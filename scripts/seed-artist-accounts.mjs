// scripts/seed-artist-accounts.mjs
//
// Crée les comptes utilisateurs (role "artist") et les profils Artist
// correspondants pour la liste d'artistes ci-dessous, avec un mot de passe
// commun. Le script est idempotent : relancé, il complète ce qui manque et
// réaligne le mot de passe, sans rien dupliquer.
//
// Un artiste déjà présent en base (profil Artist créé par l'import groupé de
// musiques, donc sans compte) est RATTACHÉ au nouveau compte plutôt que
// dupliqué : ses titres, albums et abonnés pointent sur cet _id.
//
// Usage :
//   node scripts/seed-artist-accounts.mjs --dry-run
//   ARTIST_SEED_PASSWORD='motdepasse' node scripts/seed-artist-accounts.mjs

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// --- Chargement de l'environnement (dotenv n'est pas installé) -------------
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!m) continue;
      const key = m[1];
      const value = m[2].trim().replace(/^["'](.*)["']$/, "$1");
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}
loadEnv();

const DRY_RUN = process.argv.includes("--dry-run");
const MONGODB_URI = process.env.MONGODB_URI;
const PASSWORD = process.env.ARTIST_SEED_PASSWORD;

if (!MONGODB_URI) {
  console.error("MONGODB_URI manquant dans .env.local / .env");
  process.exit(1);
}
if (!DRY_RUN && (!PASSWORD || PASSWORD.length < 8)) {
  console.error("ARTIST_SEED_PASSWORD manquant ou trop court (8 caractères minimum, comme registerSchema).");
  process.exit(1);
}

// Compare deux noms de scène en ignorant casse, accents et ponctuation :
// « Dadah R'Abel » et « dadah rabel » désignent le même artiste.
const norm = (s) =>
  // NFD sépare les accents en marques combinantes (U+0300–U+036F) que l'on
  // retire ici : sinon « Régis » deviendrait « re gis » à l'étape suivante
  // et ne correspondrait plus à « Regis » en base.
  Array.from(String(s || "").normalize("NFD"))
    .filter((ch) => {
      const c = ch.codePointAt(0);
      return c < 0x300 || c > 0x36f;
    })
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Adresse dérivée du nom, pour les entrées listées sans email : accents et
// ponctuation retirés, espaces supprimés. « Naïka » → naika@moziik.app.
const slugEmail = (name) => `${norm(name).replace(/ /g, "")}@moziik.app`;

// Distance d'édition, pour repérer les fautes de frappe : « Lion Hil » est à
// une lettre de « Lion Hill », déjà en base. Le garde-fou anti-doublon compare
// des noms normalisés à l'identique et laisserait passer ce second profil.
function distance(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99; // au-delà, inutile de calculer
  let ligne = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let precedent = ligne[0];
    ligne[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = ligne[j];
      ligne[j] = Math.min(
        ligne[j] + 1,
        ligne[j - 1] + 1,
        precedent + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      precedent = temp;
    }
  }
  return ligne[b.length];
}

/** Les deux genres du répertoire ajouté d'un bloc plus bas. */
const KAIAMBA = ["Kaiamba", "Slow nostalgique"];

/** Ce que l'on sait du label, et qui vaut de chacun de ses artistes. */
const BIO_KAIAMBA =
  "Artiste du label Kaiamba, studio malgache très en vogue à la fin des années 1970, dont les 45 tours ont marqué le hit-parade jusqu'au début des années 1980.";

/**
 * Ce qui range un artiste dans l'univers évangélique.
 *
 * Le genre seul ne suffirait pas : Moziik tient deux univers étanches
 * (lib/univers.ts), et c'est `univers` qui décide de ce qu'un auditeur
 * voit. Un artiste de louange créé sans lui apparaîtrait dans le
 * catalogue général, entre deux titres de club.
 *
 * `universSource: "admin"` protège ce classement : la passe de détection
 * ne le réécrira jamais, quoi que disent les titres publiés ensuite.
 */
const GOSPEL = { genres: ["Gospel"], univers: "christian" };

// --- Liste des artistes ----------------------------------------------------
const ARTISTS = [
  ["Tarika Soley", "tarika-soley@moziik.app"],
  ["Mika & Davis", "mika-davis@moziik.app"],
  ["BOLO", "bolo@moziik.app"],
  ["Tiana", "tiana@moziik.app"],
  ["Mahaleo", "mahaleo@moziik.app"],
  ["Tsimihole", "tsimihole@moziik.app"],
  ["ALPHA BS", "alpha-bs@moziik.app"],
  ["Thammy Mdluli", "thammy-mdluli@moziik.app"],
  ["Salala", "salala@moziik.app"],
  ["Lion Hill", "lion-hill@moziik.app"],
  ["Ny Sakelidalana", "ny-sakelidalana@moziik.app"],
  ["Johary", "johary@moziik.app"],
  ["Niu Raza", "niu-raza@moziik.app"],
  ["Levelo", "levelo@moziik.app"],
  ["Big Mj", "big-mj@moziik.app"],
  ["Poopy", "poopy@moziik.app"],
  ["'Zay", "zay@moziik.app"],
  ["Rija Ramanantoanina", "rija-ramanantoanina@moziik.app"],
  ["Denise", "denise@moziik.app"],
  ["Iraimbilanja", "iraimbilanja@moziik.app"],
  ["Gasy", "gasy@moziik.app"],
  ["Ljo", "ljo@moziik.app"],
  ["Njara Marcel", "njara-marcel@moziik.app"],
  ["Jacquis Randria", "jacquis-randria@moziik.app"],
  ["Dadah R'Abel", "dadah-rabel@moziik.app"],
  ["Imiangaly", "imiangaly@moziik.app"],
  ["Rolf Raza", "rolf-raza@moziik.app"],
  ["Tarika", "tarika@moziik.app"],
  ["Feonala", "feonala@moziik.app"],
  ["H. Ratsimbazafy", "h-ratsimbazafy@moziik.app"],
  ["Nivo", "nivo@moziik.app"],
  ["Pazzapa", "pazzapa@moziik.app"],
  ["Olombelo Ricky", "olombelo-ricky@moziik.app"],
  ["Dina Nirinasoa", "dina-nirinasoa@moziik.app"],
  ["Rak Roots", "rak-roots@moziik.app"],
  ["Kiady", "kiady@moziik.app"],
  ["Bessa", "bessa@moziik.app"],
  ["Dama", "dama@moziik.app"],
  ["D'Gary", "d-gary@moziik.app"],
  ["Samoela", "samoela@moziik.app"],
  ["Tsiliva", "tsiliva@moziik.app"],
  ["Mage 4", "mage-4@moziik.app"],
  ["Tselonina", "tselonina@moziik.app"],
  ["Joelle Claude", "joelle-claude@moziik.app"],
  ["Rajery", "rajery@moziik.app"],
  ["Shyn", "shyn@moziik.app"],
  ["Dadi Love", "dadi-love@moziik.app"],
  ["Lola", "lola@moziik.app"],
  ["Kristel", "kristel@moziik.app"],
  ["Ny Voninavoko", "ny-voninavoko@moziik.app"],
  ["Fanja Andriamanantena", "fanja-andriamanantena@moziik.app"],
  ["Ambondrona", "ambondrona@moziik.app"],
  ["Tovo j'Hay", "tovo-jhay@moziik.app"],
  ["Nate Tex", "nate-tex@moziik.app"],
  ["Rossy", "rossy@moziik.app"],
  ["Farakely", "farakely@moziik.app"],
  ["Ninie Doniah", "ninie-doniah@moziik.app"],
  ["Railola", "railola@moziik.app"],
  ["Marion", "marion@moziik.app"],
  ["VHF", "vhf@moziik.app"],
  ["Dedesse", "dedesse@moziik.app"],
  ["Princio", "princio@moziik.app"],
  ["D-Lain", "d-lain@moziik.app"],
  ["Mr Sayda", "mr-sayda@moziik.app"],
  ["Bagzana", "bagzana@moziik.app"],
  ["Reko, Fy & His Band", "reko-fy-his-band@moziik.app"],
  ["Aina Quach", "aina-quach@moziik.app"],
  ["Safidy", "safidy@moziik.app"],
  ["Njakatiana", "njakatiana@moziik.app"],
  ["Do Rajohnson", "do-rajohnson@moziik.app"],
  ["MELKY", "melky@moziik.app"],
  ["Lilie Soa", "lilie-soa@moziik.app"],
  ["Rakotomanga Noelisoa", "rakotomanga-noelisoa@moziik.app"],
  ["Ejema", "ejema@moziik.app"],
  ["Ramandaniarivo Marion", "ramandaniarivo-marion@moziik.app"],
  ["Balita MARVIN", "balita-marvin@moziik.app"],
  ["Bodo", "bodo@moziik.app"],
  ["Jaojoby", "jaojoby@moziik.app"],
  ["Erick Manana", "erick-manana@moziik.app"],
  ["Justin Vali", "justin-vali@moziik.app"],
  ["Régis Gizavo", "regis-gizavo@moziik.app"],
  ["Fenoamby", "fenoamby@moziik.app"],
  ["Bekoto", "bekoto@moziik.app"],
  ["Rakoto Frah", "rakoto-frah@moziik.app"],
  ["Sylvestre Randafison", "sylvestre-randafison@moziik.app"],
  ["Ratovonirina Ranaivovololona", "ratovonirina-ranaivovololona@moziik.app"],
  ["Randrianantoanina Doné", "randrianantoanina-done@moziik.app"],
  ["Vaiavy Chila", "vaiavy-chila@moziik.app"],
  ["Hazolahy", "hazolahy@moziik.app"],
  ["Jihé", "jihe@moziik.app"],
  ["Oladad", "oladad@moziik.app"],
  ["Jerry Marcoss", "jerry-marcoss@moziik.app"],
  ["Senge", "senge@moziik.app"],
  ["Mikéa", "mikea@moziik.app"],
  ["Vaovy", "vaovy@moziik.app"],
  ["Ny Malagasy Orkestra", "ny-malagasy-orkestra@moziik.app"],
  ["Jérôme Randria", "jerome-randria@moziik.app"],
  ["Justin Rajoro", "justin-rajoro@moziik.app"],
  ["Romy", "romy@moziik.app"],
  ["Rambao", "rambao@moziik.app"],
  ["Lalao Fabeson", "lalao-fabeson@moziik.app"],
  ["Ramaroson Wilson", "ramaroson-wilson@moziik.app"],
  ["Solika", "solika@moziik.app"],
  ["Christine Salem", "christine-salem@moziik.app"],
  ["The Dizzy Brains", "the-dizzy-brains@moziik.app"],
  // Répertoire évangélique — voir le bloc GOSPEL plus bas. L'entrée est
  // ici parce qu'elle y était déjà : la dupliquer plus bas ne créerait
  // rien, le garde-fou des homonymes la rejetterait.
  ["Rija Rasolondraibe", "rija-rasolondraibe@moziik.app", GOSPEL],
  ["Wawa", "wawa@moziik.app"],
  ["The Surfs", "the-surfs@moziik.app"],

  // --- Second lot ----------------------------------------------------------
  // Convention d'adresse différente du premier lot (sans tiret). Treize noms
  // s'y répètent : le garde-fou anti-doublon de main() les laisse au compte
  // déjà créé plutôt que d'en ouvrir un second.
  ["Simonda", "simonda@moziik.app"],
  ["Jerry Marcoss", "jerrymarcoss@moziik.app"],
  ["Simonda Valera", "simondavalera@moziik.app"],
  ["Hazolahy", "hazolahy@moziik.app"],
  ["Maestro Marcelo", "maestromarcelo@moziik.app"],
  ["Rijade", "rijade@moziik.app"],
  ["Goulam", "goulam@moziik.app"],
  ["D-Lain", "dlain@moziik.app"],
  ["Rim-Ka", "rimka@moziik.app"],
  ["Black Nadia", "blacknadia@moziik.app"],
  ["Olombelo Ricky", "olombeloricky@moziik.app"],
  ["Balita MARVIN", "balitamarvin@moziik.app"],
  ["Ckycky", "ckycky@moziik.app"],
  ["Denise", "denise@moziik.app"],
  ["Lola", "lola@moziik.app"],
  ["Stephanie", "stephanie@moziik.app"],
  ["Parish", "parish@moziik.app"],
  ["Skerzo", "skerzo@moziik.app"],
  ["Shyn", "shyn@moziik.app"],
  ["Jzigany Beat", "jziganybeat@moziik.app"],
  ["Quatuor Squad", "quatuorsquad@moziik.app"],
  ["TGC", "tgc@moziik.app"],
  ["Tence Mena", "tencemena@moziik.app"],
  ["Basta Lion", "bastalion@moziik.app"],
  ["Ceis", "ceis@moziik.app"],
  ["Cyemci", "cyemci@moziik.app"],
  ["Dalvis", "dalvis@moziik.app"],
  ["Tribal Kush", "tribalkush@moziik.app"],
  ["Kybba", "kybba@moziik.app"],
  ["MOPCAAN", "mopcaan@moziik.app"],
  ["Madmax", "madmax@moziik.app"],
  ["Tiji Negga", "tijinegga@moziik.app"],
  ["Ceasar", "ceasar@moziik.app"],
  ["Says'z", "saysz@moziik.app"],
  ["SANIH", "sanih@moziik.app"],
  ["RyckShow", "ryckshow@moziik.app"],
  ["Anatal", "anatal@moziik.app"],
  ["Erick Manana", "erickmanana@moziik.app"],
  ["Fenoamby", "fenoamby@moziik.app"],
  ["Justin Vali", "justinvali@moziik.app"],
  ["Régis Gizavo", "regisgizavo@moziik.app"],
  ["Dama", "dama@moziik.app"],

  // --- Troisième lot -------------------------------------------------------
  // Figures du répertoire malagasy absentes des deux premiers lots, réunies
  // de mémoire et non recoupées avec un registre officiel : les orthographes
  // sont à valider avant toute communication publique.
  ["Tarika Sammy", "tarikasammy@moziik.app"],
  ["Njava", "njava@moziik.app"],
  ["Monika Njava", "monikanjava@moziik.app"],
  ["Toko Telo", "tokotelo@moziik.app"],
  ["Kilema", "kilema@moziik.app"],
  ["Tao Ravao", "taoravao@moziik.app"],
  ["Solorazaf", "solorazaf@moziik.app"],
  ["Nicolas Vatomanga", "nicolasvatomanga@moziik.app"],
  ["Rakotozafy", "rakotozafy@moziik.app"],
  ["Ny Antsaly", "nyantsaly@moziik.app"],
  ["Damily", "damily@moziik.app"],
  ["Teta", "teta@moziik.app"],
  ["Voahangy", "voahangy@moziik.app"],
  ["Mily Clément", "milyclement@moziik.app"],
  ["Toto Mwandjani", "totomwandjani@moziik.app"],
  ["Lolo sy ny Tariny", "lolosynytariny@moziik.app"],
  ["Lianah", "lianah@moziik.app"],
  ["AGRAD", "agrad@moziik.app"],
  ["Skaiz", "skaiz@moziik.app"],
  ["Arione Joy", "arionejoy@moziik.app"],
  ["Da Hopp", "dahopp@moziik.app"],
  ["Rootsman", "rootsman@moziik.app"],

  // --- Quatrième lot -------------------------------------------------------
  // Entrées sans adresse : elle est dérivée du nom (voir slugEmail), sur la
  // convention sans tiret des lots 2 et 3.
  //
  // 4a. Répertoire relevé sur Wikipédia (« List of Malagasy musicians »,
  // « Music of Madagascar », « Musique malgache ») et dans la presse
  // malgache — Newsmada, Midi Madagasikara, Moov.mg, allAfrica, Music In
  // Africa — consultés le 2026-08-25.
  "Lego",
  "Naïka",
  "Rabaza",
  "Naka Rabemanantsoa",
  "Andrianary Ratianarivo",
  "Mama Sana",
  "Madagascar Slim",
  "Tearano",
  "Terakaly",
  "Solo Miral",
  "Jarifa",
  "Mamy Gotso",
  "Green",
  "18.3",
  "Sasamaso",
  "iCanto",
  "Feo-Gasy",
  "Vilon'androy",
  "Ernest Randrianasolo",
  "Remanindry",
  "Rary",
  "The Players",
  "Ramilison Besigara",
  "Raymond Razafimbahiny",
  "Mathis Picard",
  "Lalatiana",
  "Mamy Ralaivita",
  "Zanak'i Papa Blues Band",
  "Zanak'i Dada",
  "Oro",
  "Ayam",
  "Kemyrah",
  "3MA",
  "Dr JB and the Jaguars",
  "Troupe Analamanga",
  "Madame Razafindriantsoa",
  "Anisha",
  "Marghe",
  "Dina Mialinelina",
  "Soa Ravelo",
  "Jhonnito",
  "Silo",
  "Mija Kamisy",
  "Doc Holliday",
  "Tselatra",
  "Kiaka",
  "Mireille",
  "Ifanihy",
  "Fab",
  "Karnaz",
  "Diosezy",
  "Bogata",
  "Shao Boana",
  "Raboussa",
  "Name Six",
  "Big Jimda",
  "Don Smokilla",
  "Tsota",
  "Odyai",
  "Gasy Ploit",
  "Claudio Rabé",

  // 4b. Noms présents dans vos propres données à l'ancien format, encore
  // sans compte. Ils ont de vrais titres au catalogue : aucun risque
  // d'invention, contrairement au groupe précédent.
  "Nael",
  "Willy",
  "Geoscar",
  "JAJA",
  "RASH",
  "RALMO",
  "4ty Squad",
  "REQUIN NOIR",
  "Raouto",
  "Lowis",
  "MALM",
  "Tinahime",
  "ZAKAI",
  "KIMIL",
  "Tanjona Randrianarivelo",
  "Jean Freddy",
  "ZEZEX",
  "KAMARY",
  "MENDRIKA",
  // Déjà présent avant l'ajout du répertoire Kaiamba, sous cette
  // graphie : c'est elle qui fait foi, une seconde entrée « Dédé
  // Fénérive » scinderait sa discographie en deux profils.
  ["Dédé Fenerive", "dedefenerive@moziik.app", { genres: KAIAMBA, bio: BIO_KAIAMBA }],
  "Annicette",
  "FANASINA",
  "THT",
  "Louckim",
  "ORTEGAH",
  "Melo",
  "MAMINA",
  "Rao Lossa",
  "Jack'Dad",
  "Nohasy",
  "Dom Rasolo",
  "FSC",
  "JAMAL",
  "SANDHY",
  "Wendy Cathalina",
  "BEL-Z",
  "KAIAMBA",
  "Aton'ich Miuzik",
  "SAKATE BOY",

  // --- Cinquième lot -------------------------------------------------------
  // Liste de contrôle : l'essentiel y figure déjà, seuls les absents seront
  // créés. « Lion Hil » y est écrit avec un seul L et sera écarté par la
  // détection de faute de frappe, au profit de « Lion Hill » déjà en base.
  "Ljo",
  "Dalvis",
  "Boy Black",
  "Lion Hil",
  "Chriso",
  "Smaven",
  "Arnaah",
  "Tence Mena",
  "Maestro Marcelo",
  "Black Nadia",
  "Elidiot",
  "Niu Raza",
  "Ayo Naej",
  "RJ",
  "Big Mj",
  "Denise",
  "Teints Record Officiel",
  "Basta Lion",
  "Cyemci",
  "Mahaleo",
  "Ceasar",
  "Dadi Love",
  "Rak Roots",

  // --- Répertoire Kaiamba et slow nostalgique -----------------------------
  //
  // Kaiamba est un studio et un label malgaches, très en vogue à la fin des
  // années 1970, dont les 45 tours ont tenu le haut du hit-parade jusqu'au
  // début des années 1980. La biographie ci-dessous ne dit que cela : elle
  // est vraie de chaque nom de cette liste, et n'invente ni parcours, ni
  // date, ni discographie propres à l'un d'eux.
  ...[
    "Zozo Sy Dorlys",
    "Oza Jérôme",
    "Raymond Ernest",
    "Dolly Rica",
    "Bruno Resner",
    "Prosh Ely",
    "Justin Pierre",
    "Les Rogers",
    "Les Typhons",
  ].map((nom) => [
    nom,
    `${norm(nom).replace(/ /g, "-")}@moziik.app`,
    {
      genres: KAIAMBA,
      bio: BIO_KAIAMBA,
    },
  ]),

  [
    "Charles Maurin Poty",
    "charles-maurin-poty@moziik.app",
    {
      genres: KAIAMBA,
      bio: "Producteur et compositeur malgache, fondateur du label Kaiamba, sur lequel il a enregistré nombre d'artistes de la côte à partir des années 1970.",
    },
  ],

  // Demandé sous la graphie « Jean Kely Sy Bath », mais la base porte
  // déjà « Jean-Kely sy Basth » : à une lettre près, et c'est bien la
  // même personne. Créer la seconde graphie couperait son catalogue en
  // deux. Pas de biographie du label ici — il ne figure sur aucune des
  // listes d'artistes Kaiamba consultées.
  ["Jean-Kely sy Basth", "jeankelysybasth@moziik.app", { genres: KAIAMBA }],

  // --- Répertoire évangélique ---------------------------------------------
  //
  // Deux sources, et rien d'autre :
  //
  //  1. Les pochettes déjà présentes dans la base. Tana Gospel Choir,
  //     Jaws Band, Njara Marcel et Henika signent des titres versés au
  //     compte d'un autre — c'est ce que `scripts/attribuer-titres.mjs`
  //     répare, et ces comptes-là doivent exister pour qu'il le puisse.
  //  2. Le panorama du gospel malgache de Music In Africa
  //     (musicinafrica.net/node/14623). Rija Rasolondraibe, lui, est déjà
  //     plus haut dans la liste : il y reçoit le même classement, sourcé
  //     par MCTV et GasiGasy.
  //
  // Aucune biographie n'est écrite ici : ce qu'on sait de chacun tient en
  // une ligne déjà dite par le genre et l'univers. En inventer une
  // reviendrait à prêter un parcours à des gens réels.
  //
  // Cette liste n'a rien d'exhaustif, et ne prétend pas l'être : elle ne
  // contient que des noms sourcés.
  ...[
    // Présents dans le catalogue, par leurs pochettes.
    //
    // Njara Marcel n'y est pas, et D-Lain non plus : ils publient déjà des
    // titres profanes sur Moziik. Les basculer dans l'univers évangélique
    // en sortirait toute leur discographie. Leur seul titre de louange est
    // traité pour lui-même par scripts/attribuer-titres.mjs — c'est le cas
    // que `universSource: "admin"` existe pour couvrir.
    "Tana Gospel Choir",
    "Jaws Band",
    "Henika",
    // Cités par Music In Africa.
    "God's Messengers Mass Choir",
    "Singers of Jesus",
    "AAMA Gospel",
    "Meva Gospel",
    "Malagasy Gospel",
    "AMAM",
    "Deenyz",
    "FJKM Andrainarivo Fahasoavana",
    "FJKM Ambohitantely",
  ].map((nom) => [nom, slugEmail(nom), GOSPEL]),

  // Le nom sous lequel les enregistrements du recueil complémentaire de
  // la FJKM sont distribués — Amazon, Spotify, Deezer et Last.fm le
  // créditent tous ainsi. C'est l'interprète des neuf titres de la série
  // « Avy ny maraina » que le catalogue portait au compte d'un autre.
  [
    "Fihirana Fanampiny",
    slugEmail("Fihirana Fanampiny"),
    {
      ...GOSPEL,
      bio: "Enregistrements du Fihirana Fanampiny, recueil de cantiques complémentaire de l'Église FJKM, publiés à partir de 2002 dans la série « Avy ny maraina ».",
    },
  ],
].map((entry) => {
  // Trois formes acceptées : « nom », [nom, email], [nom, email, options].
  // Les options portent les genres et une courte biographie — utiles pour
  // un répertoire entier qu'on ajoute d'un bloc, inutiles ailleurs.
  const [name, email, options] = Array.isArray(entry) ? entry : [entry, slugEmail(entry)];
  return {
    name,
    email: (email || slugEmail(name)).toLowerCase(),
    genres: options?.genres ?? [],
    bio: options?.bio ?? "",
    univers: options?.univers ?? null,
  };
});

/** Les genres employés par la liste, à garantir dans les réglages du site. */
const GENRES_REQUIS = [...new Set(ARTISTS.flatMap((a) => a.genres))];

/** Ce qui s'affichera en administration en face du classement. */
const MOTIF_UNIVERS = "Répertoire évangélique, posé à la création du compte.";

/**
 * Ce qu'il reste à écrire sur un profil qui existe déjà.
 *
 * Genres et biographie ne sont posés que s'ils manquent : un profil
 * renseigné par un humain a raison contre une liste. L'univers, lui, se
 * pose même sur un profil rempli — ce n'est pas une préférence de
 * présentation mais un classement, et il n'y a rien à écraser tant qu'un
 * admin ne l'a pas déjà tranché.
 */
function completer(profil, { genres, bio, univers }) {
  const complements = {};
  if (genres.length && (profil.genres ?? []).length === 0) complements.genres = genres;
  if (bio && !profil.bio) complements.bio = bio;
  if (univers && profil.universSource !== "admin") {
    complements.univers = univers;
    complements.universSource = "admin";
    complements.universMotif = MOTIF_UNIVERS;
  }
  return complements;
}

// --- Schémas (inline : un .mjs ne peut pas importer les modèles TS) --------
// Fidèles à models/User.ts et models/Artist.ts.
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  passwordHash: String,
  googleId: String,
  avatarUrl: String,
  role: { type: String, enum: ["member", "artist", "admin"], default: "member" },
  verifiedArtist: { type: Boolean, default: false },
  suspended: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  verificationToken: String,
  verificationTokenExpires: Date,
  badges: { type: [String], default: [] },
  likedSongs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Song" }],
  savedAlbums: [{ type: mongoose.Schema.Types.ObjectId, ref: "Album" }],
  resetToken: String,
  resetTokenExpires: Date,
  createdAt: { type: Date, default: Date.now },
});

const ArtistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  stageName: { type: String, required: true },
  bio: String,
  coverUrl: String,
  bannerUrl: String,
  genres: { type: [String], default: [] },
  socialLinks: [{ platform: String, url: String }],
  verified: { type: Boolean, default: false },
  // Fidèle à models/Artist.ts : sans ces champs, mongoose écarterait
  // silencieusement l'univers et l'artiste naîtrait dans le général.
  univers: { type: String, enum: ["general", "christian"], default: "general" },
  universSource: { type: String, enum: ["auto", "admin"], default: "auto" },
  universMotif: String,
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  totalPlays: { type: Number, default: 0 },
  monetizationEnabled: { type: Boolean, default: true },
  eventPublishingAuthorized: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const SongSchema = new mongoose.Schema({ artist: mongoose.Schema.Types.ObjectId }, { strict: false });

async function main() {
  // autoIndex désactivé : ce script ne doit pas déclencher de construction
  // d'index sur une base de production.
  await mongoose.connect(MONGODB_URI, { autoIndex: false });
  console.log(`Connecté à MongoDB — base « ${mongoose.connection.name} »`);
  console.log(DRY_RUN ? "MODE SIMULATION : aucune écriture.\n" : "MODE ÉCRITURE.\n");

  const User = mongoose.model("User", UserSchema);
  const Artist = mongoose.model("Artist", ArtistSchema);
  const Song = mongoose.model("Song", SongSchema);

  // Les genres employés par la liste doivent exister dans les réglages du
  // site : sans eux, un titre publié ne pourrait pas être rangé dans
  // « Kaiamba », et la liste déroulante du formulaire ne les proposerait
  // pas. On complète, on ne remplace pas — l'ordre choisi en
  // administration est le sien.
  if (GENRES_REQUIS.length > 0) {
    const SiteConfig = mongoose.connection.collection("siteconfigs");
    const config = await SiteConfig.findOne({});
    const existants = config?.genres ?? [];
    const manquants = GENRES_REQUIS.filter(
      (g) => !existants.some((e) => norm(e) === norm(g))
    );

    if (manquants.length === 0) {
      console.log(`Genres déjà présents : ${GENRES_REQUIS.join(", ")}.`);
    } else if (DRY_RUN) {
      console.log(`Genres à ajouter aux réglages : ${manquants.join(", ")}.`);
    } else if (config) {
      // Insérés avant « Autre », qui doit rester le dernier choix.
      const sansAutre = existants.filter((g) => norm(g) !== "autre");
      const autre = existants.filter((g) => norm(g) === "autre");
      await SiteConfig.updateOne(
        { _id: config._id },
        { $set: { genres: [...sansAutre, ...manquants, ...autre] } }
      );
      console.log(`Genres ajoutés aux réglages : ${manquants.join(", ")}.`);
    } else {
      console.warn("Aucun réglage de site en base : genres non ajoutés.");
    }
  }

  const [userCount, artistCount, songCount] = await Promise.all([
    User.countDocuments(),
    Artist.countDocuments(),
    Song.countDocuments(),
  ]);
  console.log(`État actuel : ${userCount} utilisateurs, ${artistCount} profils artistes, ${songCount} titres.`);

  // Index des artistes existants par nom de scène normalisé. Il est tenu à
  // jour au fil du lot pour qu'un nom créé au début barre la route à son
  // homonyme listé plus bas.
  const byName = new Map();
  const registerName = (stageName, entry) => {
    const key = norm(stageName);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(entry);
  };
  // `genres` et `bio` sont chargés parce que le rattachement d'un profil
  // existant ne doit compléter que ce qui manque : sans eux, la garde
  // « on n'écrase pas » comparerait toujours à `undefined` et écraserait
  // systématiquement ce qu'un humain a écrit.
  for (const a of await Artist.find().select("_id user stageName genres bio").lean()) {
    registerName(a.stageName, a);
  }

  // Nombre de titres par artiste, pour mesurer ce qu'un rattachement récupère.
  const songsByArtist = new Map();
  for (const row of await Song.aggregate([{ $group: { _id: "$artist", n: { $sum: 1 } } }])) {
    songsByArtist.set(String(row._id), row.n);
  }

  const passwordHash = DRY_RUN ? null : await bcrypt.hash(PASSWORD, 12);

  const report = {
    userCreated: [],
    userUpdated: [],
    userUnchanged: [],
    artistCreated: [],
    artistLinked: [],
    artistKept: [],
    artistCompleted: [],
    duplicates: [],
    nearMisses: [],
    conflicts: [],
  };

  const seenEmails = new Set();

  for (const { name, email, genres, bio, univers } of ARTISTS) {
    // Même adresse deux fois dans la liste : la seconde n'apporte rien.
    if (seenEmails.has(email)) {
      report.duplicates.push(`${name} <${email}> : adresse déjà traitée plus haut dans la liste`);
      continue;
    }
    seenEmails.add(email);

    let user = await User.findOne({ email });

    // Garde-fou anti-doublon, AVANT toute création : un même artiste listé
    // deux fois sous deux adresses (« jerry-marcoss@ » puis « jerrymarcoss@ »)
    // se retrouverait sinon avec deux comptes et deux profils publics. On
    // conserve le compte déjà en place et on ignore l'entrée. Ce contrôle ne
    // vaut que pour une nouvelle adresse : si le compte existe déjà, c'est
    // lui-même le porteur du nom.
    if (!user) {
      let heldBy = null;
      for (const homonyme of byName.get(norm(name)) || []) {
        // Profil créé plus tôt dans ce même lot : le propriétaire est connu
        // sans requête (et son _id n'existe pas encore en simulation).
        if (homonyme.ownerEmail) {
          heldBy = homonyme.ownerEmail;
          break;
        }
        if (!homonyme.user) continue; // profil orphelin : récupérable, voir plus bas
        const owner = await User.findById(homonyme.user).select("email");
        if (owner) {
          heldBy = owner.email;
          break;
        }
      }
      if (heldBy) {
        report.duplicates.push(`${name} <${email}> : nom déjà porté par le compte ${heldBy}`);
        continue;
      }

      // Faute de frappe probable : on ne crée rien et on laisse arbitrer.
      // Créer « Lion Hil » à côté de « Lion Hill » scinderait le catalogue
      // d'un même artiste entre deux profils.
      const cible = norm(name);
      const proche = [...byName.keys()].find((k) => k && distance(cible, k) === 1);
      if (proche) {
        const officiel = byName.get(proche)[0];
        report.nearMisses.push(
          `${name} <${email}> : à une lettre de « ${officiel.stageName || proche} », déjà en base — non créé`
        );
        continue;
      }
    }

    // 1) Le compte utilisateur.
    if (!user) {
      report.userCreated.push(`${name} <${email}>`);
      if (DRY_RUN) {
        user = { _id: null, name };
      } else {
        user = await User.create({
          name,
          email,
          passwordHash,
          role: "artist",
          // Ces adresses ne relèvent aucun courrier : sans cette ligne,
          // lib/auth.ts refuserait la connexion (EMAIL_NOT_VERIFIED).
          emailVerified: true,
          verifiedArtist: true,
          suspended: false,
        });
      }
    } else {
      const changes = [];
      if (user.name !== name) changes.push(`nom « ${user.name} »→« ${name} »`);
      if (user.role !== "artist") changes.push(`role ${user.role}→artist`);
      if (!user.emailVerified) changes.push("emailVerified→true");
      if (user.suspended) changes.push("suspended→false");
      if (!user.verifiedArtist) changes.push("verifiedArtist→true");
      // Ne réécrire le hash que si le mot de passe diffère : re-hacher à
      // l'identique à chaque exécution serait une écriture pour rien.
      // En simulation sans mot de passe fourni, on ne prétend pas savoir
      // s'il faudra le changer.
      const passwordOk = !PASSWORD || (user.passwordHash && (await bcrypt.compare(PASSWORD, user.passwordHash)));
      if (!passwordOk) changes.push("mot de passe réaligné");

      if (!changes.length) {
        report.userUnchanged.push(`${name} <${email}>`);
      } else {
        if (!DRY_RUN) {
          user.name = name;
          user.role = "artist";
          user.emailVerified = true;
          user.verifiedArtist = true;
          user.suspended = false;
          if (!passwordOk) user.passwordHash = passwordHash;
          await user.save();
        }
        report.userUpdated.push(`${name} <${email}> (${changes.join(", ")})`);
      }
    }

    // 2) Le profil artiste.
    const linked = user._id ? await Artist.findOne({ user: user._id }) : null;
    if (linked) {
      // Un profil déjà rattaché n'est pas pour autant complet : les
      // genres et l'univers arrivent parfois après lui, comme ici où un
      // répertoire entier est déclaré sur des comptes créés il y a des
      // mois. Sans ce complément, une entrée qui existe déjà ne recevrait
      // jamais son classement, et l'artiste resterait invisible dans son
      // univers — le symptôme est silencieux, ce qui le rend pénible.
      const complements = completer(linked, { genres, bio, univers });
      if (Object.keys(complements).length === 0) {
        report.artistKept.push(`${name} → ${linked._id}`);
      } else {
        if (!DRY_RUN) await Artist.updateOne({ _id: linked._id }, { $set: complements });
        report.artistCompleted.push(`${name} → ${linked._id} (${Object.keys(complements).join(", ")})`);
      }
      continue;
    }

    // Un profil homonyme existe-t-il déjà (créé par l'import de musiques) ?
    const candidates = byName.get(norm(name)) || [];
    // On ne récupère qu'un profil orphelin : sans `user`, ou dont le `user`
    // n'existe plus. Rattacher un profil appartenant à un compte vivant
    // reviendrait à lui voler son contenu.
    const orphans = [];
    for (const c of candidates) {
      if (!c.user) {
        orphans.push(c);
        continue;
      }
      const owner = await User.exists({ _id: c.user });
      if (!owner) orphans.push(c);
    }

    if (orphans.length > 1) {
      report.conflicts.push(
        `${name} : ${orphans.length} profils homonymes orphelins (${orphans.map((o) => o._id).join(", ")}) — non traité`
      );
      continue;
    }

    if (orphans.length === 1) {
      const orphan = orphans[0];
      const n = songsByArtist.get(String(orphan._id)) || 0;
      if (!DRY_RUN) {
        await Artist.updateOne(
          { _id: orphan._id },
          { $set: { user: user._id, stageName: name, ...completer(orphan, { genres, bio, univers }) } }
        );
      }
      report.artistLinked.push(`${name} → ${orphan._id} (${n} titre${n > 1 ? "s" : ""})`);
      continue;
    }

    if (candidates.length) {
      report.conflicts.push(
        `${name} : profil homonyme déjà rattaché à un autre compte (${candidates.map((c) => c._id).join(", ")}) — non traité`
      );
      continue;
    }

    if (DRY_RUN) {
      report.artistCreated.push(`${name} (nouveau profil)`);
      // Inscrit le nom dans l'index même en simulation, sinon deux entrées
      // homonymes du même lot passeraient toutes les deux le garde-fou.
      registerName(name, { _id: null, user: user._id, ownerEmail: email });
    } else {
      const created = await Artist.create({
        user: user._id,
        stageName: name,
        verified: true,
        ...(genres.length ? { genres } : {}),
        ...(bio ? { bio } : {}),
        ...(univers ? { univers, universSource: "admin", universMotif: MOTIF_UNIVERS } : {}),
      });
      report.artistCreated.push(`${name} → ${created._id}`);
      registerName(name, { _id: created._id, user: user._id, ownerEmail: email });
    }
  }

  // --- Rapport -------------------------------------------------------------
  const section = (titre, lignes) => {
    console.log(`\n${titre} : ${lignes.length}`);
    for (const l of lignes) console.log(`  · ${l}`);
  };

  console.log(`\n${"=".repeat(70)}`);
  section("Comptes créés", report.userCreated);
  section("Comptes déjà présents, mis à jour", report.userUpdated);
  section("Comptes déjà conformes, rien à faire", report.userUnchanged);
  section("Doublons ignorés (aucun compte créé)", report.duplicates);
  section("Fautes de frappe probables, à arbitrer", report.nearMisses);
  section("Profils artistes existants rattachés (contenu conservé)", report.artistLinked);
  section("Profils artistes créés", report.artistCreated);
  section("Profils artistes déjà liés, complétés", report.artistCompleted);
  section("Profils artistes déjà liés, inchangés", report.artistKept);
  section("Conflits à arbitrer à la main", report.conflicts);
  const evangeliques = ARTISTS.filter((a) => a.univers === "christian").length;
  console.log(
    `\nTotal traité : ${ARTISTS.length} artistes, dont ${evangeliques} dans l'univers évangélique.`
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
