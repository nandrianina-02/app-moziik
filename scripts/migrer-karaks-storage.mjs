/**
 * Copie les fichiers de Cloudinary vers Karaks Storage et met la base à jour.
 *
 * CE QUI EST COPIÉ
 *
 * Tout ce que la base référence chez Cloudinary : titres, clips, pochettes,
 * bannières, avatars, images d'évènements, de playlists et de groupes,
 * pièces jointes de messagerie, images de l'accueil et du site.
 *
 * Pour un titre, quatre fichiers : l'original, tel quel, et ses trois
 * qualités d'écoute (64, 128 et 320 kb/s) découpées selon `trimStart` et
 * `trimEnd`. Cloudinary les fabrique encore une dernière fois, ici, pour
 * que Karaks Storage les serve ensuite sans transcodage (voir
 * lib/encodageAudio.ts, qui fait de même pour les nouveaux envois).
 *
 * CE QUI N'EST PAS TOUCHÉ
 *
 * Les fichiers chez Cloudinary : rien n'est supprimé. Une fois la migration
 * vérifiée, on les retire à la main depuis le tableau de bord Cloudinary.
 * L'APK Android (`SiteConfig.androidApkUrl`) non plus : Karaks Storage
 * n'accepte pas ce format.
 *
 * REPRISE
 *
 * Chaque fichier copié est noté dans scripts/.migration-karaks-storage.json :
 * une adresse Cloudinary déjà copiée n'est jamais renvoyée, même si plusieurs
 * documents la citent (une pochette d'album reprise par une notification),
 * et une migration interrompue reprend où elle s'était arrêtée.
 *
 * ORDRE
 *
 *   1. Renseigner KARAKS_STORAGE_URL et KARAKS_STORAGE_API_KEY.
 *   2. node scripts/migrer-karaks-storage.mjs --essai
 *      Compte les fichiers et leur poids, sans rien écrire : à comparer
 *      avec l'espace libre du stockage.
 *   3. node scripts/migrer-karaks-storage.mjs --limite 5
 *      Une poignée de documents, pour vérifier à l'écoute.
 *   4. node scripts/migrer-karaks-storage.mjs
 *
 * Options : --essai, --limite N, --parallele N (4 par défaut), --collections songs,albums,…, --aide
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

for (const fichier of [".env.local", ".env"]) {
  const chemin = path.resolve(process.cwd(), fichier);
  if (!fs.existsSync(chemin)) continue;
  for (const ligne of fs.readFileSync(chemin, "utf8").split("\n")) {
    const trouve = ligne.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!trouve) continue;
    const [, cle, valeur = ""] = trouve;
    if (!process.env[cle]) process.env[cle] = valeur.trim().replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const option = (nom) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};

if (args.includes("--aide")) {
  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]);
  process.exit(0);
}

const ESSAI = args.includes("--essai");
const LIMITE = Number(option("--limite") ?? Infinity);
/** Titres copiés en même temps. */
const PARALLELE = Math.max(1, Number(option("--parallele") ?? 4));
const STOCKAGE = process.env.KARAKS_STORAGE_URL?.replace(/\/+$/, "");
const CLE = process.env.KARAKS_STORAGE_API_KEY;
const JOURNAL = path.resolve(process.cwd(), "scripts/.migration-karaks-storage.json");

/**
 * Ce que la base référence, collection par collection. `dossier` est celui
 * des nouveaux envois (lib/envoiRegles.ts) ; « songs » est réservé aux
 * fichiers d'écoute, que /media ne sert jamais.
 */
