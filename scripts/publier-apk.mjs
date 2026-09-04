/**
 * Met une version de l'application Android en ligne.
 *
 * CE QU'IL FAIT
 *
 * Envoie l'APK chez Cloudinary, puis inscrit son adresse, sa version et
 * son poids dans les réglages du site. La page /telecharger s'en sert
 * aussitôt — il n'y a rien à redéployer.
 *
 * POURQUOI PAS UN FICHIER DANS `public/`
 *
 * Un APK pèse plusieurs dizaines de mégaoctets et change à chaque
 * version. Versionné, il ferait grossir le dépôt sans fin et chaque
 * déploiement transporterait un binaire que personne ne relit. Vercel
 * limite par ailleurs la taille des fichiers statiques servis.
 *
 * L'ADRESSE PUBLIQUE NE CHANGE JAMAIS
 *
 * Ce que l'on communique est `/api/telechargement/android`, qui redirige
 * vers la dernière version. L'adresse Cloudinary, elle, change à chaque
 * publication — et c'est justement pourquoi elle ne doit pas circuler.
 *
 * COMMENT FABRIQUER L'APK
 *
 *   npx cap sync android
 *   cd android && ./gradlew assembleRelease
 *
 * Le fichier sort dans android/app/build/outputs/apk/release/. Il doit
 * être signé : un APK non signé s'installe en debug seulement, et Android
 * refusera toute mise à jour ultérieure signée d'une autre clé. Gardez la
 * même clé pour toutes les versions, et sauvegardez-la — la perdre oblige
 * chaque personne à désinstaller avant de réinstaller.
 *
 * Usage :
 *   node scripts/publier-apk.mjs --essai chemin/vers/moziik.apk 1.0.0
 *   node scripts/publier-apk.mjs chemin/vers/moziik.apk 1.0.0
 *   node scripts/publier-apk.mjs --retirer      (retire la version en ligne)
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
const positionnels = args.filter((a) => !a.startsWith("--"));
const [chemin, version] = positionnels;

const notes = process.env.APK_NOTES ?? "";

function sortir(message) {
  console.error(message);
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
const reglages = mongoose.connection.collection("siteconfigs");
const config = await reglages.findOne({});
if (!config) sortir("Aucun réglage de site en base. Ouvrez /admin/parametres une première fois.");

if (RETIRER) {
  console.log(
    ESSAI
      ? "Simulation : la version en ligne serait retirée."
      : "Version retirée. La page /telecharger annoncera de nouveau qu'aucune application n'est publiée."
  );
  if (!ESSAI) {
    await reglages.updateOne(
      { _id: config._id },
      { $set: { androidApkUrl: "", androidVersion: "", androidSizeMB: 0, androidNotes: "" } }
    );
  }
  await mongoose.disconnect();
  process.exit(0);
}

if (!chemin) sortir("Indiquez le chemin de l'APK.\n  node scripts/publier-apk.mjs moziik.apk 1.0.0");
if (!version) sortir("Indiquez le numéro de version.\n  node scripts/publier-apk.mjs moziik.apk 1.0.0");

const complet = path.resolve(process.cwd(), chemin);
if (!fs.existsSync(complet)) sortir(`Fichier introuvable : ${complet}`);

const octets = fs.statSync(complet).size;
const megaoctets = Math.round((octets / (1024 * 1024)) * 10) / 10;

// Deux contrôles avant d'envoyer quoi que ce soit. Sans eux, l'erreur ne
// se voit qu'à la première installation ratée, chez quelqu'un d'autre.
const apk = analyserApk(complet);

if (!apk.estZip) {
  sortir("Ce fichier n'est pas un APK : ce n'est même pas une archive.");
}

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

if (ESSAI) {
  console.log("\nSimulation : rien n'a été envoyé ni écrit.");
  console.log("Adresse publique une fois publié : /api/telechargement/android");
  await mongoose.disconnect();
  process.exit(0);
}

const { v2: cloudinary } = await import("cloudinary");
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("Envoi vers Cloudinary…");
const envoi = await cloudinary.uploader.upload(complet, {
  // `raw` : ni image ni vidéo. Sans cela Cloudinary tenterait de
  // transcoder l'archive et refuserait.
  resource_type: "raw",
  folder: "moziik/app",
  // Le nom porte la version : les anciennes restent accessibles pour qui
  // aurait gardé un lien, et une publication ne détruit pas la
  // précédente.
  public_id: `moziik-${version}.apk`,
  // `type: upload` explicite : le préréglage du compte est passé en
  // « authenticated » pour l'audio, et un APK signé serait intéléchargeable.
  type: "upload",
  overwrite: true,
  invalidate: true,
});

await reglages.updateOne(
  { _id: config._id },
  {
    $set: {
      androidApkUrl: envoi.secure_url,
      androidVersion: version,
      androidSizeMB: megaoctets,
      androidPublishedAt: new Date(),
      androidNotes: notes,
    },
  }
);

console.log(`\nPublié. ${megaoctets} Mo, version ${version}.`);
console.log(`Adresse à communiquer : ${(config.siteUrl || "").replace(/\/$/, "")}/api/telechargement/android`);
console.log("Page d'installation : /telecharger");
if (!notes) {
  console.log(
    "\nAucune note de version. Pour en ajouter :\n  APK_NOTES='Ce qui change…' node scripts/publier-apk.mjs …"
  );
}

await mongoose.disconnect();
process.exit(0);
