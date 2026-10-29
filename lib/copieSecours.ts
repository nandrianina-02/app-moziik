import { createHash } from "crypto";
import { NextResponse } from "next/server";

/**
 * La dernière bonne réponse de chaque lecture (GET), servie si la base
 * tombe : pendant une coupure, le visiteur voit les données de la dernière
 * fois plutôt qu'une erreur.
 *
 * La copie vit dans la mémoire de l'instance serveur. Elle ne survit pas à
 * un redémarrage, mais les instances restent en vie entre les requêtes
 * d'un même moment, et c'est justement pendant ces moments-là que les
 * coupures d'Atlas surviennent et passent.
 *
 * La clé porte l'adresse demandée et l'empreinte des identifiants du
 * visiteur (cookies, jeton de l'application) : une réponse personnelle ne
 * peut être resservie qu'à celui qui l'a reçue.
 */

const ENTREES_MAX = 400;
const TAILLE_MAX = 400_000;
const AGE_MAX_MS = 24 * 3_600_000;

const EXCLUES = ["/api/cron", "/api/stream", "/api/telechargement", "/api/auth"];

type Copie = { corps: string; typeContenu: string; le: number };
const copies = new Map<string, Copie>();

export function cleDeCopie(req: unknown): string | null {
  if (!(req instanceof Request) || req.method !== "GET") return null;
  const adresse = new URL(req.url);
  // Ces lectures ont des effets (tâches planifiées appelées en GET) ou ne
  // renvoient pas de données (redirections vers un fichier) : ni second
  // essai, ni copie.
  if (EXCLUES.some((prefixe) => adresse.pathname.startsWith(prefixe))) return null;
  const identite = createHash("sha256")
    .update(`${req.headers.get("cookie") ?? ""}|${req.headers.get("authorization") ?? ""}`)
    .digest("hex")
    .slice(0, 20);
  return `${adresse.pathname}${adresse.search}|${identite}`;
}

/** Garde une réponse réussie ; la plus ancienne copie part quand la mémoire réservée est pleine. */
export async function retenir(cle: string | null, reponse: NextResponse): Promise<void> {
  if (!cle || reponse.status !== 200) return;
  const typeContenu = reponse.headers.get("content-type") ?? "";
  if (!typeContenu.includes("application/json")) return;
  const corps = await reponse.clone().text();
  if (corps.length > TAILLE_MAX) return;
  copies.delete(cle);
  copies.set(cle, { corps, typeContenu, le: Date.now() });
  if (copies.size > ENTREES_MAX) copies.delete(copies.keys().next().value as string);
}

/** La copie de secours, ou null si elle n'existe pas ou date de plus d'un jour. */
export function copieDe(cle: string | null): NextResponse | null {
  const copie = cle ? copies.get(cle) : undefined;
  if (!copie || Date.now() - copie.le > AGE_MAX_MS) return null;
  return new NextResponse(copie.corps, {
    status: 200,
    headers: {
      "content-type": copie.typeContenu,
      "cache-control": "private, no-store",
      // Le navigateur peut ainsi dire que les données datent un peu.
      "x-moziik-copie": new Date(copie.le).toISOString(),
    },
  });
}
