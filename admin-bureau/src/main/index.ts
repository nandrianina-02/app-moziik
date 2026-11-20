import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, session, shell, type MenuItemConstructorOptions } from "electron";
import { basename, extname, join } from "node:path";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import { parseFile } from "music-metadata";
import { CANAUX, PREFIXE_MISE_A_JOUR, SITE_PAR_DEFAUT, type Etiquettes, type FichierAudio, type PochetteLue, type Reglages } from "../partage/types";

/*
 * Processus principal : la fenêtre, et ce que la fenêtre ne peut pas faire
 * seule (lire le disque, garder un secret). Tout le reste, y compris les
 * appels au site, se fait dans la fenêtre : elle parle à l'API de Moziik
 * comme le ferait un navigateur.
 */

const EXTENSIONS_AUDIO = new Set([".mp3", ".m4a", ".aac", ".flac", ".wav", ".ogg", ".opus", ".wma"]);
const PROFONDEUR_MAX = 4;

const cheminReglages = () => join(app.getPath("userData"), "reglages.json");
const cheminCoffre = () => join(app.getPath("userData"), "coffre.bin");

async function lireReglages(): Promise<Reglages> {
  try {
    const brut = JSON.parse(await readFile(cheminReglages(), "utf8")) as Partial<Reglages>;
    return { site: (brut.site ?? SITE_PAR_DEFAUT).replace(/\/+$/, "") };
  } catch {
    return { site: SITE_PAR_DEFAUT };
  }
}

/** Parcours récursif borné : un dossier de musique a rarement plus de quatre niveaux. */
async function listerAudio(dossier: string, profondeur = 0): Promise<FichierAudio[]> {
  const resultat: FichierAudio[] = [];
  let entrees: string[];
  try {
    entrees = await readdir(dossier);
  } catch {
    return resultat;
  }
  for (const nom of entrees.sort((a, b) => a.localeCompare(b, "fr"))) {
    const chemin = join(dossier, nom);
    let infos;
    try {
      infos = await stat(chemin);
    } catch {
      continue;
    }
    if (infos.isDirectory()) {
      if (profondeur < PROFONDEUR_MAX && !nom.startsWith(".")) resultat.push(...(await listerAudio(chemin, profondeur + 1)));
    } else if (EXTENSIONS_AUDIO.has(nom.slice(nom.lastIndexOf(".")).toLowerCase())) {
      resultat.push({ chemin, nom, taille: infos.size });
    }
  }
  return resultat;
}

/**
 * Ce qu'on a glissé ou choisi : des fichiers et des dossiers mêlés. Un
 * dossier est parcouru ; seuls les fichiers audio sont gardés, une fois
 * chacun, dans l'ordre reçu.
 */
async function resoudreChemins(chemins: string[]): Promise<FichierAudio[]> {
  const vus = new Set<string>();
  const resultat: FichierAudio[] = [];
  for (const chemin of chemins) {
    let infos;
    try {
      infos = await stat(chemin);
    } catch {
      continue;
    }
    const trouves = infos.isDirectory()
      ? await listerAudio(chemin)
      : EXTENSIONS_AUDIO.has(extname(chemin).toLowerCase())
        ? [{ chemin, nom: basename(chemin), taille: infos.size }]
        : [];
    for (const f of trouves) {
      if (vus.has(f.chemin)) continue;
      vus.add(f.chemin);
      resultat.push(f);
    }
  }
  return resultat;
}

const TYPES_IMAGE: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const IMAGE_MAX = 12 * 1024 * 1024;

/** Une image choisie ou glissée pour une pochette : rien d'autre qu'une image, et pas démesurée. */
async function lireImage(chemin: string): Promise<PochetteLue> {
  const mime = TYPES_IMAGE[extname(String(chemin)).toLowerCase()];
  if (!mime) throw new Error("Seules les images JPEG, PNG ou WebP sont acceptées.");
  const octets = await readFile(chemin);
  if (octets.byteLength > IMAGE_MAX) throw new Error("Image trop lourde (12 Mo au plus).");
  return { mime, base64: octets.toString("base64") };
}

/*
 * Lecture des balises reprise de lib/audioMetadata.ts du site (formulaire
 * de publication) : une correction d'un côté se reporte de l'autre.
 */
