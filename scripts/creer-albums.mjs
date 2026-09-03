/**
 * Regroupe en albums des titres importés à l'unité.
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * Un import en masse crée des singles : chaque fichier devient un titre
 * sans album, alors que le dossier d'origine était un disque. La page
 * d'un artiste n'affiche alors qu'une liste plate, la pochette se répète
 * quinze fois, et rien ne dit que ces morceaux se suivent.
 *
 * D'OÙ VIENNENT CES ALBUMS
 *
 * De la pochette déjà en base — c'est elle qui nomme le disque — et du
 * sommaire publié par le distributeur, qui donne l'ordre des pistes. Rien
 * n'est deviné : un titre dont on ignore le rang est simplement placé
 * après ceux dont on le connaît.
 *
 * CE QU'IL NE FAIT PAS
 *
 * Il ne crée pas les pistes manquantes. Un album de quinze titres dont la
 * base n'en contient que douze reste un album de douze : inventer trois
 * morceaux muets pour faire joli serait mentir sur ce que le catalogue
 * contient.
 *
 * TOUT EST RÉVERSIBLE
 *
 * Chaque exécution écrit un journal. `--annuler <journal>` supprime les
 * albums créés et détache les titres.
 *
 * Usage :
 *   node scripts/creer-albums.mjs --essai
 *   node scripts/creer-albums.mjs
 *   node scripts/creer-albums.mjs --annuler albums-....json
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

// --- Environnement ---------------------------------------------------------
function chargerUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  for (const fichier of [".env.local", ".env"]) {
    const complet = path.resolve(process.cwd(), fichier);
    if (!fs.existsSync(complet)) continue;
    for (const ligne of fs.readFileSync(complet, "utf8").split(/\r?\n/)) {
      if (!ligne.includes("=") || ligne.trim().startsWith("#")) continue;
      const i = ligne.indexOf("=");
      if (ligne.slice(0, i).trim() === "MONGODB_URI") {
        return ligne.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      }
    }
  }
  throw new Error("MONGODB_URI introuvable (ni dans l'environnement, ni dans .env.local / .env).");
}

const ESSAI = process.argv.includes("--essai");
const EN_ANNULATION = process.argv.includes("--annuler");
const JOURNAL = EN_ANNULATION ? process.argv[process.argv.indexOf("--annuler") + 1] : null;

/**
 * Les disques à reconstituer.
 *
 * `titres` est dans l'ordre du sommaire publié, pas dans celui de la
 * base : c'est cet ordre-là que l'auditeur attend en lançant l'album.
 *
 * `date` est celle que donne la source citée. Pour ces rééditions
 * numériques, elle est souvent postérieure au disque physique — c'est
 * néanmoins la seule qui soit sourcée, et elle se corrige en deux clics
 * depuis l'administration.
 */
const ALBUMS = [
  {
    titre: "Mandigny",
    artiste: "Tana Gospel Choir",
    date: "2020-01-01",
    source: "Spotify — © 2020 Do Sol Madagasikara, 15 pistes",
    titres: [
      "Haleloia Hosana",
      "Ny anaranao",
      "Ny foko ry Mpamonjy",
      "Zakaiosy",
      "Mandigny",
      "Tiako anao Zanahary",
      "Mahere",
      "Mamela heloka",
      "Louanges bossals",
      "Jesosy mena sogny",
      "Teraka anio",
      "Il est temps",
    ],
  },
  {
    titre: "M'Saotra Anao Ray",
    artiste: "Tana Gospel Choir",
    date: "2020-01-01",
    source: "Last.fm — 12 pistes ; l'ordre de ces trois-là n'est pas publié",
    titres: ["Tolotra", "Ho avy Kristy", "Ho entina aiza"],
  },
  {
    titre: "Avy Ny Maraina (Vol.1)",
    artiste: "Fihirana Fanampiny",
    date: "2002-06-01",
    source: "Amazon Music — 12 pistes, FJKM Madagasikara",
    titres: [
      "Faneva faha-30 taona FJKM",
      "He ! Manolo-tena",
      "Jesoa, Vato fehizoro",
      "Izaho no fananganana ny maty",
      "Tsy hainay ny hangina",
      "Mivavaka aho satria",
    ],
  },
  {
    titre: "Avy Ny Maraina (Vol.4)",
    artiste: "Fihirana Fanampiny",
    // Deezer date la mise en ligne de 2024 ; le disque, lui, appartient à
    // la même série que le volume 1. Faute de mieux, c'est la date citée.
    date: "2024-11-16",
    source: "Deezer — 14 pistes, crédité fjkm",
    titres: ["Jeso No Mpanavotra", "Andriamanitra Fitiavana", "Ianao Izay Miasa Fatratra"],
  },
];

