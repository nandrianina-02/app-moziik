import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Comment from "@/models/Comment";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

export const DELETE = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);

    await connectDB();
    const comment = await Comment.findById(params.id);
    if (!comment) throw new ApiError("Commentaire introuvable.", 404);

    if (authUser.role !== "admin" && comment.user.toString() !== authUser.id) {
      throw new ApiError("Tu ne peux supprimer que tes propres commentaires.", 403);
    }

    await comment.deleteOne();
    return NextResponse.json({ message: "Commentaire supprimé." });
  }
);
