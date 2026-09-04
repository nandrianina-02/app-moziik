import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import SupportThread from "@/models/SupportThread";
import SupportMessage from "@/models/SupportMessage";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { getSiteConfig } from "@/lib/siteConfig";
import { reponseDuSupport, type EchangeSupport } from "@/lib/ai/support";

/**
 * Brouillon de réponse pour l'équipe.
 *
 * Rien n'est enregistré ni envoyé : la réponse revient dans le champ de
 * saisie de l'administration, où elle se corrige et s'envoie comme un
 * message écrit à la main. C'est ce qui distingue cette route de
 * /api/support/assist, qui répond au membre.
 *
 * Un POST plutôt qu'un GET, bien que rien ne change en base : l'appel
 * coûte de l'argent et compte dans le plafond du jour. Un GET serait
 * rejoué par un préchargement de navigateur ou une reprise de connexion.
 */
export const dynamic = "force-dynamic";

/** Contexte remonté au modèle : de quoi suivre l'échange, pas tout l'historique. */
const ECHANGES_MAX = 12;

export const POST = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const { user: admin } = await requireAdmin(req);
  if (!mongoose.Types.ObjectId.isValid(params.id)) throw new ApiError("Identifiant de discussion invalide.");

  await connectDB();
  const thread = await SupportThread.findById(params.id);
  if (!thread) throw new ApiError("Discussion introuvable.", 404);

  const derniers = await SupportMessage.find({ thread: thread._id })
    .sort({ createdAt: -1 })
    .limit(ECHANGES_MAX)
    .lean();
  const historique = derniers.reverse();

  // On répond à la dernière question du membre, même si l'assistant a
  // parlé après lui : l'équipe demande une suggestion précisément quand
  // ce qui a déjà été répondu ne convient pas.
  const derniereQuestion = [...historique].reverse().find((m) => m.author === "user");
  if (!derniereQuestion) throw new ApiError("Cette discussion ne contient aucune question à traiter.", 400);

  const config = await getSiteConfig();
  const resultat = await reponseDuSupport({
    question: derniereQuestion.body,
    historique: historique
      .filter((m) => m._id.toString() !== derniereQuestion._id.toString())
      .map((m): EchangeSupport => ({ role: m.author === "user" ? "user" : "assistant", content: m.body })),
    siteName: config.siteName,
    compte: admin.id,
    destinataire: "equipe",
    // L'appelant est l'administrateur, mais le contexte qui éclaire la
    // question est celui du membre dont on lit le fil.
    utilisateur: String(thread.user),
  });

  const brouillon = resultat.liens.length
    ? `${resultat.reponse}\n\n${resultat.liens.map((l) => `→ ${l.titre} : /aide/${l.slug}`).join("\n")}`
    : resultat.reponse;

  return NextResponse.json(
    {
      brouillon,
      // Vrai quand le centre d'aide ne couvre pas la question : la réponse
      // demande alors une décision, et l'équipe doit le savoir avant de
      // relire un texte qui a l'air sûr de lui.
      incomplet: resultat.escalade,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});
