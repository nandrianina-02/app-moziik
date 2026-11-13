import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell, nativeTheme } from "electron";
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
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#121417" : "#f7f7f5",
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

app.whenReady().then(() => {
  creerFenetre();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
});

app.on("window-all-closed", () => app.quit());
