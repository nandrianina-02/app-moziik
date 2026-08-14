import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  const artists = await Artist.find({ followers: authUser.id }).select(
    "stageName verified coverUrl followers"
  );

  return NextResponse.json({
    artists: artists.map((artist) => ({
      _id: artist._id,
      stageName: artist.stageName,
      verified: artist.verified,
      coverUrl: artist.coverUrl,
      followersCount: artist.followers.length,
    })),
  });
});