type Natif = Record<string, { id: string; value: unknown }[]> | undefined;
const premiereChaine = (valeurs?: (string | undefined)[]) => valeurs?.map((v) => v?.trim()).find((v): v is string => !!v) ?? null;
const premierNombre = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : undefined);

function horodatageLrc(ms: number) {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  return `[${String(m).padStart(2, "0")}:${(total - m * 60).toFixed(2).padStart(5, "0")}]`;
}

/** Paroles en LRC dès qu'elles sont synchronisées en millisecondes ; le texte brut sinon. */
function lireParoles(tags: { text?: string; syncText?: { text: string; timestamp?: number }[]; timeStampFormat?: number }[] | undefined) {
  for (const tag of tags ?? []) {
    const lignes = (tag.syncText ?? []).filter((l) => typeof l.timestamp === "number" && l.text);
    if (lignes.length > 0 && tag.timeStampFormat === 2) {
      return { texte: lignes.map((l) => horodatageLrc(l.timestamp as number) + l.text.replace(/[\r\n]+/g, " ").trim()).join("\n"), synchronisees: true };
    }
  }
  return { texte: premiereChaine((tags ?? []).map((t) => t.text)), synchronisees: false };
}

/** « Explicite » : chaque conteneur le range ailleurs ; seule une valeur nette compte. */
function lireExplicite(natif: Natif): boolean | null {
  for (const balises of Object.values(natif ?? {})) {
    for (const b of balises) {
      if (!/RTNG|ITUNESADVISORY|ADVISORY|EXPLICIT/.test(b.id.toUpperCase())) continue;
      const brut = typeof b.value === "object" && b.value !== null && "value" in b.value ? (b.value as { value: unknown }).value : b.value;
      const v = String(brut).trim().toLowerCase();
      if (["1", "true", "yes", "explicit"].includes(v)) return true;
      if (["0", "2", "false", "no", "clean"].includes(v)) return false;
    }
  }
  return null;
}

/** Le producteur d'une trame de crédits ID3v2.3 (IPLS), que music-metadata ne reporte pas dans `common`. */
function intervenant(natif: Natif, role: string): string | null {
  for (const balises of Object.values(natif ?? {})) {
    for (const b of balises) {
      if (!/^(IPLS|TIPL|TMCL)$/.test(b.id.toUpperCase())) continue;
      const valeur = b.value as Record<string, unknown> | null;
      if (!valeur || typeof valeur !== "object") continue;
      const trouve = Object.entries(valeur).find(([cle]) => cle.toLowerCase() === role);
      if (!trouve) continue;
      const premier = (Array.isArray(trouve[1]) ? trouve[1] : [trouve[1]]).map((n) => String(n).trim()).find(Boolean);
      if (premier) return premier;
    }
  }
  return null;
}

/** AAAA, AAAA-MM ou AAAA-MM-JJ → AAAA-MM-JJ ; une date absurde est écartée. */
function dateDeSortie(valeur?: string | number): string | null {
  const brut = typeof valeur === "number" ? String(valeur) : valeur?.trim();
  const m = brut?.match(/^([0-9]{4})(?:-([0-9]{2}))?(?:-([0-9]{2}))?/);
  if (!m) return null;
  const annee = Number(m[1]);
  if (annee < 1900 || annee > new Date().getFullYear() + 5) return null;
  return `${m[1]}-${m[2] ?? "01"}-${m[3] ?? "01"}`;
}

const EXTENSIONS_VIDEO = new Set([".mp4", ".mov", ".webm", ".m4v"]);

/** Un clip choisi ou glissé : seulement une vidéo, et pas plus que ce que le site accepte. */
async function decrireVideo(chemin: string): Promise<FichierAudio> {
  if (!EXTENSIONS_VIDEO.has(extname(String(chemin)).toLowerCase())) throw new Error("Le clip doit être une vidéo MP4, MOV, WebM ou M4V.");
  const infos = await stat(chemin);
  if (infos.size > 1024 * 1024 * 1024) throw new Error("Clip trop lourd (1 Go au plus).");
  return { chemin, nom: basename(chemin), taille: infos.size };
}

