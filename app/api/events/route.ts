import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Event from "@/models/Event";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, createEventSchema } from "@/lib/validation";
import { getAuthUser, requireAuthUser } from "@/lib/mobileAuth";
import { adresseCherchable, premierLieu } from "@/lib/geocodage";

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

  // Les coordonnées, cherchées une fois à la création.
  //
  // La carte de la fiche ne s'affiche qu'avec elles, et les demander à la
  // main revenait à ne jamais en avoir : aucune carte n'est jamais
  // apparue depuis que la section existe. Une adresse déjà située à la
  // main n'est pas retouchée, et un échec du service n'empêche jamais
  // d'enregistrer — l'évènement compte plus que sa carte.
  const situe =
    donnees.latitude == null && donnees.longitude == null
      ? await premierLieu(adresseCherchable(donnees))
      : null;

  const event = await Event.create({
    ...donnees,
    ...(situe ? { latitude: situe.latitude, longitude: situe.longitude } : {}),
    artist: artistId,
    createdBy: authUser.id,
    status,
  });

  return NextResponse.json({ event }, { status: 201 });
});
