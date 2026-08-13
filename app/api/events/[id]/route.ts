import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Event from "@/models/Event";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async (_req: Request, { params }: { params: { id: string } }) => {
  await connectDB();
  const event = await Event.findById(params.id).populate("artist", "stageName verified");
  if (!event) throw new ApiError("Évènement introuvable.", 404);
  return NextResponse.json({ event });
});

async function assertCanManage(event: { createdBy: { toString: () => string } }, userId: string, role?: string) {
  if (role === "admin") return;
  if (event.createdBy.toString() !== userId) {
    throw new ApiError("Tu ne peux modifier que tes propres évènements.", 403);
  }
}

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

    await connectDB();
    const event = await Event.findById(params.id);
    if (!event) throw new ApiError("Évènement introuvable.", 404);
    await assertCanManage(event, session.user.id, session.user.role);

    const updates = await req.json();
    const allowed = ["title", "description", "coverUrl", "location", "date", "ticketUrl", "price"];
    for (const key of allowed) {
      if (key in updates) {
        (event as unknown as Record<string, unknown>)[key] = updates[key];
      }
    }
    // Un admin peut aussi forcer le statut (republier un évènement rejeté, etc.)
    if (session.user.role === "admin" && updates.status) {
      event.status = updates.status;
    }

    await event.save();
    return NextResponse.json({ event });
  }
);

export const DELETE = withApiErrors(
  async (_req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

    await connectDB();
    const event = await Event.findById(params.id);
    if (!event) throw new ApiError("Évènement introuvable.", 404);
    await assertCanManage(event, session.user.id, session.user.role);

    await event.deleteOne();
    return NextResponse.json({ message: "Évènement supprimé." });
  }
);
