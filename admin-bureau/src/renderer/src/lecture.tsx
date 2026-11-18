import { useSyncExternalStore } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { telechargerAuthentifie } from "./api";
import clsx from "./clsx";

/*
 * Écoute d'extraits dans l'administration (doublons, genres, paroles) : un
 * seul son à la fois dans tout le logiciel, comme un lecteur. L'audio est
 * téléchargé avec le jeton (voir telechargerAuthentifie) en qualité basse,
 * puis lu depuis la mémoire ; les derniers extraits restent en cache.
 */

type Etat = { id: string | null; chargement: string | null; erreur: string | null };
let etat: Etat = { id: null, chargement: null, erreur: null };
const abonnes = new Set<() => void>();
const changer = (e: Partial<Etat>) => {
  etat = { ...etat, ...e };
  for (const f of abonnes) f();
};

const audio = new Audio();
audio.addEventListener("ended", () => changer({ id: null }));
const cache = new Map<string, string>();
const CACHE_MAX = 12;

async function adresse(id: string) {
  const deja = cache.get(id);
  if (deja) return deja;
  const url = URL.createObjectURL(await telechargerAuthentifie(`/api/stream/${id}?q=low`));
  cache.set(id, url);
  // Les plus anciens sortent du cache : un extrait pèse quelques mégaoctets.
  while (cache.size > CACHE_MAX) {
    const [premier, ancienne] = cache.entries().next().value as [string, string];
    URL.revokeObjectURL(ancienne);
    cache.delete(premier);
  }
  return url;
}

/** Joue un titre ; `depart` est une fraction de la durée (0,35 pour le milieu d'un morceau). */
export async function jouer(id: string, depart = 0) {
  if (etat.id === id && !audio.paused) return arreter();
  audio.pause();
  changer({ chargement: id, erreur: null });
  try {
    audio.src = await adresse(id);
    if (depart > 0) {
      await new Promise<void>((r) => {
        if (audio.readyState >= 1) return r();
        audio.addEventListener("loadedmetadata", () => r(), { once: true });
      });
      if (Number.isFinite(audio.duration)) audio.currentTime = audio.duration * depart;
    }
    await audio.play();
    changer({ id, chargement: null });
  } catch (e) {
    changer({ id: null, chargement: null, erreur: e instanceof Error ? e.message : "Lecture impossible." });
  }
}

export function arreter() {
  audio.pause();
  changer({ id: null });
}

/** L'élément audio partagé, pour qui doit suivre la position (atelier des paroles). */
export const lecteur = audio;

export function useLecture(): Etat {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => etat,
  );
}

/** Bouton lecture / pause d'un extrait. */
export function BoutonEcoute({ id, depart = 0, taille = 32, className }: { id: string; depart?: number; taille?: number; className?: string }) {
  const { id: enCours, chargement } = useLecture();
  const joue = enCours === id;
  return (
    <button
      type="button"
      title={joue ? "Arrêter" : "Écouter un extrait"}
      onClick={(e) => {
        e.stopPropagation();
        void jouer(id, depart);
      }}
      className={clsx("grid shrink-0 place-items-center rounded-full transition-colors", joue ? "bg-accent text-sur-accent" : "bg-surface-2 text-texte-2 hover:text-texte", className)}
      style={{ width: taille, height: taille }}
    >
      {chargement === id ? <Loader2 size={taille * 0.45} className="animate-spin" /> : joue ? <Pause size={taille * 0.45} /> : <Play size={taille * 0.45} className="translate-x-px" />}
    </button>
  );
}
