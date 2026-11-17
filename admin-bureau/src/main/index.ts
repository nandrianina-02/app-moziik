import { app, BrowserWindow, dialog, ipcMain, safeStorage, session, shell } from "electron";
import { join } from "node:path";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { parseFile } from "music-metadata";
import { CANAUX, SITE_PAR_DEFAUT, type Etiquettes, type FichierAudio, type Reglages } from "../partage/types";

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

async function lireEtiquettes(chemin: string): Promise<Etiquettes> {
  const m = await parseFile(chemin, { skipCovers: false, duration: true });
  const c = m.common;
  const image = c.picture?.[0];
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
  // Un lien vers l'extérieur s'ouvre dans le navigateur, jamais dans une fenêtre de l'app.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
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

ipcMain.handle(CANAUX.choisirDossier, async () => {
  const r = await dialog.showOpenDialog({ properties: ["openDirectory"], title: "Choisir un dossier de musique" });
  return r.canceled ? null : (r.filePaths[0] ?? null);
});
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