// --- Annulation ------------------------------------------------------------
async function annuler(db, chemin) {
  if (!chemin || !fs.existsSync(chemin)) {
    throw new Error(`Journal introuvable : ${chemin ?? "(aucun chemin donné)"}`);
  }
  const journal = JSON.parse(fs.readFileSync(chemin, "utf8"));

  for (const entree of journal.albums) {
    const ids = entree.songs.map((s) => new mongoose.Types.ObjectId(s));
    if (!ESSAI) {
      await db.collection("songs").updateMany({ _id: { $in: ids } }, { $unset: { album: "" } });
      await db.collection("albums").deleteOne({ _id: new mongoose.Types.ObjectId(entree.album) });
    }
    console.log(`  ${ESSAI ? "·" : "ok"} ${entree.titre} — album supprimé, ${ids.length} titre(s) détaché(s)`);
  }
  console.log(`\n${ESSAI ? "Simulation : rien n'a été écrit." : "État précédent rétabli."}`);
}

// --- Création --------------------------------------------------------------
async function creer(db) {
  const journal = [];

  for (const album of ALBUMS) {
    const artiste = await db.collection("artists").findOne({ stageName: album.artiste });
    if (!artiste) {
      console.warn(`  ! ${album.titre} — artiste « ${album.artiste} » introuvable, album non créé`);
      continue;
    }

    const existant = await db.collection("albums").findOne({ title: album.titre, artist: artiste._id });
    if (existant) {
      console.log(`  · ${album.titre} — existe déjà (${existant._id}), rien à faire`);
      continue;
    }

    // Les titres sont cherchés chez leur artiste, pas dans tout le
    // catalogue : deux disques différents peuvent porter le même nom de
    // morceau, et rien ne dit qu'ils se ressemblent.
    const trouves = [];
    const manquants = [];
    for (const titre of album.titres) {
      const chansons = await db
        .collection("songs")
        .find({ artist: artiste._id, title: titre })
        .project({ title: 1, coverUrl: 1, album: 1, releaseDate: 1 })
        .toArray();
      if (chansons.length === 1) trouves.push(chansons[0]);
      else manquants.push(`${titre}${chansons.length > 1 ? " (plusieurs titres de ce nom)" : ""}`);
    }

    if (trouves.length === 0) {
      console.warn(`  ! ${album.titre} — aucun de ses titres n'est en base, album non créé`);
      continue;
    }

    const deja = trouves.filter((c) => c.album);
    if (deja.length > 0) {
      console.warn(
        `  ! ${album.titre} — ${deja.length} titre(s) appartiennent déjà à un album, non créé : ` +
          deja.map((c) => c.title).join(", ")
      );
      continue;
    }

    // La pochette de l'album est celle de ses titres : ils la partagent
    // tous, puisque c'est elle qui a permis de les regrouper.
    const coverUrl = trouves[0].coverUrl;
    const doc = {
      title: album.titre,
      artist: artiste._id,
      coverUrl,
      type: "album",
      songs: trouves.map((c) => c._id),
      releaseDate: new Date(`${album.date}T00:00:00.000Z`),
      downloadsCount: 0,
      univers: artiste.univers ?? "general",
      createdAt: new Date(),
    };

    let id = null;
    if (!ESSAI) {
      const { insertedId } = await db.collection("albums").insertOne(doc);
      id = insertedId;
      await db.collection("songs").updateMany({ _id: { $in: doc.songs } }, { $set: { album: insertedId } });
      // La date du disque devient celle de ses titres quand ils n'en
      // avaient aucune : l'import les avait tous datés du 1ᵉʳ janvier 1970.
      await db.collection("songs").updateMany(
        { _id: { $in: doc.songs }, releaseDate: { $lt: new Date("1971-01-01") } },
        { $set: { releaseDate: doc.releaseDate } }
      );
    }

    journal.push({ album: String(id), titre: album.titre, songs: doc.songs.map(String) });
    console.log(
      `  ${ESSAI ? "·" : "ok"} ${album.titre} — ${album.artiste}, ${trouves.length} titre(s), ${album.date}`
    );
    console.log(`      source : ${album.source}`);
    if (manquants.length > 0) {
      console.log(`      absents du catalogue, non inventés : ${manquants.join(", ")}`);
    }
  }

  if (!ESSAI && journal.length > 0) {
    const date = new Date().toISOString().replace(/[:.]/g, "-");
    const chemin = path.resolve(process.cwd(), `albums-${date}.json`);
    fs.writeFileSync(chemin, JSON.stringify({ date, albums: journal }, null, 1), "utf8");
    console.log(`\nJournal écrit : ${chemin}`);
    console.log(`Pour tout défaire : node scripts/creer-albums.mjs --annuler "${chemin}"`);
  }

  console.log(`\n${journal.length} album(s) ${ESSAI ? "à créer" : "créés"}.`);
}

// --- Exécution -------------------------------------------------------------
await mongoose.connect(chargerUri(), { autoIndex: false });
const db = mongoose.connection.db;
console.log(`Base « ${mongoose.connection.name} » — ${ESSAI ? "SIMULATION, aucune écriture" : "ÉCRITURE"}\n`);

try {
  if (EN_ANNULATION) await annuler(db, JOURNAL);
  else await creer(db);
} finally {
  await mongoose.disconnect();
}
