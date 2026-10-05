"use client";

/**
 * Connexion Google dans une fenêtre surgissante.
 *
 * POURQUOI PAS `signIn("google")` DIRECTEMENT
 *
 * `signIn` agit sur `window.location` : il remplace la page en cours. On
 * perd alors tout ce qui n'était pas enregistré — un formulaire à moitié
 * rempli, une lecture en cours, la position dans une liste — et on
 * revient sur un écran reconstruit depuis zéro. La fenêtre surgissante
 * laisse Moziik intact derrière elle.
 *
 * CE QUI N'EST PAS TOUCHÉ
 *
 * L'application Android garde son chemin : Google refuse OAuth dans une
 * WebView embarquée, et `lib/native/authGoogle.ts` sort donc vers un
 * onglet Chrome avant de rapatrier la session par le relais. Les
 * appelants interrogent ce chemin-là EN PREMIER ; celui-ci n'est que la
 * voie du navigateur.
 *
 * POURQUOI UN REPLI EST OBLIGATOIRE
 *
 * Une fenêtre surgissante se fait bloquer : par une extension, par un
 * réglage du navigateur, ou simplement parce que l'ouverture n'est pas
 * partie d'un vrai clic. `window.open` rend alors `null`. Sans repli, le
 * bouton « Continuer avec Google » ne ferait plus rien du tout — une
 * panne muette, la pire sorte. La fonction rend donc `false` et
 * l'appelant retombe sur la redirection d'avant.
 *
 * C'est aussi pour cela que l'ouverture est SYNCHRONE : un `await` avant
 * `window.open` fait perdre le lien avec le clic, et le navigateur bloque.
 */

/** Taille de la fenêtre : celle que Google attend pour son écran de compte. */
const LARGEUR = 480;
const HAUTEUR = 640;

/** Au-delà, on cesse de guetter une fenêtre qui ne reviendra pas. */
const ABANDON_MS = 5 * 60_000;

export type ResultatPopup = "connecte" | "abandonne";

/**
 * Ouvre la fenêtre et prévient quand c'est fini.
 *
 * Rend `false` si la fenêtre n'a pas pu s'ouvrir — l'appelant doit alors
 * basculer sur `signIn("google")`.
 */
export function connexionGooglePopup(surFin: (resultat: ResultatPopup) => void): boolean {
  if (typeof window === "undefined") return false;

  // Centrée sur l'écran où se trouve la fenêtre, pas sur l'écran
  // principal : sur un poste à deux écrans, la seconde apparaîtrait
  // ailleurs que sous les yeux de la personne.
  const gauche = window.screenX + Math.max(0, (window.outerWidth - LARGEUR) / 2);
  const haut = window.screenY + Math.max(0, (window.outerHeight - HAUTEUR) / 2);

  const fenetre = window.open(
    "/connexion/popup",
    "moziik-google",
    `width=${LARGEUR},height=${HAUTEUR},left=${Math.round(gauche)},top=${Math.round(haut)},` +
      "menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes"
  );

  if (!fenetre) return false;

  // Reliée après le test, parce que `auMessage` est une déclaration de
  // fonction : elle est hissée, donc TypeScript ne peut pas garantir
  // qu'elle s'exécute après le `return` ci-dessus et refuse d'y voir une
  // fenêtre non nulle. Ce lien-ci, lui, est pris une fois pour toutes.
  const surgie = fenetre;

  let termine = false;
  const finir = (resultat: ResultatPopup) => {
    if (termine) return;
    termine = true;
    window.removeEventListener("message", auMessage);
    clearInterval(veille);
    clearTimeout(abandon);
    surFin(resultat);
  };

  function auMessage(e: MessageEvent) {
    // Même origine seulement : n'importe quelle page ouverte ailleurs peut
    // poster un message, et croire sur parole un « tu es connecté » venu
    // d'un inconnu reviendrait à laisser n'importe qui déclencher la suite.
    if (e.origin !== window.location.origin) return;
    if (!e.data || e.data.type !== "moziik-auth-google") return;
    // La fenêtre se referme d'elle-même ; on y veille au cas où son
    // `window.close()` serait refusé par le navigateur.
    try {
      surgie.close();
    } catch {
      /* déjà fermée */
    }
    finir("connecte");
  }

  window.addEventListener("message", auMessage);

  // La fenêtre fermée à la main ne poste rien : sans cette veille,
  // l'appelant resterait en « connexion en cours » indéfiniment.
  const veille = setInterval(() => {
    if (surgie.closed) finir("abandonne");
  }, 500);

  const abandon = setTimeout(() => {
    try {
      surgie.close();
    } catch {
      /* rien à fermer */
    }
    finir("abandonne");
  }, ABANDON_MS);

  return true;
}

/** Message envoyé par la fenêtre à son ouvreuse. Un seul endroit le nomme. */
export const MESSAGE_AUTH = "moziik-auth-google";
