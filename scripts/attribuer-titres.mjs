/**
 * Rend à leurs interprètes des titres versés au compte de quelqu'un d'autre.
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * Un import en masse dépose tout un dossier sous le compte de celui qui
 * l'a envoyé. Sur Moziik, cela n'a pas seulement l'air faux : les
 * royalties se calculent en remontant de l'écoute au titre puis à son
 * artiste (app/api/cron/compute-royalties). Tant qu'un titre est attribué
 * au mauvais compte, chaque écoute complète paie la mauvaise personne.
 *
 * D'OÙ VIENT L'ATTRIBUTION
 *
 * De la pochette déjà présente en base, et d'elle seule. Chaque ligne du
 * tableau ci-dessous porte l'album que montre l'image, et ce nom vient de
 * l'image, pas d'une recherche sur le web ni d'une intuition. Les titres
 * dont la pochette ne nomme aucun interprète — les compilations — ne sont
 * attribués à personne : ils restent où ils sont, et sont seulement
 * rangés dans le bon univers.
 *
 * CE QUI SE PASSE POUR LES ROYALTIES
 *
 * Les écoutes déjà payées (`monetized: true`) restent acquises à l'ancien
 * compte : un relevé émis ne se réécrit pas. Les écoutes non encore
 * payées suivront le titre, donc son nouvel artiste — c'est précisément
 * le but.
 *
 * TOUT EST RÉVERSIBLE
 *
 * Chaque exécution écrit un journal qui contient l'état exact d'avant,
 * titre par titre. `--annuler <journal>` le remet en place.
 *
 * Usage :
 *   node scripts/attribuer-titres.mjs --essai        (n'écrit rien)
 *   node scripts/attribuer-titres.mjs
 *   node scripts/attribuer-titres.mjs --annuler attribution-....json
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

/** Le compte sous lequel l'import a tout déposé. */
const SOURCE = process.env.ATTRIBUTION_SOURCE ?? "Nandrianina Razafindrakoto";

/**
 * Titre exact en base → interprète que montre la pochette.
 *
 * Le titre est comparé caractère pour caractère, apostrophe typographique
 * comprise : un titre qui ne correspond pas est signalé plutôt que
 * rapproché de force du plus ressemblant.
 */
const ATTRIBUTIONS = [
  // Pochette « Mandigny » — TanaGospelChoir, www.tgc.mg
  ["Haleloia Hosana", "Tana Gospel Choir", "pochette de l'album Mandigny"],
  ["Il est temps", "Tana Gospel Choir", "pochette de l'album Mandigny"],
  ["Jesosy mena sogny", "Tana Gospel Choir", "pochette de l'album Mandigny"],
  ["Louanges bossals", "Tana Gospel Choir", "pochette de l'album Mandigny"],
  ["Mahere", "Tana Gospel Choir", "pochette de l'album Mandigny"],
  ["Mamela heloka", "Tana Gospel Choir", "pochette de l'album Mandigny"],
  ["Mandigny", "Tana Gospel Choir", "pochette de l'album Mandigny"],
  ["Ny anaranao", "Tana Gospel Choir", "pochette de l'album Mandigny"],
  ["Ny foko ry Mpamonjy", "Tana Gospel Choir", "pochette de l'album Mandigny"],
  ["Teraka anio", "Tana Gospel Choir", "pochette de l'album Mandigny"],
  ["Tiako anao Zanahary", "Tana Gospel Choir", "pochette de l'album Mandigny"],
  ["Zakaiosy", "Tana Gospel Choir", "pochette de l'album Mandigny"],
  // Pochette « M'Saotra Anao Ray » — Tana Gospel Choir
  ["Ho avy Kristy", "Tana Gospel Choir", "pochette de l'album M'Saotra Anao Ray"],
  ["Ho entina aiza", "Tana Gospel Choir", "pochette de l'album M'Saotra Anao Ray"],
  ["Tolotra", "Tana Gospel Choir", "pochette de l'album M'Saotra Anao Ray"],
  // Pochettes signées Jaws Band
  ["Jehovah ray", "Jaws Band", "pochette du single Jehovah Ray"],
  ["Mpatsaka Vavy", "Jaws Band", "pochette du single Mpatsaka Vavy"],
  // Pochettes signées d'un nom d'artiste
  ["MANANA FINOANA", "Njara Marcel", "pochette du single Manana Finoana"],
  ["Hatramin’ny farany", "Henika", "pochette du single Hatramin'ny Farany, label Cevam"],
];

