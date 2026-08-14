import type { Metadata } from "next";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import { getSiteConfig } from "@/lib/siteConfig";
import { ArtistDetailClient } from "./ArtistDetailClient";

/**
 * Métadonnées Open Graph générées côté serveur — voir la note équivalente
 * dans app/son/[id]/page.tsx.
 */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const config = await getSiteConfig();
  try {
    await connectDB();
    const artist = await Artist.findById(params.id).select("stageName bio coverUrl");
    if (!artist) return { title: config.siteName };

    const title = `${artist.stageName} — ${config.siteName}`;
    const description = artist.bio?.slice(0, 200) || `Découvre le profil de ${artist.stageName} sur ${config.siteName}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        siteName: config.siteName,
        images: artist.coverUrl ? [{ url: artist.coverUrl }] : undefined,
        type: "profile",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: artist.coverUrl ? [artist.coverUrl] : undefined,
      },
    };
  } catch {
    return { title: config.siteName };
  }
}

export default function ArtistPage() {
  return <ArtistDetailClient />;
}
