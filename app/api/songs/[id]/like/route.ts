import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import { notify } from "@/lib/notify";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(
  async (_req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ liked: false });

    await connectDB();
    const user = await User.findById(session.user.id).select("likedSongs");
    const liked = !!user?.likedSongs.some((id) => id.toString() === params.id);

    return NextResponse.json({ liked });
  }
);

export const POST = withApiErrors(
  async (_req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

    await connectDB();
    const song = await Song.findById(params.id).select("_id");
    if (!song) throw new ApiError("Son introuvable.", 404);

    // Mise à jour atomique et conditionnelle : `$pull` ne modifie le
    // document que si l'id était présent dans le tableau, ce qui permet
    // de savoir de façon fiable si on vient de retirer ou d'ajouter le
    // like sans avoir à relire puis réécrire l'état (évite la course
    // entre deux requêtes concurrentes sur le même utilisateur).
    const removed = await User.findOneAndUpdate(
      { _id: session.user.id, likedSongs: song._id },
      { $pull: { likedSongs: song._id } }
    ).select("_id");

    const nowLiked = !removed;
    if (nowLiked) {
      await User.updateOne(
        { _id: session.user.id },
        { $addToSet: { likedSongs: song._id } }
      );
    }

    const updatedSong = await Song.findByIdAndUpdate(
      song._id,
      { $inc: { likesCount: nowLiked ? 1 : -1 } },
      { new: true }
    ).select("likesCount coverUrl title artist");

    // Notifie l'artiste propriétaire du morceau (jamais lui-même).
    if (nowLiked && updatedSong) {
      const artist = await Artist.findById(updatedSong.artist).select("user stageName");
      if (artist && artist.user.toString() !== session.user.id) {
        const liker = await User.findById(session.user.id).select("name avatarUrl");
        await notify({
          recipient: artist.user.toString(),
          type: "like",
          title: `${liker?.name ?? "Quelqu'un"} a aimé votre morceau`,
          message: updatedSong.title,
          link: `/son/${updatedSong._id}`,
          imageUrl: updatedSong.coverUrl,
        });
      }
    }

    return NextResponse.json({
      liked: nowLiked,
      likesCount: Math.max(0, updatedSong?.likesCount ?? 0),
    });
  }
);
