import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const DELETE = withApiErrors(
  async (_req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

    await connectDB();
    const notification = await Notification.findOneAndDelete({
      _id: params.id,
      recipient: session.user.id,
    });
    if (!notification) throw new ApiError("Notification introuvable.", 404);

    return NextResponse.json({ message: "Notification supprimée." });
  }
);
