/**
 * Recense les index que plus aucun schéma ne déclare, et permet de les
 * supprimer.
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * Mongoose crée les index qu'il connaît ; il ne supprime jamais ceux qu'il
 * ne connaît plus. Renommer un champ laisse donc derrière lui un index sur
 * l'ancien nom — invisible dans le code, bien présent dans la base.
 *
 * Un index *unique* survivant de cette façon est un piège : tous les
 * documents nouveaux ont `null` pour l'ancien champ, donc la même clé, et
 * le deuxième insert échoue en doublon. C'est exactement ce qui bloquait
 * le calcul des droits :
 *
 *     E11000 duplicate key error collection: moozik_db.royalties
 *     index: artisteId_1_period_1 dup key: { artisteId: null, period: null }
 *
 * `artisteId` et `period` n'existent nulle part dans `models/Royalty.ts` —
 * l'index datait d'une version antérieure du schéma. Le premier relevé
 * passait, tous les suivants étaient refusés.
 *
 * CE QU'IL FAIT
 *
 * Par défaut, il ne fait que lire : il liste chaque index et signale ceux
 * dont un champ est absent d'un échantillon de documents. Le verdict reste
 * humain — un index peut légitimement porter sur un champ rare.
 *
 * Usage :
 *   node scripts/index-obsoletes.mjs
 *   node scripts/index-obsoletes.mjs --supprimer royalties:artisteId_1_period_1
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

function chargerUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  for (const fichier of [".env.local", ".env"]) {
    const complet = path.resolve(process.cwd(), fichier);
    if (!fs.existsSync(complet)) continue;
    for (const ligne of fs.readFileSync(complet, "utf8").split(/\r?\n/)) {
      if (!ligne.includes("=") || ligne.trim().startsWith("#")) continue;
      const i = ligne.indexOf("=");
      if (ligne.slice(0, i).trim() === "MONGODB_URI") return ligne.slice(i + 1).trim();
    }
  }
  throw new Error("MONGODB_URI introuvable (ni dans l'environnement, ni dans .env.local / .env).");
}

/** `--supprimer collection:index`, répétable. */
const aSupprimer = process.argv
  .flatMap((arg, i) => (arg === "--supprimer" ? [process.argv[i + 1]] : []))
  .filter(Boolean)
  .map((valeur) => {
    const [collection, index] = valeur.split(":");
    if (!collection || !index) throw new Error(`Attendu « collection:index », reçu « ${valeur} ».`);
    return { collection, index };
  });

/** Combien de documents on regarde pour juger si un champ existe encore. */
const ECHANTILLON = 50;

await mongoose.connect(chargerUri());
const db = mongoose.connection.db;

if (aSupprimer.length > 0) {
  for (const { collection, index } of aSupprimer) {
    try {
      await db.collection(collection).dropIndex(index);
      console.log(`✓ ${collection} : index « ${index} » supprimé.`);
    } catch (err) {
      console.error(`✗ ${collection} : ${err?.message ?? err}`);
    }
  }
  await mongoose.disconnect();
  process.exit(0);
}

const collections = await db.listCollections().toArray();
let suspects = 0;

for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
  const index = await db.collection(name).indexes();
  // `_id_` est créé par MongoDB et n'appartient à aucun schéma.
  const aExaminer = index.filter((i) => i.name !== "_id_");
  if (aExaminer.length === 0) continue;

  const echantillon = await db.collection(name).find({}).limit(ECHANTILLON).toArray();
  const champsVus = new Set(echantillon.flatMap((doc) => Object.keys(doc)));

  const lignes = aExaminer.map((i) => {
    const champs = Object.keys(i.key);
    // Un champ imbriqué (`auto.run`) : on ne juge que sa racine.
    const inconnus =
      echantillon.length === 0 ? [] : champs.filter((c) => !champsVus.has(c.split(".")[0]));
    return { nom: i.name, unique: Boolean(i.unique), inconnus };
  });

  const douteux = lignes.filter((l) => l.inconnus.length > 0);
  if (douteux.length === 0) continue;

  suspects += douteux.length;
  console.log(`\n${name} (${echantillon.length} document(s) examiné(s))`);
  for (const ligne of douteux) {
    const marque = ligne.unique ? "  ⚠ UNIQUE" : "  ·";
    console.log(`${marque} ${ligne.nom} — champ(s) absent(s) : ${ligne.inconnus.join(", ")}`);
  }
}

console.log(
  suspects === 0
    ? "\nAucun index ne porte sur un champ absent des documents examinés."
    : `\n${suspects} index suspect(s). Ceux marqués UNIQUE bloquent les insertions : ` +
        `supprimez-les avec --supprimer collection:index.`
);

await mongoose.disconnect();
process.exit(0);
