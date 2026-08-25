"use client";

import { useEffect, useState } from "react";
import { memoriserManuellement } from "@/lib/offlineApi";
import { readNdjson } from "@/lib/readNdjson";

export type HomepageSlot = {
  key: string;
  title: string;
  status: "pending" | "ready";
  data: unknown;
};

type StreamEvent =
  | { type: "meta"; sections: { key: string; title: string }[] }
  | { type: "hero"; data: unknown }
  | { type: "section"; key: string; title: string; data: unknown }
  | { type: "failed"; key: string }
  | { type: "end" };

type State = {
  /** Ordre et titres définitifs, connus avant toute donnée : permet de dessiner la page en squelettes. */
  slots: HomepageSlot[];
  hero: unknown;
  heroPending: boolean;
  /** Vrai tant que la liste des sections n'est pas connue. */
  starting: boolean;
  failed: boolean;
};

const INITIAL: State = { slots: [], hero: null, heroPending: true, starting: true, failed: false };

/**
 * Consomme un flux de sections NDJSON et publie chacune dès son arrivée.
 *
 * Le rendu suit trois temps : la page est vide un instant, puis complète en
 * squelettes dès la ligne `meta`, puis chaque bloc se remplit à son rythme.
 * L'utilisateur voit donc la structure de la page presque immédiatement au
 * lieu d'attendre que la section la plus lente ait fini de se calculer.
 *
 * Repli sur `fallbackUrl` (réponse unique) si le flux est indisponible —
 * navigateur sans ReadableStream, ou intermédiaire réseau qui tamponne la
 * réponse. L'affichage est alors celui d'avant : tout d'un coup.
 */
export function useSectionStream(streamUrl: string, fallbackUrl: string) {
  const [state, setState] = useState<State>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    // Quitter la page doit interrompre le flux : sans cela le serveur
    // continue de calculer et d'émettre des sections que plus personne
    // n'affiche, jusqu'à la fin de la réponse.
    const controller = new AbortController();

    function apply(update: (prev: State) => State) {
      if (!cancelled) setState(update);
    }

    // Assemblage tenu au fil de l'eau, indépendamment de React : lire
    // l'état juste après la fin du flux le prendrait en retard d'un rendu.
    const assemblage: { hero: unknown; sections: { key: string; title: string; data: unknown }[] } = {
      hero: null,
      sections: [],
    };

    function handle(event: StreamEvent) {
      switch (event.type) {
        case "meta":
          apply((prev) => ({
            ...prev,
            starting: false,
            slots: event.sections.map((s) => ({ key: s.key, title: s.title, status: "pending", data: null })),
          }));
          break;
        case "hero":
          assemblage.hero = event.data;
          apply((prev) => ({ ...prev, hero: event.data, heroPending: false }));
          break;
        case "section":
          assemblage.sections.push({ key: event.key, title: event.title, data: event.data });
          apply((prev) => ({
            ...prev,
            slots: prev.slots.map((slot) =>
              slot.key === event.key ? { ...slot, title: event.title, status: "ready", data: event.data } : slot
            ),
          }));
          break;
        case "failed":
          // La section ne viendra pas : on retire son squelette plutôt que
          // de le laisser tourner indéfiniment.
          if (event.key === "hero") apply((prev) => ({ ...prev, heroPending: false }));
          else apply((prev) => ({ ...prev, slots: prev.slots.filter((slot) => slot.key !== event.key) }));
          break;
        case "end":
          apply((prev) => ({
            ...prev,
            heroPending: false,
            slots: prev.slots.filter((slot) => slot.status === "ready"),
          }));
          break;
      }
    }

    async function loadWhole() {
      const res = await fetch(fallbackUrl, { signal: controller.signal });
      if (!res.ok) throw new Error("Chargement impossible.");
      const data = (await res.json()) as { hero: unknown; sections: { key: string; title: string; data: unknown }[] };
      apply(() => ({
        starting: false,
        failed: false,
        hero: data.hero,
        heroPending: false,
        slots: data.sections.map((s) => ({ key: s.key, title: s.title, status: "ready", data: s.data })),
      }));
    }

    /**
     * Le flux n'est jamais mis en cache (il est lu au fil de l'eau), et son
     * repli n'est jamais appelé tant que le réseau répond. Sans ce rangement
     * explicite, la page d'accueil n'a donc rien à afficher hors-ligne alors
     * qu'elle vient de tout recevoir.
     */
    function archiver() {
      if (assemblage.sections.length === 0) return;
      memoriserManuellement(fallbackUrl, assemblage);
    }

    async function run() {
      try {
        const res = await fetch(streamUrl, { signal: controller.signal });
        if (!res.ok || !res.body) throw new Error("Flux indisponible.");
        await readNdjson<StreamEvent>(res, handle);
        if (!cancelled) archiver();
      } catch {
        // Une interruption volontaire n'est pas une panne : ne pas
        // basculer en repli, ni signaler une erreur à l'utilisateur.
        if (cancelled) return;
        try {
          await loadWhole();
        } catch {
          if (!cancelled) apply((prev) => ({ ...prev, starting: false, heroPending: false, failed: true }));
        }
      }
    }

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [streamUrl, fallbackUrl]);

  return state;
}

/** Sections de la page d'accueil. */
export function useHomepageStream() {
  return useSectionStream("/api/homepage/stream", "/api/homepage");
}

/** Sections éditoriales d'un autre groupe de pages (découvrir, radio, bibliothèque, détail). */
export function usePageSectionsStream(page: string) {
  return useSectionStream(`/api/page-sections/${page}/stream`, `/api/page-sections/${page}`);
}

/** Récupère les données d'une section arrivée, ou `undefined` si elle est encore en attente. */
export function slotData<T>(slots: HomepageSlot[], key: string): T | undefined {
  const slot = slots.find((s) => s.key === key);
  return slot && slot.status === "ready" ? (slot.data as T) : undefined;
}