/**
 * Titres dont la pochette est une compilation : elle nomme un album, pas
 * un interprète. Ils changent d'univers, pas de propriétaire.
 *
 * Les laisser au compte d'import reste faux, mais l'est moins que de les
 * attribuer à quelqu'un au jugé : il faudra le livret du disque, ou la
 * mémoire de celui qui les a versés.
 */
const SANS_INTERPRETE = [
  // Pochette « Avy ny maraina — Mihira Fihiram-Baovao ho an'i Jehovah », vol. 1
  "Faneva faha-30 taona FJKM",
  "He ! Manolo-tena",
  "Izaho no fananganana ny maty",
  "Jesoa, Vato fehizoro",
  "Mivavaka aho satria",
  "Tsy hainay ny hangina",
  // Même compilation, vol. 4
  "Andriamanitra Fitiavana",
  "Ianao Izay Miasa Fatratra",
  "Jeso No Mpanavotra",
];

/** Échappe un nom pour le placer dans une expression régulière. */
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// --- Annulation ------------------------------------------------------------
async function annuler(db, chemin) {
  if (!chemin || !fs.existsSync(chemin)) {
    throw new Error(`Journal introuvable : ${chemin ?? "(aucun chemin donné)"}`);
  }
  const journal = JSON.parse(fs.readFileSync(chemin, "utf8"));
  console.log(`Annulation de ${journal.entrees.length} modification(s) du ${journal.date}.\n`);

  for (const e of journal.entrees) {
    // `$unset` pour ce qui n'existait pas : réécrire une chaîne vide
    // laisserait un champ que le document n'avait pas.
    const set = {};
    const unset = {};
    for (const [champ, valeur] of Object.entries(e.avant)) {
      if (valeur === null || valeur === undefined) unset[champ] = "";
      else set[champ] = champ === "artist" ? new mongoose.Types.ObjectId(valeur) : valeur;
    }
    if (!ESSAI) {
      await db.collection("songs").updateOne(
        { _id: new mongoose.Types.ObjectId(e.song) },
        {
          ...(Object.keys(set).length ? { $set: set } : {}),
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        }
      );
    }
    console.log(`  ${ESSAI ? "·" : "ok"} ${e.titre}`);
  }
  console.log(`\n${ESSAI ? "Simulation : rien n'a été écrit." : "État précédent rétabli."}`);
}

