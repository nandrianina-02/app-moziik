"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { memoriserManuellement } from "@/lib/offlineApi";
import { cleInstantane, ecrireInstantane, lireInstantane } from "@/lib/instantane";
import { readNdjson } from "@/lib/readNdjson";
import { useUnivers } from "@/context/UniversProvider";
import { useMode } from "@/context/ModeProvider";

export type HomepageSlot = {
  /**
   * Identité de la section, et non son type.
   *
   * Deux sections personnalisées portent toutes les deux la clé
   * « custom » : c'est le slug qui les sépare. Se fier à `key` ferait
   * afficher le contenu de la première dans les deux blocs.
   */
  id: string;
  key: string;
  title: string;
  status: "pending" | "ready";
  data: unknown;
};

type StreamEvent =
  | {
      type: "meta";
      sections: { id: string; key: string; title: string }[];
      depuis: number;
      suivant: number;
      encore: boolean;
    }
  | { type: "hero"; data: unknown }
  | { type: "section"; id: string; key: string; title: string; data: unknown }
  | { type: "failed"; id: string; key: string }
  | { type: "end" };

type State = {
  /** Ordre et titres définitifs, connus avant toute donnée : permet de dessiner la page en squelettes. */
  slots: HomepageSlot[];
  hero: unknown;
  heroPending: boolean;
  /** Vrai tant que la liste des sections n'est pas connue. */
  starting: boolean;
  failed: boolean;
  /**
   * L'écran affiche ce qu'on avait gardé, et le réseau travaille encore.
   *
   * Distinct de `starting` : la page est complète et utilisable, mais ce
   * qu'elle montre date de la dernière visite. C'est ce que l'interface
   * signale discrètement, plutôt que de laisser croire à des données
   * fraîches.
   */
  reprise: boolean;
  /** Le serveur garde des sections pour plus bas. */
  encore: boolean;
  /** Un lot suivant est en route. */
  suite: boolean;
};

const INITIAL: State = {
  slots: [],
  hero: null,
  heroPending: true,
  starting: true,
  failed: false,
  reprise: false,
  encore: false,
  suite: false,
};

/** Ce qu'on garde d'une visite à l'autre. Même forme que le repli non-streamé. */
type Assemblage = {
  hero: unknown;
  sections: { id?: string; key: string; title: string; data: unknown }[];
};

/** Les instantanés d'avant l'identifiant n'ont que la clé. */
function identite(s: { id?: string; key: string }) {
  return s.id ?? s.key;
}

/** Repères partagés entre le premier lot et les suivants. */
type Pilote = {
  /** Rang à demander au prochain appel. */
  suivant: number;
  encore: boolean;
  enCours: boolean;
  /** Vrai une fois la page quittée ou l'univers changé : plus rien ne doit s'afficher. */
  annule: boolean;
  controller: AbortController | null;
  cle: string;
  /**
   * Sections reçues, tenues hors de React : lire l'état juste après la fin
   * d'un lot le prendrait en retard d'un rendu, et l'instantané rangerait
   * une section de moins à chaque fois.
   */
  recu: { id: string; key: string; title: string; data: unknown }[];
  hero: unknown;
};

function pilotNeuf(): Pilote {
  return {
    suivant: 0,
    encore: false,
    enCours: false,
    annule: false,
    controller: null,
    cle: "",
    recu: [],
    hero: null,
  };
}

/**
 * Insère les sections annoncées sans toucher à celles déjà affichées.
 *
 * Une clé déjà présente garde son contenu et ne reprend que son titre :
 * c'est ce qui évite qu'une section reprise de l'instantané, ou arrivée
 * au lot précédent, retombe en squelette. Les nouvelles s'ajoutent à la
 * suite, dans l'ordre où le serveur les a rangées.
 */
function poser(
  prev: HomepageSlot[],
  entrants: { id: string; key: string; title: string }[]
): HomepageSlot[] {
  const connus = new Set(prev.map((s) => s.id));
  return [
    ...prev.map((slot) => {
      const entrant = entrants.find((e) => e.id === slot.id);
      return entrant ? { ...slot, title: entrant.title } : slot;
    }),
    ...entrants
      .filter((e) => !connus.has(e.id))
      .map((e) => ({ id: e.id, key: e.key, title: e.title, status: "pending" as const, data: null })),
  ];
}

