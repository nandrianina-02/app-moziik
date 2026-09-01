import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Event from "@/models/Event";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, createEventSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async () => {
  await connectDB();
  // La liste n'affiche que des cartes : inutile de charger les blocs de la
  // fiche détaillée (déroulé, billetterie, galerie) pour tous les évènements.
  const events = await Event.find({ status: "published" })
    .select("-program -practicalInfo -inclusions -gallery -interested")
    .populate("artist", "stageName verified")
    .sort({ date: 1 });
  return NextResponse.json({ events });
});

export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  // Le schéma décrit déjà exactement les champs acceptés — les reprendre
  // un à un ici ne ferait que créer un second endroit à mettre à jour à
  // chaque nouveau champ de la fiche.
  const donnees = parseOrThrow(createEventSchema, await req.json());

  await connectDB();

  let artistId: string | undefined;
  let status: "pending" | "published" = "pending";

  if (authUser.role === "admin") {
    status = "published"; // un évènement créé par un admin est publié directement
  } else if (authUser.role === "artist") {
    const artist = await Artist.findOne({ user: authUser.id });
    if (!artist?.eventPublishingAuthorized) {
      throw new ApiError("Tu n'es pas encore autorisé à publier des évènements.", 403);
    }
    artistId = artist._id.toString();
    status = "pending"; // passe par une validation admin
  } else {
    throw new ApiError("Seuls les admins et artistes autorisés peuvent créer un évènement.", 403);
  }

  const event = await Event.create({
    ...donnees,
    artist: artistId,
    createdBy: authUser.id,
    status,
  });

  return NextResponse.json({ event }, { status: 201 });
});
