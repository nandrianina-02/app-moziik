import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import User from "@/models/User";
import { notify } from "@/lib/notify";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const POST = withApiErrors(
  async (_req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);
    const userId = session.user.id;

    await connectDB();
    const artist = await Artist.findById(params.id);
    if (!artist) throw new ApiError("Artiste introuvable.", 404);

    const alreadyFollowing = artist.followers.some((id) => id.toString() === userId);

    if (alreadyFollowing) {
      artist.followers = artist.followers.filter(
        (id) => id.toString() !== userId
      ) as typeof artist.followers;
    } else {
      artist.followers.push(new Types.ObjectId(userId));
    }

    await artist.save();

    // Notifie l'artiste d'un nouvel abonné (jamais lui-même).
    if (!alreadyFollowing && artist.user.toString() !== userId) {
      const follower = await User.findById(userId).select("name avatarUrl");
      await notify({
        recipient: artist.user.toString(),
        type: "new_follower",
        title: `${follower?.name ?? "Quelqu'un"} s'est abonné à votre profil`,
        message: `Vous comptez maintenant ${artist.followers.length} abonné(s).`,
        link: "/artiste/gestion",
        imageUrl: follower?.avatarUrl,
      });
    }

    return NextResponse.json({ following: !alreadyFollowing, followersCount: artist.followers.length });
  }
);