/**
 * Consomme un flux de sections NDJSON et publie chacune dès son arrivée.
 *
 * Le rendu suit trois temps : la page est vide un instant, puis complète en
 * squelettes dès la ligne `meta`, puis chaque bloc se remplit à son rythme.
 * L'utilisateur voit donc la structure de la page presque immédiatement au
 * lieu d'attendre que la section la plus lente ait fini de se calculer.
 *
 * PAR LOTS
 *
 * Le serveur n'envoie qu'une tranche de sections et dit s'il en reste
 * (`encore`). `chargerSuite` demande la suivante — la page la réclame
 * quand son bas approche du champ de vision. Une configuration qui porte
 * trente sections ne coûte donc, à qui ne fait pas défiler, que le calcul
 * des six premières.
 *
 * Repli sur `fallbackUrl` (réponse unique) si le flux est indisponible —
 * navigateur sans ReadableStream, ou intermédiaire réseau qui tamponne la
 * réponse. L'affichage est alors celui d'avant : tout d'un coup.
 */
export function useSectionStream(streamUrl: string, fallbackUrl: string) {
  const [state, setState] = useState<State>(INITIAL);
  // Changer d'univers change tout ce que ces sections contiennent : le
  // serveur lit le cookie, mais la page, elle, a déjà ses données. Le
  // compteur du fournisseur rejoue donc le flux — c'est le seul moyen de
  // ne pas laisser un accueil général affiché à qui vient de basculer.
  const { version, univers } = useUnivers();
  // Le mode change les sections affichées autant que l'univers : les deux
  // sont lus par le serveur dans des cookies, et les deux doivent
  // relancer le flux.
  const { mode, version: versionMode } = useMode();
  // Plusieurs sections dépendent de qui regarde : l'instantané doit donc
  // être rangé par compte, sinon un appareil partagé montrerait une
  // seconde les recommandations du précédent.
  const { data: session } = useSession();
  const compte = session?.user?.id ?? "anonyme";

  // L'instantané ne doit jamais écraser des données déjà arrivées du
  // réseau : la lecture locale est rapide, mais rien ne garantit qu'elle
  // finisse la première.
  const reseauArrive = useRef(false);
  const pilote = useRef<Pilote>(pilotNeuf());

  const consommer = useCallback(
    async (depuis: number) => {
      const p = pilote.current;
      if (p.enCours || p.annule) return;
      p.enCours = true;
      const premier = depuis === 0;
      if (!premier) setState((prev) => ({ ...prev, suite: true }));

      function apply(update: (prev: State) => State) {
        if (!p.annule) setState(update);
      }

      /** Mémorise hors de React, pour l'archivage, puis publie. */
      function enregistrer(section: { id: string; key: string; title: string; data: unknown }) {
        const rang = p.recu.findIndex((s) => s.id === section.id);
        if (rang >= 0) p.recu[rang] = section;
        else p.recu.push(section);
      }

      function handle(event: StreamEvent) {
        switch (event.type) {
          case "meta":
            reseauArrive.current = true;
            p.suivant = event.suivant;
            p.encore = event.encore;
            apply((prev) => ({
              ...prev,
              starting: false,
              encore: event.encore,
              slots: poser(prev.slots, event.sections),
            }));
            break;
          case "hero":
            p.hero = event.data;
            apply((prev) => ({ ...prev, hero: event.data, heroPending: false }));
            break;
          case "section":
            enregistrer({ id: event.id, key: event.key, title: event.title, data: event.data });
            apply((prev) => ({
              ...prev,
              slots: prev.slots.map((slot) =>
                slot.id === event.id
                  ? { ...slot, title: event.title, status: "ready", data: event.data }
                  : slot
              ),
            }));
            break;
          case "failed":
            // La section ne viendra pas : on retire son squelette plutôt que
            // de le laisser tourner indéfiniment.
            if (event.key === "hero") apply((prev) => ({ ...prev, heroPending: false }));
            else {
              p.recu = p.recu.filter((s) => s.id !== event.id);
              apply((prev) => ({ ...prev, slots: prev.slots.filter((slot) => slot.id !== event.id) }));
            }
            break;
          case "end":
            apply((prev) => ({
              ...prev,
              reprise: false,
              heroPending: premier ? false : prev.heroPending,
              slots: prev.slots.filter((slot) => slot.status === "ready"),
            }));
            break;
        }
      }

      /**
       * Le flux n'est jamais mis en cache (il est lu au fil de l'eau), et son
       * repli n'est jamais appelé tant que le réseau répond. Sans ce rangement
       * explicite, la page d'accueil n'a donc rien à afficher hors-ligne alors
       * qu'elle vient de tout recevoir.
       */
      function archiver() {
        if (p.recu.length === 0) return;
        const assemblage: Assemblage = { hero: p.hero, sections: [...p.recu] };
        memoriserManuellement(fallbackUrl, assemblage);
        // Le même contenu, rangé une seconde fois sous une clé qui porte
        // l'univers, le mode et le compte : c'est ce que la prochaine
        // visite affichera avant même d'ouvrir le flux.
        void ecrireInstantane(p.cle, assemblage);
      }

      async function loadWhole() {
        const res = await fetch(fallbackUrl, { signal: p.controller?.signal });
        // Note : le repli hors-ligne relit la dernière page rangée, quel que
        // soit l'univers alors actif. Sans réseau, il n'y a rien d'autre à
        // servir — et une page vide serait pire qu'une page de l'autre bord.
        if (!res.ok) throw new Error("Chargement impossible.");
        const data = (await res.json()) as Assemblage;
        reseauArrive.current = true;
        p.recu = data.sections.map((s) => ({ ...s, id: identite(s) }));
        p.hero = data.hero;
        p.encore = false;
        apply(() => ({
          starting: false,
          failed: false,
          reprise: false,
          encore: false,
          suite: false,
          hero: data.hero,
          heroPending: false,
          slots: data.sections.map((s) => ({
            id: identite(s),
            key: s.key,
            title: s.title,
            status: "ready" as const,
            data: s.data,
          })),
        }));
        void ecrireInstantane(p.cle, data);
      }

      try {
        const res = await fetch(`${streamUrl}?depuis=${depuis}`, { signal: p.controller?.signal });
        if (!res.ok || !res.body) throw new Error("Flux indisponible.");
        await readNdjson<StreamEvent>(res, handle);
        if (!p.annule) archiver();
      } catch {
        // Une interruption volontaire n'est pas une panne : ne pas
        // basculer en repli, ni signaler une erreur à l'utilisateur.
        if (p.annule) return;
        if (!premier) {
          // Un lot suivant qui échoue ne doit pas effacer ce qui est déjà
          // lu : on cesse simplement d'en proposer la suite.
          p.encore = false;
          apply((prev) => ({ ...prev, encore: false }));
          return;
        }
        try {
          await loadWhole();
        } catch {
          // `failed` seulement si l'écran est vide : une page reprise de
          // l'instantané reste préférable à un message d'erreur, et le
          // bandeau de reprise dit déjà que les données ne sont pas
          // fraîches.
          apply((prev) => ({
            ...prev,
            starting: false,
            heroPending: false,
            failed: prev.slots.length === 0,
          }));
        }
      } finally {
        p.enCours = false;
        if (!premier && !p.annule) setState((prev) => ({ ...prev, suite: false }));
      }
    },
    [streamUrl, fallbackUrl]
  );

  const chargerSuite = useCallback(() => {
    const p = pilote.current;
    if (p.annule || p.enCours || !p.encore) return;
    void consommer(p.suivant);
  }, [consommer]);

  useEffect(() => {
    // Repartir des squelettes plutôt que de laisser les sections de
    // l'univers précédent à l'écran pendant que les nouvelles arrivent.
    setState(INITIAL);
    reseauArrive.current = false;

    // Quitter la page doit interrompre le flux : sans cela le serveur
    // continue de calculer et d'émettre des sections que plus personne
    // n'affiche, jusqu'à la fin de la réponse.
    const controller = new AbortController();
    const p = pilotNeuf();
    p.controller = controller;
    p.cle = cleInstantane(["sections", streamUrl, univers, mode, compte]);
    pilote.current = p;

    /** Affiche ce qui a été gardé, tant que rien de frais n'est arrivé. */
    function reprendre(garde: Assemblage) {
      if (p.annule || reseauArrive.current) return;
      if (garde.sections.length === 0) return;
      p.recu = garde.sections.map((s) => ({ ...s, id: identite(s) }));
      p.hero = garde.hero;
      setState(() => ({
        starting: false,
        failed: false,
        reprise: true,
        encore: false,
        suite: false,
        hero: garde.hero,
        // Le héros est considéré comme prêt : garder son squelette
        // au-dessus d'une page complète serait le seul endroit qui
        // clignote, et c'est le plus visible de tous.
        heroPending: false,
        slots: garde.sections.map((s) => ({
          id: identite(s),
          key: s.key,
          title: s.title,
          status: "ready" as const,
          data: s.data,
        })),
      }));
    }

    // Les deux partent ensemble. Celui qui arrive le premier s'affiche,
    // et l'instantané s'efface de lui-même à mesure que le frais arrive.
    void lireInstantane<Assemblage>(p.cle).then((garde) => {
      if (garde) reprendre(garde.valeur);
    });
    void consommer(0);

    return () => {
      p.annule = true;
      controller.abort();
    };
    // `univers` figure ici avec `version` : le premier couvre la lecture
    // initiale du cookie, le second les bascules qui suivent.
  }, [streamUrl, fallbackUrl, version, univers, versionMode, mode, compte, consommer]);

  return { ...state, chargerSuite };
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
