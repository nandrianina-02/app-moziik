"use client";

import { useEffect, useState } from "react";

/**
 * Détails complets du morceau en cours (informations, crédits, paroles).
 *
 * `PlayableSong` reste volontairement léger : il circule dans toutes les
 * files d'attente de l'application. Les onglets du lecteur ont besoin de
 * bien plus (BPM, tonalité, ISRC, copyright, description, tags…), qu'on
 * va chercher une seule fois par morceau plutôt que d'alourdir chaque
 * liste de titres du site.
 *
 * Hors-ligne, cette requête est servie par le cache d'API par compte
 * (lib/offlineApi.ts) dès lors que le morceau a déjà été consulté.
 */

export type ArtisteLie = { _id: string; stageName: string; verified?: boolean; coverUrl?: string };

export type SongDetails = {
  _id: string;
  title: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  genre?: string;
  lyrics?: string;
  description?: string;
  tags?: string[];
  language?: string;
  composer?: string;
  producer?: string;
  bpm?: number;
  musicalKey?: string;
  isrc?: string;
  copyright?: string;
  explicit?: boolean;
  releaseDate?: string;
  playsCount?: number;
  likesCount?: number;
  sharesCount?: number;
  artist: ArtisteLie | null;
  featuring?: { artist: ArtisteLie | null; confirmed: boolean }[];
  album?: { _id: string; title: string; coverUrl?: string; type?: string } | null;
};

export function useSongDetails(songId?: string) {
  const [details, setDetails] = useState<SongDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!songId) {
      setDetails(null);
      return;
    }
    let annule = false;
    setLoading(true);
    setErreur(null);
    fetch(`/api/songs/${songId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Détails indisponibles."))))
      .then((data) => {
        if (!annule) setDetails(data.song as SongDetails);
      })
      .catch(() => {
        // Hors-ligne sans entrée en cache : les onglets affichent alors
        // ce que la file d'attente connaît déjà, sans message d'échec
        // alarmant. L'erreur reste disponible pour l'appelant qui veut
        // la montrer.
        if (!annule) setErreur("Informations indisponibles hors-ligne.");
      })
      .finally(() => {
        if (!annule) setLoading(false);
      });
    return () => {
      annule = true;
    };
  }, [songId]);

  return { details, loading, erreur };
}
