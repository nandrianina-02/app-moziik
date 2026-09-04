/**
 * Met une version de l'application Android à disposition sur le site.
 *
 * POURQUOI L'APK EST DANS `public/` ET PAS CHEZ CLOUDINARY
 *
 * Cloudinary refuse les APK. Pas par l'extension — renommer le fichier ne
 * sert à rien, c'est le contenu qu'il reconnaît : « resources with
 * extension apk are not allowed ». C'est une politique de compte, et sur
 * les offres courantes elle ne se lève pas.
 *
 * Le fichier est donc servi comme n'importe quel fichier statique du
 * site. Vercel le distribue par son CDN, sans passer par une fonction —
 * la limite de 4,5 Mo des réponses serverless ne s'applique donc pas.
 *
 * CE QUE CELA COÛTE, ET IL FAUT LE SAVOIR
 *
 * L'APK entre dans le dépôt git. Chaque version publiée y laisse
 * définitivement ses quelques mégaoctets, même après remplacement. À
 * raison de deux ou trois versions par an, c'est sans conséquence. Si le
 * rythme s'accélère, l'endroit juste est une *release* GitHub — le dépôt
 * est public, les fichiers de release ne pèsent pas sur l'historique, et
 * il suffira alors de coller l'adresse obtenue dans /admin/parametres :
 * la route de téléchargement accepte déjà une adresse absolue.
 *
 * UN SEUL FICHIER, TOUJOURS LE MÊME NOM
 *
 * `public/telechargements/moziik.apk`. Garder un fichier par version
 * multiplierait le poids du dépôt sans que personne n'aille jamais
 * chercher une ancienne version — et l'adresse publique, elle, ne change
 * pas : c'est `/api/telechargement/android` qu'on communique.
 *
 * LE DÉPLOIEMENT DOIT SUIVRE
 *
 * Le script écrit le fichier et met les réglages à jour, mais le fichier
 * ne sera servi qu'une fois déployé. Tant que ce n'est pas fait, le lien
 * renvoie une erreur — le script le rappelle à la fin.
 *
 * COMMENT FABRIQUER L'APK
 *
 *   npx cap sync android
 *   cd android && ./gradlew assembleRelease
 *
 * Le fichier sort dans android/app/build/outputs/apk/release/. S'il
 * s'appelle `app-release-unsigned.apk`, c'est qu'il manque
 * android/keystore.properties : ce script refusera de le publier, et
 * dira quoi faire.
 *
 * Usage :
 *   node scripts/publier-apk.mjs --essai <fichier.apk> <version>
 *   node scripts/publier-apk.mjs <fichier.apk> <version>
 *   node scripts/publier-apk.mjs --retirer
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { analyserApk } from "./lib/apkSignature.mjs";

for (const fichier of [".env.local", ".env"]) {
  const chemin = path.resolve(process.cwd(), fichier);
  if (!fs.existsSync(chemin)) continue;
  for (const ligne of fs.readFileSync(chemin, "utf8").split(/\r?\n/)) {
    const trouve = ligne.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!trouve) continue;
    const [, cle, valeur = ""] = trouve;
    if (!process.env[cle]) process.env[cle] = valeur.replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const ESSAI = args.includes("--essai");
const RETIRER = args.includes("--retirer");
const [chemin, version] = args.filter((a) => !a.startsWith("--"));

const notes = process.env.APK_NOTES ?? "";

/** Là où le fichier est déposé, et l'adresse à laquelle le site le sert. */
const DOSSIER = path.resolve(process.cwd(), "public", "telechargements");
const NOM = "moziik.apk";
const ADRESSE = "/telechargements/moziik.apk";

