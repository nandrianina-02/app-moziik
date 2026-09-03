import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";
import Conversation from "@/models/Conversation";
import { withApiErrors, ApiError } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { parseOrThrow, envoiMessageSchema } from "@/lib/validation";
import { notify } from "@/lib/notify";
import {
  conversationOuvree,
  conversationActive,
  enregistrerMessage,
  fichesUtilisateurs,
  lecteursDe,
  presenterConversation,
  presenterMessage,
  resoudrePartage,
  toucherPresence,
} from "@/lib/messagerieServer";
import { apercuMessage, LIBELLES_PARTAGE } from "@/lib/messagerie";

/**
 * Les messages d'une conversation : les lire, en écrire un.
 *
 * DEUX FAÇONS DE LIRE, ET C'EST VOULU
 *
 * `?avant=<iso>` remonte dans l'historique, page par page. `?depuis=<iso>`
 * ne rapporte que ce qui est arrivé après une date connue — c'est ce que
 * demande le rafraîchissement périodique, et il serait absurde de lui
 * renvoyer la conversation entière toutes les cinq secondes.
 *
 * Le rafraîchissement rapporte aussi les messages *modifiés* depuis cette
 * date, pas seulement les nouveaux : sans quoi une réaction posée sur une
 * bulle déjà affichée n'apparaîtrait jamais chez l'autre.
 */

const PAGE = 40;

function dateOuNull(brut: string | null): Date | null {
  if (!brut) return null;
  const d = new Date(brut);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const GET = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const moi = await requireAuthUser(req);
  const conv = await conversationOuvree(params.id, moi.id);
  toucherPresence(moi.id);

  const { searchParams } = new URL(req.url);
  const avant = dateOuNull(searchParams.get("avant"));
  const depuis = dateOuNull(searchParams.get("depuis"));

  const filtre: Record<string, unknown> = { conversation: conv._id };
  if (avant) filtre.createdAt = { $lt: avant };

  let documents;
  if (depuis) {
    // Un message est « nouveau » pour le rafraîchissement s'il vient
    // d'être écrit, mais aussi s'il a bougé depuis : réaction, correction,
    // suppression. C'est à cela que sert `touchedAt`, que posent les
    // routes qui modifient un message. Sans lui, une réaction posée sur
    // une bulle déjà affichée n'arriverait jamais chez l'autre.
    documents = await Message.find({
      conversation: conv._id,
      $or: [{ createdAt: { $gt: depuis } }, { touchedAt: { $gt: depuis } }],
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();
  } else {
    // Les plus récents d'abord pour la requête, puis remis dans l'ordre :
    // c'est la fin d'une conversation qu'on ouvre, pas son début.
    const page = await Message.find(filtre).sort({ createdAt: -1 }).limit(PAGE + 1).lean();
    documents = page.slice(0, PAGE).reverse();
    const encore = page.length > PAGE;

    const fiches = await fichesUtilisateurs([
      ...documents.map((m) => m.author),
      ...conv.participants.map((p) => p.user),
    ]);
    return NextResponse.json({
      messages: documents.map((m) => presenterMessage(m as never, fiches)),
      encore,
      lecteurs: lecteursDe(conv, moi.id),
    });
  }

  const fiches = await fichesUtilisateurs([
    ...documents.map((m) => m.author),
    ...conv.participants.map((p) => p.user),
  ]);
  return NextResponse.json({
    messages: documents.map((m) => presenterMessage(m as never, fiches)),
    encore: false,
    lecteurs: lecteursDe(conv, moi.id),
    // Qui tape en ce moment : la même réponse sert les deux, plutôt qu'un
    // second appel toutes les quatre secondes pour trois mots.
    saisie: presenterConversation(conv, moi.id, fiches).saisie ?? [],
  });
});

export const POST = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const moi = await requireAuthUser(req);
  const donnees = parseOrThrow(envoiMessageSchema, await req.json());
  const conv = await conversationActive(params.id, moi.id);
  await connectDB();

  // Le contenu partagé est relu en base, jamais recopié depuis la
  // requête : sinon une carte pourrait annoncer un morceau et pointer
  // ailleurs. Voir resoudrePartage.
  const partage = donnees.partage
    ? await resoudrePartage(donnees.partage.type, donnees.partage.refId, moi.id)
    : null;
  if (donnees.partage && !partage) {
    throw new ApiError("Ce contenu n'existe plus, ou n'est pas partageable.", 404);
  }

  let citation;
  if (donnees.repondA) {
    const cite = await Message.findOne({ _id: donnees.repondA, conversation: conv._id }).lean();
    if (!cite) throw new ApiError("Le message auquel vous répondez n'existe plus.", 404);
    const fichesCite = await fichesUtilisateurs([cite.author]);
    citation = {
      messageId: new Types.ObjectId(donnees.repondA),
      auteurNom: fichesCite.get(String(cite.author))?.name ?? "Membre",
      extrait: apercuMessage(cite.deletedAt ? "" : cite.body, cite.partage).slice(0, 140),
    };
  }

  const message = await enregistrerMessage(conv, moi.id, {
    corps: donnees.corps.trim(),
    partage,
    pieces: donnees.pieces,
    citation,
  });

  // Écrire, c'est cesser d'être « en train d'écrire ». Sans cette ligne,
  // l'indicateur resterait allumé chez les autres pendant six secondes
  // après l'arrivée du message qu'il annonçait.
  await Conversation.updateOne(
    { _id: conv._id },
    { $unset: { "participants.$[moi].typingAt": "" } },
    { arrayFilters: [{ "moi.user": new Types.ObjectId(moi.id) }] }
  );

  // Prévenir ceux qui ne sont ni l'auteur, ni partis, ni en sourdine. La
  // notification est écrite après le message et hors de son chemin
  // d'erreur : un envoi ne doit pas échouer parce qu'une notification n'a
  // pas pu partir.
  const fiches = await fichesUtilisateurs([...conv.participants.map((p) => p.user)]);
  const monNom = fiches.get(moi.id)?.name ?? "Un membre";
  const destinataires = conv.participants
    .filter((p) => !p.leftAt && !p.muted && String(p.user) !== moi.id)
    .map((p) => String(p.user));

  if (destinataires.length > 0) {
    const resume = partage
      ? `${LIBELLES_PARTAGE[partage.type]} · ${partage.titre}`
      : donnees.corps.trim().slice(0, 120) ||
        (donnees.pieces[0]?.type === "image" ? "Photo" : "Message vocal");
    void Promise.all(
      destinataires.map((id) =>
        notify({
          recipient: id,
          type: "message",
          title: conv.type === "group" ? `${monNom} — ${conv.title ?? "Groupe"}` : monNom,
          message: resume,
          link: `/messages?c=${String(conv._id)}`,
          imageUrl: fiches.get(moi.id)?.avatarUrl,
        })
      )
    ).catch(() => {
      /* le message est parti ; la notification n'est pas critique */
    });
  }

  return NextResponse.json(
    { message: presenterMessage(message as never, fiches) },
    { status: 201 }
  );
});
