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
  miseAJour: {
    /** Télécharge l'installeur puis le lance ; le logiciel se ferme pour lui laisser la place. */
    installer: (url: string): Promise<void> => ipcRenderer.invoke(CANAUX.installerMiseAJour, url),
    /** Avancement du téléchargement, en pour cent ; rend de quoi se désabonner. */
    surProgression: (rappel: (pourcent: number) => void) => {
      const ecouteur = (_e: unknown, p: number) => rappel(p);
      ipcRenderer.on(CANAUX.progressionMiseAJour, ecouteur);
      return () => void ipcRenderer.removeListener(CANAUX.progressionMiseAJour, ecouteur);
    },
  },
};

export type Bureau = typeof bureau;

contextBridge.exposeInMainWorld("bureau", bureau);
