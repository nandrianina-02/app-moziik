import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, adminArtistPatchSchema } from "@/lib/validation";

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    await requireAdmin(req);

    const { eventPublishingAuthorized, monetizationEnabled } = parseOrThrow(
      adminArtistPatchSchema,
      await req.json()
    );

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
