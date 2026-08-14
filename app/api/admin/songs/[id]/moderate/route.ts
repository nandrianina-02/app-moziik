import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, moderateDecisionSchema } from "@/lib/validation";

export const POST = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const session = await requireAdmin(req);

    const { decision } = parseOrThrow(moderateDecisionSchema, await req.json());

    await connectDB();
    const song = await Song.findById(params.id);
    if (!song) throw new ApiError("Son introuvable.", 404);

    if (decision === "approve") {
      song.status = song.releaseDate <= new Date() ? "published" : "scheduled";
    } else {
      song.status = "rejected";
    }
    song.approvedBy = new Types.ObjectId(session.user.id);
    await song.save();

    return NextResponse.json({ song });
  }
);
