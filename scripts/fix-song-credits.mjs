// scripts/fix-song-credits.mjs
//
// Réattribue les titres au format actuel à leurs vrais artistes, ajoute les
// featurings, et crée au besoin les profils manquants (mêmes règles que
// scripts/seed-artist-accounts.mjs).
//
// Le premier artiste de chaque ligne devient l'artiste principal (Song.artist),
// les suivants passent en Song.featuring. Un titre n'est touché que si sa
// correspondance est certaine : les cas douteux sont signalés, pas devinés.
//
// Usage :
//   node scripts/fix-song-credits.mjs --dry-run
//   ARTIST_SEED_PASSWORD='motdepasse' node scripts/fix-song-credits.mjs

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!m) continue;
      if (!(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["'](.*)["']$/, "$1");
    }
  }
}
loadEnv();

const DRY_RUN = process.argv.includes("--dry-run");
const MONGODB_URI = process.env.MONGODB_URI;
const PASSWORD = process.env.ARTIST_SEED_PASSWORD;

if (!MONGODB_URI) {
  console.error("MONGODB_URI manquant.");
  process.exit(1);
}

const norm = (s) =>
  Array.from(String(s || "").normalize("NFD"))
    .filter((ch) => {
      const c = ch.codePointAt(0);
      return c < 0x300 || c > 0x36f;
    })
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slugEmail = (name) => `${norm(name).replace(/ /g, "")}@moziik.app`;

// Noms de la liste désignant un artiste déjà en base sous une autre graphie.
// Sans cette table, on créerait un second profil pour le même artiste — or la
// consigne est de ne pas faire de doublons. Chaque correspondance est signalée
// dans le rapport pour pouvoir être démentie.
const ALIAS = {
  "wawa salegy": "Wawa",
  "reko band": "Reko, Fy & His Band",
  "fsc mozika": "FSC",
};

