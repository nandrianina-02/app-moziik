"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Languages, Loader2, Mic2, RotateCcw, Sparkles } from "lucide-react";
import { analyserParoles, ligneActive, parolesEnTexte } from "@/lib/lyrics";

/**
 * Paroles du morceau en cours.
 *
 * Remplace l'égaliseur au centre du lecteur. Trois états, jamais
 * confondus : synchronisées (elles défilent et se cliquent), simplement
 * disponibles (texte lisible, pas d'horodatage dans la source), ou
 * absentes — auquel cas on le dit, plutôt que d'afficher un vide.
 */

/** Délai après un défilement manuel avant que le suivi automatique ne reprenne. */
const PAUSE_SUIVI_MS = 4000;

/**
 * Langues de traduction proposées.
 *
 * Le français était la seule cible possible, ce qui rendait le bouton sans
 * objet sur un morceau déjà en français — c'est-à-dire une bonne part du
 * catalogue. Les trois langues du public sont désormais offertes.
 */
const LANGUES_TRADUCTION = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "mg", label: "Malagasy" },
] as const;

export function LyricsPanel({
  lyrics,
  progress,
  onSeek,
  titre,
  artiste,
  className = "",
}: {
  lyrics?: string;
  progress: number;
  onSeek: (seconds: number) => void;
  titre: string;
  artiste?: string;
  className?: string;
}) {
  const paroles = useMemo(() => analyserParoles(lyrics), [lyrics]);
  const conteneurRef = useRef<HTMLDivElement>(null);
  const lignesRef = useRef<(HTMLElement | null)[]>([]);

  const [suiviAuto, setSuiviAuto] = useState(true);
  const reprisePrevue = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Distingue le défilement que NOUS provoquons de celui de l'utilisateur :
  // sans ce drapeau, chaque saut automatique se prend lui-même pour une
  // intervention manuelle et désactive aussitôt le suivi.
  const defilementProgramme = useRef(false);

  const [traduction, setTraduction] = useState<string[] | null>(null);
  const [traductionBloc, setTraductionBloc] = useState<string | null>(null);
  const [traduitEnCours, setTraduitEnCours] = useState(false);
  const [erreurTraduction, setErreurTraduction] = useState<string | null>(null);
  const [afficherTraduction, setAfficherTraduction] = useState(false);
  const [langueCible, setLangueCible] = useState<string>("fr");

  const index = paroles.synchronisees ? ligneActive(paroles.lignes, progress) : -1;

  // Une nouvelle chanson repart de zéro : traduction, suivi, position.
  useEffect(() => {
    setTraduction(null);
    setTraductionBloc(null);
    setErreurTraduction(null);
    setAfficherTraduction(false);
    setSuiviAuto(true);
    conteneurRef.current?.scrollTo({ top: 0 });
  }, [lyrics]);

  useEffect(() => {
    if (!paroles.synchronisees || !suiviAuto || index < 0) return;
    const conteneur = conteneurRef.current;
    const ligne = lignesRef.current[index];
    if (!conteneur || !ligne) return;

    // On centre la ligne dans SON conteneur, sans `scrollIntoView` : celui-ci
    // fait aussi défiler tous les ancêtres, ce qui déplace la page entière
    // sous le lecteur.
    const cible = ligne.offsetTop - conteneur.clientHeight / 2 + ligne.clientHeight / 2;
    defilementProgramme.current = true;
    conteneur.scrollTo({ top: Math.max(0, cible), behavior: "smooth" });
    const relache = setTimeout(() => (defilementProgramme.current = false), 600);
    return () => clearTimeout(relache);
  }, [index, suiviAuto, paroles.synchronisees]);

  function auDefilement() {
    if (defilementProgramme.current) return;
    setSuiviAuto(false);
    if (reprisePrevue.current) clearTimeout(reprisePrevue.current);
    reprisePrevue.current = setTimeout(() => setSuiviAuto(true), PAUSE_SUIVI_MS);
  }

  useEffect(() => {
    return () => {
      if (reprisePrevue.current) clearTimeout(reprisePrevue.current);
    };
  }, []);

  async function traduire() {
    if (traduction || traductionBloc) {
      setAfficherTraduction((v) => !v);
      return;
    }
    setTraduitEnCours(true);
    setErreurTraduction(null);
    try {
      const res = await fetch("/api/lyrics/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: parolesEnTexte(paroles), target: langueCible }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Traduction impossible.");

      const lignesTraduites = String(data.translatedText).split(/\r?\n/);
      // Le service peut fusionner ou couper des lignes : dans ce cas on
      // n'aligne rien de force, on affiche la traduction en bloc. Une
      // correspondance approximative placerait la mauvaise phrase en face
      // de la mauvaise ligne, ce qui est pire que pas de synchronisation.
      if (lignesTraduites.length === paroles.lignes.length) {
        setTraduction(lignesTraduites);
      } else {
        setTraductionBloc(String(data.translatedText));
      }
      setAfficherTraduction(true);
    } catch (err) {
      setErreurTraduction(err instanceof Error ? err.message : "Traduction impossible.");
    } finally {
      setTraduitEnCours(false);
    }
  }

  const aDesParoles = paroles.lignes.some((l) => l.texte.trim().length > 0);

  if (!aDesParoles) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-xl2 border border-dashed border-border bg-surface/40 px-6 py-14 text-center ${className}`}
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
          <Mic2 size={22} />
        </span>
        <p className="font-display text-base text-ink">Paroles indisponibles</p>
        <p className="max-w-xs text-sm text-ink-muted">
          Aucune parole n&apos;a encore été ajoutée à «&nbsp;{titre}&nbsp;»
          {artiste ? ` par ${artiste}` : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <Mic2 size={14} className="text-accent" /> Paroles
          </span>
          {paroles.synchronisees ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-semibold text-accent">
              <Sparkles size={10} /> Synchronisées
            </span>
          ) : (
            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-muted">
              Non synchronisées
            </span>
          )}
        </span>

        <span className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor="langue-traduction">
            Langue de traduction
          </label>
          <select
            id="langue-traduction"
            value={langueCible}
            onChange={(e) => {
              setLangueCible(e.target.value);
              // La traduction en mémoire est celle de l'ancienne langue :
              // la garder afficherait un texte qui ne correspond plus au
              // bouton.
              setTraduction(null);
              setTraductionBloc(null);
              setAfficherTraduction(false);
              setErreurTraduction(null);
            }}
            className="rounded-full border border-border bg-surface px-2 py-1 text-[11px] text-ink-muted outline-none focus:border-accent"
          >
            {LANGUES_TRADUCTION.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          {paroles.synchronisees && !suiviAuto && (
            <button
              onClick={() => setSuiviAuto(true)}
              className="flex items-center gap-1 rounded-full border border-accent/40 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/10"
            >
              <RotateCcw size={11} /> Suivre
            </button>
          )}
          <button
            onClick={traduire}
            disabled={traduitEnCours}
            aria-pressed={afficherTraduction}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors disabled:opacity-60 ${
              afficherTraduction
                ? "border-accent bg-accent/12 text-accent"
                : "border-border text-ink-muted hover:border-accent hover:text-accent"
            }`}
          >
            {traduitEnCours ? <Loader2 size={11} className="animate-spin" /> : <Languages size={11} />}
            {afficherTraduction ? "Version originale" : "Traduire"}
          </button>
        </span>
      </div>

      {erreurTraduction && (
        <p className="mb-3 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink-muted">
          {erreurTraduction}
        </p>
      )}

      <div
        ref={conteneurRef}
        onScroll={auDefilement}
        className="min-h-0 flex-1 overflow-y-auto pr-1"
      >
        {afficherTraduction && traductionBloc ? (
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{traductionBloc}</p>
        ) : (
          <ul className="space-y-1 pb-24">
            {paroles.lignes.map((ligne, i) => {
              const texte = afficherTraduction && traduction ? traduction[i] : ligne.texte;
              if (!texte?.trim()) return <li key={i} className="h-4" aria-hidden />;

              const estActive = i === index;
              const cliquable = paroles.synchronisees && ligne.temps !== null;

              const contenu = (
                <span
                  className={`block transition-all duration-300 ${
                    estActive
                      ? "text-lg font-semibold text-accent md:text-xl"
                      : // Les lignes deja chantees restaient a 70 %
                        // d'opacite, soit 3,34:1 sur le fond sombre. La
                        // hierarchie est deja portee par la ligne active —
                        // plus grande, grasse et en accent — sans avoir a
                        // rendre le reste illisible.
                        "text-[15px] text-ink-muted"
                  }`}
                >
                  {texte}
                </span>
              );

              return (
                <li
                  key={i}
                  ref={(el) => {
                    lignesRef.current[i] = el;
                  }}
                >
                  {cliquable ? (
                    <button
                      onClick={() => onSeek(ligne.temps as number)}
                      title="Reprendre la lecture à cette ligne"
                      className="w-full rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface"
                    >
                      {contenu}
                    </button>
                  ) : (
                    <p className="px-2 py-1">{contenu}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-2 shrink-0 border-t border-border pt-2 text-[11px] text-ink-muted">
        {paroles.credits
          ? `Paroles — ${paroles.credits}`
          : `Paroles fournies par ${artiste ?? "l'artiste"} sur Moziik.`}
      </p>
    </div>
  );
}
