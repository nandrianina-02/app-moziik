import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Event from "@/models/Event";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const POST = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const session = await requireAdmin();

    const { decision } = await req.json();
    if (!["approve", "reject"].includes(decision)) {
      throw new ApiError("Décision invalide.");
    }

    await connectDB();
    const event = await Event.findById(params.id);
    if (!event) throw new ApiError("Évènement introuvable.", 404);

    event.status = decision === "approve" ? "published" : "rejected";
    event.approvedBy = new Types.ObjectId(session.user.id);
    await event.save();

    return NextResponse.json({ event });
  }
);
