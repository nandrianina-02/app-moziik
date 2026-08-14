import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Badge from "@/models/Badge";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, createBadgeSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async () => {
  await connectDB();
  const badges = await Badge.find().sort({ category: 1 });
  return NextResponse.json({ badges });
});

// Création réservée aux admins (Phase 6 branchera l'UI dessus).
export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  if (authUser.role !== "admin") throw new ApiError("Réservé aux admins.", 403);

  const { key, label, description, icon, category } = parseOrThrow(createBadgeSchema, await req.json());

  await connectDB();
  const badge = await Badge.create({ key, label, description, icon, category });
  return NextResponse.json({ badge }, { status: 201 });
});