const CHAMPS = {
  songs: [
    { champ: "videoUrl", dossier: "videos" },
    { champ: "coverUrl", dossier: "covers" },
  ],
  albums: [
    { champ: "coverUrl", dossier: "covers" },
    { champ: "bannerUrl", dossier: "banners" },
  ],
  artists: [
    { champ: "coverUrl", dossier: "avatars" },
    { champ: "bannerUrl", dossier: "banners" },
  ],
  users: [{ champ: "avatarUrl", dossier: "avatars" }],
  events: [
    { champ: "coverUrl", dossier: "covers" },
    { champ: "gallery", dossier: "covers", liste: true },
  ],
  playlists: [{ champ: "coverUrl", dossier: "covers" }],
  conversations: [{ champ: "coverUrl", dossier: "covers" }],
  messages: [
    { champ: "imageUrl", dossier: "messages" },
    { champ: "attachments", dossier: "messages", sousChamp: "url" },
  ],
  notifications: [{ champ: "imageUrl", dossier: "covers" }],
  homepagehubcards: [{ champ: "coverUrl", dossier: "covers" }],
  homepagepinneds: [{ champ: "customCoverUrl", dossier: "covers" }],
  siteconfigs: [
    { champ: "logoUrl", dossier: "site-assets" },
    { champ: "logoDarkUrl", dossier: "site-assets" },
    { champ: "faviconUrl", dossier: "site-assets" },
  ],
};

const COLLECTIONS = option("--collections")?.split(",") ?? Object.keys(CHAMPS);

function estCloudinary(valeur) {
  return typeof valeur === "string" && valeur.includes("res.cloudinary.com/");
}

// --- Journal de reprise -------------------------------------------------------

const journal = fs.existsSync(JOURNAL) ? JSON.parse(fs.readFileSync(JOURNAL, "utf8")) : { fichiers: {}, titres: {} };
function noter() {
  if (!ESSAI) fs.writeFileSync(JOURNAL, JSON.stringify(journal, null, 2));
}

