"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";

/**
 * Écouter à plusieurs, sur le site : la même chose que l'application
 * (EcouteEnsemble.kt), sur la même route (/api/ecoute-ensemble). Un code
 * créé sur le téléphone se rejoint depuis le site, et inversement.
 *
 * L'hôte publie son titre, sa position et sa pause : à chaque changement,
 * et toutes les cinq secondes pour que l'heure de référence reste fraîche.
 * L'invité relit l'état toutes les deux secondes et se recale : il change
 * de titre avec l'hôte, se met en pause avec lui, et ne corrige sa
 * position qu'au-delà de 2,5 s d'écart (une correction plus fine ferait
 * entendre des sauts).
 *
 * La session survit au rechargement de la page : son code est gardé sur
 * l'appareil jusqu'à ce qu'on la quitte.
 */

type Etat = { role: "hote" | "invite"; code: string; participants: number; hote?: string } | null;

const Contexte = createContext<{
  etat: Etat;
  lancer: () => Promise<void>;
  rejoindre: (code: string) => Promise<void>;
  quitter: () => Promise<void>;
}>({ etat: null, lancer: async () => {}, rejoindre: async () => {}, quitter: async () => {} });

export const useEcouteEnsemble = () => useContext(Contexte);

const CLE = "moziik-ecoute-ensemble";
const ECART_TOLERE_MS = 2500;

export function EcouteEnsembleProvider({ children }: { children: React.ReactNode }) {
  const { currentSong, isPlaying, progress, playQueue, seek, togglePlay } = usePlayer();
  const pushToast = useToast();
  const [etat, setEtat] = useState<Etat>(null);
  // L'état du lecteur au moment présent, pour les boucles qui ne se refont pas à chaque rendu.
  const lecteur = useRef({ currentSong, isPlaying, progress });
  lecteur.current = { currentSong, isPlaying, progress };

  const garder = (e: Etat) => {
    setEtat(e);
    try {
      if (e) localStorage.setItem(CLE, JSON.stringify({ role: e.role, code: e.code }));
      else localStorage.removeItem(CLE);
    } catch {
      // Sans stockage, la session vaut pour la page ouverte.
    }
  };

  // Une session en cours avant un rechargement.
  useEffect(() => {
    try {
      const brut = localStorage.getItem(CLE);
      if (brut) {
        const { role, code } = JSON.parse(brut) as { role: "hote" | "invite"; code: string };
        setEtat({ role, code, participants: 0 });
      }
    } catch {
      // Donnée illisible : pas de session à reprendre.
    }
  }, []);

  const publier = useCallback(async (code: string) => {
    const { currentSong: titre, isPlaying: lit, progress: position } = lecteur.current;
    await fetch(`/api/ecoute-ensemble/${code}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titreId: titre?._id ?? null, positionMs: Math.round((position ?? 0) * 1000), enLecture: lit }),
    }).catch(() => {});
  }, []);

  // Hôte : publication à chaque changement de titre ou de lecture…
  useEffect(() => {
    if (etat?.role === "hote") publier(etat.code);
  }, [etat?.role, etat?.code, currentSong?._id, isPlaying, publier]);

  // … et toutes les cinq secondes, avec le nombre de participants en retour.
  useEffect(() => {
    if (etat?.role !== "hote") return;
    const code = etat.code;
    const tic = window.setInterval(async () => {
      await publier(code);
      const r = await fetch(`/api/ecoute-ensemble/${code}`).catch(() => null);
      if (r?.status === 404) {
        garder(null);
        return;
      }
      const d = r?.ok ? await r.json() : null;
      if (d) setEtat((e) => (e && e.code === code ? { ...e, participants: d.participants } : e));
    }, 5000);
    return () => window.clearInterval(tic);
  }, [etat?.role, etat?.code, publier]);

  // Invité : relit l'état et se recale sur l'hôte.
  useEffect(() => {
    if (etat?.role !== "invite") return;
    const code = etat.code;
    let enCours = false;
    const suivre = async () => {
      if (enCours) return;
      enCours = true;
      try {
        const r = await fetch(`/api/ecoute-ensemble/${code}`);
        if (r.status === 404) {
          pushToast("info", "L'écoute à plusieurs est terminée.");
          garder(null);
          return;
        }
        if (!r.ok) return;
        const d = (await r.json()) as { titre: PlayableSong | null; positionMs: number; enLecture: boolean; participants: number; hote: { name: string } };
        setEtat((e) => (e && e.code === code ? { ...e, participants: d.participants, hote: d.hote.name } : e));
        const { currentSong: courant, isPlaying: lit, progress: position } = lecteur.current;
        if (!d.titre) return;
        if (courant?._id !== d.titre._id) {
          playQueue([d.titre], 0, { type: "queue", label: `À plusieurs avec ${d.hote.name}` });
          // La position se pose une fois le titre chargé.
          window.setTimeout(() => seek(d.positionMs / 1000), 900);
          return;
        }
        if (Math.abs((position ?? 0) * 1000 - d.positionMs) > ECART_TOLERE_MS) seek(d.positionMs / 1000);
        if (d.enLecture !== lit) togglePlay();
      } catch {
        // Réseau coupé : on réessaie au tour suivant.
      } finally {
        enCours = false;
      }
    };
    suivre();
    const tic = window.setInterval(suivre, 2000);
    return () => window.clearInterval(tic);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- les commandes du lecteur sont relues à chaque tour
  }, [etat?.role, etat?.code]);

  const lancer = useCallback(async () => {
    const r = await fetch("/api/ecoute-ensemble", { method: "POST" });
    if (!r.ok) throw new Error("La session n'a pas pu être créée.");
    const { code } = (await r.json()) as { code: string };
    garder({ role: "hote", code, participants: 0 });
  }, []);

  const rejoindre = useCallback(async (code: string) => {
    const propre = code.trim().toUpperCase();
    const r = await fetch(`/api/ecoute-ensemble/${propre}`);
    if (r.status === 404) throw new Error("Code inconnu ou écoute terminée.");
    if (!r.ok) throw new Error("Impossible de rejoindre cette écoute.");
    const d = await r.json();
    if (d.estHote) garder({ role: "hote", code: propre, participants: d.participants });
    else garder({ role: "invite", code: propre, participants: d.participants, hote: d.hote?.name });
  }, []);

  const quitter = useCallback(async () => {
    if (etat) await fetch(`/api/ecoute-ensemble/${etat.code}`, { method: "DELETE" }).catch(() => {});
    garder(null);
  }, [etat]);

  return <Contexte.Provider value={{ etat, lancer, rejoindre, quitter }}>{children}</Contexte.Provider>;
}
