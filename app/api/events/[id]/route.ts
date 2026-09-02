import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Event from "@/models/Event";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, patchEventSchema } from "@/lib/validation";
import { getAuthUser, requireAuthUser } from "@/lib/mobileAuth";
import { adresseCherchable, premierLieu } from "@/lib/geocodage";

/** Ce que la fiche a besoin de savoir des artistes qu'elle montre. */
const CHAMPS_ARTISTE = "stageName verified coverUrl bio socialLinks";

export const GET = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  await connectDB();
  const event = await Event.findById(params.id)
    .populate("artist", CHAMPS_ARTISTE)
    .populate("lineup", "stageName verified coverUrl")
    .lean();
  if (!event) throw new ApiError("Évènement introuvable.", 404);

  // La liste des membres intéressés ne sort jamais de la base : la page
  // n'a besoin que du total, et de savoir si le visiteur en fait partie.
  const authUser = await getAuthUser(req);
  const interested = (event.interested ?? []).map((id) => id.toString());
  const { interested: _liste, ...reste } = event;

  return NextResponse.json({
    event: {
      ...reste,
      interestedCount: interested.length,
      viewerInterested: authUser ? interested.includes(authUser.id) : false,
    },
  });
});

async function assertCanManage(event: { createdBy: { toString: () => string } }, userId: string, role?: string) {
  if (role === "admin") return;
  if (event.createdBy.toString() !== userId) {
    throw new ApiError("Tu ne peux modifier que tes propres évènements.", 403);
  }
}

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);

    await connectDB();
    const event = await Event.findById(params.id);
    if (!event) throw new ApiError("Évènement introuvable.", 404);
    await assertCanManage(event, authUser.id, authUser.role);

    const parsedUpdates = parseOrThrow(patchEventSchema, await req.json());
    const updates = parsedUpdates as Record<string, unknown>;
    const allowed = [
      "title",
      "description",
      "coverUrl",
      "location",
      "date",
      "ticketUrl",
      "price",
      "category",
      "endDate",
      "gallery",
      "lineup",
      "highlights",
      "inclusions",
      "program",
      "practicalInfo",
      "tickets",
      "address",
      "postalCode",
      "city",
      "country",
      "mapsUrl",
      "latitude",
      "longitude",
      "tags",
      "minAge",
      "visibility",
      "organizer",
    ];
    for (const key of allowed) {
      if (key in updates) {
        (event as unknown as Record<string, unknown>)[key] = updates[key];
      }
    }
    // Un admin peut aussi forcer le statut (republier un évènement rejeté, etc.)
    if (authUser.role === "admin" && parsedUpdates.status) {
      event.status = parsedUpdates.status;
    }

    /**
     * Les coordonnées, retrouvées quand elles manquent.
     *
     * Seulement si personne ne les a posées : une position choisie à la
     * main dans le formulaire — parce que le premier résultat tombait à
     * côté — ne doit pas être réécrite au prochain enregistrement. Un
     * échec du service laisse simplement la fiche sans carte.
     */
    const coordonneesFournies = "latitude" in updates || "longitude" in updates;
    if (!coordonneesFournies && event.latitude == null && event.longitude == null) {
      const situe = await premierLieu(adresseCherchable(event));
      if (situe) {
        event.latitude = situe.latitude;
        event.longitude = situe.longitude;
      }
    }

    await event.save();
    return NextResponse.json({ event });
  }
);

export const DELETE = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);

    await connectDB();
    const event = await Event.findById(params.id);
    if (!event) throw new ApiError("Évènement introuvable.", 404);
    await assertCanManage(event, authUser.id, authUser.role);

    await event.deleteOne();
    return NextResponse.json({ message: "Évènement supprimé." });
  }
);
