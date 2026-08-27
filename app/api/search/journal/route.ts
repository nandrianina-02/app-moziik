import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { retenirRecherche } from "@/lib/searchJournal";

/**
 * Retient une recherche pour le classement hebdomadaire.
 *
 * POST /api/search/journal { q }
 *
 * POURQUOI UNE ROUTE SÉPARÉE PLUTÔT QUE /api/search
 *
 * La page /recherche est débattue à la frappe : elle interroge
 * /api/search dès que la saisie se stabilise quelques centaines de
 * millisecondes. Compter là-bas enregistrerait « mo », « moz », « mozi »
 * autant que « moziik » — et les préfixes gagneraient, puisque tous ceux
 * qui cherchent « moziik » passent par « mozi ». Le classement mesurerait
 * alors la vitesse de frappe du public.
 *
 * Le client n'appelle donc cette route qu'une fois la recherche vraiment
 * posée (voir app/recherche/page.tsx) : ce délai-là, aucune frappe
 * continue ne le franchit.
 *
 * Elle est volontairement séparée du chemin de la recherche elle-même :
 * quoi qu'il arrive ici, aucun résultat n'est ralenti ni perdu.
 */
export const POST = withApiErrors(async (req: Request) => {
  // Un classement public est une cible : sans plafond, une boucle
  // suffirait à y installer le terme de son choix. La limite ne rend pas
  // le bourrage impossible, elle le rend coûteux.
  checkRateLimitByIp("recherche-journal", { limit: 40, windowMs: 10 * 60 * 1000 });

  const corps = (await req.json().catch(() => ({}))) as { q?: unknown };
  const q = typeof corps.q === "string" ? corps.q : "";

  const retenu = await retenirRecherche(q);
  // 200 dans les deux cas : que la saisie soit trop courte ou que la base
  // ait refusé, le navigateur n'a rien à faire de cette information et
  // rien à réessayer.
  return NextResponse.json({ retenu });
});
