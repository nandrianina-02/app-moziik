/**
 * Retrouve les coordonnées des évènements déjà en base.
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * La carte d'une fiche d'évènement ne s'affiche qu'avec une latitude et
 * une longitude. Depuis peu, elles sont cherchées à l'enregistrement — mais
 * seulement à l'enregistrement : les évènements créés avant n'en ont
 * aucune, et rouvrir chacun pour cliquer « Enregistrer » n'est pas une
 * façon de traiter un catalogue.
 *
 * CE QU'IL RESPECTE
 *
 * Nominatim, le service d'OpenStreetMap, demande de ne pas dépasser une
 * requête par seconde et d'identifier l'application appelante. Le script
 * attend donc entre chaque adresse, et se nomme. Ne pas le faire, c'est se
 * faire bloquer l'adresse IP du serveur — pour tout le monde.
 *
 * CE QU'IL NE TOUCHE PAS
 *
 * Un évènement qui a déjà des coordonnées, même approximatives : elles ont
 * pu être choisies à la main parce que le premier résultat tombait à côté.
 *
 * Usage :
 *   node scripts/situer-evenements.mjs --essai   (n'écrit rien)
 *   node scripts/situer-evenements.mjs
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

const ESSAI = process.argv.includes("--essai");

/** Une seconde entre deux appels, plus une marge : c'est la règle de Nominatim. */
const PAUSE_MS = 1200;

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

await mongoose.connect(chargerUri());
const db = mongoose.connection.db;

const aSituer = await db
  .collection("events")
  .find({
    $and: [
      { $or: [{ latitude: { $exists: false } }, { latitude: null }] },
      { $or: [{ longitude: { $exists: false } }, { longitude: null }] },
    ],
  })
  .project({ title: 1, location: 1, address: 1, postalCode: 1, city: 1, country: 1 })
  .toArray();

if (aSituer.length === 0) {
  console.log("Tous les évènements ont déjà des coordonnées.");
  await mongoose.disconnect();
  process.exit(0);
}

console.log(
  `${aSituer.length} évènement(s) sans coordonnées.` +
    (ESSAI ? " Essai : rien ne sera écrit.\n" : ` Une requête toutes les ${PAUSE_MS / 1000} s.\n`)
);

// Le nom du site sert à s'identifier auprès de Nominatim.
const config = await db.collection("siteconfigs").findOne({});
const identite = `${config?.siteName ?? "Moziik"} (${config?.supportEmail ?? "contact"})`;

let situes = 0;
let introuvables = 0;

for (const [index, evenement] of aSituer.entries()) {
  const adresse = [
    evenement.address,
    evenement.postalCode,
    evenement.city,
    evenement.country,
    evenement.location,
  ]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(", ");

  if (adresse.length < 3) {
    introuvables++;
    console.log(`  · ${evenement.title} — pas d'adresse exploitable`);
    continue;
  }

  if (index > 0) await attendre(PAUSE_MS);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", adresse);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  try {
    const reponse = await fetch(url, {
      headers: { "User-Agent": identite, "Accept-Language": "fr" },
    });
    if (!reponse.ok) {
      introuvables++;
      console.warn(`  ✗ ${evenement.title} — service indisponible (${reponse.status})`);
      continue;
    }

    const [lieu] = await reponse.json();
    const latitude = Number(lieu?.lat);
    const longitude = Number(lieu?.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      introuvables++;
      console.log(`  · ${evenement.title} — « ${adresse} » introuvable`);
      continue;
    }

    if (!ESSAI) {
      await db
        .collection("events")
        .updateOne({ _id: evenement._id }, { $set: { latitude, longitude } });
    }
    situes++;
    console.log(`  ✓ ${evenement.title} — ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
  } catch (err) {
    introuvables++;
    console.warn(`  ✗ ${evenement.title} — ${err?.message ?? err}`);
  }
}

console.log(
  `\n${situes} ${ESSAI ? "situable(s)" : "situé(s)"}, ${introuvables} sans résultat.` +
    (introuvables > 0
      ? " Ceux-là gardent leur fiche sans carte : précisez leur adresse, ou posez le point à la main dans le formulaire."
      : "")
);

await mongoose.disconnect();
process.exit(0);
