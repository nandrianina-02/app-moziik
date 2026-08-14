import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import HomepageHubCard from "@/models/HomepageHubCard";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, hubCardPatchSchema } from "@/lib/validation";

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    await requireAdmin(req);
    const updates = parseOrThrow(hubCardPatchSchema, await req.json());

    await connectDB();
    const card = await HomepageHubCard.findByIdAndUpdate(
      params.id,
      { ...updates, coverUrl: updates.coverUrl || undefined },
      { new: true }
    );
    if (!card) throw new ApiError("Carte introuvable.", 404);

    return NextResponse.json({ card });
  }
);

export const DELETE = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    await requireAdmin(req);

    await connectDB();
    const card = await HomepageHubCard.findByIdAndDelete(params.id);
    if (!card) throw new ApiError("Carte introuvable.", 404);

    return NextResponse.json({ message: "Carte supprimée." });
  }
);
