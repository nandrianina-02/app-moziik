import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Event from "@/models/Event";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, patchEventSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

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
    const authUser = await requireAuthUser(req);

    await connectDB();
    const event = await Event.findById(params.id);
    if (!event) throw new ApiError("Évènement introuvable.", 404);
    await assertCanManage(event, authUser.id, authUser.role);

    const parsedUpdates = parseOrThrow(patchEventSchema, await req.json());
    const updates = parsedUpdates as Record<string, unknown>;
    const allowed = ["title", "description", "coverUrl", "location", "date", "ticketUrl", "price"];
    for (const key of allowed) {
      if (key in updates) {
        (event as unknown as Record<string, unknown>)[key] = updates[key];
      }
    }
    // Un admin peut aussi forcer le statut (republier un évènement rejeté, etc.)
    if (authUser.role === "admin" && parsedUpdates.status) {
      event.status = parsedUpdates.status;
    }

    await event.save();
    return NextResponse.json({ event });
  }
);

export const DELETE = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);

    await connectDB();
    const event = await Event.findById(params.id);
    if (!event) throw new ApiError("Évènement introuvable.", 404);
    await assertCanManage(event, authUser.id, authUser.role);

    await event.deleteOne();
    return NextResponse.json({ message: "Évènement supprimé." });
  }
);
