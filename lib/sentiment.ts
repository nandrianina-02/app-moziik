// Analyse de sentiment basique par lexique, pensée pour des
// commentaires courts en français autour de la musique. Suffisante
// pour un premier classement positif/neutre/négatif sans dépendance
// à un service externe ; peut être remplacée plus tard par un vrai
// modèle NLP (ex: appel à une API cloud) en gardant la même interface.

const POSITIVE_WORDS = [
  "génial", "excellent", "superbe", "magnifique", "incroyable", "top",
  "adore", "aime", "parfait", "puissant", "meilleur", "beau", "belle",
  "kiff", "banger", "feu", "chef-d'oeuvre", "bravo", "merci", "propre",
  "stylé", "vibe", "énorme", "dingue", "fou", "trop bien", "nickel",
];

const NEGATIVE_WORDS = [
  "nul", "mauvais", "horrible", "déteste", "raté", "déçu", "moyen",
  "ennuyeux", "plat", "copie", "plagiat", "faible", "décevant", "bof",
  "pas terrible", "dommage", "gênant", "insupportable", "triste",
  "pire", "mal", "problème", "arnaque",
];

export type SentimentResult = { sentiment: "positive" | "neutral" | "negative"; score: number };

export function analyzeSentiment(text: string): SentimentResult {
  const normalized = text.toLowerCase();
  let score = 0;

  for (const word of POSITIVE_WORDS) {
    if (normalized.includes(word)) score += 1;
  }
  for (const word of NEGATIVE_WORDS) {
    if (normalized.includes(word)) score -= 1;
  }

  // Normalisation grossière entre -1 et 1
  const normalizedScore = Math.max(-1, Math.min(1, score / 3));

  let sentiment: SentimentResult["sentiment"] = "neutral";
  if (normalizedScore > 0.15) sentiment = "positive";
  else if (normalizedScore < -0.15) sentiment = "negative";

  return { sentiment, score: normalizedScore };
}
