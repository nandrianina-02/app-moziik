import cloudinary from "@/lib/cloudinary";
import type { AudioQuality } from "@/lib/offlineSettings";

/**
 * L'adresse réellement servie pour écouter un morceau.
 *
 * Jusqu'ici, le fichier audio était une URL Cloudinary publique, écrite
 * telle quelle dans chaque réponse d'API : le plafond de qualité et le
 * quota des visiteurs se contournaient en lisant l'adresse dans l'onglet
 * réseau. Ce module la fabrique côté serveur, au moment de la demande, et
 * seulement pour qui y a droit.
 *
 * ---
 *
 * **Deux niveaux, et il faut les distinguer.**
 *
 * 1. Sans rien changer chez Cloudinary, l'indirection par
 *    `/api/stream/<id>` fait déjà respecter le quota et la qualité : la
 *    version 320 kb/s n'est jamais fabriquée pour un compte gratuit.
 *    Mais l'URL d'origine, si on la connaît, fonctionne encore.
 *
 * 2. Avec `CLOUDINARY_AUDIO_AUTHENTICATED=true`, les adresses sont signées
 *    et le type de distribution devient `authenticated` : l'URL d'origine
 *    cesse de répondre, et une adresse retouchée à la main (pour passer de
 *    128 à 320) échoue sur la signature.
 *
 * Le second niveau suppose deux gestes hors du code, décrits dans le
 * README : régler le préréglage d'envoi Cloudinary sur « authenticated »,
 * et convertir les fichiers déjà en ligne
 * (`scripts/proteger-audio.mjs`). Tant qu'ils ne sont pas faits, laisser
 * le drapeau à `false` — l'activer avant rendrait tout le catalogue muet.
 */

const DEBITS: Record<AudioQuality, string> = { low: "64k", medium: "128k", high: "320k" };

/** La signature n'est demandée que si l'administration a fait la bascule. */
export function audioProtege(): boolean {
  return process.env.CLOUDINARY_AUDIO_AUTHENTICATED === "true";
}

/**
 * Retrouve l'identifiant Cloudinary à partir d'une adresse enregistrée.
 *
 * Une URL de livraison ressemble à
 * `https://res.cloudinary.com/<cloud>/video/upload/v123/moziik/songs/abc.mp3`.
 * L'identifiant est ce qui suit la version, sans l'extension.
 */
export function identifiantPublic(audioUrl: string): string | null {
  const marqueur = audioUrl.match(/\/(?:upload|authenticated)\//);
  if (!marqueur || marqueur.index === undefined) return null;

  let reste = audioUrl.slice(marqueur.index + marqueur[0].length);
  // La version (`v1712345678/`) et les transformations éventuelles ne font
  // pas partie de l'identifiant.
  reste = reste.replace(/^v\d+\//, "");
  const sansExtension = reste.replace(/\.[a-z0-9]+$/i, "");
  return sansExtension || null;
}

/**
 * L'adresse à servir, pour cette qualité.
 *
 * Retombe sur une simple transformation de l'URL enregistrée quand la
 * protection est désactivée ou que l'identifiant n'a pas pu être lu — un
 * morceau doit rester écoutable même si son adresse ne suit pas la forme
 * attendue (import ancien, fichier hébergé ailleurs).
 */
export function adresseAudio(audioUrl: string, quality: AudioQuality): string {
  const debit = DEBITS[quality];

  if (!audioProtege()) {
    if (!audioUrl.includes("/upload/")) return audioUrl;
    return audioUrl.replace("/upload/", `/upload/br_${debit}/`);
  }

  const publicId = identifiantPublic(audioUrl);
  if (!publicId) return audioUrl;

  // `sign_url` scelle la transformation avec l'identifiant : une adresse
  // retouchée pour passer en 320 ne correspond plus à sa signature.
  return cloudinary.url(publicId, {
    resource_type: "video",
    type: "authenticated",
    sign_url: true,
    secure: true,
    transformation: [{ bit_rate: debit }],
  });
}
