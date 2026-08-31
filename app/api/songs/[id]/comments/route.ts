import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Comment from "@/models/Comment";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import User from "@/models/User";
import { analyzeSentiment } from "@/lib/sentiment";
import { notify } from "@/lib/notify";
import { notifierMentions } from "@/lib/notifyMentions";
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

    // Classement provisoire par lexique : instantane, donc l'envoi d'un
    // commentaire n'attend rien. La relecture par l'IA repasse ensuite par
    // lots et corrige ce ton (voir lib/ai/moderationQueue.ts) ; c'est
    // l'absence de `moderatedAt` qui met ce commentaire dans sa file.
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

    // Notifie l'artiste propriétaire du morceau (jamais lui-même), puis
    // les personnes citées dans le texte.
    const song = await Song.findById(params.id).select("title coverUrl artist");
    const commenter = await User.findById(authUser.id).select("name avatarUrl");
    let proprietaireId: string | undefined;

    if (song) {
      const artist = await Artist.findById(song.artist).select("user");
      proprietaireId = artist?.user?.toString();
      if (proprietaireId && proprietaireId !== authUser.id) {
        const excerpt = text.length > 80 ? `${text.slice(0, 80)}…` : text;
        await notify({
          recipient: proprietaireId,
          type: "comment",
          title: `${commenter?.name ?? "Quelqu'un"} a commenté "${song.title}"`,
          message: excerpt,
          link: `/son/${song._id}`,
          imageUrl: commenter?.avatarUrl ?? song.coverUrl,
        });
      }
    }

    // Une citation ne doit pas faire échouer la publication du commentaire :
    // il est déjà enregistré, et l'auteur n'y peut rien.
    try {
      await notifierMentions({
        texte: text,
        auteurId: authUser.id,
        dejaPrevenu: [proprietaireId],
        lien: `/son/${params.id}`,
        titre: `${commenter?.name ?? "Quelqu'un"} vous a mentionné`,
        avatarUrl: commenter?.avatarUrl,
      });
    } catch (err) {
      console.error("Notification de mention non envoyée :", err);
    }

    return NextResponse.json({ comment }, { status: 201 });
  }
);
