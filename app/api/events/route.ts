import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Event from "@/models/Event";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, createEventSchema } from "@/lib/validation";
import { getAuthUser, requireAuthUser } from "@/lib/mobileAuth";

export const GET = withApiErrors(async (req: Request) => {
  await connectDB();
  // La liste n'affiche que des cartes : inutile de charger les blocs de la
  // fiche détaillée (déroulé, billetterie, galerie) pour tous les évènements.
  //
  // `visibility` exclut les fiches non répertoriées : elles restent
  // accessibles par leur lien, mais n'ont rien à faire dans une liste
  // publique. Les documents créés avant ce champ n'en ont pas du tout,
  // d'où le `$ne` plutôt qu'un `$eq: "public"` qui les ferait disparaître.
  const events = await Event.find({ status: "published", visibility: { $ne: "unlisted" } })
    .select("-program -practicalInfo -inclusions -gallery -interested -tickets")
    .populate("artist", "stageName verified")
    .sort({ date: 1 });

  // Ce que le visiteur a déjà marqué, pour que les cœurs de la liste
  // s'affichent dans le bon état dès le premier rendu. Une seule requête
  // pour toute la page, plutôt qu'une par carte.
  const authUser = await getAuthUser(req);
  const interestedIds = authUser
    ? (await Event.find({ interested: authUser.id }).distinct("_id")).map((id) => id.toString())
    : [];

  return NextResponse.json({ events, interestedIds });
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
