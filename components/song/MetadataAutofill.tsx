"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, Loader2, RotateCcw, ScanLine, Sparkles } from "lucide-react";

/** État d'un champ après lecture des balises du fichier. */
export type EtatChamp = "applique" | "conserve" | "sans-correspondance";

export type ChampDetecte = {
  /** Libellé affiché, identique à celui du champ du formulaire. */
  champ: string;
  /** Valeur lue, telle qu'elle sera montrée à l'artiste. */
  valeur: string;
  etat: EtatChamp;
  /** Précision affichée en petit : pourquoi conservé, pourquoi sans correspondance. */
  note?: string;
};

export type RapportMetadonnees = {
  nomFichier: string;
  /** Conteneur et débit, ex. « MP3 · 320 kb/s ». */
  technique?: string;
  champs: ChampDetecte[];
  /** Vrai tant que l'analyse tourne. */
  enCours?: boolean;
  /** Message d'échec de lecture, le cas échéant. */
  erreur?: string;
};

const STYLE_ETAT: Record<EtatChamp, { pastille: string; texte: string }> = {
  applique: { pastille: "bg-verified/15 text-verified", texte: "text-ink" },
  conserve: { pastille: "bg-warning/15 text-warning", texte: "text-ink-muted" },
  "sans-correspondance": { pastille: "bg-ink-muted/15 text-ink-muted", texte: "text-ink-muted" },
};

/**
 * Compte rendu de la lecture automatique des balises.
 *
 * Il ne suffit pas de remplir les champs : sans ce compte rendu, l'artiste
 * ne sait pas ce qui vient du fichier et ce qu'il a écrit lui-même, ni
 * pourquoi un genre pourtant présent dans le fichier n'a pas été retenu.
 * Chaque ligne dit l'un des trois cas — appliqué, conservé (le champ était
 * déjà rempli), sans correspondance dans les listes du site.
 */
export function MetadataAutofill({
  rapport,
  onAppliquerQuandMeme,
  onAnnuler,
}: {
  rapport: RapportMetadonnees | null;
  /** Écrase les champs que l'artiste avait déjà remplis. */
  onAppliquerQuandMeme?: () => void;
  /** Rétablit le formulaire tel qu'il était avant la lecture. */
  onAnnuler?: () => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {rapport && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22 }}
          className="overflow-hidden"
        >
          <div className="mt-4 rounded-xl2 border border-border bg-base p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                  {rapport.enCours ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {rapport.enCours ? "Lecture des métadonnées…" : "Métadonnées du fichier"}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {rapport.nomFichier}
                    {rapport.technique ? ` · ${rapport.technique}` : ""}
                  </p>
                </div>
              </div>

              {!rapport.enCours && (onAppliquerQuandMeme || onAnnuler) && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  {onAppliquerQuandMeme && (
                    <button
                      type="button"
                      onClick={onAppliquerQuandMeme}
                      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
                    >
                      <Sparkles size={12} /> Écraser mes saisies
                    </button>
                  )}
                  {onAnnuler && (
                    <button
                      type="button"
                      onClick={onAnnuler}
                      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
                    >
                      <RotateCcw size={12} /> Annuler le remplissage
                    </button>
                  )}
                </div>
              )}
            </div>

            {rapport.erreur && (
              <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-accent/10 p-2.5 text-xs text-accent">
                <AlertCircle size={13} className="mt-0.5 shrink-0" /> {rapport.erreur}
              </p>
            )}

            {!rapport.enCours && !rapport.erreur && rapport.champs.length === 0 && (
              <p className="mt-3 text-xs text-ink-muted">
                Ce fichier ne porte aucune balise exploitable — à remplir à la main.
              </p>
            )}

            {rapport.champs.length > 0 && (
              <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {rapport.champs.map((c) => {
                  const style = STYLE_ETAT[c.etat];
                  return (
                    <li key={c.champ} className="flex items-start gap-2 text-xs">
                      <span className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full ${style.pastille}`}>
                        {c.etat === "applique" ? <Check size={10} /> : <span className="text-[9px] font-bold">!</span>}
                      </span>
                      <span className="min-w-0">
                        <span className="text-ink-muted">{c.champ} : </span>
                        <span className={`break-words ${style.texte}`}>{c.valeur}</span>
                        {c.note && <span className="block text-[11px] text-ink-muted">{c.note}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
