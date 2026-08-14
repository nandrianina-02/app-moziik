import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import User from "@/models/User";
import { notify } from "@/lib/notify";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

export const POST = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);
    const userId = authUser.id;

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