// --- Cloudinary -----------------------------------------------------------------

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/** Même lecture que lib/cloudinaryAudio.ts : identifiant, format, type de distribution. */
function decrireCloudinary(url) {
  const marqueur = url.match(/\/(upload|authenticated)\//);
  if (!marqueur) return null;
  let reste = url.slice(marqueur.index + marqueur[0].length).split("?")[0];
  // Dans cet ordre : la signature d'une adresse `authenticated`
  // (`s--AbCd--/`), les transformations éventuelles, puis la version.
  reste = reste
    .replace(/^s--[\w-]+--\//, "")
    .replace(/^(?:[a-z]{1,3}_[^/]+\/)+/, "")
    .replace(/^v\d+\//, "");
  const format = reste.match(/\.([a-z0-9]{2,4})$/i)?.[1];
  return { publicId: format ? reste.slice(0, -format.length - 1) : reste, format, type: marqueur[1] };
}

/** Adresse lisible d'un fichier : signée s'il est distribué en `authenticated`. */
/**
 * Type de distribution réel. Après scripts/proteger-audio.mjs, l'audio des
 * titres est en `authenticated` alors que la base garde l'adresse en
 * `/upload/` : même règle que lib/cloudinaryAudio.ts, le drapeau
 * CLOUDINARY_AUDIO_AUTHENTICATED décide pour ces adresses-là.
 */
function typeReel(infos, audioTitre) {
  if (infos.type === "authenticated") return "authenticated";
  return audioTitre && process.env.CLOUDINARY_AUDIO_AUTHENTICATED === "true" ? "authenticated" : "upload";
}

function adresseLisible(url, ressource, audioTitre = false) {
  const infos = decrireCloudinary(url);
  if (!infos || typeReel(infos, audioTitre) !== "authenticated") return url;
  return cloudinary.url(infos.publicId, { resource_type: ressource, type: "authenticated", sign_url: true, format: infos.format });
}

const DEBITS = { low: "64k", medium: "128k", high: "320k" };

/** Une qualité d'écoute, fabriquée par Cloudinary, découpe comprise. */
function adresseVariante(audioUrl, qualite, debut, fin) {
  const infos = decrireCloudinary(audioUrl);
  if (!infos) throw new Error(`Adresse audio illisible : ${audioUrl}`);
  const transformation = { bit_rate: DEBITS[qualite], audio_codec: "mp3" };
  if (typeof debut === "number" && debut > 0) transformation.start_offset = debut;
  if (typeof fin === "number" && fin > 0) transformation.end_offset = fin;
  return cloudinary.url(infos.publicId, {
    resource_type: "video",
    type: typeReel(infos, true),
    sign_url: typeReel(infos, true) === "authenticated",
    format: "mp3",
    transformation: [transformation],
  });
}

async function telecharger(url) {
  for (let essai = 1; ; essai += 1) {
    try {
      const reponse = await fetch(url);
      if (!reponse.ok) throw new Error(`Cloudinary a répondu ${reponse.status}`);
      return {
        octets: new Uint8Array(await reponse.arrayBuffer()),
        type: (reponse.headers.get("content-type") ?? "application/octet-stream").split(";")[0],
      };
    } catch (erreur) {
      // Une qualité fabriquée à la demande peut répondre 423 le temps du
      // calcul : on laisse à Cloudinary quelques secondes.
      if (essai >= 4) throw erreur;
      await new Promise((r) => setTimeout(r, 3000 * essai));
    }
  }
}

async function poids(url) {
  const reponse = await fetch(url, { method: "HEAD" }).catch(() => null);
  return Number(reponse?.headers.get("content-length") ?? 0);
}

// --- Karaks Storage ---------------------------------------------------------------

async function appel(chemin, init = {}) {
  const requete = () =>
    fetch(`${STOCKAGE}${chemin}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${CLE}`, ...(init.corps ? { "Content-Type": "application/json" } : {}) },
      body: init.corps ? JSON.stringify(init.corps) : undefined,
    });
  // Une connexion coupée en route (« fetch failed ») se rattrape en
  // réessayant ; au pire, une session d'envoi de plus, qui expire seule.
  let reponse;
  for (let essai = 1; ; essai += 1) {
    try {
      reponse = await requete();
      break;
    } catch (erreur) {
      if (essai >= 4) throw erreur;
      await new Promise((r) => setTimeout(r, 2000 * essai));
    }
  }
  const donnees = await reponse.json().catch(() => null);
  if (!reponse.ok) throw new Error(donnees?.error?.message ?? `Karaks Storage a répondu ${reponse.status}`);
  return donnees;
}

const dossiers = new Map();
async function dossier(nom) {
  if (dossiers.has(nom)) return dossiers.get(nom);
  const { folders } = await appel("/api/v1/folders");
  let id = folders.find((f) => f.name === nom)?.id;
  if (!id) id = (await appel("/api/v1/folders", { method: "POST", corps: { name: nom } })).folder.id;
  dossiers.set(nom, id);
  return id;
}

const EXTENSIONS = {
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/flac": "flac", "audio/mp4": "m4a",
  "audio/aac": "aac", "audio/ogg": "ogg", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
  "image/svg+xml": "svg", "application/pdf": "pdf",
};

/** Dépose des octets sur Karaks Storage, par morceaux, et renvoie l'identifiant du fichier. */
async function deposer(octets, type, nom, nomDossier) {
  const extension = EXTENSIONS[type];
  if (!extension) throw new Error(`Format non accepté par Karaks Storage : ${type}`);
  const base = nom.replace(/\.[A-Za-z0-9]{1,8}$/, "").slice(0, 150) || "fichier";
  const envoi = await appel("/api/v1/uploads", {
    method: "POST",
    corps: { name: `${base}.${extension}`, mimeType: type, size: octets.byteLength, folderId: await dossier(nomDossier) },
  });
  let envoye = 0;
  let essais = 0;
  while (envoye < octets.byteLength) {
    const fin = Math.min(envoye + envoi.chunkSize, octets.byteLength);
    try {
      const reponse = await fetch(envoi.uploadUrl, {
        method: "PUT",
        headers: { "Content-Range": `bytes ${envoye}-${fin - 1}/${octets.byteLength}` },
        body: octets.subarray(envoye, fin),
      });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) {
        const erreur = new Error(donnees?.error?.message ?? `Envoi refusé (${reponse.status})`);
        // Un refus (format, quota) ne changera pas ; une panne passagère, si.
        if (reponse.status < 500 && reponse.status !== 429) erreur.definitif = true;
        throw erreur;
      }
      envoye = donnees.upload.received;
      essais = 0;
      if (donnees.file) return donnees.file.id;
    } catch (erreur) {
      if (erreur.definitif || essais >= 4) throw erreur;
      essais += 1;
      await new Promise((r) => setTimeout(r, 2000 * essais));
      // Après une coupure, le service dit combien d'octets il a gardés.
      const etat = await fetch(envoi.uploadUrl).then((r) => r.json()).catch(() => null);
      if (etat?.file) return etat.file.id;
      if (typeof etat?.upload?.received === "number") envoye = etat.upload.received;
    }
  }
  return envoi.upload.fileId;
}

