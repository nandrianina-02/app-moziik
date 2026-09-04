import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SupportThread from "@/models/SupportThread";
import SupportMessage from "@/models/SupportMessage";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { getSiteConfig } from "@/lib/siteConfig";
import { etatIA } from "@/lib/ai/client";
import { reponseDuSupport, type EchangeSupport } from "@/lib/ai/support";

/**
 * Réponse de l'assistant au dernier message du membre.
 *
 * Appelée par le panneau de discussion juste après l'envoi, et non depuis
 * l'envoi lui-même : la réponse du modèle prend quelques secondes, et
 * faire attendre l'enregistrement du message derrière elle donnerait
 * l'impression que le chat rame. Ici le message est déjà en base ; si
 * cette route n'aboutit pas, le fil reste simplement en attente de
 * l'équipe, comme avant l'IA.
 *
 * L'assistant se retire définitivement d'un fil dès que quelqu'un demande
 * un humain, ou dès qu'il reconnaît lui-même qu'il ne sait pas.
 */
export const dynamic = "force-dynamic";

/** Contexte remonté au modèle : de quoi suivre l'échange, pas tout l'historique. */
const ECHANGES_MAX = 10;

const NOM_ASSISTANT = "Assistant";
const SANS_CACHE = { "Cache-Control": "no-store" };

export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  const thread = await SupportThread.findOne({ user: authUser.id });
  if (!thread) return NextResponse.json({ assistant: false }, { headers: SANS_CACHE });

  // Quelqu'un a demandé l'équipe : l'assistant n'a plus rien à faire ici.
  if (thread.humanRequested) return NextResponse.json({ assistant: false }, { headers: SANS_CACHE });

  // Indisponible (clé absente, réglage coupé, plafond atteint) : ce n'est
  // pas une erreur du point de vue du chat, c'est un chat sans assistant.
  const etat = await etatIA("chat");
  if (!etat.disponible) return NextResponse.json({ assistant: false }, { headers: SANS_CACHE });

  const derniers = await SupportMessage.find({ thread: thread._id })
    .sort({ createdAt: -1 })
    .limit(ECHANGES_MAX)
    .lean();
  const historiqueComplet = derniers.reverse();
  const dernier = historiqueComplet[historiqueComplet.length - 1];

  // Rien à répondre : le fil est vide, ou c'est déjà l'équipe ou
  // l'assistant qui a le dernier mot.
  if (!dernier || dernier.author !== "user") {
    return NextResponse.json({ assistant: false }, { headers: SANS_CACHE });
  }

  // Réservation atomique : deux onglets ouverts sur le même fil ne
  // produiront pas deux réponses à la même question.
  const reserve = await SupportThread.findOneAndUpdate(
    { _id: thread._id, aiAnsweredMessage: { $ne: dernier._id } },
    { $set: { aiAnsweredMessage: dernier._id } },
    { new: true }
  );
  if (!reserve) return NextResponse.json({ assistant: false }, { headers: SANS_CACHE });

  const config = await getSiteConfig();

  let resultat;
  try {
    resultat = await reponseDuSupport({
      question: dernier.body,
      historique: historiqueComplet.slice(0, -1).map(
        (m): EchangeSupport => ({
          role: m.author === "user" ? "user" : "assistant",
          content: m.body,
        })
      ),
      siteName: config.siteName,
      compte: authUser.id,
      destinataire: "membre",
      // Ici l'appelant et la personne concernée sont la même : c'est le
      // membre qui écrit dans son propre fil.
      utilisateur: authUser.id,
    });
  } catch (err) {
    // La réservation est relâchée : sans cela, un incident passager
    // ferait passer la question à côté de l'assistant pour de bon.
    await SupportThread.updateOne({ _id: thread._id }, { $unset: { aiAnsweredMessage: 1 } });
    throw err;
  }

  const corps = resultat.liens.length
    ? `${resultat.reponse}\n\n${resultat.liens.map((l) => `→ ${l.titre} : /aide/${l.slug}`).join("\n")}`
    : resultat.reponse;

  const message = await SupportMessage.create({
    thread: thread._id,
    author: "ai",
    authorName: NOM_ASSISTANT,
    body: corps.slice(0, 4000),
  });

  // `unreadForAdmin` n'est pas remis à zéro : l'équipe doit voir le fil
  // même quand l'assistant a répondu, sans quoi une mauvaise réponse
  // passerait inaperçue. C'est le sens de « l'humain reprend la main ».
  await SupportThread.updateOne(
    { _id: thread._id },
    {
      $set: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: corps.replace(/\s+/g, " ").slice(0, 120),
        lastMessageFrom: "ai",
        aiRepliedAt: new Date(),
        ...(resultat.escalade ? { humanRequested: true } : {}),
      },
    }
  );

  return NextResponse.json(
    { assistant: true, message, escalade: resultat.escalade },
    { status: 201, headers: SANS_CACHE }
  );
});
