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

// Variantes désignant un artiste déjà inscrit sous une autre graphie. Sans
// cette table, « Vali Justin » ouvrirait un second profil à côté de « Justin
// Vali » et scinderait son catalogue. La détection de faute de frappe ne
// couvre que l'écart d'une lettre ; ces cas-là en sont trop loin.
const VARIANTES = {
  "les surfs": "The Surfs",
  "mika sy davis": "Mika & Davis",
  "vali justin": "Justin Vali",
  "randafison sylvestre": "Sylvestre Randafison",
  "radafison": "Sylvestre Randafison",
  "henri ratsimbazafy": "H. Ratsimbazafy",
  "jaojoby eusebe": "Jaojoby",
  "datkotry": "Da T'Kotry",
  "bessa et lola": "Bessa sy Lola",
  "tarika tarika sammy": "Tarika Sammy",
  "samy tarika sammy": "Tarika Sammy",
  "olombelo ricky ricky randimbiarison": "Olombelo Ricky",
  // Annoté « chanteur solo » dans le répertoire : c'est bien 'Zay, déjà inscrit.
  "tarika zay": "'Zay",
};

// Noms à une lettre d'un artiste déjà inscrit, mais bel et bien distincts :
// Ossy est un chanteur de variété des années 50-70, sans rapport avec Rossy ;
// Bary est un artiste des années 90, sans rapport avec Rary. Sans cette liste,
// la détection de faute de frappe les écarterait à tort.
const PROCHES_MAIS_DISTINCTS = new Set(["ossy", "bary"]);

// « Dox (Jean-Verdi Salomon Razakandrainy) » → « Dox » : on garde le nom de
// scène, la parenthèse n'étant qu'une précision d'état civil ou de groupe.
const sansParenthese = (nom) => nom.replace(/\s*\([^)]*\)\s*$/, "").trim();

