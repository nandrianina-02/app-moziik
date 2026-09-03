import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { parseOrThrow, assistantSchema } from "@/lib/validation";
import { universDeLaRequete } from "@/lib/universServer";
import { etatIA } from "@/lib/ai/client";
import { construireVivier, repondre, TOURS_CONTEXTE } from "@/lib/ai/assistantEcoute";
import {
  enregistrerMessage,
  fichesUtilisateurs,
  presenterConversation,
  presenterMessage,
  resoudrePartage,
} from "@/lib/messagerieServer";
import { NOM_ASSISTANT } from "@/lib/messagerie";

/**
 * Le fil avec l'assistant d'écoute.
 *
 * UN FIL, PAS UN FORMULAIRE
 *
 * L'assistant vit dans la messagerie, avec les mêmes bulles et les mêmes
 * cartes que les conversations entre personnes. Un panneau à part aurait
 * demandé son propre historique, son propre affichage de cartes et sa
 * propre pagination — trois copies d'un code qui existe déjà, pour un
 * résultat que l'auditeur aurait vécu comme un outil, pas comme quelqu'un
 * à qui l'on parle.
 *
 * IL Y A UN SEUL FIL PAR COMPTE
 *
 * Créé au premier message. Le retrouver ou le créer se fait en une seule
 * écriture, comme les tête-à-tête : deux onglets ouverts en même temps ne
 * doivent pas donner deux assistants.
 *
 * DEUX MESSAGES SONT ÉCRITS, ET LE PREMIER RESTE
 *
 * La question de la personne est enregistrée avant l'appel au modèle. Si
 * le modèle échoue, sa question reste dans le fil — elle a été posée, et
 * la faire disparaître donnerait à croire qu'elle n'a jamais été envoyée.
 */

export const GET = withApiErrors(async (req: Request) => {
  const moi = await requireAuthUser(req);
  const conv = await filAssistant(moi.id);
  const fiches = await fichesUtilisateurs([new Types.ObjectId(moi.id)]);
  const etat = await etatIA("assistant");

  return NextResponse.json({
    conversation: presenterConversation(conv as never, moi.id, fiches),
    // L'écran doit pouvoir dire « indisponible » plutôt que laisser
    // écrire dans le vide : sans clé ou au-delà du plafond, l'assistant
    // ne répondra pas, et mieux vaut l'annoncer avant la question.
    disponible: etat.disponible,
  });
});

export const POST = withApiErrors(async (req: Request) => {
  const moi = await requireAuthUser(req);
  const { demande } = parseOrThrow(assistantSchema, await req.json());
  const univers = await universDeLaRequete(req, { compte: moi.id });

  const conv = await filAssistant(moi.id);
  const fiches = await fichesUtilisateurs([new Types.ObjectId(moi.id)]);

  // La question d'abord : elle appartient à la personne, pas au succès de
  // l'appel qui suit.
  const question = await enregistrerMessage(conv as never, moi.id, { corps: demande });

  const derniers = await Message.find({ conversation: conv._id })
    .sort({ createdAt: -1 })
    .limit(TOURS_CONTEXTE + 1)
    .select("role body")
    .lean();

  const historique = derniers
    .reverse()
    // La question qu'on vient d'écrire est passée séparément : la laisser
    // ici la ferait lire deux fois.
    .filter((m) => String(m._id) !== String(question._id))
    .map((m) => ({ role: (m.role ?? "membre") as "membre" | "assistant", texte: m.body ?? "" }))
    .filter((t) => t.texte);

  const vivier = await construireVivier(demande, univers);
  const verdict = await repondre({ demande, historique, vivier, compte: moi.id });

  // Le contenu désigné est relu en base avant d'entrer dans la carte,
  // comme tout partage : le vivier vient du serveur, mais la carte doit
  // porter le titre et l'image d'aujourd'hui, pas ceux du vivier.
  const partage = verdict.choisi
    ? await resoudrePartage(verdict.choisi.type, verdict.choisi.refId, moi.id)
    : null;

  const reponse = await enregistrerMessage(conv as never, moi.id, {
    corps: verdict.texte,
    partage,
    role: "assistant",
  });

  return NextResponse.json({
    question: presenterMessage(question as never, fiches),
    reponse: presenterMessage(reponse as never, fiches),
    // « lancer » n'est vrai que si la carte existe vraiment : sans elle,
    // le client n'aurait rien à démarrer.
    lancer: Boolean(partage) && verdict.lancer,
  });
});

/** Retrouve le fil de l'assistant, ou le crée. Une seule écriture. */
async function filAssistant(userId: string) {
  await connectDB();
  const conv = await Conversation.findOneAndUpdate(
    { type: "assistant", "participants.user": new Types.ObjectId(userId) },
    {
      $setOnInsert: {
        type: "assistant",
        title: NOM_ASSISTANT,
        createdBy: new Types.ObjectId(userId),
        lastMessageAt: new Date(),
        lastMessagePreview: "",
        participants: [{ user: new Types.ObjectId(userId), manager: true }],
      },
    },
    { upsert: true, new: true }
  );
  return conv!;
}
