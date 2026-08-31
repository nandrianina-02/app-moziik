import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { getSiteConfig } from "@/lib/siteConfig";
import { COOKIE_UNIVERS, estUnivers, UNIVERS_PAR_DEFAUT, type Univers } from "@/lib/univers";
import { assurerUnivers } from "@/lib/universBackfill";

/**
 * Quel univers sert-on à cette requête ?
 *
 * TROIS SOURCES, DANS CET ORDRE
 *
 * 1. Le paramètre `?univers=` de l'URL. Il n'existe que pour deux
 *    usages : l'aperçu depuis l'administration, et l'application mobile
 *    qui porte son choix elle-même.
 * 2. Le cookie posé par le sélecteur. C'est le cas courant, et c'est ce
 *    qui permet à toutes les routes de filtrer sans qu'aucun appelant
 *    n'ait à transmettre quoi que ce soit — y compris le prolongement de
 *    file, qui part du navigateur vers cinq points d'entrée différents.
 * 3. À défaut, la préférence du compte s'il est connecté, puis l'univers
 *    par défaut du site.
 *
 * La lecture en base n'a lieu que lorsque le cookie manque, c'est-à-dire
 * à la première requête d'un appareil. Ensuite, la résolution ne coûte
 * rien.
 */

function depuisLaRequete(req?: Request): Univers | null {
  if (!req) return null;
  try {
    const valeur = new URL(req.url).searchParams.get("univers");
    return estUnivers(valeur) ? valeur : null;
  } catch {
    return null;
  }
}

function depuisLeCookie(): Univers | null {
  try {
    const valeur = cookies().get(COOKIE_UNIVERS)?.value;
    return estUnivers(valeur) ? valeur : null;
  } catch {
    // Hors du cycle d'une requête (tâche planifiée, script) : il n'y a
    // pas de visiteur, donc pas de cookie à lire.
    return null;
  }
}

/** L'univers par défaut du site, ou celui du code si la base est injoignable. */
export async function universParDefautDuSite(): Promise<Univers> {
  try {
    const config = await getSiteConfig();
    return estUnivers(config.defaultUnivers) ? config.defaultUnivers : UNIVERS_PAR_DEFAUT;
  } catch {
    return UNIVERS_PAR_DEFAUT;
  }
}

export async function universDeLaRequete(
  req?: Request,
  options?: { compte?: string | null }
): Promise<Univers> {
  // Une seule fois par processus, et sans effet une fois le drapeau posé :
  // c'est ce qui garantit qu'aucune route ne filtre sur un champ que les
  // documents antérieurs à la séparation n'ont pas encore.
  await assurerUnivers();

  const explicite = depuisLaRequete(req) ?? depuisLeCookie();
  if (explicite) return explicite;

  if (options?.compte) {
    try {
      await connectDB();
      const compte = await User.findById(options.compte).select("preferences.univers").lean();
      const choisi = (compte as { preferences?: { univers?: string } } | null)?.preferences?.univers;
      if (estUnivers(choisi)) return choisi;
    } catch {
      // Un compte illisible ne doit pas empêcher de servir la page.
    }
  }

  return universParDefautDuSite();
}

/**
 * Le fragment de requête MongoDB qui restreint à un univers.
 *
 * Écrit une seule fois plutôt que `{ univers }` répété partout : le jour
 * où un troisième univers apparaîtra, ou bien où l'un devra en englober
 * un autre, tout passe par ici.
 */
export function filtreUnivers(univers: Univers) {
  return { univers } as const;
}
