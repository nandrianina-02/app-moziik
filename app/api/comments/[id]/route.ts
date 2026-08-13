import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Comment from "@/models/Comment";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const DELETE = withApiErrors(
  async (_req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

    await connectDB();
    const comment = await Comment.findById(params.id);
    if (!comment) throw new ApiError("Commentaire introuvable.", 404);

    if (session.user.role !== "admin" && comment.user.toString() !== session.user.id) {
      throw new ApiError("Tu ne peux supprimer que tes propres commentaires.", 403);
    }

    await comment.deleteOne();
    return NextResponse.json({ message: "Commentaire supprimé." });
  }
);
