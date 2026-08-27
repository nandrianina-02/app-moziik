"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, Loader2, Sparkles, X } from "lucide-react";
import { readApiError } from "@/lib/readApiError";

export type PropositionTitre = {
  genre: string;
  langue: string;
  tags: string[];
  description: string;
  remarque: string;
};

/** Ce que le formulaire porte déjà, pour signaler ce qui serait écrasé. */
export type ValeursTitre = {
  genre: string;
  language: string;
  tags: string[];
  description: string;
};

export type ChampsAppliques = Partial<{
  genre: string;
  language: string;
  tags: string[];
  description: string;
}>;

type Cle = "genre" | "language" | "tags" | "description";

const LIBELLES: Record<Cle, string> = {
  genre: "Genre",
  language: "Langue",
  tags: "Mots-clés",
  description: "Description",
};

/**
 * Propositions de l'IA pour un titre en cours de publication.
 *
 * Rien ne s'applique tout seul, et c'est le point : un titre est signé par
 * son artiste. Chaque proposition s'affiche avec sa valeur, et se pose
 * champ par champ. Celles qui écraseraient une saisie le disent avant.
 *
 * Le panneau ne rédige pas non plus à la place de l'artiste quand il n'a
 * rien pour le faire : sur un titre dont seul le nom est connu, la
 * description revient vide et la ligne n'apparaît pas — voir
 * lib/ai/songMetadata.ts, qui préfère le vide à l'invention.
 */
export function SongAiAssist({
  disponible,
  langues,
  donnees,
  valeurs,
  onAppliquer,
}: {
  /** Faux quand la clé manque, que l'administration a coupé, ou que le plafond est atteint. */
  disponible: boolean;
  langues: string[];
  /** Lu au moment du clic, jamais avant : le formulaire bouge jusque-là. */
  donnees: () => { title: string; artistName: string; lyrics?: string; album?: string };
  valeurs: ValeursTitre;
  onAppliquer: (champs: ChampsAppliques) => void;
}) {
  const [proposition, setProposition] = useState<PropositionTitre | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [poses, setPoses] = useState<Cle[]>([]);

  const demander = useCallback(async () => {
    const contexte = donnees();
    if (!contexte.title.trim()) {
      setErreur("Indiquez d'abord le titre du morceau.");
      setProposition(null);
      return;
    }
    setChargement(true);
    setErreur(null);
    setPoses([]);
    try {
      const res = await fetch("/api/ai/song-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contexte, languages: langues }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "La proposition a échoué."));
      const data = await res.json();
      setProposition(data.proposition);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "La proposition a échoué.");
      setProposition(null);
    } finally {
      setChargement(false);
    }
  }, [donnees, langues]);

  if (!disponible) return null;

  const lignes: { cle: Cle; valeur: string; brut: string[] | string }[] = [];
  if (proposition) {
    if (proposition.genre) lignes.push({ cle: "genre", valeur: proposition.genre, brut: proposition.genre });
    if (proposition.langue) lignes.push({ cle: "language", valeur: proposition.langue, brut: proposition.langue });
    if (proposition.tags.length)
      lignes.push({ cle: "tags", valeur: proposition.tags.join(", "), brut: proposition.tags });
    if (proposition.description)
      lignes.push({ cle: "description", valeur: proposition.description, brut: proposition.description });
  }

  function dejaRempli(cle: Cle): boolean {
    if (cle === "tags") return valeurs.tags.length > 0;
    if (cle === "genre") return Boolean(valeurs.genre);
    if (cle === "language") return Boolean(valeurs.language);
    return Boolean(valeurs.description.trim());
  }

  function poser(cle: Cle, brut: string[] | string) {
    onAppliquer(cle === "tags" ? { tags: brut as string[] } : ({ [cle]: brut as string } as ChampsAppliques));
    setPoses((prev) => (prev.includes(cle) ? prev : [...prev, cle]));
  }

  function toutPoser() {
    const champs: ChampsAppliques = {};
    for (const l of lignes) {
      if (l.cle === "tags") champs.tags = l.brut as string[];
      else champs[l.cle] = l.brut as string;
    }
    onAppliquer(champs);
    setPoses(lignes.map((l) => l.cle));
  }

  return (
    <div>
      <button
        type="button"
        onClick={demander}
        disabled={chargement}
        className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
      >
        {chargement ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {chargement ? "Analyse du morceau…" : proposition ? "Proposer à nouveau" : "Proposer genre, mots-clés et description"}
      </button>

      {erreur && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-accent">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {erreur}
        </p>
      )}

      <AnimatePresence initial={false}>
        {proposition && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl2 border border-border bg-base p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Sparkles size={14} className="text-accent" /> Propositions de l&apos;IA
                </p>
                <div className="flex shrink-0 gap-2">
                  {lignes.length > 0 && (
                    <button
                      type="button"
                      onClick={toutPoser}
                      className="rounded-full border border-border px-3 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
                    >
                      Tout appliquer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setProposition(null)}
                    aria-label="Fermer les propositions"
                    className="grid h-6 w-6 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {lignes.length === 0 ? (
                <p className="mt-2 text-xs text-ink-muted">
                  Rien à proposer avec ces seuls éléments. Collez les paroles, puis réessayez.
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {lignes.map((l) => {
                    const pose = poses.includes(l.cle);
                    const ecrase = !pose && dejaRempli(l.cle);
                    return (
                      <li key={l.cle} className="flex flex-wrap items-start gap-x-3 gap-y-1.5 text-xs">
                        <span className="min-w-[5rem] text-ink-muted">{LIBELLES[l.cle]}</span>
                        <span className="min-w-[10rem] flex-1 break-words text-ink">{l.valeur}</span>
                        {pose ? (
                          <span className="flex shrink-0 items-center gap-1 text-verified">
                            <Check size={12} /> Appliqué
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => poser(l.cle, l.brut)}
                            className="shrink-0 rounded-full border border-border px-2.5 py-1 font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
                          >
                            {ecrase ? "Remplacer" : "Appliquer"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {proposition.remarque && (
                <p className="mt-3 border-t border-border pt-2.5 text-[11px] text-ink-muted">
                  {proposition.remarque}
                </p>
              )}
              <p className="mt-1.5 text-[11px] text-ink-muted">
                Relisez avant de publier : ce texte paraîtra sous votre nom.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