function sortir(message) {
  console.error(message);
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
const reglages = mongoose.connection.collection("siteconfigs");
const config = await reglages.findOne({});
if (!config) sortir("Aucun réglage de site en base. Ouvrez /admin/parametres une première fois.");

/* ------------------------------------------------------------- retrait -- */

if (RETIRER) {
  const fichier = path.join(DOSSIER, NOM);
  const present = fs.existsSync(fichier);
  console.log(
    ESSAI
      ? `Simulation : les réglages seraient vidés${present ? ", et le fichier supprimé" : ""}.`
      : "Version retirée."
  );
  if (!ESSAI) {
    if (present) fs.rmSync(fichier);
    await reglages.updateOne(
      { _id: config._id },
      { $set: { androidApkUrl: "", androidVersion: "", androidSizeMB: 0, androidNotes: "" } }
    );
    console.log("La page /telecharger annonce de nouveau qu'aucune application n'est publiée.");
    if (present) console.log("Pensez à valider la suppression du fichier et à redéployer.");
  }
  await mongoose.disconnect();
  process.exit(0);
}

/* ----------------------------------------------------------- contrôles -- */

if (!chemin) sortir("Indiquez le chemin de l'APK.\n  node scripts/publier-apk.mjs moziik.apk 1.0.0");
if (!version) sortir("Indiquez le numéro de version.\n  node scripts/publier-apk.mjs moziik.apk 1.0.0");

const complet = path.resolve(process.cwd(), chemin);
if (!fs.existsSync(complet)) sortir(`Fichier introuvable : ${complet}`);

const octets = fs.statSync(complet).size;
const megaoctets = Math.round((octets / (1024 * 1024)) * 10) / 10;

// Deux contrôles avant d'écrire quoi que ce soit. Sans eux, l'erreur ne se
// voit qu'à la première installation ratée, chez quelqu'un d'autre.
const apk = analyserApk(complet);

if (!apk.estZip) sortir("Ce fichier n'est pas un APK : ce n'est même pas une archive.");

if (!apk.signe) {
  sortir(
    [
      `${path.basename(complet)} n'est PAS SIGNÉ. Android refusera de l'installer,`,
      "par un « Application non installée » qui n'explique rien.",
      "",
      "C'est ce que produit `gradlew assembleRelease` quand",
      "android/keystore.properties est absent — le fichier s'appelle alors",
      "app-release-UNSIGNED.apk, et le nom est le seul avertissement.",
      "",
      "Pour créer la clé, une fois pour toutes :",
      "",
      "  keytool -genkeypair -v -keystore android/moziik-release.jks \\",
      "    -alias moziik -keyalg RSA -keysize 2048 -validity 10000",
      "",
      "Puis écrire android/keystore.properties (ignoré par git) :",
      "",
      "  storeFile=../moziik-release.jks",
      "  storePassword=<le mot de passe choisi>",
      "  keyAlias=moziik",
      "  keyPassword=<le mot de passe de la clé>",
      "",
      "Et recompiler : cd android && ./gradlew assembleRelease",
      "",
      "GARDEZ CETTE CLÉ. Android refuse de mettre à jour une application",
      "signée d'une autre clé : la perdre obligerait chaque personne à",
      "désinstaller avant de réinstaller, en perdant ses téléchargements.",
    ].join("\n")
  );
}

console.log(
  `APK : ${path.basename(complet)} — ${megaoctets} Mo, version ${version}, signé (${apk.schemas.join(" + ")})`
);

// Un APK énorme dans le dépôt est un choix, pas un accident : au-delà de
// ce seuil, on le dit avant d'écrire.
const SEUIL_ALERTE_MO = 40;
if (megaoctets > SEUIL_ALERTE_MO) {
  console.warn(
    `\nAttention : ${megaoctets} Mo entreront définitivement dans l'historique git.\n` +
      "Au-delà de quelques versions, préférez une release GitHub et collez\n" +
      "son adresse dans /admin/parametres — la route accepte une adresse absolue."
  );
}

if (ESSAI) {
  console.log(`\nSimulation : rien n'a été copié ni écrit.`);
  console.log(`Le fichier irait dans public/telechargements/${NOM}`);
  console.log("Adresse publique : /api/telechargement/android");
  await mongoose.disconnect();
  process.exit(0);
}

/* ------------------------------------------------------------ écriture -- */

fs.mkdirSync(DOSSIER, { recursive: true });
fs.copyFileSync(complet, path.join(DOSSIER, NOM));

await reglages.updateOne(
  { _id: config._id },
  {
    $set: {
      androidApkUrl: ADRESSE,
      androidVersion: version,
      androidSizeMB: megaoctets,
      androidPublishedAt: new Date(),
      androidNotes: notes,
    },
  }
);

console.log(`\nCopié dans public/telechargements/${NOM}, réglages mis à jour.`);
console.log("\nIL RESTE DEUX GESTES, sans lesquels le lien ne mènera nulle part :");
console.log(`  git add public/telechargements/${NOM} && git commit -m "Publie l'application ${version}"`);
console.log("  git push");
console.log("\nUne fois déployé :");
console.log("  Page d'installation : /telecharger");
console.log("  Adresse à communiquer : /api/telechargement/android");
if (!notes) {
  console.log(
    "\nAucune note de version. Pour en ajouter :\n  APK_NOTES='Ce qui change…' node scripts/publier-apk.mjs …"
  );
}

await mongoose.disconnect();
process.exit(0);
