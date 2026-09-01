import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import User from "@/models/User";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, adminArtistPatchSchema } from "@/lib/validation";

/** Le profil complet, tel que l'éditeur d'administration le charge. */
export const GET = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  await requireAdmin(req);

  await connectDB();
  const artist = await Artist.findById(params.id).populate("user", "name email avatarUrl");
  if (!artist) throw new ApiError("Artiste introuvable.", 404);

  return NextResponse.json({ artist });
});

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    await requireAdmin(req);

    const donnees = parseOrThrow(adminArtistPatchSchema, await req.json());

    await connectDB();
    const artist = await Artist.findById(params.id);
    if (!artist) throw new ApiError("Artiste introuvable.", 404);

    if (typeof donnees.stageName === "string") artist.stageName = donnees.stageName;
    if (typeof donnees.bio === "string") artist.bio = donnees.bio;
    if (typeof donnees.coverUrl === "string") artist.coverUrl = donnees.coverUrl;
    if (typeof donnees.bannerUrl === "string") artist.bannerUrl = donnees.bannerUrl;
    if (Array.isArray(donnees.genres)) artist.genres = donnees.genres;
    if (Array.isArray(donnees.socialLinks)) artist.socialLinks = donnees.socialLinks;

    if (typeof donnees.eventPublishingAuthorized === "boolean") {
      artist.eventPublishingAuthorized = donnees.eventPublishingAuthorized;
    }
    if (typeof donnees.monetizationEnabled === "boolean") {
      artist.monetizationEnabled = donnees.monetizationEnabled;
    }

    if (typeof donnees.verified === "boolean") {
      artist.verified = donnees.verified;
      // Le badge vit à deux endroits : sur le profil artiste, qui l'affiche,
      // et sur le compte, que l'annuaire d'administration filtre. Les
      // désynchroniser afficherait un artiste vérifié introuvable par le
      // filtre « Vérifiés ».
      await User.findByIdAndUpdate(artist.user, { verifiedArtist: donnees.verified });
    }

    await artist.save();
    return NextResponse.json({ artist });
  }
);
