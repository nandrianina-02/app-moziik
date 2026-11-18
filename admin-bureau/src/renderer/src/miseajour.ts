/*
 * Les versions publiées du logiciel. Elles portent l'étiquette admin-vX.Y.Z
 * et ne sont jamais « latest » (l'application Android lit celle-là) : on
 * parcourt donc la liste des versions du dépôt.
 */

const DEPOT = "nandrianina-02/app-moziik";

/** Vrai si la version « 1.2.3 » a est plus récente que b. */
export function plusRecente(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}

/** La dernière version publiée et l'adresse de son installeur. */
export async function derniereVersion(): Promise<{ version: string; lien: string }> {
  const r = await fetch(`https://api.github.com/repos/${DEPOT}/releases?per_page=30`, { headers: { Accept: "application/vnd.github+json" } });
  if (!r.ok) throw new Error(`GitHub a répondu ${r.status}.`);
  const versions = ((await r.json()) as { tag_name: string; draft: boolean }[])
    .filter((v) => !v.draft && /^admin-v\d+\.\d+\.\d+$/.test(v.tag_name))
    .map((v) => v.tag_name.slice("admin-v".length))
    .sort((a, b) => (plusRecente(a, b) ? -1 : 1));
  if (!versions[0]) throw new Error("Aucune version publiée.");
  return { version: versions[0], lien: `https://github.com/${DEPOT}/releases/download/admin-v${versions[0]}/moziik-admin-setup.exe` };
}
