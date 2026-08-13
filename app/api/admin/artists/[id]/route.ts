import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    await requireAdmin();

    const { eventPublishingAuthorized, monetizationEnabled } = await req.json();

    await connectDB();
    const artist = await Artist.findById(params.id);
    if (!artist) throw new ApiError("Artiste introuvable.", 404);

    if (typeof eventPublishingAuthorized === "boolean") {
      artist.eventPublishingAuthorized = eventPublishingAuthorized;
    }
    if (typeof monetizationEnabled === "boolean") {
      artist.monetizationEnabled = monetizationEnabled;
    }

    await artist.save();
    return NextResponse.json({ artist });
  }
);
