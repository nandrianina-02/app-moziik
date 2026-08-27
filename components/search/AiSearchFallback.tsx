"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { SectionResultats, type SectionRecherche } from "@/components/search/SearchSection";

type Interpretation = {
  genres: string[];
  langue?: string;
  motsCles: string[];
  explication: string;
};

/**
 * Une seconde lecture de la demande.
 *
 * La recherche du site part du texte : « une chanson douce pour dormir »
 * ne désigne aucun titre et aucun artiste. Ce bloc lit la même phrase
 * autrement — en genres, en langue, en mots-clés — puis réinterroge le
 * catalogue.
 *
 * Il ne se déclenche pas seulement sur un résultat vide. Mesuré sur le
 * catalogue d'essai : « de quoi accompagner une longue route en voiture »
 * remonte deux titres par la recherche ordinaire, simplement parce qu'un
 * mot sur huit ressemble à un mot-clé. Une phrase entière trouve presque
 * toujours quelque chose, et un repli réservé au vide n'aurait jamais
 * servi. La page l'affiche donc aussi sous une réponse maigre à une vraie
 * phrase — sans jamais remplacer les résultats du site, qui restent
 * au-dessus.
 *
 * L'appel part une fois par demande, jamais à chaque frappe : la page ne
 * monte ce composant qu'une fois la recherche terminée, et le verrou
 * ci-dessous couvre les remontages.
 */
export function AiSearchFallback({
  demande,
  avecResultats = false,
}: {
  demande: string;
  /** Vrai quand la recherche du site a tout de même trouvé quelque chose. */
  avecResultats?: boolean;
}) {
  const [songs, setSongs] = useState<Record<string, unknown>[]>([]);
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const [chargement, setChargement] = useState(true);
  const dernierAppel = useRef<string | null>(null);

  useEffect(() => {
    const phrase = demande.trim();
    if (phrase.length < 3 || dernierAppel.current === phrase) return;
    dernierAppel.current = phrase;

    const controleur = new AbortController();
    setChargement(true);
    setSongs([]);
    setInterpretation(null);

    fetch("/api/ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demande: phrase }),
      signal: controleur.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setInterpretation(data.interpretation ?? null);
        setSongs(data.songs ?? []);
      })
      .catch(() => {
        // Silence volontaire : c'est déjà un repli. Un message d'erreur
        // par-dessus « aucun résultat » n'apprendrait rien.
      })
      .finally(() => setChargement(false));

    return () => controleur.abort();
  }, [demande]);

  if (chargement) {
    return (
      <p className="mt-5 flex items-center justify-center gap-2 text-sm text-ink-muted">
        <Loader2 size={15} className="animate-spin" /> Autre lecture de votre demande…
      </p>
    );
  }

  if (songs.length === 0) return null;

  const section: SectionRecherche = {
    key: "ia",
    title: avecResultats ? "Ou, si vous cherchiez plutôt…" : "Ce qui pourrait convenir",
    kind: "song",
    items: songs,
    total: songs.length,
    disposition: "liste",
  };

  return (
    <div className="mt-6">
      <p className="mb-4 flex items-start gap-2 rounded-xl2 border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
        <span>
          {interpretation?.explication || "Voici ce qui se rapproche le plus de votre demande."}
          {interpretation && (interpretation.genres.length > 0 || interpretation.langue) && (
            <span className="mt-1 block text-xs">
              {[...interpretation.genres, interpretation.langue].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
      </p>
      <SectionResultats section={section} requete={demande} />
    </div>
  );
}