async function lireEtiquettes(chemin: string): Promise<Etiquettes> {
  const m = await parseFile(chemin, { skipCovers: false, duration: true });
  const c = m.common;
  const natif = m.native as unknown as Natif;
  // Plusieurs images (face, dos, livret) : la plus lourde, à défaut de la plus définie, puis la face avant.
  const image = [...(c.picture ?? [])].sort((a, b) => b.data.byteLength - a.data.byteLength || Number(/front/i.test(b.type ?? "")) - Number(/front/i.test(a.type ?? "")))[0];
  const paroles = lireParoles(c.lyrics as Parameters<typeof lireParoles>[0]);
  const genres = (c.genre ?? []).map((g) => g.trim()).filter(Boolean);
  return {
    titre: c.title ?? null,
    artiste: c.artist ?? c.albumartist ?? null,
    album: c.album ?? null,
    annee: c.year ?? (c.date ? Number(String(c.date).slice(0, 4)) || null : null),
    piste: c.track?.no ?? null,
    genre: c.genre?.[0] ?? null,
    compositeur: c.composer?.[0] ?? null,
    bpm: c.bpm ? Math.round(c.bpm) : null,
    duree: m.format.duration ? Math.round(m.format.duration) : null,
    debit: m.format.bitrate ? Math.round(m.format.bitrate / 1000) : null,
    pochette: image ? { mime: image.format, base64: Buffer.from(image.data).toString("base64") } : null,
    artistes: (c.artists ?? []).map((a) => a.trim()).filter(Boolean),
    producteur: premiereChaine(c.producer) ?? intervenant(natif, "producer"),
    tonalite: c.key?.trim() || null,
    isrc: premiereChaine(c.isrc),
    copyright: c.copyright?.trim() || null,
    langue: c.language?.trim() || null,
    paroles: paroles.texte,
    parolesSynchronisees: paroles.synchronisees,
    description: premiereChaine(c.description) ?? premiereChaine((c.comment ?? []).map((x) => x.text)) ?? (c.longDescription?.trim() || null),
    dateSortie: dateDeSortie(c.releasedate) ?? dateDeSortie(c.date) ?? dateDeSortie(c.originaldate) ?? dateDeSortie(premierNombre(c.year)),
    genresSecondaires: genres.slice(1),
    motsCles: [...(c.keywords ?? []), c.grouping, c.mood].map((v) => v?.trim()).filter((v): v is string => !!v),
    explicite: lireExplicite(natif),
  };
}

function creerFenetre() {
  const fenetre = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    show: false,
    // Le fond du thème sombre, celui par défaut : pas d'éclair blanc à l'ouverture.
    backgroundColor: "#0d0f1a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  fenetre.once("ready-to-show", () => fenetre.show());
  // Un fichier lâché à côté d'une zone de dépôt ouvrirait ce fichier à la place
  // du logiciel : la fenêtre ne quitte jamais sa page.
  fenetre.webContents.on("will-navigate", (e, url) => {
    if (url !== fenetre.webContents.getURL()) e.preventDefault();
  });
  // Un lien vers l'extérieur s'ouvre dans le navigateur, jamais dans une fenêtre de l'app.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  // Electron n'a aucun menu au clic droit : sans celui-ci, impossible de
  // coller une adresse dans un champ à la souris. Les listes ont leur propre
  // menu, côté fenêtre, qui empêche celui-ci de s'ouvrir.
  fenetre.webContents.on("context-menu", (_e, p) => {
    if (!p.isEditable && !p.selectionText.trim()) return;
    const f = p.editFlags;
    const modele: MenuItemConstructorOptions[] = [
      // Le correcteur orthographique (français) propose ses corrections en tête.
      ...p.dictionarySuggestions.slice(0, 5).map((mot): MenuItemConstructorOptions => ({ label: mot, click: () => fenetre.webContents.replaceMisspelling(mot) })),
      ...(p.misspelledWord
        ? [
            { label: "Ajouter au dictionnaire", click: () => fenetre.webContents.session.addWordToSpellCheckerDictionary(p.misspelledWord) },
            { type: "separator" } as MenuItemConstructorOptions,
          ]
        : []),
      ...(p.isEditable
        ? ([
            { label: "Annuler", role: "undo", enabled: f.canUndo },
            { label: "Rétablir", role: "redo", enabled: f.canRedo },
            { type: "separator" },
            { label: "Couper", role: "cut", enabled: f.canCut },
          ] as MenuItemConstructorOptions[])
        : []),
      { label: "Copier", role: "copy", enabled: f.canCopy },
      ...(p.isEditable ? ([{ label: "Coller", role: "paste", enabled: f.canPaste }] as MenuItemConstructorOptions[]) : []),
      { type: "separator" },
      { label: "Tout sélectionner", role: "selectAll" },
    ];
    Menu.buildFromTemplate(modele).popup({ window: fenetre });
  });
  // La fenêtre retient sa fermeture pendant un téléversement (beforeunload) :
  // Electron ne demande rien de lui-même, on pose donc la question ici.
  fenetre.webContents.on("will-prevent-unload", (evenement) => {
    const choix = dialog.showMessageBoxSync(fenetre, {
      type: "warning",
      buttons: ["Fermer quand même", "Continuer le téléversement"],
      defaultId: 1,
      cancelId: 1,
      title: "Téléversement en cours",
      message: "Un téléversement est en cours.",
      detail: "Fermer Moziik Admin l'interrompt : le titre en cours d'envoi ne sera pas publié. Ceux déjà publiés le restent.",
    });
    // preventDefault ici annule la retenue : la fenêtre se ferme.
    if (choix === 0) evenement.preventDefault();
  });
  if (process.env.ELECTRON_RENDERER_URL) void fenetre.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void fenetre.loadFile(join(__dirname, "../renderer/index.html"));
  return fenetre;
}

