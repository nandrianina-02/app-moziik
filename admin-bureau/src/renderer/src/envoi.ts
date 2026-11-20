import { api, ErreurApi } from "./api";

/**
 * Envoi d'un fichier vers Karaks Storage par la porte du site : le site
 * ouvre l'envoi avec sa clé et rend une adresse à jeton où les morceaux
 * partent directement. Rend l'identifiant du fichier.
 */
export async function televerser(contenu: Blob, nom: string, type: string, dossier: "songs" | "covers" | "avatars" | "site-assets" | "videos", duree: number | undefined, surProgression: (p: number) => void): Promise<string> {
  const ouverture = await api<{ mode: string; fichierId: string; adresseEnvoi: string; tailleMorceau: number }>("/api/fichiers/envoi", {
    corps: { nom, type, taille: contenu.size, dossier, ...(duree ? { duree } : {}) },
  });
  if (ouverture.mode !== "karaks-storage") throw new ErreurApi("Le stockage Karaks Storage n'est pas configuré sur le site.", 503);
  const taille = ouverture.tailleMorceau;
  for (let debut = 0; debut < contenu.size; debut += taille) {
    const fin = Math.min(debut + taille, contenu.size);
    let dernier: Error | null = null;
    for (let essai = 0; essai < 4; essai++) {
      try {
        const r = await fetch(ouverture.adresseEnvoi, { method: "PUT", headers: { "Content-Range": `bytes ${debut}-${fin - 1}/${contenu.size}` }, body: contenu.slice(debut, fin) });
        if (r.status === 200 || r.status === 202) {
          dernier = null;
          break;
        }
        const corps = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
        dernier = new Error(corps?.error?.message ?? `Le stockage a répondu ${r.status}.`);
        if (r.status < 500 && r.status !== 429) break;
      } catch (e) {
        dernier = e instanceof Error ? e : new Error("Envoi interrompu.");
      }
      await new Promise((res) => setTimeout(res, 1500 * (essai + 1)));
    }
    if (dernier) throw dernier;
    surProgression(Math.round((fin / contenu.size) * 100));
  }
  return ouverture.fichierId;
}