// [titre, [artiste principal, ...featurings]]
const CREDITS = [
  ["Tsy Pointure", ["Elidiot"]],
  ["Gasy mashiro", ["Dalvis"]],
  ["Jombilo Voatora", ["Wendy Cathalina", "Fayonne Armada"]],
  ["Miangotro", ["Wendy Cathalina"]],
  ["Voly", ["Wendy Cathalina"]],
  ["Tsy anjarako", ["Black Nadia"]],
  ["Bonjour tout le monde", ["Black Nadia"]],
  ["Iz Sa Za", ["Dalvis"]],
  ["Tsy Ambelako", ["Dadi Love"]],
  ["Fitiavagna", ["Dadi Love"]],
  ["Ameza Facture", ["Dadi Love"]],
  ["Tso-Drano", ["Dadi Love"]],
  ["Ho Anjarako Anao", ["Dadi Love"]],
  ["Ambilà Anaovako Azy", ["Dadi Love"]],
  ["Lelah Manambola", ["Big Mj"]],
  ["I Bilieve", ["Big Mj"]],
  ["Vady tsara", ["Big Mj", "Arnaah"]],
  ["Poposy", ["Big Mj"]],
  ["Ka Mibabababa", ["Nina's"]],
  ["Manahirana", ["Lola"]],
  ["Rahoviana ary", ["Lola"]],
  ["Ny vehivavy", ["Lola"]],
  ["Alay lakana", ["Lola"]],
  ["DJ One Mada - Radio Edit", ["Tence Mena", "Big Mj", "GaEi", "DJ Flex", "Nyti", "Sylka", "Joyce Mena"]],
  ["Tsy Hitambarako", ["Boy Black"]],
  ["Moramora", ["Niu Raza"]],
  ["Ngoma", ["Shyn", "Denise"]],
  ["Fitiavana Mafoaka", ["Shyn"]],
  ["Yray + Yray", ["Shyn"]],
  ["Oxygene", ["Shyn"]],
  ["Distance", ["Ayo Naej", "RJ"]],
  ["Laniko", ["Basta Lion", "GaEi"]],
  ["So Sweet", ["GaEi", "Nash Leong", "Joudas"]],
  ["Talia", ["Hazolahy"]],
  ["Ze Mitsiko RO Mokotry", ["Manaly"]],
  ["Amboara sauce", ["Jerry Marcoss"]],
  ["Malemilemy", ["Jaojoby"]],
  ["400 volts", ["Wawa Salegy"]],
  ["Tsy hiala aminazy", ["Lola"]],
  ["Azafady", ["Lola"]],
  ["Tsy Ambelako Mandeha Seul", ["Elidiot"]],
  ["Velogno", ["Smaven"]],
  ["Aminao fo ty niany", ["Big Mj"]],
  ["Salama", ["Dalvis"]],
  ["Pas touche", ["Big Mj", "Oashna Tess"]],
  ["Fôko tsary niova", ["Jazz Mmc", "Arione Joy"]],
  ["Medley 20ème anniversaire", ["Jerry Marcoss"]],
  ["Lanitra Manga Manga", ["Salala"]],
  ["Ravoravo", ["Mika & Davis"]],
  ["Tantaranao Tantarako", ["D-Lain"]],
  ["Stopeo ny Corona", ["Jerry Marcoss", "Big Mj", "Black Nadia", "Tence Mena", "Ambondrona", "Samoela", "Johane", "Njakatiana", "BODO", "Chantal"]],
  ["Ndao Mba", ["Tovo j'Hay"]],
  ["Veloma", ["Nael"]],
  ["Efa Niova", ["Denise"]],
  ["Hangalaka Ano - Original Mix", ["Shyn", "Quatuor Squad", "Davalt Records"]],
  ["Hiaraka Aminao", ["Denise"]],
  ["Tsara Joro - Intro", ["Denise"]],
  ["All Eyes on Me", ["Denise"]],
  ["Amino", ["Denise"]],
  ["Bio", ["Denise"]],
  ["Azafady - Interlude", ["Denise"]],

  ["MALAHELOISATION", ["Wada & Yoongs", "Cyemci"]],
  ["Azafady", ["Boy Black"]],
  ["Resy", ["Boy Black"]],
  ["FOTSY HELY", ["Sreydan"]],
  ["Oh Marie", ["Big Mj", "Lion Hill"]],
  ["5pm", ["Marco Klarck"]],
  ["Tsy Mahavita", ["WizKing", "Rim-Ka"]],
  ["Bonbon Mamy", ["Rim-Ka"]],
  ["Atsika Roa", ["Rijade", "Rim-Ka"]],
  ["Ankilanao", ["Basta Lion", "Ricia"]],
  ["Avia", ["Ljo"]],
  ["Zanako", ["Denise"]],
  ["Ka Aria", ["Ckycky"]],
  ["Ho Avy", ["Lion Hill"]],
  ["Go Back Home", ["FSC MOZIKA"]],
  ["Toriny", ["Hazolahy"]],
  ["Samby malagasy", ["Mima"]],
  ["Sheila", ["Da T'Kotry"]],
  ["Da T'Kotry", ["Da T'Kotry"]],
  ["Tsy avelako ho nofy", ["Skaiz"]],
  ["Masovanahy", ["Lion Hill"]],
  ["Tamana", ["D-Lain"]],
  ["Misenge - Radio Edit", ["D-Lain"]],
  ["Hafa Mihitsy", ["REKO BAND"]],
  ["Ameza Izy", ["Wendy Cathalina"]],
  ["Paradisako", ["Lion Hill"]],
  ["Ninao", ["Lion Hill", "Ljo"]],
  ["My Body, My Business", ["Niu Raza", "Denise"]],
  ["Navadiko", ["Ceasar", "Rim-Ka"]],
  ["Vente en Ligne", ["Jiorshy"]],
  ["Mimpolìa", ["Marco Klarck"]],
  ["Soa tognotogno", ["Ceasar"]],
  ["Tsika 2 Avao", ["D-Lain"]],
  ["KILOMÈTRES", ["Big Mj", "Ckycky"]],
  ["Mahatamana", ["Ceasar"]],
  ["Tompontanana", ["Tence Mena"]],
  ["After (Tsy Midodo)", ["Big Mj"]],
  ["Witry", ["Lion Hill"]],
  ["Atsika Roa", ["Ngiah Tax Olo Fotsy"]],
  ["Koa Andeha", ["Rim-Ka"]],
  ["Tanteraky", ["Ceasar"]],
  ["Phoneko", ["Big Mj", "Denise"]],
  ["Ampela", ["Shyn"]],
  ["Darling", ["Rootsman"]],
  ["Garcon Gourmand", ["MadaZik", "Wada Yoongs"]],
  ["Na Lingi Yo", ["Rootsman"]],
  ["Ngoma", ["Ljo"]],
  ["Ankatia", ["WizKing"]],
  ["Magnantegna", ["Lion Hill"]],
  ["Zaza Mena", ["Safidy", "Rim-Ka"]],
  ["Féïchitan", ["NIKANOR"]],
  ["Secret", ["Denise", "Shyn"]],
  ["Sikim Pary", ["Ngiah Tax Olo Fotsy", "Nashan"]],
  ["Tebiteby - Acoustic Version", ["Arione Joy"]],
  ["Amore Mio", ["Tence Mena", "GaEi"]],
  ["Hoy aba", ["Tearano"]],
  ["Medley Mamy Gotso", ["Big Mj"]],
  ["Andao Fa Lalana - Radio Edit", ["D-Lain"]],
  ["Gasikara - Radio Edit", ["D-Lain"]],
  ["Joro Atero Amin'i Babany", ["Big Mj"]],
  ["Ka Ampijalia", ["Nina's"]],
  ["Tiko Loatra Ianao - Live", ["Lola", "Denise", "Njakatiana", "Nate Tex", "Do Rajohnson", "MELKY", "Farakely", "Safidy"]],
  ["Tiako tia za", ["Welvi Waves"]],
  ["Mahatsiaro", ["Simonda", "Jerry Marcoss"]],
  ["Samy Malagasy", ["Simonda Valera"]],
  ["Session Mangaliba - Maestro Marcelo Mix", ["Hazolahy", "Maestro Marcelo"]],
  ["Touche pas", ["Rijade", "Goulam"]],
  ["Mahere - Radio Edit", ["D-Lain"]],
  ["Avia (Explicite)", ["Rim-Ka"]],
  ["Mipolia", ["Black Nadia"]],
  ["Izy indrindra", ["Olombelo Ricky", "Balita MARVIN"]],
  ["Resy", ["Rijade", "Ckycky"]],
  ["Mama", ["Denise"]],
  ["Mandramaty", ["Lola", "Stephanie"]],
  ["Tsy Narianao Zaho", ["Parish"]],
  ["Afoiko", ["Parish"]],
  ["Malemilemy", ["Black Nadia", "Skerzo"]],
  ["Resimpitia - English Version", ["Shyn", "Jzigany Beat"]],
  ["Baba", ["Shyn", "Quatuor Squad", "TGC"]],
  ["Sitrany Solo", ["Tence Mena"]],
  ["Werawera", ["Basta Lion"]],
  ["Destiny", ["Ceis"]],
  ["Lost", ["Ceis"]],
  ["Afroblood - Intro", ["Ceis"]],
  ["Mikisaka", ["Cyemci", "Dalvis"]],
  ["Mila Fitiavana", ["Stephanie"]],
  ["Lesambilo", ["Ckycky"]],
  ["Colombian", ["Tribal Kush", "Kybba", "Basta Lion"]],
  ["Tsy Magnahy", ["MOPCAAN"]],
  ["Ambadiky Amaray", ["Madmax"]],
  ["Anao Tômpiny", ["MOPCAAN"]],
  ["Ambilao", ["Tiji Negga"]],
  ["Aza Magnahy", ["Ceasar"]],
  ["COUCOU MA BELLE", ["Says'z"]],
  ["Candidat", ["SANIH"]],
  ["Collé", ["SANIH"]],
  ["Cadeau - Baile Funk Remix - DJ Edit", ["RyckShow", "SANIH"]],
  ["Menimeninao", ["Ckycky"]],
  ["6000 Euro (Explicite)", ["Anatal"]],
  ["Malaso - Voleurs de zébus", ["Erick Manana", "Fenoamby", "Justin Vali", "Régis Gizavo", "Dama"]],
];

