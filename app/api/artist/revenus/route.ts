import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import Royalty from "@/models/Royalty";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  const artist = await Artist.findOne({ user: authUser.id });
  if (!artist) throw new ApiError("Profil artiste introuvable.", 404);

  const royalties = await Royalty.find({ artist: artist._id }).sort({ periodStart: -1 }).limit(90);
  const totalUSD = royalties.reduce((sum, r) => sum + r.amountUSD, 0);
  const totalPlays = royalties.reduce((sum, r) => sum + r.eligiblePlays, 0);

  return NextResponse.json({ royalties, totalUSD, totalPlays });
});
