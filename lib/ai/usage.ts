import AiUsage from "@/models/AiUsage";
import { connectDB } from "@/lib/db";
import type { IdFonctionnaliteIA } from "@/lib/ai/features";

/**
 * Compteurs d'usage de l'IA et plafond journalier.
 *
 * Le plafond se vérifie avant chaque appel, donc sur le chemin critique.
 * Le relire en base à chaque fois ajouterait un aller-retour à une requête
 * qui en compte déjà plusieurs, pour une valeur qui bouge d'une unité à la
 * fois : on le garde en mémoire quelques secondes, et on l'incrémente
 * localement à chaque appel enregistré.
 *
 * Ce que cette approche concède : sur un déploiement multi-instances, deux
 * instances peuvent dépasser le plafond de ce qu'elles ont servi pendant
 * la même fenêtre de fraîcheur. Le dépassement est borné par le trafic de
 * quelques secondes, jamais par une dérive continue — chaque relecture
 * repart du total réel écrit en base.
 */

const FRAICHEUR_MS = 20 * 1000;

let cache: { jour: string; total: number; expire: number } | null = null;

/** Jour UTC au format AAAA-MM-JJ — voir models/AiUsage.ts sur ce choix. */
export function jourCourant(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Total d'appels partis aujourd'hui, erreurs comprises. */
export async function appelsDuJour(): Promise<number> {
  const jour = jourCourant();
  const maintenant = Date.now();
  if (cache && cache.jour === jour && cache.expire > maintenant) return cache.total;

  await connectDB();
  const lignes = await AiUsage.find({ day: jour }).select("calls errors").lean();
  const total = lignes.reduce((somme, l) => somme + (l.calls ?? 0), 0);

  cache = { jour, total, expire: maintenant + FRAICHEUR_MS };
  return total;
}

/**
 * Enregistre un appel. Appelé aussi bien en succès qu'en échec : un appel
 * parti puis tombé en erreur a pu être facturé, l'ignorer laisserait une
 * boucle en échec dépenser sans jamais approcher le plafond.
 */
export async function enregistrerUsage(
  fonctionnalite: IdFonctionnaliteIA,
  { entree = 0, sortie = 0, erreur = false }: { entree?: number; sortie?: number; erreur?: boolean }
): Promise<void> {
  const jour = jourCourant();

  if (cache && cache.jour === jour) cache.total += 1;
  else cache = { jour, total: 1, expire: Date.now() + FRAICHEUR_MS };

  try {
    await connectDB();
    await AiUsage.updateOne(
      { day: jour, feature: fonctionnalite },
      {
        $inc: { calls: 1, inputTokens: entree, outputTokens: sortie, errors: erreur ? 1 : 0 },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );
  } catch (err) {
    // Un compteur qui ne s'écrit pas ne doit pas faire échouer la réponse
    // que l'utilisateur attend : l'appel a eu lieu et a réussi.
    console.error("[ia] compteur d'usage non enregistré :", err);
  }
}

export type LigneUsage = {
  feature: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  errors: number;
};

/** Détail des `jours` derniers jours, pour la page de réglages. */
export async function usageRecent(jours = 30): Promise<{
  parJour: { day: string; calls: number }[];
  parFonctionnalite: LigneUsage[];
  aujourdhui: number;
}> {
  await connectDB();
  const depuis = new Date(Date.now() - jours * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const lignes = await AiUsage.find({ day: { $gte: depuis } })
    .select("day feature calls inputTokens outputTokens errors")
    .lean();

  const parJour = new Map<string, number>();
  const parFonctionnalite = new Map<string, LigneUsage>();
  for (const l of lignes) {
    parJour.set(l.day, (parJour.get(l.day) ?? 0) + (l.calls ?? 0));
    const cumul = parFonctionnalite.get(l.feature) ?? {
      feature: l.feature,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      errors: 0,
    };
    cumul.calls += l.calls ?? 0;
    cumul.inputTokens += l.inputTokens ?? 0;
    cumul.outputTokens += l.outputTokens ?? 0;
    cumul.errors += l.errors ?? 0;
    parFonctionnalite.set(l.feature, cumul);
  }

  return {
    parJour: [...parJour.entries()].map(([day, calls]) => ({ day, calls })).sort((a, b) => a.day.localeCompare(b.day)),
    parFonctionnalite: [...parFonctionnalite.values()].sort((a, b) => b.calls - a.calls),
    aujourdhui: parJour.get(jourCourant()) ?? 0,
  };
}
