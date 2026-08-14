import type { Metadata } from "next";
import { connectDB } from "@/lib/db";
import Album from "@/models/Album";
import { getSiteConfig } from "@/lib/siteConfig";
import { AlbumDetailClient } from "./AlbumDetailClient";

/**
 * Métadonnées Open Graph générées côté serveur — voir la note équivalente
 * dans app/son/[id]/page.tsx.
 */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const config = await getSiteConfig();
  try {
    await connectDB();
    const album = await Album.findById(params.id).populate("artist", "stageName");
    if (!album) return { title: config.siteName };

    const artistName = (album.artist as unknown as { stageName?: string } | null)?.stageName;
    const title = artistName ? `${album.title} — ${artistName}` : album.title;
    const description =
      album.description?.slice(0, 200) || `Écoute l'album "${album.title}" sur ${config.siteName}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        siteName: config.siteName,
        images: album.coverUrl ? [{ url: album.coverUrl }] : undefined,
        type: "music.album",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: album.coverUrl ? [album.coverUrl] : undefined,
      },
    };
  } catch {
    return { title: config.siteName };
  }
}

export default function AlbumPage() {
  return <AlbumDetailClient />;
}
