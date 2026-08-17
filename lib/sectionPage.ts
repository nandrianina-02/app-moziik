import { ApiError } from "@/lib/apiError";
import { SECTION_PAGES, type SectionPage } from "@/models/HomepageSection";

/**
 * Valide un identifiant de page reçu d'un client (paramètre d'URL ou
 * segment de route). Refuser explicitement une valeur inconnue évite
 * qu'une faute de frappe rende silencieusement la configuration de
 * l'accueil sur une autre page.
 */
export function parseSectionPage(value: string | null | undefined, fallback: SectionPage = "home"): SectionPage {
  if (!value) return fallback;
  if (!SECTION_PAGES.includes(value as SectionPage)) throw new ApiError("Page inconnue.", 400);
  return value as SectionPage;
}
