import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const POST = withApiErrors(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  await connectDB();
  await Notification.updateMany(
    { recipient: session.user.id, read: false },
    { read: true }
  );

  return NextResponse.json({ message: "Tout est marqué comme lu." });
});
