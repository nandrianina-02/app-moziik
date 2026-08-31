/**
 * Pose l'univers musical — général ou évangélique — sur les documents
 * antérieurs à la séparation.
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * Une valeur par défaut Mongoose ne s'applique qu'à la création : les
 * artistes, titres, albums, playlists et écoutes déjà en base n'ont pas
 * de champ `univers` du tout. Or toutes les lectures du site filtrent
 * désormais dessus. Sans rattrapage, l'accueil, la recherche, les
 * classements et la lecture automatique seraient vides sur un catalogue
 * pourtant intact.
 *
 * L'application fait la même chose toute seule au premier démarrage
 * (lib/universBackfill.ts). Ce script existe pour l'exécuter à la main —
 * avant un déploiement, ou pour voir ce qu'il touche.
 *
 * CE QU'IL NE FAIT PAS
 *
 * Il ne classe rien. Tout part dans l'univers général ; c'est la
 * détection, depuis /admin/univers, qui répartit ensuite le catalogue en
 * s'appuyant sur le genre déclaré, les titres, les paroles et les
 * biographies. Séparer les deux est délibéré : ce rattrapage doit être
 * rapide et sans surprise, le classement est un acte éditorial.
 *
 * Idempotent : relancé, il ne fait rien.
 *
 * Usage :  node scripts/backfill-univers.mjs
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

function loadEnv() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  // Même ordre de priorité que Next.js : .env.local l'emporte sur .env.
  for (const file of [".env.local", ".env"]) {
    const full = path.resolve(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      if (!line.includes("=") || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      if (line.slice(0, i).trim() === "MONGODB_URI") return line.slice(i + 1).trim();
    }
  }
  throw new Error("MONGODB_URI introuvable (ni dans l'environnement, ni dans .env.local / .env).");
}

const uri = loadEnv();
await mongoose.connect(uri);
const db = mongoose.connection.db;

const absent = { univers: { $exists: false } };

const travaux = [
  { nom: "artistes", collection: "artists", set: { univers: "general", universSource: "auto" } },
  { nom: "titres", collection: "songs", set: { univers: "general", universSource: "artiste" } },
  { nom: "albums", collection: "albums", set: { univers: "general" } },
  { nom: "playlists", collection: "playlists", set: { univers: "general" } },
  { nom: "écoutes", collection: "plays", set: { univers: "general" } },
];

let total = 0;
for (const travail of travaux) {
  const { modifiedCount } = await db.collection(travail.collection).updateMany(absent, { $set: travail.set });
  total += modifiedCount;
  console.log(
    modifiedCount > 0
      ? `${modifiedCount} ${travail.nom} rattaché(e)s à l'univers général.`
      : `Rien à faire pour les ${travail.nom}.`
  );
}

// Le drapeau évite que l'application relance un balayage complet à chaque
// démarrage à froid pour ne rien trouver.
await db
  .collection("siteconfigs")
  .updateOne(
    { _id: new mongoose.Types.ObjectId("000000000000000000000001") },
    { $set: { universBackfilledAt: new Date() } },
    { upsert: true }
  );

console.log(
  total > 0
    ? `\nFait. Lancez maintenant la détection depuis /admin/univers pour répartir le catalogue.`
    : `\nRien n'a changé : le catalogue portait déjà son univers.`
);

await mongoose.disconnect();
process.exit(0);
