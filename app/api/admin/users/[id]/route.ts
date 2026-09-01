import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Artist from "@/models/Artist";
import Song from "@/models/Song";
import Album from "@/models/Album";
import Event from "@/models/Event";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, adminUserPatchSchema } from "@/lib/validation";
import { reporterPhotoDeCompte } from "@/lib/artistPhoto";

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    await requireAdmin(req);

    const { role, verifiedArtist, suspended, badges } = parseOrThrow(
      adminUserPatchSchema,
      await req.json()
    );

    await connectDB();
    const user = await User.findById(params.id);
    if (!user) throw new ApiError("Utilisateur introuvable.", 404);

    if (role) user.role = role;
    if (typeof suspended === "boolean") user.suspended = suspended;
    if (Array.isArray(badges)) user.badges = badges;

    // Promotion en artiste : on crée le profil Artist s'il n'existe pas.
    //
    // La photo du compte devient la photo d'artiste : sans elle, un membre
    // déjà photographié se retrouvait avec un profil public sans visage.
    if (role === "artist") {
      const existingArtist = await Artist.findOne({ user: user._id });
      if (!existingArtist) {
        await Artist.create({ user: user._id, stageName: user.name, coverUrl: user.avatarUrl });
      } else {
        await reporterPhotoDeCompte(user._id.toString(), user.avatarUrl);
      }
    }

    if (typeof verifiedArtist === "boolean") {
      user.verifiedArtist = verifiedArtist;
      await Artist.findOneAndUpdate({ user: user._id }, { verified: verifiedArtist });
    }

    await user.save();
    return NextResponse.json({ user });
  }
);

export const DELETE = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    await requireAdmin(req);

    await connectDB();
    const user = await User.findById(params.id);
    if (!user) throw new ApiError("Utilisateur introuvable.", 404);

    // Supprimer un compte artiste sans supprimer son contenu laisserait des
    // titres/albums/évènements pointer vers un artiste introuvable (bug
    // constaté sur /admin/musiques et /admin/albums). On supprime donc en
    // cascade tout ce qui appartient à l'artiste avant de le supprimer.
    const artist = await Artist.findOne({ user: user._id });
    if (artist) {
      await Promise.all([
        Song.deleteMany({ artist: artist._id }),
        Album.deleteMany({ artist: artist._id }),
        Event.deleteMany({ artist: artist._id }),
      ]);
      await artist.deleteOne();
    }

    await user.deleteOne();

    return NextResponse.json({ message: "Utilisateur supprimé." });
  }
);
