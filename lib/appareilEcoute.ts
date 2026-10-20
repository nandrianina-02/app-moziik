/**
 * L'appareil d'une écoute, dans les catégories des statistiques d'artiste
 * (app/artiste/statistiques : Mobile, Ordinateur, Application) et les seules
 * que POST /api/songs/[id]/play enregistre.
 *
 * « pwa » couvre tout ce qui tourne comme une application : le site installé
 * (affichage autonome) et l'app Android, qui l'affiche dans sa coquille.
 */
export type AppareilEcoute = "mobile" | "desktop" | "pwa";

export function appareilEcoute(): AppareilEcoute {
  if (typeof window === "undefined") return "desktop";
  const capacitor = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (capacitor?.isNativePlatform?.() || window.matchMedia("(display-mode: standalone)").matches) return "pwa";
  // Un écran tactile comme pointeur principal : téléphone ou tablette.
  return window.matchMedia("(pointer: coarse)").matches ? "mobile" : "desktop";
}
