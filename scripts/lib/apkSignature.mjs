import fs from "node:fs";

/**
 * Un APK est-il signé ?
 *
 * POURQUOI CETTE VÉRIFICATION EXISTE
 *
 * Un APK non signé s'envoie, se télécharge et s'ouvre exactement comme un
 * autre. C'est Android qui le refuse, à la toute fin, par un « Application
 * non installée » qui ne dit pas pourquoi. Sans ce contrôle, on publie un
 * fichier que personne ne peut installer, et on ne l'apprend que par les
 * plaintes.
 *
 * `gradlew assembleRelease` produit précisément ce fichier-là quand
 * `android/keystore.properties` est absent : il s'appelle
 * `app-release-unsigned.apk`, et le nom est le seul avertissement.
 *
 * CE QU'ELLE REGARDE
 *
 * Un APK est une archive ZIP. Deux schémas de signature peuvent s'y
 * trouver, et l'un des deux suffit :
 *
 * - v1, héritée du JAR : un fichier `META-INF/<nom>.RSA`, `.DSA` ou `.EC`.
 * - v2 et au-delà : un « APK Signing Block », posé juste avant le
 *   répertoire central, reconnaissable à sa signature « APK Sig Block 42 ».
 *
 * CE QU'ELLE NE FAIT PAS
 *
 * Vérifier que la signature est valide, ni de qui elle vient. Cela
 * demanderait `apksigner` et le SDK Android. Ce contrôle répond à une
 * seule question — « ce fichier a-t-il été signé ? » — qui est celle qui
 * distingue un APK installable d'un fichier mort.
 */

/** Fin du répertoire central : les 22 derniers octets, plus un commentaire. */
const EOCD_MAGIC = 0x06054b50;
const APK_SIG_MAGIC = "APK Sig Block 42";

export function analyserApk(chemin) {
  const donnees = fs.readFileSync(chemin);

  if (donnees.length < 22 || donnees.readUInt32LE(0) !== 0x04034b50) {
    return { estZip: false, signe: false, schemas: [], entrees: 0 };
  }

  // Le répertoire central se trouve par la fin : son emplacement est écrit
  // dans l'EOCD, lui-même en queue de fichier, éventuellement suivi d'un
  // commentaire de 64 ko au plus.
  let eocd = -1;
  const debut = Math.max(0, donnees.length - 22 - 65535);
  for (let i = donnees.length - 22; i >= debut; i--) {
    if (donnees.readUInt32LE(i) === EOCD_MAGIC) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return { estZip: true, signe: false, schemas: [], entrees: 0 };

  const entrees = donnees.readUInt16LE(eocd + 10);
  const debutCentral = donnees.readUInt32LE(eocd + 16);

  const schemas = [];

  // --- v2 et suivants : le bloc précède le répertoire central, et se
  // termine par sa signature magique juste avant lui.
  if (debutCentral >= 16) {
    const magie = donnees.subarray(debutCentral - 16, debutCentral).toString("latin1");
    if (magie === APK_SIG_MAGIC) schemas.push("v2+");
  }

  // --- v1 : un certificat rangé dans META-INF. On lit les noms des
  // entrées du répertoire central plutôt que de décompresser quoi que ce
  // soit : le nom suffit à répondre.
  let curseur = debutCentral;
  let vues = 0;
  let v1 = false;
  while (vues < entrees && curseur + 46 <= donnees.length) {
    if (donnees.readUInt32LE(curseur) !== 0x02014b50) break;
    const tailleNom = donnees.readUInt16LE(curseur + 28);
    const tailleExtra = donnees.readUInt16LE(curseur + 30);
    const tailleCommentaire = donnees.readUInt16LE(curseur + 32);
    const nom = donnees.subarray(curseur + 46, curseur + 46 + tailleNom).toString("latin1");

    if (/^META-INF\/[^/]+\.(RSA|DSA|EC)$/i.test(nom)) {
      v1 = true;
      break;
    }
    curseur += 46 + tailleNom + tailleExtra + tailleCommentaire;
    vues += 1;
  }
  if (v1) schemas.push("v1");

  return { estZip: true, signe: schemas.length > 0, schemas, entrees };
}
