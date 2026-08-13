import type { MetadataRoute } from "next";
import { connectDB } from "@/lib/db";
import Album from "@/models/Album";
import Artist from "@/models/Artist";
import Event from "@/models/Event";
import Playlist from "@/models/Playlist";

const baseUrl = "https://app-moziik.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Pages statiques publiques (on exclut les pages qui nécessitent une
  // connexion : compte, bibliothèque, notifications, admin, gestion artiste...)
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/recherche",
    "/radio",
    "/classements",
    "/evenements",
    "/abonnement",
    "/contact",
    "/mentions-legales",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));

  try {
    await connectDB();

    const [albums, artists, events, playlists] = await Promise.all([
      Album.find({}, "_id createdAt").lean(),
      Artist.find({}, "_id createdAt").lean(),
      Event.find({ status: "published" }, "_id createdAt").lean(),
      Playlist.find({ isPublic: true }, "_id createdAt").lean(),
    ]);

    const albumRoutes: MetadataRoute.Sitemap = albums.map((a) => ({
      url: `${baseUrl}/album/${a._id}`,
      lastModified: a.createdAt || new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    }));

    const artistRoutes: MetadataRoute.Sitemap = artists.map((a) => ({
      url: `${baseUrl}/artiste/${a._id}`,
      lastModified: a.createdAt || new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    }));

    const eventRoutes: MetadataRoute.Sitemap = events.map((e) => ({
      url: `${baseUrl}/evenements/${e._id}`,
      lastModified: e.createdAt || new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    const playlistRoutes: MetadataRoute.Sitemap = playlists.map((p) => ({
      url: `${baseUrl}/playlist/${p._id}`,
      lastModified: p.createdAt || new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    }));

    return [...staticRoutes, ...albumRoutes, ...artistRoutes, ...eventRoutes, ...playlistRoutes];
  } catch (error) {
    // Si la connexion DB échoue au build, on retourne au moins les pages statiques
    console.error("Erreur lors de la génération du sitemap :", error);
    return staticRoutes;
  }
}