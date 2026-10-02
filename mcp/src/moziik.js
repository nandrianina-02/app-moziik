/**
 * Le client HTTP vers Moziik.
 *
 * POURQUOI AUCUN NOUVEAU MÉCANISME D'AUTHENTIFICATION
 *
 * Le site accepte déjà `Authorization: Bearer <accessToken>` sur toutes
 * ses routes : c'est le chemin que l'application Android emprunte, résolu
 * par `getAuthUser` dans lib/mobileAuth.ts. Ce serveur emprunte exactement
 * le même. Conséquences, toutes voulues :
 *
 * - aucune route nouvelle n'est ouverte sur la production, donc aucune
 *   surface d'attaque ajoutée ;
 * - les droits sont ceux du compte utilisé, appliqués par le serveur. Un
 *   compte artiste ne pourra pas modifier le titre d'un autre, quoi que
 *   demande le modèle — la règle vit côté serveur, pas ici ;
 * - le jeton de rafraîchissement est révocable depuis « Mon compte », page
 *   des appareils connectés. Couper ce serveur ne demande donc ni
 *   redéploiement ni changement de mot de passe.
 *
 * LES IDENTIFIANTS
 *
 * Deux façons de se présenter, et la première est préférable :
 *
 * 1. MOZIIK_REFRESH_TOKEN — obtenu une fois (`npm run jeton`), révocable,
 *    et qui ne donne pas le mot de passe à qui lit le fichier de
 *    configuration ;
 * 2. MOZIIK_EMAIL + MOZIIK_PASSWORD — plus simple à mettre en place, mais
 *    le mot de passe se retrouve en clair dans la configuration du client
 *    MCP.
 */

const TTL_MARGE_MS = 60_000;
const DELAI_REQUETE_MS = 60_000;

export class ErreurMoziik extends Error {
  constructor(message, statut, route) {
    super(message);
    this.name = "ErreurMoziik";
    this.statut = statut;
    this.route = route;
  }
}