/**
 * Mise à jour depuis le logiciel : l'installeur de la version choisie est
 * téléchargé dans le dossier temporaire, lancé, et le logiciel se ferme
 * pour lui laisser remplacer ses fichiers. Seule une adresse de version du
 * dépôt du projet est acceptée : la fenêtre ne peut pas faire exécuter
 * n'importe quel programme.
 */
ipcMain.handle(CANAUX.installerMiseAJour, async (evenement, url: string) => {
  if (typeof url !== "string" || !url.startsWith(PREFIXE_MISE_A_JOUR) || !url.endsWith(".exe")) throw new Error("Adresse de mise à jour refusée.");
  const reponse = await fetch(url);
  if (!reponse.ok || !reponse.body) throw new Error(`Téléchargement impossible (${reponse.status}).`);
  const total = Number(reponse.headers.get("content-length")) || 0;
  const chemin = join(app.getPath("temp"), "moziik-admin-setup.exe");
  const fichier = createWriteStream(chemin);
  let recu = 0;
  let dernier = -1;
  for await (const morceau of reponse.body as unknown as AsyncIterable<Uint8Array>) {
    if (!fichier.write(morceau)) await new Promise<void>((r) => fichier.once("drain", () => r()));
    recu += morceau.length;
    const pourcent = total ? Math.floor((recu / total) * 100) : 0;
    if (pourcent !== dernier) {
      dernier = pourcent;
      evenement.sender.send(CANAUX.progressionMiseAJour, pourcent);
    }
  }
  await new Promise<void>((resoudre, rejeter) => fichier.end((e?: Error | null) => (e ? rejeter(e) : resoudre())));
  spawn(chemin, [], { detached: true, stdio: "ignore" }).unref();
  setTimeout(() => app.quit(), 400);
});

