import { contextBridge, ipcRenderer } from "electron";
import { CANAUX, type Etiquettes, type FichierAudio, type Reglages } from "../partage/types";

/** Le pont : ce que la fenêtre a le droit de demander au processus principal, et rien d'autre. */
const bureau = {
  choisirDossier: (): Promise<string | null> => ipcRenderer.invoke(CANAUX.choisirDossier),
  listerAudio: (dossier: string): Promise<FichierAudio[]> => ipcRenderer.invoke(CANAUX.listerAudio, dossier),
  lireEtiquettes: (chemin: string): Promise<Etiquettes> => ipcRenderer.invoke(CANAUX.lireEtiquettes, chemin),
  lireFichier: (chemin: string): Promise<ArrayBuffer> => ipcRenderer.invoke(CANAUX.lireFichier, chemin),
  reglages: {
    lire: (): Promise<Reglages> => ipcRenderer.invoke(CANAUX.reglagesLire),
    ecrire: (r: Reglages): Promise<void> => ipcRenderer.invoke(CANAUX.reglagesEcrire, r),
  },
  coffre: {
    lire: (): Promise<string | null> => ipcRenderer.invoke(CANAUX.coffreLire),
    ecrire: (valeur: string | null): Promise<void> => ipcRenderer.invoke(CANAUX.coffreEcrire, valeur),
  },
  ouvrirExterne: (url: string): Promise<void> => ipcRenderer.invoke(CANAUX.ouvrirExterne, url),
  version: (): Promise<string> => ipcRenderer.invoke(CANAUX.version),
};

export type Bureau = typeof bureau;

contextBridge.exposeInMainWorld("bureau", bureau);
