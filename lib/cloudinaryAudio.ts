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
 * (`scripts/proteger-audio.mjs`). Tant que le second n'est pas fait,
 * laisser le drapeau à `false` — l'activer avant réclamerait en
 * `authenticated` des fichiers encore publics, qui ne répondraient plus.
 *
 * **Le catalogue reste audible pendant la migration.** Le drapeau ne
 * décide que du sort des adresses restées en `/upload/`. Un morceau dont
 * l'adresse enregistrée porte déjà `/authenticated/` — parce qu'il a été
 * envoyé après le changement de préréglage — est signé quoi qu'il
 * arrive. Les deux moitiés du catalogue jouent donc en même temps, ce qui
 * évite d'avoir à réussir une bascule en un seul geste.
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
  // Une adresse déjà distribuée en `authenticated` porte sa signature
  // avant sa version : `/authenticated/s--AbCdEf12--/v1712345678/…`. La
  // laisser en place donnait un identifiant du genre
  // « s--AbCdEf12--/v1712345678/moziik/songs/abc », que Cloudinary
  // signait à son tour — l'adresse obtenue ne désignait plus aucun
  // fichier, et tout morceau converti devenait muet.
  reste = reste.replace(/^s--[\w-]+--\//, "");
  // La version (`v1712345678/`) ne fait pas non plus partie de
  // l'identifiant.
  reste = reste.replace(/^v\d+\//, "");
  const sansExtension = reste.replace(/\.[a-z0-9]+$/i, "");
  return sansExtension || null;
}

/** L'extension de l'adresse enregistrée, pour la redemander à l'identique. */
function formatDe(audioUrl: string): string | undefined {
  const trouve = audioUrl.split("?")[0].match(/\.([a-z0-9]{2,4})$/i);
  return trouve ? trouve[1].toLowerCase() : undefined;
}

/**
 * L'adresse à servir, pour cette qualité.
 *
 * Retombe sur une simple transformation de l'URL enregistrée quand la
 * protection est désactivée ou que l'identifiant n'a pas pu être lu — un
 * morceau doit rester écoutable même si son adresse ne suit pas la forme
 * attendue (import ancien, fichier hébergé ailleurs).
 */
export type Decoupe = { debut?: number | null; fin?: number | null };

/** Les bornes de découpe, arrondies au dixième — Cloudinary n'en veut pas plus. */
function bornes(decoupe?: Decoupe): { start_offset?: string; end_offset?: string } {
  if (!decoupe) return {};
  const arrondi = (v: number) => String(Math.max(0, Math.round(v * 10) / 10));

  return {
    ...(typeof decoupe.debut === "number" && decoupe.debut > 0
      ? { start_offset: arrondi(decoupe.debut) }
      : {}),
    ...(typeof decoupe.fin === "number" && decoupe.fin > 0 ? { end_offset: arrondi(decoupe.fin) } : {}),
  };
}

/**
 * L'adresse à servir, pour cette qualité et cette découpe.
 *
 * La découpe est une transformation, pas un réencodage : `so_`/`eo_`
 * disent à Cloudinary quelle portion livrer. Le fichier d'origine reste
 * entier, donc la découpe se corrige ou s'annule sans rien perdre — ce
 * qu'un découpage destructif dans le navigateur ne permettrait pas, en
 * plus d'exiger un réencodeur MP3 embarqué.
 *
 * Retombe sur une simple transformation de l'URL enregistrée quand la
 * protection est désactivée ou que l'identifiant n'a pas pu être lu — un
 * morceau doit rester écoutable même si son adresse ne suit pas la forme
 * attendue (import ancien, fichier hébergé ailleurs).
 */
export function adresseAudio(audioUrl: string, quality: AudioQuality, decoupe?: Decoupe): string {
  const debit = DEBITS[quality];
  const coupe = bornes(decoupe);

  // Deux sources se prononcent sur le type de distribution, et la plus
  // sûre est l'adresse elle-même : une URL qui porte déjà
  // `/authenticated/` désigne un fichier converti, quoi que dise la
  // variable d'environnement. Le drapeau ne tranche donc que pour les
  // adresses restées en `/upload/`, dont le fichier a pu être converti
  // par scripts/proteger-audio.mjs — qui, lui, ne réécrit pas la base.
  //
  // Cette distinction n'est pas un raffinement : sans elle, un catalogue
  // à moitié migré est entièrement muet. Poser le drapeau avant d'avoir
  // lancé le script fait réclamer en `authenticated` des centaines de
  // fichiers encore publics ; le retirer coupe ceux que le nouveau
  // préréglage d'envoi a déjà protégés. Aucune des deux positions n'est
  // bonne, et c'est bien le signe que la question ne se pose pas là.
  const signer = audioUrl.includes("/authenticated/") || audioProtege();

  if (!signer) {
    if (!audioUrl.includes("/upload/")) return audioUrl;
    const morceaux = [
      ...(coupe.start_offset ? [`so_${coupe.start_offset}`] : []),
      ...(coupe.end_offset ? [`eo_${coupe.end_offset}`] : []),
      `br_${debit}`,
    ];
    return audioUrl.replace("/upload/", `/upload/${morceaux.join(",")}/`);
  }

  const publicId = identifiantPublic(audioUrl);
  if (!publicId) return audioUrl;

  // `sign_url` scelle la transformation avec l'identifiant : une adresse
  // retouchée pour passer en 320, ou pour récupérer la partie coupée, ne
  // correspond plus à sa signature.
  return cloudinary.url(publicId, {
    resource_type: "video",
    type: "authenticated",
    sign_url: true,
    secure: true,
    // Le format est redemandé tel qu'il a été envoyé : sans lui,
    // Cloudinary livre l'original sans extension, et le navigateur doit
    // deviner le type d'un flux qu'il vient de recevoir.
    ...(formatDe(audioUrl) ? { format: formatDe(audioUrl) } : {}),
    transformation: [{ bit_rate: debit, ...coupe }],
  });
}
