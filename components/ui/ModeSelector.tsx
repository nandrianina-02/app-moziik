"use client";

import { useEffect, useRef, useState } from "react";
import {
  BedDouble,
  BriefcaseBusiness,
  Check,
  Compass,
  Dumbbell,
  Flame,
  GraduationCap,
  Heart,
  Leaf,
  Moon,
  Plane,
  Sparkles,
  Sunrise,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { useMode } from "@/context/ModeProvider";
import { MODES, MODES_INFO, modeDeLHeure, type Mode } from "@/lib/modes";

/**
 * Le sélecteur de mode d'écoute.
 *
 * POURQUOI UN MENU ET NON UNE RANGÉE
 *
 * Douze modes ne tiennent pas dans un en-tête, et les afficher tous en
 * permanence ferait de ce réglage la chose la plus visible du site — alors
 * qu'on en change quelques fois par jour au plus. Le bouton dit le mode
 * courant, le menu propose les autres.
 *
 * PAS D'EMOJI DANS LE CODE
 *
 * Chaque mode porte une icône dessinée plutôt qu'un caractère : le rendu
 * d'un emoji dépend de la police du système, et deux appareils n'affichent
 * pas le même dessin. Un admin qui veut des emoji dans les titres de
 * sections peut les saisir depuis /admin/accueil — ce sont des données,
 * pas du code.
 */

const ICONES: Record<Mode, React.ComponentType<{ size?: number | string; className?: string }>> = {
  voyage: Plane,
  sport: Dumbbell,
  etude: GraduationCap,
  travail: BriefcaseBusiness,
  sommeil: BedDouble,
  relaxation: Leaf,
  romance: Heart,
  fete: Flame,
  matin: Sunrise,
  nuit: Moon,
  decouverte: Compass,
  tendance: TrendingUp,
};

export function ModeSelector({ pleineLargeur = false }: { pleineLargeur?: boolean }) {
  const { mode, choix, setMode, pret } = useMode();
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur : le menu se superpose au contenu, il ne
  // doit pas rester ouvert quand on va ailleurs.
  useEffect(() => {
    if (!ouvert) return;
    function surClic(e: MouseEvent) {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", surClic);
    return () => document.removeEventListener("mousedown", surClic);
  }, [ouvert]);

  const Icone = ICONES[mode];
  const automatique = choix === "auto";

  function choisir(valeur: Mode | "auto") {
    setMode(valeur);
    setOuvert(false);
  }

  return (
    <div ref={conteneur} className={`relative ${pleineLargeur ? "w-full" : "shrink-0"}`}>
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        disabled={!pret}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        className={`flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent disabled:opacity-60 ${
          pleineLargeur ? "w-full justify-between" : ""
        }`}
      >
        <span className="flex items-center gap-1.5">
          <Icone size={14} className="text-accent" />
          {MODES_INFO[mode].label}
        </span>
        {automatique && <span className="text-[10px] uppercase tracking-wide text-ink-muted">auto</span>}
      </button>

      {ouvert && (
        <div
          role="menu"
          className={`absolute right-0 z-40 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-xl2 border border-border bg-surface p-1.5 shadow-xl ${
            pleineLargeur ? "left-0 right-auto w-full" : ""
          }`}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => choisir("auto")}
            className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-base"
          >
            <Wand2 size={15} className="mt-0.5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">Automatique</span>
              <span className="block text-xs text-ink-muted">
                Suit l&apos;heure qu&apos;il est chez vous — actuellement {MODES_INFO[modeDeLHeure(new Date().getHours())].label.toLowerCase()}.
              </span>
            </span>
            {automatique && <Check size={14} className="mt-0.5 shrink-0 text-accent" />}
          </button>

          <div className="my-1.5 h-px bg-border" />

          {MODES.map((m) => {
            const IconeMode = ICONES[m];
            const actif = choix === m;
            return (
              <button
                key={m}
                type="button"
                role="menuitem"
                onClick={() => choisir(m)}
                className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-base"
              >
                <IconeMode size={15} className="mt-0.5 shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{MODES_INFO[m].label}</span>
                  <span className="block text-xs text-ink-muted">{MODES_INFO[m].intention}</span>
                </span>
                {actif && <Check size={14} className="mt-0.5 shrink-0 text-accent" />}
              </button>
            );
          })}

          <p className="px-2.5 pb-1 pt-2 text-[11px] leading-relaxed text-ink-muted">
            <Sparkles size={11} className="mr-1 inline align-[-1px]" />
            Un mode qui n&apos;a pas assez de titres dans votre univers n&apos;affiche pas de section : les
            sélections se construisent sur des mesures, pas sur du remplissage.
          </p>
        </div>
      )}
    </div>
  );
}