/** Copie une adresse Cloudinary, une seule fois quel que soit le nombre de documents qui la citent. */
async function copier(url, nomDossier, ressource, audioTitre = false) {
  if (journal.fichiers[url]) return journal.fichiers[url];
  const { octets, type } = await telecharger(adresseLisible(url, ressource, audioTitre));
  const nom = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "fichier");
  const id = await deposer(octets, type, nom, nomDossier);
  journal.fichiers[url] = id;
  noter();
  return id;
}

// --- Passes -----------------------------------------------------------------------

const bilan = { documents: 0, fichiers: 0, octets: 0, octetsVersions: 0, echecs: 0 };

async function migrerTitres(db) {
  const titres = db.collection("songs");
  const curseur = titres.find({ audioUrl: { $regex: "res\\.cloudinary\\.com/" } }, { projection: { title: 1, audioUrl: 1, trimStart: 1, trimEnd: 1, duration: 1 } });
  const liste = [];
  for await (const titre of curseur) {
    if (liste.length >= LIMITE) break;
    liste.push(titre);
  }
  // Plusieurs titres à la fois : chacun attend surtout le réseau (Cloudinary
  // qui fabrique une qualité, puis l'envoi par morceaux), pas le processeur.
  let suivant = 0;
  const ouvrier = async () => {
    while (suivant < liste.length) await migrerTitre(titres, liste[suivant++]);
  };
  await Promise.all(Array.from({ length: Math.min(PARALLELE, liste.length) }, ouvrier));
}

async function migrerTitre(titres, titre) {
  {
    try {
      if (ESSAI) {
        bilan.fichiers += 4;
        bilan.octets += await poids(adresseLisible(titre.audioUrl, "video", true));
        // Les trois qualités cumulent 512 kb/s, soit 64 000 octets par seconde
        // servie : souvent plus que l'original lui-même.
        bilan.octetsVersions += (titre.duration ?? 0) * 64_000;
        return;
      }
      const deja = journal.titres[String(titre._id)];
      const source = deja?.source ?? (await copier(titre.audioUrl, "songs", "video", true));
      const variantes = {};
      for (const qualite of ["low", "medium", "high"]) {
        if (deja?.variantes?.[qualite]) {
          variantes[qualite] = deja.variantes[qualite];
          continue;
        }
        const { octets, type } = await telecharger(adresseVariante(titre.audioUrl, qualite, titre.trimStart, titre.trimEnd));
        variantes[qualite] = await deposer(octets, type === "audio/mpeg" ? type : "audio/mpeg", `${titre.title}-${qualite}.mp3`, "songs");
        journal.titres[String(titre._id)] = { source, variantes };
        noter();
      }
      await titres.updateOne({ _id: titre._id }, { $set: { audioUrl: `ks:${source}`, audioVariantes: variantes } });
      bilan.documents += 1;
      bilan.fichiers += 4;
      console.log(`  titre  ${titre.title}`);
    } catch (erreur) {
      bilan.echecs += 1;
      console.error(`  ÉCHEC  titre ${titre._id} (${titre.title}) : ${erreur.message}`);
    }
  }
}