ipcMain.handle(CANAUX.choisirDossier, async () => {
  const r = await dialog.showOpenDialog({ properties: ["openDirectory"], title: "Choisir un dossier de musique" });
  return r.canceled ? null : (r.filePaths[0] ?? null);
});
ipcMain.handle(CANAUX.choisirFichiers, async () => {
  const r = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    title: "Choisir des fichiers audio",
    filters: [{ name: "Audio", extensions: [...EXTENSIONS_AUDIO].map((e) => e.slice(1)) }],
  });
  return r.canceled ? [] : resoudreChemins(r.filePaths);
});
ipcMain.handle(CANAUX.resoudreChemins, (_e, chemins: string[]) => resoudreChemins(Array.isArray(chemins) ? chemins.filter((c) => typeof c === "string") : []));
ipcMain.handle(CANAUX.choisirImage, async () => {
  const r = await dialog.showOpenDialog({
    properties: ["openFile"],
    title: "Choisir une image",
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }],
  });
  return r.canceled || !r.filePaths[0] ? null : lireImage(r.filePaths[0]);
});
ipcMain.handle(CANAUX.lireImage, (_e, chemin: string) => lireImage(chemin));
// Le clip d'un titre : le site accepte MP4, MOV, WebM et M4V (envoiRegles.ts, dossier « videos »).
ipcMain.handle(CANAUX.choisirVideo, async () => {
  const r = await dialog.showOpenDialog({
    properties: ["openFile"],
    title: "Choisir le clip vidéo",
    filters: [{ name: "Vidéo", extensions: ["mp4", "mov", "webm", "m4v"] }],
  });
  const chemin = r.canceled ? null : r.filePaths[0];
  return chemin ? decrireVideo(chemin) : null;
});
ipcMain.handle(CANAUX.decrireVideo, (_e, chemin: string) => decrireVideo(chemin));
ipcMain.handle(CANAUX.listerAudio, (_e, dossier: string) => listerAudio(dossier));
ipcMain.handle(CANAUX.lireEtiquettes, (_e, chemin: string) => lireEtiquettes(chemin));
ipcMain.handle(CANAUX.lireFichier, async (_e, chemin: string) => {
  const octets = await readFile(chemin);
  return octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength);
});
ipcMain.handle(CANAUX.reglagesLire, () => lireReglages());
ipcMain.handle(CANAUX.reglagesEcrire, async (_e, reglages: Reglages) => {
  await writeFile(cheminReglages(), JSON.stringify({ site: reglages.site.replace(/\/+$/, "") }), "utf8");
});
// Le jeton de session, chiffré par Windows pour ce compte utilisateur (DPAPI) : lisible par personne d'autre.
ipcMain.handle(CANAUX.coffreLire, async () => {
  try {
    const chiffre = await readFile(cheminCoffre());
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(chiffre) : null;
  } catch {
    return null;
  }
});
ipcMain.handle(CANAUX.coffreEcrire, async (_e, valeur: string | null) => {
  if (valeur === null || !safeStorage.isEncryptionAvailable()) {
    await writeFile(cheminCoffre(), "");
    return;
  }
  await writeFile(cheminCoffre(), safeStorage.encryptString(valeur));
});
ipcMain.handle(CANAUX.ouvrirExterne, (_e, url: string) => (/^https?:\/\//.test(url) ? shell.openExternal(url) : undefined));
ipcMain.handle(CANAUX.version, () => app.getVersion());

/**
 * La fenêtre est une page locale (file://) : pour Chromium, chaque appel au
 * site ou à Karaks Storage est un appel d'une autre origine, et ni l'un ni
 * l'autre ne déclare cette origine (le site n'envoie aucun en-tête CORS, le
 * stockage ne connaît que les adresses du site). Sans ce relais, aucune
 * réponse ne serait lisible, connexion comprise.
 *
 * On complète donc les réponses des appels faits par la fenêtre, et
 * seulement ceux-là, plutôt que de couper la sécurité web
 * (webSecurity: false), qui ouvrirait aussi les scripts et les cadres.
 */
function autoriserAppelsDeLaFenetre() {
  session.defaultSession.webRequest.onHeadersReceived({ urls: ["https://*/*"] }, (details, rappel) => {
    // Seulement ce que demande une fenêtre du logiciel. Le type de ressource
    // ne suffit pas : la requête de vérification préalable (OPTIONS) n'est
    // pas classée « xhr » par toutes les versions d'Electron.
    if (details.webContentsId === undefined) return rappel({});
    const entetes: Record<string, string[]> = {};
    for (const [cle, valeur] of Object.entries(details.responseHeaders ?? {})) if (!cle.toLowerCase().startsWith("access-control-")) entetes[cle] = valeur;
    entetes["Access-Control-Allow-Origin"] = ["*"];
    entetes["Access-Control-Allow-Methods"] = ["GET, POST, PUT, PATCH, DELETE, OPTIONS"];
    entetes["Access-Control-Allow-Headers"] = ["Authorization, Content-Type, Content-Range"];
    entetes["Access-Control-Expose-Headers"] = ["*"];
    rappel({ responseHeaders: entetes });
  });
}

/**
 * Mode d'essai de l'intégration continue (MOZIIK_ESSAI_RESEAU=1) : une page
 * locale, comme la vraie fenêtre, appelle le site et le stockage avec les
 * en-têtes que le logiciel envoie. Un appel illisible fait sortir en échec.
 * Les statuts d'erreur (401, 404) sont attendus : seul compte le fait que
 * la réponse arrive jusqu'à la page.
 */
async function essaiReseau() {
  const page = join(app.getPath("temp"), "moziik-admin-essai-reseau.html");
  await writeFile(
    page,
    `<!doctype html><meta charset="utf-8"><title>attente</title><script>
(async () => {
  const essais = [
    ["site", ${JSON.stringify(`${SITE_PAR_DEFAUT}/api/site-config`)}, {}],
    ["site avec jeton", ${JSON.stringify(`${SITE_PAR_DEFAUT}/api/admin/stats`)}, { headers: { Authorization: "Bearer essai" } }],
    ["connexion", ${JSON.stringify(`${SITE_PAR_DEFAUT}/api/mobile-auth/login`)}, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }],
    ["stockage", "https://karaks-storage.vercel.app/u/essai?t=essai", { method: "PUT", headers: { "Content-Range": "bytes 0-0/1" }, body: "a" }],
  ];
  const lignes = [];
  let ok = true;
  for (const [nom, url, init] of essais) {
    try { const r = await fetch(url, init); lignes.push(nom + " : lisible (" + r.status + ")"); }
    catch { ok = false; lignes.push(nom + " : BLOQUE"); }
  }
  document.title = (ok ? "OK|" : "ECHEC|") + lignes.join("|");
})();
</script>`,
  );
  const reseau = await attendreResultat("Essai réseau", (f) => f.loadFile(page));
  // Le vrai logiciel construit, chargé depuis le disque comme chez
  // l'utilisateur : son encodeur MP3 tourne dans un worker, que Chromium
  // pourrait refuser de démarrer depuis une page file://.
  const encodage = await attendreResultat("Essai encodage", (f) => f.loadFile(join(__dirname, "../renderer/index.html"), { query: { essai: "encodage" } }));
  const verdict = reseau && encodage ? "OK" : "ECHEC";
  // Le verdict est aussi écrit dans un fichier, que l'intégration continue
  // relit : le code de sortie d'Electron ne lui parvient pas toujours.
  if (process.env.MOZIIK_ESSAI_SORTIE) await writeFile(process.env.MOZIIK_ESSAI_SORTIE, verdict);
  console.log(`Essais : ${verdict}`);
  app.exit(verdict === "OK" ? 0 : 1);
}

/** Charge une page d'essai et attend son verdict, écrit dans le titre : « OK|… » ou « ECHEC|… ». */
function attendreResultat(nom: string, charger: (f: BrowserWindow) => Promise<void>): Promise<boolean> {
  return new Promise((resoudre) => {
    const fenetre = new BrowserWindow({ show: false });
    const delai = setTimeout(() => {
      console.error(`${nom} : délai dépassé.`);
      fenetre.destroy();
      resoudre(false);
    }, 120_000);
    fenetre.on("page-title-updated", (_e, titre) => {
      if (!titre.includes("|")) return;
      clearTimeout(delai);
      const [etat, ...lignes] = titre.split("|");
      for (const l of lignes) console.log(`${nom} : ${l}`);
      fenetre.destroy();
      resoudre(etat === "OK");
    });
    fenetre.webContents.on("console-message", (_e, _niveau, message) => console.log(`${nom} (console) : ${message}`));
    charger(fenetre).catch((e) => {
      clearTimeout(delai);
      console.error(`${nom} : chargement impossible (${e instanceof Error ? e.message : e}).`);
      if (!fenetre.isDestroyed()) fenetre.destroy();
      resoudre(false);
    });
  });
}

app.whenReady().then(() => {
  autoriserAppelsDeLaFenetre();
  // Pas de menu : le menu caché d'Electron porte ses propres raccourcis de
  // zoom (Ctrl + +, Ctrl + −), qui doubleraient ceux du logiciel et
  // agrandiraient la page sans passer par les Paramètres.
  Menu.setApplicationMenu(null);
  // Correcteur orthographique en français : annonces, réponses d'assistance, biographies.
  try {
    session.defaultSession.setSpellCheckerLanguages(["fr"]);
  } catch {
    // Dictionnaire français absent de ce poste : le correcteur reste sur sa langue par défaut.
  }
  if (process.env.MOZIIK_ESSAI_RESEAU === "1") return void essaiReseau();
  creerFenetre();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
});

// En mode d'essai, les fenêtres se succèdent : fermer la première ne doit pas
// quitter le logiciel avant que la suivante ait rendu son verdict (c'est ce
// qui interrompait l'essai d'encodage et le faisait passer pour réussi).
app.on("window-all-closed", () => {
  if (process.env.MOZIIK_ESSAI_RESEAU !== "1") app.quit();
});
