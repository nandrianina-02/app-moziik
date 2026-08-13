import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Badge from "@/models/Badge";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async () => {
  await connectDB();
  const badges = await Badge.find().sort({ category: 1 });
  return NextResponse.json({ badges });
});

// Création réservée aux admins (Phase 6 branchera l'UI dessus).
export const POST = withApiErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") throw new ApiError("Réservé aux admins.", 403);

  const { key, label, description, icon, category } = await req.json();
  if (!key || !label || !description || !icon) throw new ApiError("Champs obligatoires manquants.");

  await connectDB();
  const badge = await Badge.create({ key, label, description, icon, category: category ?? "member" });
  return NextResponse.json({ badge }, { status: 201 });
});
