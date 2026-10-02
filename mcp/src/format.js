/**
 * Mise en forme des réponses rendues au modèle.
 *
 * POURQUOI ON NE RENVOIE PAS LE JSON BRUT
 *
 * Une route comme `/api/songs` rend des documents complets : trente
 * champs par titre, dont l'URL audio signée, les compteurs internes et
 * `__v`. Vingt titres font quinze mille jetons que le modèle doit lire
 * avant de pouvoir répondre « il y a vingt titres ». Chaque outil
 * déclare donc ce qu'il garde, et le reste ne traverse pas.
 *
 * Deux champs sont retirés systématiquement, même quand on en demande
 * d'autres : `audioUrl`, qui est une adresse signée inutilisable hors
 * contexte et qui n'a rien à faire dans un historique de conversation,
 * et `lyrics`, qui peut faire vingt mille caractères à lui seul.
 */

const JAMAIS = new Set(["audioUrl", "lyrics", "__v", "passwordHash"]);

/** Ne garde que les champs demandés, en aplatissant les références peuplées. */
export function reduire(objet, champs) {
  if (!objet || typeof objet !== "object") return objet;
  const sortie = {};
  for (const champ of champs) {
    if (JAMAIS.has(champ)) continue;
    const valeur = objet[champ];
    if (valeur === undefined || valeur === null) continue;
    sortie[champ] = simplifier(valeur);
  }
  return sortie;
}

/**
 * Une référence peuplée devient « nom (id) » plutôt qu'un objet imbriqué.
 *
 * Le modèle a besoin des deux : du nom pour répondre, de l'identifiant
 * pour enchaîner un appel. Les séparer en deux champs doublerait la
 * place ; les imbriquer rendrait la lecture indirecte.
 */
function simplifier(valeur) {
  if (Array.isArray(valeur)) return valeur.map(simplifier);
  if (valeur && typeof valeur === "object") {
    const nom = valeur.stageName ?? valeur.title ?? valeur.name;
    const id = valeur._id ?? valeur.id;
    if (nom && id) return `${nom} (${id})`;
    if (id && Object.keys(valeur).length === 1) return String(id);
    const sortie = {};
    for (const [k, v] of Object.entries(valeur)) {
      if (JAMAIS.has(k)) continue;
      sortie[k] = simplifier(v);
    }
    return sortie;
  }
  return valeur;
}

export function liste(items, champs) {
  return (Array.isArray(items) ? items : []).map((i) => reduire(i, champs));
}

/**
 * Le contenu d'une réponse d'outil MCP.
 *
 * Toujours du JSON, jamais de prose : le modèle enchaîne sur ces données,
 * et une phrase française l'obligerait à les réextraire. La prose est son
 * travail, pas celui de l'outil.
 */
export function reponse(donnees) {
  return {
    content: [{ type: "text", text: JSON.stringify(donnees, null, 2) }],
  };
}

/**
 * Une erreur rendue au modèle plutôt que levée.
 *
 * `isError` laisse le client MCP la présenter comme un échec, tout en
 * donnant au modèle de quoi corriger son appel suivant — un refus de
 * droits n'est pas la même chose qu'un identifiant introuvable, et il
 * doit pouvoir faire la différence sans redemander.
 */
export function erreur(message, details) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({ erreur: message, ...(details ?? {}) }, null, 2),
      },
    ],
  };
}
