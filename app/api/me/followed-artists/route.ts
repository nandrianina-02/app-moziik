import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  await connectDB();
  const artists = await Artist.find({ followers: session.user.id }).select(
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
