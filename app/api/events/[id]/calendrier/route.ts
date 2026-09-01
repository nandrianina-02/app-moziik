import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Event from "@/models/Event";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { getSiteConfig } from "@/lib/siteConfig";

/** Horodatage iCalendar en UTC : 20240524T160000Z. */
function horodatage(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Échappement iCalendar (RFC 5545 § 3.3.11).
 *
 * Sans lui, une virgule ou un point-virgule dans un titre coupe la
 * propriété en deux et le fichier devient illisible pour l'agenda.
 */
function echapper(valeur: string): string {
  return valeur
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Les lignes iCalendar sont pliées à 75 octets ; on plie à 73 par sécurité. */
function plier(ligne: string): string {
  if (ligne.length <= 73) return ligne;
  const morceaux: string[] = [ligne.slice(0, 73)];
  let reste = ligne.slice(73);
  while (reste.length > 72) {
    morceaux.push(` ${reste.slice(0, 72)}`);
    reste = reste.slice(72);
  }
  if (reste) morceaux.push(` ${reste}`);
  return morceaux.join("\r\n");
}

/**
 * « Ajouter au calendrier » : renvoie l'évènement au format .ics.
 *
 * Un fichier plutôt qu'un lien vers un agenda en particulier — celui-ci
 * s'ouvre aussi bien dans Google Agenda que dans Outlook ou l'agenda du
 * téléphone, et ne dépend d'aucun service tiers.
 */
export const GET = withApiErrors(async (_req: Request, { params }: { params: { id: string } }) => {
  await connectDB();
  const event = await Event.findById(params.id).select("title description location address date endDate status");
  if (!event || event.status !== "published") throw new ApiError("Évènement introuvable.", 404);

  const config = await getSiteConfig();
  const lieu = [event.address, event.location].filter(Boolean).join(", ");

  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${echapper(config.siteName)}//Evenements//FR`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event._id.toString()}@moziik`,
    `DTSTAMP:${horodatage(new Date())}`,
    `DTSTART:${horodatage(event.date)}`,
    // Pas d'heure de fin inventée : sans `endDate`, l'agenda applique sa
    // propre durée par défaut plutôt qu'une durée que personne n'a annoncée.
    ...(event.endDate ? [`DTEND:${horodatage(event.endDate)}`] : []),
    plier(`SUMMARY:${echapper(event.title)}`),
    plier(`DESCRIPTION:${echapper(event.description)}`),
    plier(`LOCATION:${echapper(lieu)}`),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // Nom de fichier réduit à l'ASCII : les agendas de bureau gèrent mal les
  // accents dans un Content-Disposition.
  const nom = event.title.normalize("NFD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "evenement";

  return new NextResponse(lignes.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nom}.ics"`,
    },
  });
});
