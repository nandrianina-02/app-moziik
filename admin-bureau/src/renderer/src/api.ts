/*
 * Le client de l'API de Moziik. Même API que le site et l'application
 * Android : jeton d'accès court en Authorization, jeton de renouvellement
 * long gardé dans le coffre de Windows. Un 401 déclenche un renouvellement
 * puis une seule nouvelle tentative.
 */

export class ErreurApi extends Error {
  constructor(
    message: string,
    readonly statut: number,
  ) {
    super(message);
  }
}

export interface Utilisateur {
  _id: string;
  name: string;
  email: string;
  role: "member" | "artist" | "admin";
  avatarUrl?: string;
}

let site = "";
let jetonAcces: string | null = null;
let jetonRenouvellement: string | null = null;
let renouvellementEnCours: Promise<string | null> | null = null;
let surDeconnexion: (() => void) | null = null;

export function configurer(options: { site: string; jetonRenouvellement: string | null; surDeconnexion: () => void }) {
  site = options.site.replace(/\/+$/, "");
  jetonRenouvellement = options.jetonRenouvellement;
  jetonAcces = null;
  surDeconnexion = options.surDeconnexion;
}

export const adresseSite = () => site;
export const jetonActuel = () => jetonAcces;

async function renouveler(): Promise<string | null> {
  if (!jetonRenouvellement) return null;
  renouvellementEnCours ??= (async () => {
    try {
      const r = await fetch(`${site}/api/mobile-auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: jetonRenouvellement }),
      });
      if (!r.ok) return null;
      const { accessToken } = (await r.json()) as { accessToken: string };
      jetonAcces = accessToken;
      return accessToken;
    } catch {
      return null;
    } finally {
      renouvellementEnCours = null;
    }
  })();
  return renouvellementEnCours;
}

/** Un appel à l'API, en JSON. `corps` est sérialisé ; une réponse non-2xx devient une ErreurApi. */
export async function api<T>(chemin: string, options: { methode?: string; corps?: unknown; brut?: BodyInit; entetes?: Record<string, string> } = {}): Promise<T> {
  const executer = async (jeton: string | null): Promise<Response> =>
    fetch(`${site}${chemin}`, {
      method: options.methode ?? (options.corps !== undefined || options.brut !== undefined ? "POST" : "GET"),
      headers: {
        ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
        ...(options.corps !== undefined ? { "Content-Type": "application/json" } : {}),
        ...options.entetes,
      },
      body: options.corps !== undefined ? JSON.stringify(options.corps) : options.brut,
    });

  let reponse: Response;
  try {
    reponse = await executer(jetonAcces ?? (await renouveler()));
    if (reponse.status === 401 && jetonRenouvellement) {
      const neuf = await renouveler();
      if (neuf) reponse = await executer(neuf);
    }
  } catch {
    throw new ErreurApi("Le site ne répond pas. Vérifiez la connexion.", 0);
  }
  if (reponse.status === 401) {
    surDeconnexion?.();
    throw new ErreurApi("Session expirée : reconnectez-vous.", 401);
  }
  const texte = await reponse.text();
  const donnees = texte ? (JSON.parse(texte) as T & { error?: string }) : ({} as T & { error?: string });
  if (!reponse.ok) throw new ErreurApi(donnees?.error ?? `Erreur ${reponse.status}.`, reponse.status);
  return donnees;
}

/** Connexion par e-mail et mot de passe : les mêmes règles que l'application Android. */
export async function connecter(email: string, motDePasse: string): Promise<{ utilisateur: Utilisateur; jetonRenouvellement: string }> {
  const r = await fetch(`${site}/api/mobile-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: motDePasse, device: "Moziik Admin (Windows)" }),
  }).catch(() => {
    throw new ErreurApi("Le site ne répond pas. Vérifiez la connexion.", 0);
  });
  const donnees = (await r.json().catch(() => ({}))) as { accessToken?: string; refreshToken?: string; user?: Utilisateur; error?: string };
  if (!r.ok || !donnees.accessToken || !donnees.refreshToken || !donnees.user) throw new ErreurApi(donnees.error ?? "Connexion refusée.", r.status);
  jetonAcces = donnees.accessToken;
  jetonRenouvellement = donnees.refreshToken;
  return { utilisateur: donnees.user, jetonRenouvellement: donnees.refreshToken };
}

export async function deconnecter(): Promise<void> {
  const jeton = jetonRenouvellement;
  jetonAcces = null;
  jetonRenouvellement = null;
  if (jeton) await fetch(`${site}/api/mobile-auth/logout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: jeton }) }).catch(() => undefined);
}

/** Une route réservée à l'administration, légère : 401 si le jeton est mort, 403 si le compte n'est pas admin. */
export const verifierAdmin = () => api<Record<string, number>>("/api/admin/a-traiter");