async function migrerCollection(db, nom) {
  const champs = CHAMPS[nom];
  const collection = db.collection(nom);
  const filtre = {
    $or: champs.map(({ champ, sousChamp }) => ({ [sousChamp ? `${champ}.${sousChamp}` : champ]: { $regex: "res\\.cloudinary\\.com/" } })),
  };
  let vus = 0;
  for await (const doc of collection.find(filtre)) {
    if (vus++ >= LIMITE) break;
    const modifs = {};
    try {
      for (const { champ, dossier: nomDossier, liste, sousChamp } of champs) {
        const valeur = doc[champ];
        const ressource = nomDossier === "videos" ? "video" : "image";
        const remplacer = async (url) => {
          if (!estCloudinary(url)) return url;
          bilan.fichiers += 1;
          if (ESSAI) {
            bilan.octets += journal.fichiers[url] ? 0 : await poids(adresseLisible(url, ressource));
            return url;
          }
          // Une pièce jointe audio de messagerie est un fichier audio, pas une image.
          return `/media/${await copier(url, nomDossier, url.includes("/video/") ? "video" : ressource)}`;
        };
        if (sousChamp && Array.isArray(valeur)) {
          const suite = [];
          for (const element of valeur) suite.push({ ...element, [sousChamp]: await remplacer(element?.[sousChamp]) });
          modifs[champ] = suite;
        } else if (liste && Array.isArray(valeur)) {
          const suite = [];
          for (const url of valeur) suite.push(await remplacer(url));
          modifs[champ] = suite;
        } else if (estCloudinary(valeur)) {
          modifs[champ] = await remplacer(valeur);
        }
      }
      if (!ESSAI && Object.keys(modifs).length > 0) {
        await collection.updateOne({ _id: doc._id }, { $set: modifs });
        bilan.documents += 1;
      }
    } catch (erreur) {
      bilan.echecs += 1;
      console.error(`  ÉCHEC  ${nom} ${doc._id} : ${erreur.message}`);
    }
  }
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI manquante.");
  if (!ESSAI && (!STOCKAGE || !CLE)) throw new Error("KARAKS_STORAGE_URL et KARAKS_STORAGE_API_KEY sont nécessaires.");
  if (!process.env.CLOUDINARY_API_SECRET) throw new Error("CLOUDINARY_API_SECRET manquante : les fichiers protégés ne se liraient pas.");

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log(ESSAI ? "Essai : rien ne sera copié ni modifié.\n" : `Copie vers ${STOCKAGE}\n`);

  if (COLLECTIONS.includes("songs")) {
    console.log("Titres (original et trois qualités)");
    await migrerTitres(db);
  }
  for (const nom of COLLECTIONS) {
    if (!CHAMPS[nom]) continue;
    console.log(`\n${nom}`);
    await migrerCollection(db, nom);
  }

  await mongoose.disconnect();
  const mo = (bilan.octets / 1024 / 1024).toFixed(1);
  console.log(
    ESSAI
      ? `\n${bilan.fichiers} fichiers à copier : ${mo} Mo d'originaux, clips et images, ` +
        `et environ ${(bilan.octetsVersions / 1024 / 1024).toFixed(0)} Mo de qualités d'écoute, ` +
        `soit ${((bilan.octets + bilan.octetsVersions) / 1024 ** 3).toFixed(1)} Go en tout.`
      : `\n${bilan.documents} documents mis à jour, ${bilan.fichiers} fichiers copiés, ${bilan.echecs} échec(s).`,
  );
  if (bilan.echecs > 0) {
    console.log("Relancez le script : les fichiers déjà copiés ne repartent pas.");
    process.exitCode = 1;
  }
}

main().catch((erreur) => {
  console.error(erreur.message);
  process.exit(1);
});
