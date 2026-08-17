/**
 * Supprime l'index unique hérité `key_1` sur la collection
 * `homepagesections`.
 *
 * Pourquoi : cet index n'est déclaré dans aucun schéma — c'est un reliquat
 * d'une version antérieure de models/HomepageSection.ts. Il impose
 * l'unicité de `key` sur toute la collection, ce qui casse deux choses :
 *
 *  - « Ajouter une section » dans l'administration ne peut créer qu'UNE
 *    seule section personnalisée. La deuxième échoue avec
 *
 *        E11000 duplicate key error ... index: key_1 dup key: { key: "custom" }
 *
 *    soit un 500 côté navigateur, sans explication.
 *  - une même clé (« genres », « top_tracks »...) ne peut pas exister à la
 *    fois sur l'accueil et sur un autre groupe de pages, ce qui empêche la
 *    configuration par page.
 *
 * Aucune requête ne s'appuie sur cet index : les lectures se font par
 * `page` (index `page_1_position_1`) ou par `slug` (index `slug_1`, lui
 * bien déclaré et toujours utile).
 *
 * L'application effectue la même réparation au démarrage
 * (lib/homepageSections.ts) ; ce script existe pour l'exécuter à la main,
 * par exemple avant un déploiement. Il est idempotent : relancé, il ne
 * fait rien.
 *
 * Usage :  node scripts/fix-homepage-section-indexes.mjs
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
const sections = mongoose.connection.db.collection("homepagesections");

const indexes = await sections.indexes();
const faulty = indexes.find((index) => index.name === "key_1" && index.unique);

if (!faulty) {
  console.log("Rien à faire : aucun index unique sur `key`.");
} else {
  console.log("Suppression de l'index unique hérité « key_1 »...");
  await sections.dropIndex("key_1");
  console.log("Fait. Plusieurs sections de même type peuvent à nouveau coexister.");
}

// Le champ `page` n'existe pas sur les documents antérieurs : ils
// appartiennent tous à l'accueil.
const backfilled = await sections.updateMany({ page: { $exists: false } }, { $set: { page: "home" } });
if (backfilled.modifiedCount > 0) {
  console.log(`${backfilled.modifiedCount} section(s) rattachée(s) à la page d'accueil.`);
}

await mongoose.disconnect();
process.exit(0);
