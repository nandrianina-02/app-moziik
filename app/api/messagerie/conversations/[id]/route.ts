import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Conversation from "@/models/Conversation";
import User from "@/models/User";
import { withApiErrors, ApiError } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { parseOrThrow, majConversationSchema } from "@/lib/validation";
import {
  conversationOuvree,
  conversationActive,
  fichesUtilisateurs,
  moiDans,
  presenterConversation,
} from "@/lib/messagerieServer";
import { MEMBRES_MAX } from "@/lib/messagerie";

/**
 * Une conversation : la lire, la régler, la quitter.
 *
 * QUI PEUT QUOI
 *
 * Renommer, changer l'image, ajouter et exclure sont réservés aux
 * gestionnaires du groupe. La mise en sourdine, elle, est un réglage
 * personnel : chacun la pose sur sa propre entrée, y compris dans un
 * groupe qu'il ne gère pas.
 *
 * Un tête-à-tête n'a rien de tout cela. Il n'a ni nom, ni membres à
 * gérer, et le quitter n'aurait pas de sens : il n'y aurait plus
 * personne. Les réglages y sont donc refusés, sauf la sourdine.
 */

export const GET = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const moi = await requireAuthUser(req);
  const conv = await conversationOuvree(params.id, moi.id);
  const fiches = await fichesUtilisateurs(conv.participants.map((p) => p.user));
  return NextResponse.json({ conversation: presenterConversation(conv, moi.id, fiches) });
});