function requis(nom) {
  const v = process.env[nom];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export class ClientMoziik {
  constructor(options = {}) {
    this.base = (options.base ?? requis("MOZIIK_URL") ?? "https://app-moziik.vercel.app").replace(
      /\/+$/,
      ""
    );
    this.refreshToken = options.refreshToken ?? requis("MOZIIK_REFRESH_TOKEN");
    this.email = options.email ?? requis("MOZIIK_EMAIL");
    this.motDePasse = options.motDePasse ?? requis("MOZIIK_PASSWORD");

    this.accessToken = null;
    /** Instant d'expiration estimé — le jeton vaut quinze minutes. */
    this.expireA = 0;
    /** Promesse d'obtention en cours : empêche dix appels de se connecter dix fois. */
    this.enCours = null;
  }

  configure() {
    return Boolean(this.refreshToken || (this.email && this.motDePasse));
  }

  /** Message unique, pour ne pas répéter la procédure à chaque outil. */
  static manqueIdentifiants() {
    return (
      "Aucun identifiant Moziik. Renseignez MOZIIK_REFRESH_TOKEN (recommandé, obtenu par " +
      "`npm run jeton`), ou à défaut MOZIIK_EMAIL et MOZIIK_PASSWORD, dans la configuration " +
      "du serveur MCP."
    );
  }

  async jeton() {
    if (this.accessToken && Date.now() < this.expireA) return this.accessToken;
    if (this.enCours) return this.enCours;

    this.enCours = this.#obtenirJeton().finally(() => {
      this.enCours = null;
    });
    return this.enCours;
  }

  async #obtenirJeton() {
    if (!this.configure()) throw new ErreurMoziik(ClientMoziik.manqueIdentifiants(), 401, "auth");

    if (this.refreshToken) {
      const r = await this.#brut("POST", "/api/mobile-auth/refresh", {
        refreshToken: this.refreshToken,
      });
      this.#poser(r.accessToken);
      return this.accessToken;
    }

    const r = await this.#brut("POST", "/api/mobile-auth/login", {
      email: this.email,
      password: this.motDePasse,
      device: "Moziik Admin MCP",
    });
    // Le jeton de rafraîchissement reçu ici n'est PAS conservé sur disque :
    // l'écrire quelque part reviendrait à créer un second secret que
    // personne ne saurait révoquer. Il sert le temps du processus.
    this.refreshToken = r.refreshToken ?? this.refreshToken;
    this.#poser(r.accessToken);
    return this.accessToken;
  }

  #poser(accessToken) {
    if (!accessToken) throw new ErreurMoziik("Jeton d'accès absent de la réponse.", 500, "auth");
    this.accessToken = accessToken;
    // Quinze minutes côté serveur, moins une marge : on renouvelle avant
    // l'expiration plutôt que d'essuyer un 401 au milieu d'un appel.
    this.expireA = Date.now() + 15 * 60_000 - TTL_MARGE_MS;
  }

  /** Appel sans jeton : seulement pour les deux routes d'authentification. */
  async #brut(methode, route, corps) {
    const reponse = await this.#envoyer(methode, route, corps, {});
    return reponse;
  }

  async #envoyer(methode, route, corps, entetes) {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), DELAI_REQUETE_MS);
    try {
      const res = await fetch(`${this.base}${route}`, {
        method: methode,
        headers: {
          ...(corps === undefined ? {} : { "Content-Type": "application/json" }),
          ...entetes,
        },
        body: corps === undefined ? undefined : JSON.stringify(corps),
        signal: controleur.signal,
      });

      const texte = await res.text();
      let donnees = null;
      try {
        donnees = texte ? JSON.parse(texte) : null;
      } catch {
        donnees = null;
      }

      if (!res.ok) {
        // Le message de l'API d'abord : il est écrit pour être lu, et c'est
        // lui qui dit « Tu ne peux modifier que tes propres sons » plutôt
        // qu'un 403 nu.
        const message =
          (donnees && typeof donnees.error === "string" && donnees.error) ||
          `${res.status} ${res.statusText}`;
        throw new ErreurMoziik(message, res.status, route);
      }

      return donnees;
    } catch (err) {
      if (err instanceof ErreurMoziik) throw err;
      if (err && err.name === "AbortError") {
        throw new ErreurMoziik(`Délai dépassé sur ${route}.`, 504, route);
      }
      throw new ErreurMoziik(
        `Moziik injoignable (${err && err.message ? err.message : "erreur réseau"}).`,
        503,
        route
      );
    } finally {
      clearTimeout(minuteur);
    }
  }

  /**
   * Un appel authentifié, avec un seul réessai après renouvellement.
   *
   * Un seul : si le jeton fraîchement obtenu est refusé à son tour, le
   * problème n'est pas l'expiration — c'est le compte ou les droits, et
   * réessayer en boucle ne ferait que masquer le vrai message.
   */
  async appel(methode, route, { corps, recommence = true } = {}) {
    const jeton = await this.jeton();
    try {
      return await this.#envoyer(methode, route, corps, { Authorization: `Bearer ${jeton}` });
    } catch (err) {
      if (err instanceof ErreurMoziik && err.statut === 401 && recommence) {
        this.accessToken = null;
        this.expireA = 0;
        return this.appel(methode, route, { corps, recommence: false });
      }
      throw err;
    }
  }

  get(route) {
    return this.appel("GET", route);
  }
  post(route, corps) {
    return this.appel("POST", route, { corps });
  }
  patch(route, corps) {
    return this.appel("PATCH", route, { corps });
  }
  put(route, corps) {
    return this.appel("PUT", route, { corps });
  }
  delete(route) {
    return this.appel("DELETE", route);
  }

  /**
   * Qui suis-je, selon le serveur.
   *
   * `/api/me/profile` et non `/api/mobile-auth/me` : ce dernier n'existe
   * pas — le dossier est resté vide dans le dépôt, sans route dedans.
   * `/api/me`, lui, n'expose que DELETE.
   */
  async moi() {
    const r = await this.get("/api/me/profile");
    return r && r.user ? r.user : r;
  }
}

/** Construit une query string en ignorant ce qui n'a pas été fourni. */
export function parametres(obj) {
  const p = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(obj ?? {})) {
    if (valeur === undefined || valeur === null || valeur === "") continue;
    p.set(cle, String(valeur));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
