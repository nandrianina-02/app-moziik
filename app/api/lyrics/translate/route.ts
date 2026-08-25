import { NextResponse } from "next/server";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";

/**
 * Traduction des paroles.
 *
 * Moziik n'embarque aucun moteur de traduction : en inventer un donnerait
 * des résultats faux, et en câbler un en dur ferait dépendre le lecteur
 * d'un service tiers payant que personne n'a choisi. La route délègue donc
 * à un point d'accès **compatible LibreTranslate**, désigné par la
 * variable d'environnement `LYRICS_TRANSLATE_URL` :
 *
 *   LYRICS_TRANSLATE_URL=https://libretranslate.example/translate
 *   LYRICS_TRANSLATE_API_KEY=…            (facultatif selon l'instance)
 *
 * Tant qu'elle n'est pas renseignée, la route répond 501 avec un message
 * explicite : le bouton « Traduire » existe, il dit clairement pourquoi il
 * ne peut pas répondre, et n'affiche jamais une traduction inventée.
 *
 * Le texte transite par le serveur plutôt que par le navigateur : la clé
 * d'API n'a ainsi jamais à quitter l'environnement serveur.
 */

const LONGUEUR_MAX = 12_000;
const LANGUES = /^[a-z]{2}(-[A-Za-z]{2})?$/;

export const POST = withApiErrors(async (req: Request) => {
  // Un service de traduction se facture au caractère : sans limite, un
  // seul visiteur peut vider le quota de tout le monde.
  checkRateLimitByIp("lyrics-translate", { limit: 20, windowMs: 60 * 1000 });

  const point = process.env.LYRICS_TRANSLATE_URL;
  if (!point) {
    throw new ApiError(
      "La traduction des paroles n'est pas configurée sur ce serveur (variable LYRICS_TRANSLATE_URL absente).",
      501
    );
  }

  const corps = (await req.json()) as { text?: unknown; target?: unknown; source?: unknown };
  const texte = typeof corps.text === "string" ? corps.text.trim() : "";
  const cible = typeof corps.target === "string" ? corps.target : "fr";
  const source = typeof corps.source === "string" ? corps.source : "auto";

  if (!texte) throw new ApiError("Aucun texte à traduire.");
  if (texte.length > LONGUEUR_MAX) throw new ApiError("Ces paroles sont trop longues pour être traduites.");
  if (!LANGUES.test(cible)) throw new ApiError("Langue cible invalide.");

  let reponse: Response;
  try {
    reponse = await fetch(point, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: texte,
        source,
        target: cible,
        format: "text",
        ...(process.env.LYRICS_TRANSLATE_API_KEY ? { api_key: process.env.LYRICS_TRANSLATE_API_KEY } : {}),
      }),
      // Un service lent ne doit pas bloquer une route Next indéfiniment.
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError("Le service de traduction est injoignable. Réessaie dans un instant.", 502);
  }

  if (!reponse.ok) {
    // On ne relaie pas le corps de l'erreur distante : il peut contenir
    // des détails d'infrastructure sans intérêt pour l'utilisateur.
    throw new ApiError("Le service de traduction a refusé la demande.", 502);
  }

  const data = (await reponse.json()) as { translatedText?: string; detectedLanguage?: { language?: string } };
  if (typeof data.translatedText !== "string") {
    throw new ApiError("Réponse inattendue du service de traduction.", 502);
  }

  return NextResponse.json({
    translatedText: data.translatedText,
    detected: data.detectedLanguage?.language ?? null,
    target: cible,
  });
});
