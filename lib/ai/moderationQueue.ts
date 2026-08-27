import Comment from "@/models/Comment";
import { connectDB } from "@/lib/db";
import { etatIA } from "@/lib/ai/client";
import { classerCommentaires, PAR_LOT, type CommentaireAClasser } from "@/lib/ai/moderation";

/**
 * Vidage de la file de relecture.
 *
 * Les commentaires ne sont pas relus à l'envoi mais par lots, ensuite.
 * Trois raisons, dans cet ordre :
 *
 * 1. **La latence.** Un appel au modèle prend une à deux secondes.
 *    Publier un commentaire ne doit pas attendre ça.
 * 2. **Le coût.** Un lot de dix partage les mêmes consignes, écrites une
 *    seule fois au lieu de dix.
 * 3. **Rien n'est masqué.** Puisque la relecture ne fait que signaler, un
 *    décalage de quelques minutes ne laisse rien passer qui aurait été
 *    bloqué autrement — il retarde seulement l'apparition dans la liste
 *    de l'équipe.
 *
 * La file est déclenchée par le cron, et par l'ouverture de la page de
 * modération : c'est là que le retard se verrait, autant le rattraper au
 * moment où quelqu'un regarde.
 *
 * Un commentaire déjà relu ne l'est jamais deux fois : c'est l'absence de
 * `moderatedAt` qui définit la file.
 */

/** Un vidage borné : le suivant reprendra le reste. */
export const LOTS_PAR_VIDAGE = 3;

export type ResultatVidage = {
  relus: number;
  signales: number;
  /** Ce qui reste en attente après ce passage. */
  restants: number;
  /** Pourquoi rien n'a été fait, le cas échéant. */
  raison?: "indisponible" | "rien";
};

export async function viderLaFile({
  compte,
  lots = LOTS_PAR_VIDAGE,
}: {
  compte: string;
  lots?: number;
}): Promise<ResultatVidage> {
  await connectDB();

  const etat = await etatIA("moderation");
  if (!etat.disponible) {
    const restants = await Comment.countDocuments({ moderatedAt: { $exists: false } });
    return { relus: 0, signales: 0, restants, raison: "indisponible" };
  }

  let relus = 0;
  let signales = 0;

  for (let tour = 0; tour < lots; tour++) {
    const enAttente = await Comment.find({ moderatedAt: { $exists: false } })
      .select("text")
      .sort({ createdAt: -1 })
      .limit(PAR_LOT)
      .lean();
    if (enAttente.length === 0) break;

    const lot: CommentaireAClasser[] = enAttente.map((c) => ({ id: String(c._id), texte: c.text ?? "" }));
    const verdicts = await classerCommentaires(lot, compte);

    // Un commentaire que le modèle a oublié reste sans `moderatedAt` : il
    // repassera au tour suivant. Le marquer relu sur la foi d'une absence
    // de verdict reviendrait à l'innocenter sans l'avoir lu.
    if (verdicts.length === 0) break;

    const maintenant = new Date();
    await Comment.bulkWrite(
      verdicts.map((v) => {
        const commun = {
          sentiment: v.sentiment,
          sentimentScore: v.score,
          moderatedAt: maintenant,
          flagged: v.signaler,
        };
        // `$set` et `$unset` ne peuvent pas viser le même champ dans une
        // même mise à jour — MongoDB refuse le document entier. D'où deux
        // formes distinctes plutôt qu'un objet à trous.
        return {
          updateOne: {
            filter: { _id: v.id },
            update: v.signaler
              ? { $set: { ...commun, flagLabels: v.motifs, flagNote: v.note.slice(0, 300) } }
              : { $set: commun, $unset: { flagLabels: 1, flagNote: 1 } },
          },
        };
      })
    );

    relus += verdicts.length;
    signales += verdicts.filter((v) => v.signaler).length;

    // Lot incomplet : la file est vide, inutile de retourner voir.
    if (enAttente.length < PAR_LOT) break;
  }

  const restants = await Comment.countDocuments({ moderatedAt: { $exists: false } });
  return { relus, signales, restants, ...(relus === 0 ? { raison: "rien" as const } : {}) };
}