export const PATCH = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const moi = await requireAuthUser(req);
  const donnees = parseOrThrow(majConversationSchema, await req.json());
  const conv = await conversationActive(params.id, moi.id);
  await connectDB();

  // La sourdine se règle seule, avant tout contrôle de gestion : c'est le
  // seul réglage qui n'engage que celui qui le pose.
  if (typeof donnees.silencieux === "boolean") {
    await Conversation.updateOne(
      { _id: conv._id },
      { $set: { "participants.$[moi].muted": donnees.silencieux } },
      { arrayFilters: [{ "moi.user": new Types.ObjectId(moi.id) }] }
    );
  }

  const demandesDeGroupe =
    donnees.titre !== undefined ||
    donnees.coverUrl !== undefined ||
    donnees.ajouter !== undefined ||
    donnees.exclure !== undefined ||
    donnees.gestionnaire !== undefined;

  if (demandesDeGroupe) {
    if (conv.type !== "group") throw new ApiError("Cette conversation n'a pas de réglages.", 400);
    if (!moiDans(conv, moi.id)?.manager) {
      throw new ApiError("Seul un gestionnaire du groupe peut le modifier.", 403);
    }
  }

  const modifications: Record<string, unknown> = {};
  if (donnees.titre !== undefined) modifications.title = donnees.titre.trim();
  if (donnees.coverUrl !== undefined) modifications.coverUrl = donnees.coverUrl;
  if (Object.keys(modifications).length > 0) {
    await Conversation.updateOne({ _id: conv._id }, { $set: modifications });
  }

  if (donnees.ajouter?.length) {
    const actifs = conv.participants.filter((p) => !p.leftAt).length;
    // Ceux qui étaient déjà là — ou qui sont partis — ne sont pas des
    // ajouts : un revenant réactive son entrée au lieu d'en créer une
    // seconde, sinon il apparaîtrait deux fois dans la liste.
    const connus = new Set(conv.participants.map((p) => String(p.user)));
    const nouveaux = [...new Set(donnees.ajouter)].filter((id) => !connus.has(id));
    const revenants = [...new Set(donnees.ajouter)].filter((id) => {
      const p = conv.participants.find((x) => String(x.user) === id);
      return Boolean(p?.leftAt);
    });

    if (actifs + nouveaux.length + revenants.length > MEMBRES_MAX) {
      throw new ApiError(`Un groupe ne peut pas dépasser ${MEMBRES_MAX} personnes.`, 400);
    }

    if (nouveaux.length) {
      const existants = await User.countDocuments({ _id: { $in: nouveaux } });
      if (existants !== nouveaux.length) throw new ApiError("Un des comptes choisis n'existe pas.", 404);
      await Conversation.updateOne(
        { _id: conv._id },
        {
          $push: {
            participants: {
              $each: nouveaux.map((id) => ({ user: new Types.ObjectId(id), manager: false })),
            },
          },
        }
      );
    }

    for (const id of revenants) {
      await Conversation.updateOne(
        { _id: conv._id },
        {
          $unset: { "participants.$[qui].leftAt": "" },
          // Il reprend au présent : lui compter comme non lus les
          // messages échangés pendant son absence lui présenterait une
          // conversation qu'il n'a pas le droit d'avoir manquée.
          $set: { "participants.$[qui].lastReadAt": new Date(), "participants.$[qui].unread": 0 },
        },
        { arrayFilters: [{ "qui.user": new Types.ObjectId(id) }] }
      );
    }
  }

  if (donnees.exclure) {
    if (donnees.exclure === moi.id) {
      throw new ApiError("Pour sortir du groupe, utilisez « Quitter ».", 400);
    }
    await Conversation.updateOne(
      { _id: conv._id },
      { $set: { "participants.$[qui].leftAt": new Date(), "participants.$[qui].manager": false } },
      { arrayFilters: [{ "qui.user": new Types.ObjectId(donnees.exclure) }] }
    );
  }

  if (donnees.gestionnaire) {
    const cible = donnees.gestionnaire.user;
    if (!donnees.gestionnaire.actif) {
      // Un groupe sans gestionnaire ne peut plus être ni renommé ni
      // complété : personne ne pourrait rendre le droit à personne.
      const restants = conv.participants.filter(
        (p) => p.manager && !p.leftAt && String(p.user) !== cible
      ).length;
      if (restants === 0) throw new ApiError("Le groupe doit garder au moins un gestionnaire.", 400);
    }
    await Conversation.updateOne(
      { _id: conv._id },
      { $set: { "participants.$[qui].manager": donnees.gestionnaire.actif } },
      { arrayFilters: [{ "qui.user": new Types.ObjectId(cible) }] }
    );
  }

  const frais = await conversationOuvree(params.id, moi.id);
  const fiches = await fichesUtilisateurs(frais.participants.map((p) => p.user));
  return NextResponse.json({ conversation: presenterConversation(frais, moi.id, fiches) });
});

/** Quitter un groupe. L'historique reste, pour ceux qui y sont encore. */
export const DELETE = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const moi = await requireAuthUser(req);
  const conv = await conversationActive(params.id, moi.id);

  if (conv.type !== "group") {
    throw new ApiError("Une conversation à deux ne se quitte pas.", 400);
  }

  const autresGestionnaires = conv.participants.filter(
    (p) => p.manager && !p.leftAt && String(p.user) !== moi.id
  );
  const autresMembres = conv.participants.filter((p) => !p.leftAt && String(p.user) !== moi.id);

  await Conversation.updateOne(
    { _id: conv._id },
    { $set: { "participants.$[moi].leftAt": new Date(), "participants.$[moi].manager": false } },
    { arrayFilters: [{ "moi.user": new Types.ObjectId(moi.id) }] }
  );

  // Le dernier gestionnaire qui part passe la main au plus ancien membre
  // restant, plutôt que de laisser un groupe que plus personne ne peut
  // administrer.
  if (autresGestionnaires.length === 0 && autresMembres.length > 0) {
    const successeur = [...autresMembres].sort(
      (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
    )[0];
    await Conversation.updateOne(
      { _id: conv._id },
      { $set: { "participants.$[qui].manager": true } },
      { arrayFilters: [{ "qui.user": successeur.user }] }
    );
  }

  return NextResponse.json({ message: "Vous avez quitté le groupe." });
});
