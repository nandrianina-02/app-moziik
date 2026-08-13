import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import Royalty from "@/models/Royalty";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  await connectDB();
  const artist = await Artist.findOne({ user: session.user.id });
  if (!artist) throw new ApiError("Profil artiste introuvable.", 404);

  const royalties = await Royalty.find({ artist: artist._id }).sort({ periodStart: -1 }).limit(90);
  const totalUSD = royalties.reduce((sum, r) => sum + r.amountUSD, 0);
  const totalPlays = royalties.reduce((sum, r) => sum + r.eligiblePlays, 0);

  return NextResponse.json({ royalties, totalUSD, totalPlays });
});
