/**
 * La dernière version de l'application Android à proposer.
 *
 * Deux sources :
 * - les publications du dépôt GitHub de l'application, créées à chaque
 *   version signée : un fichier `moziik.apk` au nom constant, public et
 *   permanent. C'est la source normale, sans rien à saisir ;
 * - les réglages de l'administration (androidVersion, androidApkUrl…),
 *   qui restent utilisables pour annoncer une version hébergée ailleurs.
 *
 * La plus récente l'emporte. L'application fait le même choix de son côté
 * (MiseAJour.kt) : le site et l'app proposent toujours la même version.
 */

const DEPOT = "nandrianina-02/app-moziik";
const FICHIER = "moziik.apk";

export type VersionAndroid = {
  url: string;
  version: string;
  tailleMo: number;
  publieLe?: Date;
  notes: string;
};

/** « 2.16.0 » contre « 2.9.1 » : chiffre par chiffre, pas en texte. */
export function plusRecente(candidate: string, actuelle: string): boolean {
  const nombres = (v: string) => v.trim().replace(/^v/, "").split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  const a = nombres(candidate);
  const b = nombres(actuelle);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

type Publication = {
  tag_name?: string;
  draft?: boolean;
  prerelease?: boolean;
  published_at?: string;
  assets?: { name?: string; browser_download_url?: string; size?: number }[];
};

/**
 * La dernière publication GitHub, gardée dix minutes : le layout la
 * demande à chaque page, et l'API publique de GitHub limite les appels.
 * Une panne de GitHub ne fait que taire cette source.
 */
async function depuisGithub(): Promise<VersionAndroid | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${DEPOT}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const p = (await res.json()) as Publication;
    if (p.draft || p.prerelease || !p.tag_name) return null;
    const apk = p.assets?.find((a) => a.name === FICHIER);
    if (!apk?.browser_download_url) return null;
    return {
      // Le lien « latest » plutôt que celui de la version : il reste juste
      // si une page le garde après la publication suivante.
      url: `https://github.com/${DEPOT}/releases/latest/download/${FICHIER}`,
      version: p.tag_name.replace(/^v/, ""),
      tailleMo: Math.round(((apk.size ?? 0) / 1_048_576) * 10) / 10,
      publieLe: p.published_at ? new Date(p.published_at) : undefined,
      // Les notes d'une publication sont des messages de commit, pas un texte pour le public.
      notes: "",
    };
  } catch {
    return null;
  }
}

type Reglages = {
  androidApkUrl?: string;
  androidVersion?: string;
  androidSizeMB?: number;
  androidPublishedAt?: Date;
  androidNotes?: string;
};

export async function derniereVersionAndroid(reglages: Reglages): Promise<VersionAndroid | null> {
  const github = await depuisGithub();
  const url = reglages.androidApkUrl?.trim();
  const annoncee: VersionAndroid | null = url
    ? {
        url,
        version: reglages.androidVersion?.trim() ?? "",
        tailleMo: reglages.androidSizeMB ?? 0,
        publieLe: reglages.androidPublishedAt,
        notes: reglages.androidNotes ?? "",
      }
    : null;
  if (!github) return annoncee;
  if (!annoncee) return github;
  return plusRecente(annoncee.version, github.version) ? annoncee : github;
}
