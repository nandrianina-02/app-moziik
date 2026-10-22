import { createSign } from "crypto";
import { connectDB } from "@/lib/db";
import AppareilPush from "@/models/AppareilPush";

/**
 * Notifications push vers l'app native, par Firebase Cloud Messaging
 * (API HTTP v1). Rien ne part tant que `FIREBASE_SERVICE_ACCOUNT` (le JSON
 * du compte de service Firebase) n'est pas posé : le site fonctionne
 * comme avant.
 *
 * Les messages sont des données seules, sans bloc `notification` : c'est
 * l'app qui affiche, avec son canal, son icône et le lien à ouvrir, que
 * l'app soit à l'écran ou non.
 */

type CompteDeService = { project_id: string; client_email: string; private_key: string };

let jetonAcces: { valeur: string; jusqua: number } | null = null;

function compteDeService(): CompteDeService | null {
  const brut = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!brut) return null;
  try {
    const c = JSON.parse(brut) as CompteDeService;
    return c.project_id && c.client_email && c.private_key ? c : null;
  } catch {
    return null;
  }
}

const base64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** Jeton OAuth du compte de service (JWT signé RS256), gardé jusqu'à cinq minutes de son expiration. */
async function acces(compte: CompteDeService): Promise<string> {
  if (jetonAcces && jetonAcces.jusqua - Date.now() > 5 * 60_000) return jetonAcces.valeur;
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corps = base64url(
    JSON.stringify({
      iss: compte.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: maintenant,
      exp: maintenant + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256").update(`${entete}.${corps}`).sign(compte.private_key.replace(/\\n/g, "\n"));
  const reponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${entete}.${corps}.${base64url(signature)}`,
    }),
  });
  if (!reponse.ok) throw new Error(`Jeton Firebase refusé (${reponse.status}).`);
  const donnees = (await reponse.json()) as { access_token: string; expires_in: number };
  jetonAcces = { valeur: donnees.access_token, jusqua: Date.now() + donnees.expires_in * 1000 };
  return donnees.access_token;
}

export type ContenuPush = { type: string; title: string; message: string; link?: string };

/** Ne fait jamais échouer l'appelant : une notification push manquée ne doit pas annuler l'action qui l'a provoquée. */
export async function envoyerPush(destinataires: string[], contenu: ContenuPush | ((destinataire: string) => ContenuPush)) {
  const compte = compteDeService();
  if (!compte || destinataires.length === 0) return;
  try {
    await connectDB();
    const appareils = await AppareilPush.find({ user: { $in: destinataires } }).select("user jeton").lean();
    if (appareils.length === 0) return;
    const jeton = await acces(compte);
    const perimes: string[] = [];
    await Promise.all(
      appareils.map(async (a) => {
        const c = typeof contenu === "function" ? contenu(a.user.toString()) : contenu;
        const reponse = await fetch(`https://fcm.googleapis.com/v1/projects/${compte.project_id}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token: a.jeton,
              data: { type: c.type, titre: c.title.slice(0, 200), message: c.message.slice(0, 1000), lien: c.link ?? "" },
              android: { priority: "high" },
            },
          }),
        }).catch(() => null);
        // Application désinstallée ou jeton remplacé : l'appareil est oublié.
        if (reponse && (reponse.status === 404 || reponse.status === 410)) perimes.push(a.jeton);
      }),
    );
    if (perimes.length > 0) await AppareilPush.deleteMany({ jeton: { $in: perimes } });
  } catch (erreur) {
    console.error("[push]", erreur instanceof Error ? erreur.message : erreur);
  }
}

/** Au plus quelques secondes d'attente : la réponse de la route qui notifie ne doit pas en dépendre. */
export function envoyerPushBorne(...args: Parameters<typeof envoyerPush>): Promise<void> {
  return Promise.race([envoyerPush(...args), new Promise<void>((resolve) => setTimeout(resolve, 3000))]);
}
