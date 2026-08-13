import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const POST = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

    const { decision } = await req.json(); // "confirm" | "remove"

    await connectDB();
    const artistProfile = await Artist.findOne({ user: session.user.id });
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
