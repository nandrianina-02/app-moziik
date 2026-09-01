/**
 * Le filtre des comptes de l'administration, écrit une seule fois.
 *
 * L'annuaire et les actions de masse doivent désigner exactement le même
 * ensemble : si « tous les résultats » se calculait avec sa propre copie
 * du filtre, l'écran afficherait 42 comptes et l'action en toucherait 43.
 */

export type FiltresComptes = {
  role?: string | null;
  status?: string | null;
  verified?: string | null;
  search?: string | null;
};

export function construireFiltreComptes(filtres: FiltresComptes): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  const role = filtres.role ?? "";
  if (role === "member" || role === "artist" || role === "admin") query.role = role;

  // Les trois états d'un compte, tels qu'ils existent vraiment : en attente
  // tant que l'adresse n'est pas confirmée, suspendu si l'administration l'a
  // décidé, actif sinon.
  const statut = filtres.status ?? "";
  if (statut === "active") Object.assign(query, { suspended: false, emailVerified: true });
  if (statut === "pending") Object.assign(query, { emailVerified: false, suspended: false });
  if (statut === "suspended") query.suspended = true;

  const verifie = filtres.verified ?? "";
  if (verifie === "yes") query.verifiedArtist = true;
  if (verifie === "no") query.verifiedArtist = false;

  const search = (filtres.search ?? "").trim();
  if (search) {
    // Les caractères spéciaux d'une recherche sont échappés : « a+b » ne doit
    // pas devenir une expression régulière qui ne trouve rien, ou pire, qui
    // fait travailler la base pour rien.
    const motif = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { name: { $regex: motif, $options: "i" } },
      { email: { $regex: motif, $options: "i" } },
    ];
  }

  return query;
}

/** Lit les filtres depuis une URL de requête. */
export function filtresDepuisUrl(searchParams: URLSearchParams): FiltresComptes {
  return {
    role: searchParams.get("role"),
    status: searchParams.get("status"),
    verified: searchParams.get("verified"),
    search: searchParams.get("search"),
  };
}
