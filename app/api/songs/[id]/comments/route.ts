import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Comment from "@/models/Comment";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import User from "@/models/User";
import { analyzeSentiment } from "@/lib/sentiment";
import { notify } from "@/lib/notify";
import { withApiErrors } from "@/lib/apiError";
import { parseOrThrow, createCommentSchema } from "@/lib/validation";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (_req: Request, { params }: { params: { id: string } }) => {
  await connectDB();
  const comments = await Comment.find({ song: params.id })
    .populate("user", "name avatarUrl")
    .sort({ createdAt: -1 });
  return NextResponse.json({ comments });
});

export const POST = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);

    // Un compte, même légitime, ne devrait jamais avoir besoin de poster
    // plus de quelques commentaires par minute — protège contre le spam.
    checkRateLimitByIp("song-comment", { limit: 10, windowMs: 60 * 1000 });

    const { text, timestampInSong, parentComment } = parseOrThrow(createCommentSchema, await req.json());

    const { sentiment, score } = analyzeSentiment(text);

    await connectDB();
    const comment = await Comment.create({
      song: params.id,
      user: authUser.id,
      text,
      timestampInSong,
      parentComment,
      sentiment,
      sentimentScore: score,
    });

    await comment.populate("user", "name avatarUrl");

    // Notifie l'artiste propriétaire du morceau (jamais lui-même).
    const song = await Song.findById(params.id).select("title coverUrl artist");
    if (song) {
      const artist = await Artist.findById(song.artist).select("user");
      if (artist && artist.user.toString() !== authUser.id) {
        const commenter = await User.findById(authUser.id).select("name");
        const excerpt = text.length > 80 ? `${text.slice(0, 80)}…` : text;
        await notify({
          recipient: artist.user.toString(),
          type: "comment",
          title: `${commenter?.name ?? "Quelqu'un"} a commenté "${song.title}"`,
          message: excerpt,
          link: `/son/${song._id}`,
          imageUrl: song.coverUrl,
        });
      }
    }

    return NextResponse.json({ comment }, { status: 201 });
  }
);
