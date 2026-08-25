/**
 * Pochette Moziik par défaut, dessinée dans un canvas.
 *
 * Deux raisons de la générer plutôt que de servir un fichier statique :
 * `coverUrl` est validé par `z.string().url()` côté API — un chemin relatif
 * comme /images/defaut.png serait refusé — et une image produite ici part
 * sur Cloudinary comme n'importe quelle autre pochette, donc la fiche du
 * morceau reste valide même si le domaine du site change.
 *
 * Couleurs volontairement figées : une pochette est un objet, elle ne suit
 * pas le thème clair/sombre du visiteur.
 */

const TAILLE = 1000;
const CORAIL = "#FF6B4A";
const INDIGO = "#0D0F1A";
const CREME = "#F2F0E9";

/** Jusqu'à deux initiales, sinon la note de musique. */
function initiales(titre: string): string {
  const mots = titre
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (mots.length === 0) return "♪";
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
}

/** Police d'affichage réellement chargée par next/font, avec repli. */
function policeDaffichage(): string {
  if (typeof document === "undefined") return "system-ui, sans-serif";
  const variable = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
  return variable || "system-ui, sans-serif";
}

export async function creerPochetteParDefaut(titre: string, nomDeBase: string): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = TAILLE;
  canvas.height = TAILLE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de dessiner la pochette par défaut.");

  ctx.fillStyle = INDIGO;
  ctx.fillRect(0, 0, TAILLE, TAILLE);

  // Halo corail en haut à gauche, dans l'esprit du dégradé des héros.
  const halo = ctx.createRadialGradient(TAILLE * 0.22, TAILLE * 0.16, 0, TAILLE * 0.22, TAILLE * 0.16, TAILLE * 0.95);
  halo.addColorStop(0, "rgba(255, 107, 74, 0.55)");
  halo.addColorStop(0.45, "rgba(255, 107, 74, 0.12)");
  halo.addColorStop(1, "rgba(255, 107, 74, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, TAILLE, TAILLE);

  // Ondes concentriques discrètes — rappel de l'onde sonore du logo.
  ctx.strokeStyle = "rgba(242, 240, 233, 0.07)";
  ctx.lineWidth = 2;
  for (let r = TAILLE * 0.28; r < TAILLE * 0.95; r += TAILLE * 0.09) {
    ctx.beginPath();
    ctx.arc(TAILLE / 2, TAILLE / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Les polices next/font sont chargées de façon asynchrone : sans cette
  // attente, le canvas dessinerait avec la police de repli.
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* on dessine avec ce qui est disponible */
    }
  }

  const police = policeDaffichage();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = CREME;
  ctx.font = `600 ${Math.round(TAILLE * 0.3)}px ${police}`;
  ctx.fillText(initiales(titre), TAILLE / 2, TAILLE * 0.47, TAILLE * 0.8);

  ctx.fillStyle = CORAIL;
  ctx.font = `500 ${Math.round(TAILLE * 0.05)}px ${police}`;
  ctx.letterSpacing = "6px";
  ctx.fillText("MOZIIK", TAILLE / 2, TAILLE * 0.68, TAILLE * 0.8);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Impossible de produire la pochette par défaut.");
  return new File([blob], `${nomDeBase}-pochette-moziik.png`, { type: "image/png" });
}
