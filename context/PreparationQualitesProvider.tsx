"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCw, X } from "lucide-react";
import { envoyerVersions, type EtapeTitre } from "@/lib/envoiTitre";
import type { Decoupe } from "@/lib/encodageAudio";
import { useToast } from "@/context/ToastProvider";

/**
 * Les qualités d'écoute (64, 128 et 320 kbit/s) préparées en arrière-plan,
 * après la publication.
 *
 * Avant, publier un titre attendait l'encodage des trois versions et leur
 * envoi : les deux tiers du temps. Désormais le titre est publié dès que
 * son fichier d'origine est envoyé (il se lit tout de suite, en qualité
 * d'origine), et ses versions se préparent ici pendant qu'on continue
 * d'utiliser le site, l'une après l'autre : l'encodage occupe le
 * processeur, deux à la fois ralentiraient tout.
 *
 * Fermer l'onglet avant la fin ne perd rien d'important : le titre reste
 * publié et jouable, et « Générer les qualités » sur sa page de
 * modification reprend le travail à partir du fichier d'origine.
 */

type Tache = {
  id: string;
  songId: string;
  titre: string;
  /** Le fichier d'origine, ou de quoi le relire. */
  source: Blob | (() => Promise<Blob>);
  decoupe: Decoupe;
  etat: "attente" | EtapeTitre | "fini" | "erreur";
  progression: number;
  erreur?: string;
};

type Demande = Pick<Tache, "songId" | "titre" | "source" | "decoupe">;

const Contexte = createContext<{ preparer: (demande: Demande) => void; enCours: (songId: string) => boolean }>({
  preparer: () => {},
  enCours: () => false,
});

export function usePreparationQualites() {
  return useContext(Contexte);
}

const LIBELLES: Record<Tache["etat"], string> = {
  attente: "En attente",
  source: "Envoi",
  encodage: "Encodage des qualités",
  versions: "Envoi des qualités",
  fini: "Qualités prêtes",
  erreur: "Échec",
};

export function PreparationQualitesProvider({ children }: { children: React.ReactNode }) {
  const pushToast = useToast();
  const [taches, setTaches] = useState<Tache[]>([]);
  const occupe = useRef(false);

  const maj = useCallback((id: string, changement: Partial<Tache>) => {
    setTaches((liste) => liste.map((t) => (t.id === id ? { ...t, ...changement } : t)));
  }, []);

  const preparer = useCallback((demande: Demande) => {
    setTaches((liste) => [
      ...liste.filter((t) => t.songId !== demande.songId),
      { ...demande, id: `${demande.songId}-${Date.now()}`, etat: "attente", progression: 0 },
    ]);
  }, []);

  // Une tâche à la fois, dans l'ordre d'arrivée.
  useEffect(() => {
    if (occupe.current) return;
    const suivante = taches.find((t) => t.etat === "attente");
    if (!suivante) return;
    occupe.current = true;
    (async () => {
      try {
        maj(suivante.id, { etat: "encodage" });
        const source = typeof suivante.source === "function" ? await suivante.source() : suivante.source;
        const { variantes } = await envoyerVersions(
          source,
          suivante.decoupe,
          suivante.titre,
          (p) => maj(suivante.id, { progression: p }),
          (etape) => maj(suivante.id, { etat: etape }),
        );
        const res = await fetch(`/api/songs/${suivante.songId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioVariantes: variantes }),
        });
        if (!res.ok) throw new Error("Les qualités n'ont pas pu être rattachées au titre.");
        maj(suivante.id, { etat: "fini", progression: 100 });
        pushToast("success", `« ${suivante.titre} » : qualités d'écoute prêtes.`);
        window.setTimeout(() => setTaches((liste) => liste.filter((t) => t.id !== suivante.id)), 6000);
      } catch (e) {
        maj(suivante.id, { etat: "erreur", erreur: e instanceof Error ? e.message : "Échec de la préparation." });
      } finally {
        occupe.current = false;
        // Relance l'examen de la file : la tâche suivante attend peut-être.
        setTaches((liste) => [...liste]);
      }
    })();
  }, [taches, maj, pushToast]);

  // Quitter la page pendant une préparation : le navigateur demande confirmation.
  const actives = taches.filter((t) => t.etat !== "fini" && t.etat !== "erreur");
  useEffect(() => {
    if (actives.length === 0) return;
    const avertir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [actives.length]);

  const enCours = useCallback((songId: string) => taches.some((t) => t.songId === songId && t.etat !== "fini" && t.etat !== "erreur"), [taches]);

  return (
    <Contexte.Provider value={{ preparer, enCours }}>
      {children}
      {taches.length > 0 && (
        <div
          className="fixed bottom-[calc(var(--hauteur-lecteur,0px)+4.5rem)] right-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] space-y-2 md:bottom-[calc(var(--hauteur-lecteur,0px)+1rem)] md:right-4 print:hidden"
          role="status"
          aria-live="polite"
        >
          {taches.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-surface p-3 shadow-[0_8px_24px_rgba(0,0,0,0.3)] animate-fade-in-up">
              <div className="flex items-center gap-2">
                {t.etat === "fini" ? (
                  <CheckCircle2 size={16} className="shrink-0 text-verified" />
                ) : t.etat === "erreur" ? (
                  <AlertTriangle size={16} className="shrink-0 text-danger" />
                ) : (
                  <Loader2 size={16} className="shrink-0 animate-spin text-accent" />
                )}
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{t.titre}</p>
                {t.etat === "erreur" && (
                  <>
                    <button
                      type="button"
                      onClick={() => maj(t.id, { etat: "attente", progression: 0, erreur: undefined })}
                      aria-label="Réessayer"
                      title="Réessayer"
                      className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-ink/[0.08] hover:text-ink"
                    >
                      <RotateCw size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaches((liste) => liste.filter((x) => x.id !== t.id))}
                      aria-label="Fermer"
                      title="Fermer"
                      className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-ink/[0.08] hover:text-ink"
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {t.erreur ?? `${LIBELLES[t.etat]}${t.etat !== "fini" && t.etat !== "attente" ? ` · ${t.progression} %` : ""}`}
              </p>
              {t.etat !== "erreur" && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/10">
                  <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${t.progression}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Contexte.Provider>
  );
}
