import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, featuringDecisionSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

export const POST = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);

    const { decision } = parseOrThrow(featuringDecisionSchema, await req.json());

    await connectDB();
    const artistProfile = await Artist.findOne({ user: authUser.id });
    if (!artistProfile) throw new ApiError("Profil artiste introuvable.", 404);

    const song = await Song.findById(params.id);
    if (!song) throw new ApiError("Son introuvable.", 404);

    const credit = song.featuring.find((f) => f.artist.equals(artistProfile._id));
    if (!credit) throw new ApiError("Tu n'es pas crédité sur ce son.", 404);

    if (decision === "remove") {
      song.featuring = song.featuring.filter(
        (f) => !f.artist.equals(artistProfile._id)
      ) as typeof song.featuring;
    } else {
      credit.confirmed = true;
    }

    await song.save();
    return NextResponse.json({ song });
  }
);
