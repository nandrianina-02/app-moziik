import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/siteConfig";
import { withApiErrors, ApiError } from "@/lib/apiError";

/**
 * L'adresse stable de l'application Android.
 *
 * POURQUOI UNE REDIRECTION PLUTÔT QUE LE LIEN DIRECT
 *
 * Le fichier vit chez un hébergeur, et cette adresse-là changera : une
 * nouvelle version porte un autre nom, un changement d'hébergeur les
 * change toutes. Or un lien d'installation se partage — par message, sur
 * une affiche, de bouche à oreille. Il doit survivre à ce qui se passe
 * derrière.
 *
 * `/api/telechargement/android` est donc la seule adresse à communiquer.
 * Elle mène toujours à la dernière version publiée.
 *
 * POURQUOI PAS DE FICHIER DANS LE DÉPÔT
 *
 * Un APK pèse plusieurs dizaines de mégaoctets et change à chaque
 * version. Le versionner ferait grossir le dépôt sans fin, et chaque
 * déploiement transporterait un binaire que personne ne relit. Il est
 * hébergé à part et son adresse vit dans les réglages
 * (scripts/publier-apk.mjs s'en charge).
 */
/**
 * Jamais figée au build.
 *
 * La route ne lit aucun en-tête de requête : Next la tenait donc pour
 * statique et gelait la redirection à la construction. Le lien aurait
 * pointé vers la version présente au dernier déploiement, et publier une
 * mise à jour n'aurait rien changé pour personne.
 */
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request) => {
  const config = await getSiteConfig();
  const stocke = config.androidApkUrl?.trim();

  if (!stocke) {
    // 404 et non 302 vers une page : ce qui demande cette adresse est un
    // gestionnaire de téléchargement, pas un navigateur qui saurait lire
    // une explication.
    throw new ApiError("Aucune version de l'application n'est publiée pour le moment.", 404);
  }

  // Deux formes admises, et il faut les deux. Le fichier est aujourd'hui
  // servi par le site lui-même (`/telechargements/moziik.apk`), parce que
  // l'hébergeur d'images refuse les APK ; mais le jour où il partira
  // ailleurs — une release GitHub, par exemple — l'adresse collée dans
  // l'administration sera absolue, et rien d'autre ne devra changer.
  const url = stocke.startsWith("/") ? new URL(stocke, req.url).toString() : stocke;

  return NextResponse.redirect(url, {
    status: 302,
    headers: {
      // La redirection ne doit pas être mise en cache : elle changera à la
      // prochaine version, et un intermédiaire qui la garderait servirait
      // l'ancien fichier pendant des jours.
      "Cache-Control": "no-store",
    },
  });
});
