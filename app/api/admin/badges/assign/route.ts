import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { notify } from "@/lib/notify";

export const POST = withApiErrors(async (req: Request) => {
  await requireAdmin();

  const { userId, badgeKey, badgeLabel } = await req.json();
  if (!userId || !badgeKey) throw new ApiError("userId et badgeKey requis.");

  await connectDB();
  const user = await User.findById(userId);
  if (!user) throw new ApiError("Utilisateur introuvable.", 404);

  if (!user.badges.includes(badgeKey)) {
    user.badges.push(badgeKey);
    await user.save();

    await notify({
      recipient: user._id.toString(),
      type: "system",
      title: "Nouveau badge débloqué",
      message: `Tu as reçu le badge "${badgeLabel ?? badgeKey}".`,
      link: "/compte",
    });
  }

  return NextResponse.json({ user });
});
