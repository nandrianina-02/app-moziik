import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { COOKIE_MODE, MODE_PAR_DEFAUT, estMode, modeDeLHeure, type Mode } from "@/lib/modes";

/**
 * Quel mode d'écoute sert-on à cette requête ?
 *
 * Même mécanique que l'univers (lib/universServer.ts), et pour la même
 * raison : une trentaine de points d'entrée filtrent, et leur faire
 * porter un paramètre reviendrait à l'oublier quelque part.
 *
 * POURQUOI LE COOKIE NE CONTIENT JAMAIS « AUTO »
 *
 * Le serveur ne sait pas quelle heure il est chez l'auditeur : lire
 * l'horloge du serveur proposerait du « Matin » à quelqu'un qui se
 * couche, selon l'endroit où l'application est déployée. C'est donc le
 * navigateur qui résout « auto » en un mode concret et l'écrit dans le
 * cookie ; le fait que le choix soit automatique ou explicite reste, lui,
 * dans le stockage local (context/ModeProvider.tsx).
 *
 * Le serveur n'a ainsi jamais à deviner, et le repli — quand aucun cookie
 * n'existe encore — est le mode le plus neutre possible.
 */

function depuisLaRequete(req?: Request): Mode | null {
  if (!req) return null;
  try {
    const params = new URL(req.url).searchParams;
    const explicite = params.get("mode");
    if (estMode(explicite)) return explicite;
    // Les clients qui envoient leur heure locale plutôt qu'un mode :
    // l'application mobile, et la station qui le faisait déjà.
    const heure = Number(params.get("heure"));
    return Number.isFinite(heure) && params.has("heure") ? modeDeLHeure(heure) : null;
  } catch {
    return null;
  }
}

function depuisLeCookie(): Mode | null {
  try {
    const valeur = cookies().get(COOKIE_MODE)?.value;
    return estMode(valeur) ? valeur : null;
  } catch {
    // Hors du cycle d'une requête (tâche planifiée, script) : il n'y a pas
    // de visiteur, donc pas de cookie à lire.
    return null;
  }
}

export async function modeDeLaRequete(
  req?: Request,
  options?: { compte?: string | null }
): Promise<Mode> {
  const explicite = depuisLaRequete(req) ?? depuisLeCookie();
  if (explicite) return explicite;

  if (options?.compte) {
    try {
      await connectDB();
      const compte = await User.findById(options.compte).select("preferences.mode").lean();
      const choisi = (compte as { preferences?: { mode?: string } } | null)?.preferences?.mode;
      // « auto » enregistré en base ne se résout pas ici, faute d'horloge
      // locale : on retombe sur le défaut, et le navigateur corrigera au
      // premier rendu.
      if (estMode(choisi)) return choisi;
    } catch {
      // Un compte illisible ne doit pas empêcher de servir la page.
    }
  }

  return MODE_PAR_DEFAUT;
}
