import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import Song from "@/models/Song";

/**
 * Ce qui se dessine, si rien ne change.
 *
 * TOUT LE FICHIER TIENT DANS CETTE RÉSERVE
 *
 * Une prévision d'audience n'est pas une prédiction : c'est le
 * prolongement d'une droite. Elle suppose que la semaine prochaine
 * ressemblera aux précédentes — ce qui est faux dès qu'un artiste connu
 * publie, qu'une panne survient ou qu'une campagne démarre. Elle vaut
 * comme repère, jamais comme promesse, et tout ici est fait pour que
 * cette limite reste visible plutôt que d'être noyée dans un chiffre net.
 *
 * D'où trois partis pris :
 *
 * 1. **Une fourchette, jamais un nombre seul.** Un « 4 812 écoutes la
 *    semaine prochaine » se retient et se cite ; un « entre 3 900 et
 *    5 700 » dit ce qu'on sait réellement.
 *
 * 2. **Un refus explicite quand l'historique est trop court.** Sous
 *    quatre semaines, une droite passe par n'importe quoi. On rend
 *    `null` et l'écran affiche « pas assez d'historique » — ce qui est
 *    une information, contrairement à un chiffre inventé.
 *
 * 3. **Aucun modèle de langue n'approche ces nombres.** Ils sont
 *    calculés ici et affichés tels quels ; l'IA n'a le droit que de les
 *    commenter (voir lib/ai/analyst.ts).
 */

const SEMAINE_MS = 7 * 86_400_000;
/** En deçà, on ne prolonge rien. */
const SEMAINES_MIN = 4;

export type PrevisionAudience = {
  /** Totaux hebdomadaires observés, du plus ancien au plus récent. */
  historique: number[];
  /** Estimation centrale pour la semaine à venir. */
  estimation: number;
  /** Fourchette, bornée à zéro. */
  bas: number;
  haut: number;
  /** Sens du mouvement, en écoutes par semaine. */
  penteHebdo: number;
};

/** Régression linéaire simple sur des points régulièrement espacés. */
function droite(valeurs: number[]): { pente: number; ordonnee: number } {
  const n = valeurs.length;
  const moyenneX = (n - 1) / 2;
  const moyenneY = valeurs.reduce((s, v) => s + v, 0) / n;

  let numerateur = 0;
  let denominateur = 0;
  for (let i = 0; i < n; i++) {
    numerateur += (i - moyenneX) * (valeurs[i] - moyenneY);
    denominateur += (i - moyenneX) ** 2;
  }
  const pente = denominateur === 0 ? 0 : numerateur / denominateur;
  return { pente, ordonnee: moyenneY - pente * moyenneX };
}

/**
 * Prolonge l'audience d'une semaine.
 *
 * Rend `null` quand l'historique ne le permet pas — c'est le cas normal
 * sur une plateforme qui démarre, et il doit se dire.
 */
export async function previsionAudience(semaines = 8): Promise<PrevisionAudience | null> {
  await connectDB();

  const depuis = new Date(Date.now() - semaines * SEMAINE_MS);
  const lignes = await Play.aggregate<{ _id: number; n: number }>([
    { $match: { playedAt: { $gte: depuis } } },
    {
      $group: {
        _id: { $floor: { $divide: [{ $subtract: ["$playedAt", new Date(0)] }, SEMAINE_MS] } },
        n: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // La semaine en cours est incomplète : la prolonger tirerait la droite
  // vers le bas et annoncerait un effondrement qui n'est qu'un calendrier.
  const semaineCourante = Math.floor(Date.now() / SEMAINE_MS);
  const completes = lignes.filter((l) => l._id < semaineCourante);
  if (completes.length < SEMAINES_MIN) return null;

  const historique = completes.map((l) => l.n);
  const { pente, ordonnee } = droite(historique);
  const n = historique.length;
  const estimation = Math.max(0, Math.round(ordonnee + pente * n));

  // Fourchette bâtie sur la dispersion réelle autour de la droite, pas
  // sur un pourcentage arbitraire : une audience régulière donne une
  // fourchette étroite, une audience erratique une fourchette large —
  // ce qui est exactement l'information utile.
  const residus = historique.map((v, i) => v - (ordonnee + pente * i));
  const ecart = Math.sqrt(residus.reduce((s, r) => s + r * r, 0) / n);

  return {
    historique,
    estimation,
    bas: Math.max(0, Math.round(estimation - 1.5 * ecart)),
    haut: Math.round(estimation + 1.5 * ecart),
    penteHebdo: Math.round(pente),
  };
}

export type TitreQuiMonte = {
  id: string;
  titre: string;
  artiste: string;
  /** Écoutes des trois dernières semaines, de la plus ancienne à la plus récente. */
  trajectoire: number[];
};

/** En deçà, la trajectoire n'est qu'une poignée d'écoutes. */
const ECOUTES_MIN = 15;

/**
 * Titres dont l'écoute progresse trois semaines de suite.
 *
 * C'est le seul « signal de contenu à venir » qu'on puisse tirer
 * honnêtement des données : une progression continue, pas une prédiction
 * de succès. Trois semaines consécutives plutôt que deux, parce que deux
 * points ne distinguent pas une tendance d'un soubresaut.
 */
export async function titresQuiMontent(limite = 5): Promise<TitreQuiMonte[]> {
  await connectDB();

  const depuis = new Date(Date.now() - 3 * SEMAINE_MS);
  const lignes = await Play.aggregate<{ _id: { song: Types.ObjectId; semaine: number }; n: number }>([
    { $match: { playedAt: { $gte: depuis } } },
    {
      $group: {
        _id: {
          song: "$song",
          semaine: { $floor: { $divide: [{ $subtract: ["$playedAt", new Date(0)] }, SEMAINE_MS] } },
        },
        n: { $sum: 1 },
      },
    },
  ]);

  const semaineCourante = Math.floor(Date.now() / SEMAINE_MS);
  const parTitre = new Map<string, number[]>();
  for (const l of lignes) {
    const decalage = semaineCourante - l._id.semaine;
    // 1 = la semaine dernière, 3 = il y a trois semaines. La semaine en
    // cours est écartée : incomplète, elle paraîtrait toujours en baisse.
    if (decalage < 1 || decalage > 3) continue;
    const cle = String(l._id.song);
    const serie = parTitre.get(cle) ?? [0, 0, 0];
    serie[3 - decalage] = l.n;
    parTitre.set(cle, serie);
  }

  const montants = [...parTitre.entries()]
    .filter(([, s]) => s[0] < s[1] && s[1] < s[2] && s[2] >= ECOUTES_MIN)
    .sort((a, b) => b[1][2] - a[1][2])
    .slice(0, limite);

  if (montants.length === 0) return [];

  const titres = await Song.find({ _id: { $in: montants.map(([id]) => new Types.ObjectId(id)) } })
    .select("title")
    .populate("artist", "stageName");
  const parId = new Map(
    titres.map((s) => [
      s._id.toString(),
      { titre: s.title, artiste: (s.artist as unknown as { stageName?: string })?.stageName ?? "" },
    ])
  );

  return montants.map(([id, trajectoire]) => ({
    id,
    titre: parId.get(id)?.titre ?? "Titre supprimé",
    artiste: parId.get(id)?.artiste ?? "",
    trajectoire,
  }));
}
