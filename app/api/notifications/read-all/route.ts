import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  await Notification.updateMany(
    { recipient: authUser.id, read: false },
    { read: true }
  );

  return NextResponse.json({ message: "Tout est marqué comme lu." });
});
