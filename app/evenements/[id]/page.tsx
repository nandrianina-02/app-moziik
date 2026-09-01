import type { Metadata } from "next";
import { connectDB } from "@/lib/db";
import Event from "@/models/Event";
import { getSiteConfig } from "@/lib/siteConfig";
import { jourLong } from "@/components/events/eventPresentation";
import { EventDetailClient } from "./EventDetailClient";

/**
 * Métadonnées Open Graph générées côté serveur — voir la note équivalente
 * dans app/son/[id]/page.tsx.
 *
 * Un évènement est fait pour être partagé : c'est la page du projet où
 * l'aperçu du lien compte le plus, et il doit dire la date et le lieu, pas
 * seulement le titre.
 */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const config = await getSiteConfig();
  try {
    await connectDB();
    const event = await Event.findById(params.id).select("title description coverUrl location date status");
    if (!event || event.status !== "published") return { title: config.siteName };

    const title = `${event.title} — ${config.siteName}`;
    const description = `${jourLong(event.date, config.timezone)}, ${event.location}. ${event.description.slice(0, 160)}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        siteName: config.siteName,
        images: event.coverUrl ? [{ url: event.coverUrl }] : undefined,
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: event.coverUrl ? [event.coverUrl] : undefined,
      },
    };
  } catch {
    return { title: config.siteName };
  }
}

export default function EventPage() {
  return <EventDetailClient />;
}
