import { NextResponse } from "next/server";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { getAuthUser } from "@/lib/mobileAuth";
import { etatIA } from "@/lib/ai/client";
import { estLangueCible, traduireParoles } from "@/lib/ai/lyricsTranslate";

/**
 * Traduction des paroles.
 *
 * Deux moteurs possibles, essayés dans cet ordre.
 *
 * 1. **L'assistance par IA**, quand elle est disponible et que la personne
 *    est connectée. C'est le meilleur choix pour ce catalogue : les
 *    paroles mélangent malgache, français et anglais dans la même
 *    chanson, et un traducteur statistique rend mot à mot ce qui est une
 *    image. Surtout, elle traduit ligne par ligne en conservant leur
 *    nombre — les paroles sont horodatées, une ligne fusionnée décale
 *    tout le reste du morceau (voir lib/ai/lyricsTranslate.ts).
 * 2. **Un point d'accès compatible LibreTranslate**, désigné par
 *    `LYRICS_TRANSLATE_URL`, qui reste la voie de secours et le choix de
 *    qui préfère ne pas dépendre d'un modèle :
 *
 *      LYRICS_TRANSLATE_URL=https://libretranslate.example/translate
 *      LYRICS_TRANSLATE_API_KEY=…          (facultatif selon l'instance)
 *
 * Si aucun des deux n'est disponible, la route répond 501 avec un message
 * explicite : le bouton « Traduire » existe, il dit pourquoi il ne peut
 * pas répondre, et n'affiche jamais une traduction inventée.
 *
 * Le texte transite par le serveur plutôt que par le navigateur : aucune
 * clé d'API n'a ainsi à quitter l'environnement serveur.
 */

const LONGUEUR_MAX = 12_000;
const LANGUES = /^[a-z]{2}(-[A-Za-z]{2})?$/;

export const POST = withApiErrors(async (req: Request) => {
  // Un service de traduction se facture au caractère : sans limite, un
  // seul visiteur peut vider le quota de tout le monde.
  checkRateLimitByIp("lyrics-translate", { limit: 20, windowMs: 60 * 1000 });

  const point = process.env.LYRICS_TRANSLATE_URL;

  const corps = (await req.json()) as { text?: unknown; target?: unknown; source?: unknown };
  const texte = typeof corps.text === "string" ? corps.text.trim() : "";
  const cible = typeof corps.target === "string" ? corps.target : "fr";
  const source = typeof corps.source === "string" ? corps.source : "auto";

  if (!texte) throw new ApiError("Aucun texte à traduire.");
  if (texte.length > LONGUEUR_MAX) throw new ApiError("Ces paroles sont trop longues pour être traduites.");
  if (!LANGUES.test(cible)) throw new ApiError("Langue cible invalide.");

  // ---- 1. L'IA, quand elle peut ------------------------------------------
  const parIA = await etatIA("traduction");
  if (parIA.disponible && estLangueCible(cible)) {
    const authUser = await getAuthUser(req);
    if (authUser) {
      // Le texte reçu conserve une ligne par ligne de paroles, y compris
      // les vides : c'est exactement ce que lib/lyrics.ts a produit, et
      // ce découpage est ce qui garde l'horodatage aligné.
      const lignes = texte.split(/\r?\n/);
      const traduites = await traduireParoles({ lignes, cible, compte: authUser.id });
      if (traduites) {
        return NextResponse.json({
          translatedText: traduites.join("\n"),
          detected: null,
          target: cible,
          moteur: "ia",
        });
      }
    } else if (!point) {
      // Pas de compte et aucun service de secours : le dire franchement
      // plutôt que de renvoyer « non configuré », qui laisserait croire à
      // une panne alors qu'une connexion suffit.
      throw new ApiError("Connectez-vous pour traduire les paroles.", 401);
    }
  }

  // ---- 2. Le service compatible LibreTranslate ---------------------------
  if (!point) {
    throw new ApiError(
      "La traduction des paroles n'est pas disponible sur ce serveur.",
      501
    );
  }

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
    moteur: "service",
  });
});