const UserSchema = new mongoose.Schema({}, { strict: false, collection: "users" });
const ArtistSchema = new mongoose.Schema({}, { strict: false, collection: "artists" });
const SongSchema = new mongoose.Schema({}, { strict: false, collection: "songs" });

async function main() {
  await mongoose.connect(MONGODB_URI, { autoIndex: false });
  console.log(`Connecté à « ${mongoose.connection.name} »`);
  console.log(DRY_RUN ? "MODE SIMULATION : aucune écriture.\n" : "MODE ÉCRITURE.\n");

  const User = mongoose.model("User", UserSchema);
  const Artist = mongoose.model("Artist", ArtistSchema);
  const Song = mongoose.model("Song", SongSchema);

  // --- 1. Index des titres en base (format actuel uniquement) -------------
  const songs = await Song.find({ title: { $exists: true } }).lean();
  const songsByTitle = new Map();
  for (const s of songs) {
    const k = norm(s.title);
    if (!songsByTitle.has(k)) songsByTitle.set(k, []);
    songsByTitle.get(k).push(s);
  }

  // --- 2. Index des profils artistes vivants ------------------------------
  const artists = await Artist.find({ stageName: { $exists: true } }).lean();
  const artistByName = new Map();
  for (const a of artists) artistByName.set(norm(a.stageName), a);

  const resolveName = (nom) => {
    const k = norm(nom);
    const alias = ALIAS[k];
    return alias ? { key: norm(alias), label: alias, viaAlias: nom } : { key: k, label: nom };
  };

  // --- 3. Quels artistes manquent ? ---------------------------------------
  const requis = new Map(); // key -> label
  for (const [, noms] of CREDITS) {
    for (const nom of noms) {
      const r = resolveName(nom);
      if (!requis.has(r.key)) requis.set(r.key, r.label);
    }
  }
  const manquants = [...requis.entries()].filter(([k]) => !artistByName.has(k));

  console.log(`${songs.length} titres au format actuel · ${artists.length} profils artistes`);
  console.log(`${CREDITS.length} lignes de crédits · ${requis.size} artistes distincts cités`);
  console.log(`\nARTISTES À CRÉER : ${manquants.length}`);
  for (const [, label] of manquants) console.log(`  + ${label} <${slugEmail(label)}>`);

  const aliasUtilises = [...new Set(
    CREDITS.flatMap(([, noms]) => noms).map((n) => norm(n)).filter((k) => ALIAS[k])
  )];
  if (aliasUtilises.length) {
    console.log(`\nNOMS RAPPROCHÉS D'UN PROFIL EXISTANT (à démentir si erroné) : ${aliasUtilises.length}`);
    for (const k of aliasUtilises) console.log(`  ~ « ${k} » → « ${ALIAS[k]} »`);
  }

  if (!DRY_RUN && manquants.length && (!PASSWORD || PASSWORD.length < 8)) {
    console.error("\nARTIST_SEED_PASSWORD requis (8 caractères min.) pour créer les profils manquants.");
    process.exit(1);
  }

  // --- 4. Création des profils manquants ----------------------------------
  const passwordHash = DRY_RUN ? null : await bcrypt.hash(PASSWORD, 12);
  for (const [key, label] of manquants) {
    if (DRY_RUN) {
      artistByName.set(key, { _id: `(simulé:${label})`, stageName: label });
      continue;
    }
    const email = slugEmail(label);
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: label,
        email,
        passwordHash,
        role: "artist",
        emailVerified: true,
        verifiedArtist: true,
        suspended: false,
        badges: [],
        likedSongs: [],
        savedAlbums: [],
        createdAt: new Date(),
      });
    }
    let profil = await Artist.findOne({ user: user._id, stageName: { $exists: true } });
    if (!profil) {
      profil = await Artist.create({
        user: user._id,
        stageName: label,
        genres: [],
        socialLinks: [],
        verified: true,
        followers: [],
        totalPlays: 0,
        monetizationEnabled: true,
        eventPublishingAuthorized: false,
        createdAt: new Date(),
      });
    }
    artistByName.set(key, profil.toObject ? profil.toObject() : profil);
  }

  // --- 5. Résolution titre par titre --------------------------------------
  // Un titre cité deux fois dans la liste (« Azafady » chez Lola et chez Boy
  // Black) ne peut être attribué que si la base tranche déjà : on regarde si
  // le titre y est déjà rattaché à l'un des candidats. Sinon on s'abstient.
  const parTitre = new Map();
  for (const [titre, noms] of CREDITS) {
    const k = norm(titre);
    if (!parTitre.has(k)) parTitre.set(k, []);
    parTitre.get(k).push({ titre, noms });
  }

  const rapport = { misAJour: [], inchanges: [], absents: [], ambigus: [], departages: [] };

  for (const [k, lignes] of parTitre) {
    const candidats = songsByTitle.get(k) || [];

    if (!candidats.length) {
      for (const l of lignes) rapport.absents.push(`${l.titre} — ${l.noms.join(", ")}`);
      continue;
    }

    let ligne = lignes[0];
    if (lignes.length > 1) {
      // Départage par l'attribution déjà en base.
      const actuel = candidats[0].artist ? artists.find((a) => String(a._id) === String(candidats[0].artist)) : null;
      const nomActuel = actuel ? norm(actuel.stageName) : null;
      const gagnante = lignes.find((l) => norm(resolveName(l.noms[0]).label) === nomActuel);
      if (!gagnante) {
        rapport.ambigus.push(
          `« ${lignes[0].titre} » cité ${lignes.length}× (${lignes.map((l) => l.noms[0]).join(" / ")}) ` +
          `— ${candidats.length} titre(s) en base, actuellement chez ${actuel ? actuel.stageName : "?"} : non traité`
        );
        continue;
      }
      ligne = gagnante;
      // L'homonyme écarté correspond à un autre morceau, absent de la base.
      rapport.departages.push(
        `« ${ligne.titre} » : retenu ${ligne.noms[0]} (déjà l'artiste en base) ; ` +
        `écarté ${lignes.filter((l) => l !== gagnante).map((l) => l.noms[0]).join(", ")}`
      );
    }

    if (candidats.length > 1) {
      rapport.ambigus.push(`« ${ligne.titre} » : ${candidats.length} documents portent ce titre — non traité`);
      continue;
    }

    const song = candidats[0];
    const principal = artistByName.get(resolveName(ligne.noms[0]).key);
    const feats = ligne.noms
      .slice(1)
      .map((n) => artistByName.get(resolveName(n).key))
      .filter(Boolean)
      .filter((a) => String(a._id) !== String(principal._id));

    const memeArtiste = String(song.artist) === String(principal._id);
    const featsActuels = (song.featuring || []).map((f) => String(f.artist)).sort().join(",");
    const featsVoulus = feats.map((f) => String(f._id)).sort().join(",");

    if (memeArtiste && featsActuels === featsVoulus) {
      rapport.inchanges.push(`${song.title} — déjà chez ${principal.stageName}`);
      continue;
    }

    const avant = artists.find((a) => String(a._id) === String(song.artist));
    if (!DRY_RUN) {
      await Song.updateOne(
        { _id: song._id },
        {
          $set: {
            artist: principal._id,
            // `confirmed: true` : ces crédits viennent du catalogue officiel,
            // pas d'une demande d'artiste. À false, l'app afficherait
            // « (non confirmé) » sur chaque featuring et placerait une
            // validation en attente sur des comptes que personne n'utilise.
            featuring: feats.map((f) => ({ artist: f._id, confirmed: true })),
            // Le modèle gère `updatedAt` automatiquement ; ce script écrit en
            // schéma libre, on le pose donc à la main.
            updatedAt: new Date(),
          },
        }
      );
    }
    rapport.misAJour.push(
      `${song.title} : ${avant ? avant.stageName : "?"} → ${principal.stageName}` +
      (feats.length ? ` feat. ${feats.map((f) => f.stageName).join(", ")}` : "")
    );
  }

  const section = (t, l) => {
    console.log(`\n${t} : ${l.length}`);
    for (const x of l) console.log(`  · ${x}`);
  };
  console.log(`\n${"=".repeat(76)}`);
  section("TITRES RÉATTRIBUÉS", rapport.misAJour);
  section("DÉJÀ CORRECTS", rapport.inchanges);
  section("HOMONYMES DÉPARTAGÉS PAR LA BASE", rapport.departages);
  section("TITRES DE LA LISTE ABSENTS DE LA BASE", rapport.absents);
  section("CAS DOUTEUX, NON TRAITÉS", rapport.ambigus);

  const traites = new Set(rapport.misAJour.concat(rapport.inchanges).map((x) => x.split(" : ")[0].split(" — ")[0]));
  console.log(`\nTitres de la base non couverts par la liste : ${songs.length - traites.size}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
