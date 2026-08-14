import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

export const POST = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);

    await connectDB();
    const notification = await Notification.findOneAndUpdate(
      { _id: params.id, recipient: authUser.id },
      { read: true },
      { new: true }
    );
    if (!notification) throw new ApiError("Notification introuvable.", 404);

    return NextResponse.json({ notification });
  }
);