// --- Attribution -----------------------------------------------------------
async function attribuer(db) {
  const source = await db.collection("artists").findOne({ stageName: SOURCE });
  if (!source) throw new Error(`Artiste source introuvable : « ${SOURCE} ».`);

  // Les profils destinataires doivent exister : ce script ne crée aucun
  // compte, c'est le travail de scripts/seed-artist-accounts.mjs, qui les
  // crée avec leur univers, leur genre et leur mot de passe.
  const voulus = [...new Set(ATTRIBUTIONS.map(([, artiste]) => artiste))];
  const profils = new Map();
  for (const nom of voulus) {
    const trouves = await db
      .collection("artists")
      .find({ stageName: { $regex: `^${echapper(nom)}$`, $options: "i" } })
      .toArray();
    if (trouves.length === 1) profils.set(nom, trouves[0]);
    else if (trouves.length > 1) console.warn(`  ! ${nom} : ${trouves.length} profils homonymes — non traité`);
  }

  const absents = voulus.filter((nom) => !profils.has(nom));
  if (absents.length > 0) {
    console.error(
      `\nProfils artistes manquants : ${absents.join(", ")}.\n` +
        "Lancez d'abord : ARTIST_SEED_PASSWORD='...' node scripts/seed-artist-accounts.mjs\n"
    );
    if (!ESSAI) throw new Error("Attribution interrompue : rien n'a été écrit.");
  }

  const entrees = [];
  const introuvables = [];
  let rendus = 0;

  const lire = async (titre) => {
    const trouves = await db
      .collection("songs")
      .find({ artist: source._id, title: titre })
      .project({ title: 1, artist: 1, genre: 1, univers: 1, universSource: 1 })
      .toArray();
    if (trouves.length === 0) {
      introuvables.push(`${titre} — aucun titre de ce nom chez ${SOURCE}`);
      return null;
    }
    if (trouves.length > 1) {
      introuvables.push(`${titre} — ${trouves.length} titres de ce nom, ambigu`);
      return null;
    }
    return trouves[0];
  };

  console.log(`Titres rendus à leur interprète (source : ${SOURCE})\n`);
  for (const [titre, artiste, preuve] of ATTRIBUTIONS) {
    const chanson = await lire(titre);
    if (!chanson) continue;
    const cible = profils.get(artiste);
    if (!cible) continue;

    const avant = {
      artist: String(chanson.artist),
      genre: chanson.genre ?? null,
      univers: chanson.univers ?? null,
      universSource: chanson.universSource ?? null,
    };
    // La source du classement dépend de qui reçoit le titre.
    //
    // Un artiste évangélique transmet son univers à tout ce qu'il publie :
    // « artiste » suffit, et le titre suivra son auteur s'il change un
    // jour. Mais Njara Marcel, lui, chante surtout autre chose : son
    // unique titre de louange doit être marqué « admin », sinon la cascade
    // le ramènerait au général avec le reste de sa discographie à la
    // prochaine passe de détection (lib/universClassify.ts).
    const heritier = cible.univers === "christian";
    const apres = {
      artist: cible._id,
      genre: "Gospel",
      univers: "christian",
      universSource: heritier ? "artiste" : "admin",
    };

    if (!ESSAI) await db.collection("songs").updateOne({ _id: chanson._id }, { $set: apres });
    entrees.push({ song: String(chanson._id), titre, avant });
    rendus += 1;
    console.log(`  ${ESSAI ? "·" : "ok"} ${titre.padEnd(30)} -> ${artiste}   (${preuve})`);
  }

  console.log("\nTitres rangés dans l'univers évangélique, sans changer d'interprète\n");
  for (const titre of SANS_INTERPRETE) {
    const chanson = await lire(titre);
    if (!chanson) continue;

    const avant = {
      genre: chanson.genre ?? null,
      univers: chanson.univers ?? null,
      universSource: chanson.universSource ?? null,
    };
    // « admin » ici, et c'est toute la différence : le titre reste chez un
    // artiste général, donc la cascade le ramènerait au général à la
    // prochaine passe si son classement n'était pas déclaré comme une
    // décision (voir lib/universClassify.ts).
    const apres = { genre: "Gospel", univers: "christian", universSource: "admin" };

    if (!ESSAI) await db.collection("songs").updateOne({ _id: chanson._id }, { $set: apres });
    entrees.push({ song: String(chanson._id), titre, avant });
    console.log(`  ${ESSAI ? "·" : "ok"} ${titre}`);
  }

  if (introuvables.length > 0) {
    console.log(`\nNon traités : ${introuvables.length}`);
    for (const ligne of introuvables) console.log(`  ! ${ligne}`);
  }

  if (!ESSAI && entrees.length > 0) {
    const date = new Date().toISOString().replace(/[:.]/g, "-");
    const chemin = path.resolve(process.cwd(), `attribution-${date}.json`);
    fs.writeFileSync(chemin, JSON.stringify({ date, source: SOURCE, entrees }, null, 1), "utf8");
    console.log(`\nJournal écrit : ${chemin}`);
    console.log(`Pour tout remettre en place : node scripts/attribuer-titres.mjs --annuler "${chemin}"`);
  }

  console.log(
    `\n${entrees.length} titre(s) ${ESSAI ? "à traiter" : "traités"}, dont ${rendus} rendus à un interprète.`
  );
  if (!ESSAI && rendus > 0) {
    console.log(
      "\nLes écoutes déjà payées restent acquises à l'ancien compte ; celles qui ne\n" +
        "le sont pas encore seront versées au nouvel interprète au prochain relevé."
    );
  }
}

// --- Exécution -------------------------------------------------------------
await mongoose.connect(chargerUri(), { autoIndex: false });
const db = mongoose.connection.db;
console.log(`Base « ${mongoose.connection.name} » — ${ESSAI ? "SIMULATION, aucune écriture" : "ÉCRITURE"}\n`);

try {
  if (EN_ANNULATION) await annuler(db, JOURNAL);
  else await attribuer(db);
} finally {
  await mongoose.disconnect();
}
