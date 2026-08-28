import { NextResponse } from "next/server";

/**
 * Digital Asset Links : la preuve, côté site, que l'application Android
 * `com.moziik.app` a le droit d'ouvrir les liens de ce domaine.
 *
 * Sans ce fichier — ou avec une empreinte qui ne correspond pas à celle du
 * certificat de signature — Android échoue silencieusement la vérification
 * de l'`intent-filter android:autoVerify="true"` déclaré dans
 * AndroidManifest.xml. Conséquence visible : un lien Moziik partagé par
 * message n'ouvre PAS l'app, il ouvre le navigateur. Aucune erreur nulle
 * part ; c'est ce qui rend la panne longue à diagnostiquer.
 *
 * L'empreinte se lit :
 *
 *   keytool -list -v -keystore moziik-release.jks -alias moziik
 *
 * et se copie dans ANDROID_CERT_SHA256 (format hexadécimal, 32 octets
 * séparés par des deux-points).
 *
 * ATTENTION AU BON CERTIFICAT
 *
 * Si l'app est publiée avec « Play App Signing » — le défaut aujourd'hui —
 * Google resigne l'APK avec SA clé. C'est donc l'empreinte affichée dans
 * la Play Console (Configuration > Intégrité de l'application > certificat
 * de signature de l'app) qu'il faut mettre ici, PAS celle du keystore
 * d'upload. Les deux peuvent d'ailleurs coexister, d'où la liste :
 * ANDROID_CERT_SHA256 accepte plusieurs empreintes séparées par des
 * virgules, ce qui permet de garder une build de test installable en
 * parallèle de la version du Store.
 */

// Servi tel quel à chaque appel : le fichier dépend d'une variable
// d'environnement, qui peut changer sans redéploiement du code.
export const dynamic = "force-dynamic";

export async function GET() {
  const empreintes = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (empreintes.length === 0) {
    // Tableau vide plutôt qu'un 404 : Android accepte les deux, mais un
    // JSON valide permet de vérifier d'un coup d'œil que la route est bien
    // déployée et que seule l'empreinte manque.
    return NextResponse.json([], {
      headers: { "cache-control": "no-store" },
    });
  }

  return NextResponse.json(
    [
      {
        relation: [
          "delegate_permission/common.handle_all_urls",
          // Permet en prime à Android de proposer le remplissage
          // automatique des identifiants Moziik dans l'app depuis ceux
          // enregistrés pour le site.
          "delegate_permission/common.get_login_creds",
        ],
        target: {
          namespace: "android_app",
          package_name: "com.moziik.app",
          sha256_cert_fingerprints: empreintes,
        },
      },
    ],
    {
      headers: {
        // Android exige explicitement ce type MIME.
        "content-type": "application/json",
        // Une empreinte corrigée doit prendre effet tout de suite : la
        // vérification n'a lieu qu'à l'installation, une réponse en cache
        // condamnerait toutes les installations de la journée.
        "cache-control": "no-store",
      },
    }
  );
}
