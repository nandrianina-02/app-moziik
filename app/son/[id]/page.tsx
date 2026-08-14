import type { Metadata } from "next";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import { getSiteConfig } from "@/lib/siteConfig";
import { SongDetailClient } from "./SongDetailClient";

/**
 * Métadonnées Open Graph générées côté serveur : la page elle-même reste
 * un composant client ("use client" déplacé dans SongDetailClient) pour
 * ne pas perturber son fonctionnement existant — generateMetadata a
 * seulement besoin d'un accès direct en lecture, sans dupliquer la
 * logique d'affichage. Sans ça, un lien partagé (WhatsApp, Facebook, QR
 * code — voir ShareModal) s'affichait en URL nue, sans titre ni pochette.
 */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const config = await getSiteConfig();
  try {
    await connectDB();
    const song = await Song.findById(params.id).populate("artist", "stageName");
    if (!song) return { title: config.siteName };

    const artistName = (song.artist as unknown as { stageName?: string } | null)?.stageName;
    const title = artistName ? `${song.title} — ${artistName}` : song.title;
    const description =
      song.description?.slice(0, 200) || `Écoute "${song.title}" sur ${config.siteName}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        siteName: config.siteName,
        images: song.coverUrl ? [{ url: song.coverUrl }] : undefined,
        type: "music.song",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: song.coverUrl ? [song.coverUrl] : undefined,
      },
    };
  } catch {
    return { title: config.siteName };
  }
}

export default function SongPage() {
  return <SongDetailClient />;
}
