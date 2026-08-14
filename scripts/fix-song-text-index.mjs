/**
 * Supprime l'index texte hérité de l'ancien modèle de données sur la
 * collection `songs`.
 *
 * Pourquoi : un index texte MongoDB lit, dans chaque document inséré, un
 * champ dit « language override » — par défaut nommé `language` — et
 * exige qu'il contienne un code de langue reconnu ("french", "en"...).
 * Or `language` est chez nous un champ métier : la langue du morceau,
 * saisie en clair ("Français", "Malagasy"). MongoDB rejetait donc
 * l'écriture avec :
 *
 *     MongoServerError: language override unsupported: Français  (code 17262)
 *
 * Conséquence : plus aucun son ne pouvait être publié ni modifié, avec un
 * simple 500 côté navigateur.
 *
 * L'index en cause (`titre_text_artiste_text`) porte sur `titre` et
 * `artiste`, champs de l'ancien schéma francophone qui n'existent plus
 * dans models/Song.ts, et aucune requête `$text` ne subsiste dans le
 * code : il ne sert plus à rien.
 *
 * Le script est idempotent : relancé, il ne fait rien.
 *
 * Usage :  node scripts/fix-song-text-index.mjs
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
const songs = mongoose.connection.db.collection("songs");

const indexes = await songs.indexes();
// Tout index texte dont le « language override » reste `language` est
// incompatible avec notre champ métier du même nom, quel que soit son nom.
const faulty = indexes.filter(
  (index) => index.textIndexVersion && (index.language_override ?? "language") === "language"
);

if (faulty.length === 0) {
  console.log("Rien à faire : aucun index texte en conflit avec le champ `language`.");
} else {
  for (const index of faulty) {
    console.log(`Suppression de l'index texte « ${index.name} » (champs: ${Object.keys(index.weights ?? {}).join(", ") || "?"})`);
    await songs.dropIndex(index.name);
  }
  console.log(`${faulty.length} index supprimé(s). L'ajout et la modification d'un son sont rétablis.`);
  console.log("Pour le recréer un jour sans casser les écritures, préciser une autre clé :");
  console.log('  db.songs.createIndex({ title: "text" }, { language_override: "_textLang" })');
}

await mongoose.disconnect();
process.exit(0);