const canonique = (nom) => {
  const nu = sansParenthese(nom);
  return VARIANTES[norm(nom)] || VARIANTES[norm(nu)] || nu;
};

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
  ["Rija Rasolondraibe", "rija-rasolondraibe@moziik.app"],
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
  "Dédé Fenerive",
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

  // --- Sixième lot ---------------------------------------------------------
  // Répertoire par périodes, 1950 à aujourd'hui. Beaucoup de noms s'y répètent
  // d'une période à l'autre et beaucoup sont déjà inscrits : les garde-fous
  // (adresse vue, nom déjà porté, faute de frappe, variante connue) trient.
  "Albert Razafimbahiny", "Andrianary Ratianarivo", "Barijaona", "Charles Ravaloson",
  "Dédé Fenerive", "Emilson", "Gaby Ratsito", "Jean-Fredy", "Justin Rajoro",
  "Ludger Andrianjaka", "Naly Rakotofiringa", "Ny Antsaly", "Ny Railovy", "Ossy",
  "Paul Bert", "Radafison", "Raimond Ranjeva", "Ramilison Besigara",
  "Randafison Sylvestre", "Rasamy-Gitara", "Ratsimiseta", "Samuel Ratany",
  "Theresa", "Troupe Jeanette",

  "Dox (Jean-Verdi Salomon Razakandrainy)", "Fredy Ranarison", "Henri Ratsimbazafy",
  "Hubert", "Jerôme Randria", "Kintana Telo", "Les Chacha Boys", "Les Corsaires",
  "Les Fantômes", "Les Flamants", "Les Jeunes", "Les Shakers", "Les Surfs",
  "Les Vagabonds", "Ny Nanahary", "Rahoerson", "Romule", "The Dynamic's", "The Jokers",

  "Ajesaia", "Bessa sy Lola", "Elysé Ranarivelo", "Feon'ny Ntaolo",
  "Jean-Kely sy Basth", "Les Maîtres du Salegy", "Lolo sy ny Tariny", "Mahaleo",
  "Odéam Rahaniraka", "Rakoto Frah", "Ramros", "Régis Gizavo", "Rivo sy Lala",
  "Sanjila", "Soamy", "Terakaly", "Tovo",

  "Afora", "Babaïque", "Bahery", "Datita Rabeson", "Doc Holliday", "Erick Manana",
  "Feon'ala", "Fenoambby", "Freddy de Majunga", "Iraimbilanja", "Jaojoby Eusèbe",
  "Kajy", "Kiaka", "Mily Clément", "Ndriana Ramamonjy", "Om-Gui (Ny Ainga)",
  "Parson Jacques", "Pro-G", "Raza", "Rebika", "Rija Ramanantoanina", "Rossy",
  "Sakaiza", "Salala", "Samy (Tarika Sammy)", "Scol", "Télésphore", "Tselatra",
  "Vahombey",

  "Alson", "Ambondron", "ABabet", "Bakar", "Bary", "Black Nadia", "Celia",
  "Datkotry", "Din Rotsaka", "Farasoa", "Gothlieb", "Hazolahy", "Jabba", "Jarifa",
  "Jerry Marcoss", "Joy K", "Lego", "Lianah", "Mage 4", "Mamy Gotso", "Marion",
  "Mika sy Davis", "Nanie", "Olada", "Onja (Tinondadia)", "Princio", "Rabousssa",
  "Rajery", "Silo", "Spy d'Op", "Tandapa", "Tarika Zay (Zay)", "Tence Mena",
  "Tinondadia", "Titi", "Toto Mwandjani", "Unik", "Vaiavy Chila", "Vilon'Androy",
  "Yzit",

  "Anjaray Ankarana", "Apost", "Bessa et Lola", "Bogota", "Da Hopp", "Dadah R'Abel",
  "Dama", "Damily", "D'Gary", "Dillie", "FAB", "Green", "Henri Ratsimbazafy",
  "INN (Inaudible Negative Noise)", "Jean Emilien", "L.A Doudh", "Menalotsa",
  "Ninie Doniah", "Njakatiana", "Olombelo Ricky (Ricky Randimbiarison)", "Poopy",
  "Samoëla", "Tarika (Tarika Sammy)", "Tearano", "Teta", "Tsiok'ampita",
  "Vali Justin", "Wawa", "X-Crew",
].map((entry) => {
  const [brut, emailFourni] = Array.isArray(entry) ? entry : [entry, null];
  const name = canonique(brut);
  return { name, email: (emailFourni || slugEmail(name)).toLowerCase() };
});

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
  const tousArtistes = await Artist.find().select("_id user stageName").lean();
  for (const a of tousArtistes) registerName(a.stageName, a);

  // Tout est chargé d'avance : à ce volume, une requête par entrée coûtait
  // plus d'un millier d'allers-retours vers Atlas, soit plusieurs minutes.
  const tousUsers = await User.find()
    .select("_id email name role emailVerified suspended verifiedArtist passwordHash")
    .lean();
  const userParEmail = new Map(tousUsers.map((u) => [u.email, u]));
  const userParId = new Map(tousUsers.map((u) => [String(u._id), u]));
  const artisteParUser = new Map();
  for (const a of tousArtistes) {
    if (a.user) artisteParUser.set(String(a.user), a);
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
    duplicates: [],
    nearMisses: [],
    conflicts: [],
  };

  const seenEmails = new Set();

  for (const { name, email } of ARTISTS) {
    // Même adresse deux fois dans la liste : la seconde n'apporte rien.
    if (seenEmails.has(email)) {
      report.duplicates.push(`${name} <${email}> : adresse déjà traitée plus haut dans la liste`);
      continue;
    }
    seenEmails.add(email);

    // Travaillé depuis l'index en mémoire : la base n'est réécrite que
    // lorsqu'un champ diffère réellement.
    let user = userParEmail.get(email) || null;

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
        const owner = userParId.get(String(homonyme.user));
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
      const proche = PROCHES_MAIS_DISTINCTS.has(cible)
        ? null
        : [...byName.keys()].find((k) => k && distance(cible, k) === 1);
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
        userParEmail.set(email, user);
        userParId.set(String(user._id), user);
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
          const maj = {
            name,
            role: "artist",
            emailVerified: true,
            verifiedArtist: true,
            suspended: false,
          };
          if (!passwordOk) maj.passwordHash = passwordHash;
          await User.updateOne({ _id: user._id }, { $set: maj });
        }
        report.userUpdated.push(`${name} <${email}> (${changes.join(", ")})`);
      }
    }

    // 2) Le profil artiste.
    const linked = user._id ? artisteParUser.get(String(user._id)) : null;
    if (linked) {
      report.artistKept.push(`${name} → ${linked._id}`);
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
        await Artist.updateOne({ _id: orphan._id }, { $set: { user: user._id, stageName: name } });
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
      const created = await Artist.create({ user: user._id, stageName: name, verified: true });
      report.artistCreated.push(`${name} → ${created._id}`);
      registerName(name, { _id: created._id, user: user._id, ownerEmail: email, stageName: name });
      artisteParUser.set(String(user._id), created);
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
  section("Profils artistes déjà liés, inchangés", report.artistKept);
  section("Conflits à arbitrer à la main", report.conflicts);
  console.log(`\nTotal traité : ${ARTISTS.length} artistes.`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
