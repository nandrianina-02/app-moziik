import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const POST = withApiErrors(
  async (_req: Request, { params }: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new ApiError("Non authentifié.", 401);

    await connectDB();
    const notification = await Notification.findOneAndUpdate(
      { _id: params.id, recipient: session.user.id },
      { read: true },
      { new: true }
    );
    if (!notification) throw new ApiError("Notification introuvable.", 404);

    return NextResponse.json({ notification });
  }
);
