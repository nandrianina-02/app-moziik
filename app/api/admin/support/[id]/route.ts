import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import SupportThread from "@/models/SupportThread";
import SupportMessage from "@/models/SupportMessage";
import User from "@/models/User";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, supportMessageSchema, supportThreadPatchSchema } from "@/lib/validation";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

const SANS_CACHE = { "Cache-Control": "no-store" };
const APERCU_MAX = 120;

function idValide(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError("Identifiant de discussion invalide.");
}

/** Un fil et ses messages. La consultation vaut lecture côté équipe. */
export const GET = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  idValide(params.id);

  const { searchParams } = new URL(req.url);
  const after = searchParams.get("after");

  await connectDB();

  const thread = await SupportThread.findById(params.id).populate("user", "name email avatarUrl");
  if (!thread) throw new ApiError("Discussion introuvable.", 404);

  const query: Record<string, unknown> = { thread: thread._id };
  const depuis = after ? new Date(after) : null;
  if (depuis && !Number.isNaN(depuis.getTime())) query.createdAt = { $gt: depuis };

  const messages = await SupportMessage.find(query).sort({ createdAt: 1 }).limit(300);

  if (thread.unreadForAdmin > 0) {
    thread.unreadForAdmin = 0;
    await thread.save();
  }

  return NextResponse.json({ thread, messages }, { headers: SANS_CACHE });
});

/** Réponse de l'équipe. */
export const POST = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  const { user: admin } = await requireAdmin(req);
  idValide(params.id);

  const { body } = parseOrThrow(supportMessageSchema, await req.json());

  await connectDB();

  const thread = await SupportThread.findById(params.id);
  if (!thread) throw new ApiError("Discussion introuvable.", 404);

  const compte = await User.findById(admin.id).select("name");
  const message = await SupportMessage.create({
    thread: thread._id,
    author: "admin",
    authorUser: admin.id,
    authorName: compte?.name ?? "Support",
    body,
  });

  thread.lastMessageAt = new Date();
  thread.lastMessagePreview = body.replace(/\s+/g, " ").slice(0, APERCU_MAX);
  thread.lastMessageFrom = "admin";
  thread.unreadForUser += 1;
  // Répondre rouvre un fil clos : sinon la réponse partirait dans une
  // discussion que le membre voit comme terminée.
  thread.status = "open";
  await thread.save();

  // La notification est le seul moyen pour le membre d'apprendre la
  // réponse s'il n'a pas la page ouverte. Elle ne doit pas faire échouer
  // l'envoi : le message, lui, est déjà enregistré.
  try {
    await notify({
      recipient: String(thread.user),
      type: "system",
      title: "Réponse du support",
      message: thread.lastMessagePreview,
      link: "/contact",
    });
  } catch (err) {
    console.error("Notification de réponse support non envoyée :", err);
  }

  return NextResponse.json({ message }, { status: 201 });
});

/** Clore ou rouvrir une discussion. */
export const PATCH = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  idValide(params.id);

  const { status } = parseOrThrow(supportThreadPatchSchema, await req.json());

  await connectDB();
  const thread = await SupportThread.findByIdAndUpdate(params.id, { status }, { new: true });
  if (!thread) throw new ApiError("Discussion introuvable.", 404);

  return NextResponse.json({ thread });
});
