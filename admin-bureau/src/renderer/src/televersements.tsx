import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ErreurApi } from "./api";
import { televerser } from "./envoi";
import type { Etiquettes, FichierAudio } from "../../partage/types";

/*
 * Les téléversements, hors de l'écran qui les montre : la lecture d'un
 * dossier, le rapprochement et l'envoi vivent ici, au niveau de la coquille,
 * et continuent quand on passe sur une autre page. L'écran Téléversements
 * n'en est qu'une vue ; en y revenant, on retrouve l'avancement où il en est.
 *
 * Les mêmes routes que l'import du site (inspect, fichiers/envoi, songs) :
 * rien n'entre au catalogue par une autre porte.
 */

export type Statut = "lecture" | "inspection" | "pret" | "incomplet" | "doublon" | "envoi" | "termine" | "erreur";

export interface ArtisteOption {
  _id: string;
  stageName: string;
  verified?: boolean;
  coverUrl?: string | null;
}

export interface Ligne {
  id: string;
  fichier: FichierAudio;
  etiquettes: Etiquettes | null;
  statut: Statut;
  erreur?: string;
  titre: string;
  artisteNom: string;
  artiste: ArtisteOption | null;
  album: string;
  genre: string;
  annee: string;
  doublon: { title: string; artistName: string; certain: boolean } | null;
  importerQuandMeme: boolean;
  progression: number;
  songId?: string;
}

export type Phase = "repos" | "analyse" | "envoi";

export const STATUTS: Record<Statut, { libelle: string; ton: "neutre" | "succes" | "attention" | "danger" | "accent" }> = {
  lecture: { libelle: "Lecture", ton: "neutre" },
  inspection: { libelle: "Rapprochement", ton: "neutre" },
  pret: { libelle: "Prêt", ton: "succes" },
  incomplet: { libelle: "À compléter", ton: "attention" },
  doublon: { libelle: "Doublon", ton: "attention" },
  envoi: { libelle: "Envoi", ton: "accent" },
  termine: { libelle: "Publié", ton: "succes" },
  erreur: { libelle: "Erreur", ton: "danger" },
};

const GENRE_PAR_DEFAUT = "Afrobeat";

/** Le titre d'après le nom du fichier quand la balise manque : « Artiste - Titre (Clip officiel).mp3 ». */
function titreDuNom(nom: string): { artiste: string | null; titre: string } {
  const base = nom
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\((MP3|M4A)_\d+K\)(_\d+)?$/i, "")
    .replace(/\((?:[^()]*)\)|\[(?:[^\][]*)\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = /^(.*?)\s+-\s+(.*)$/.exec(base);
  return m ? { artiste: m[1].trim(), titre: m[2].trim() } : { artiste: null, titre: base };
}

const complet = (l: Ligne): Statut => {
  if (l.doublon && l.doublon.certain && !l.importerQuandMeme) return "doublon";
  return l.titre.trim() && l.artiste && l.genre && (l.etiquettes?.pochette || l.artiste.coverUrl) && l.etiquettes?.duree ? "pret" : "incomplet";
};
const recalculer = (l: Ligne): Ligne => (["pret", "incomplet", "doublon"].includes(l.statut) ? { ...l, statut: complet(l) } : l);

async function albumExistant(artisteId: string, titre: string): Promise<string | null> {
  if (!titre.trim()) return null;
  try {
    const { albums } = await api<{ albums: { _id: string; title: string }[] }>(`/api/albums?artist=${artisteId}`);
    const cle = (s: string) => s.trim().toLowerCase();
    return albums.find((a) => cle(a.title) === cle(titre))?._id ?? null;
  } catch {
    return null;
  }
}

/** L'avancement en un coup d'œil, pour la barre latérale et l'en-tête. */
export interface Avancement {
  phase: Phase;
  /** Titres traités dans l'envoi en cours (publiés ou en erreur). */
  faits: number;
  /** Titres que l'envoi en cours doit traiter. */
  aFaire: number;
  /** Progression du fichier en cours d'envoi, en pour cent. */
  enCours: number;
  /** Titre du fichier en cours d'envoi. */
  titreEnCours: string | null;
}

interface Televersements {
  dossier: string | null;
  lignes: Ligne[];
  genres: string[];
  phase: Phase;
  erreur: string | null;
  avancement: Avancement;
  choisir: () => Promise<void>;
  envoyerTout: () => Promise<void>;
  arreter: () => void;
  modifier: (id: string, patch: Partial<Ligne>) => void;
  vider: () => void;
}

const Contexte = createContext<Televersements | null>(null);

export function useTeleversements(): Televersements {
  const t = useContext(Contexte);
  if (!t) throw new Error("useTeleversements hors du FournisseurTeleversements");
  return t;
}

export function FournisseurTeleversements({ children }: { children: ReactNode }) {
  const [dossier, setDossier] = useState<string | null>(null);
  const [lignes, setLignesEtat] = useState<Ligne[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("repos");
  const [erreur, setErreur] = useState<string | null>(null);
  const [lot, setLot] = useState<string[]>([]);
  const arret = useRef(false);
  // La boucle d'envoi tourne longtemps : elle lit la liste à jour ici,
  // pas celle capturée au moment où elle a démarré.
  const courantes = useRef<Ligne[]>([]);

  const setLignes = useCallback((f: (l: Ligne[]) => Ligne[]) => {
    setLignesEtat((avant) => {
      const apres = f(avant);
      courantes.current = apres;
      return apres;
    });
  }, []);

  useEffect(() => {
    api<{ genres?: string[] }>("/api/site-config")
      .then((c) => setGenres(c.genres ?? []))
      .catch(() => undefined);
  }, []);

  // Fermer la fenêtre pendant un envoi le couperait : le processus principal
  // demande alors confirmation (voir will-prevent-unload).
  useEffect(() => {
    if (phase === "repos") return;
    const retenir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", retenir);
    return () => window.removeEventListener("beforeunload", retenir);
  }, [phase]);

  const modifier = useCallback((id: string, patch: Partial<Ligne>) => setLignes((liste) => liste.map((l) => (l.id === id ? recalculer({ ...l, ...patch }) : l))), [setLignes]);

  const choisir = useCallback(async () => {
    const choisi = await window.bureau.choisirDossier();
    if (!choisi) return;
    setDossier(choisi);
    setErreur(null);
    setLot([]);
    setPhase("analyse");
    const fichiers = await window.bureau.listerAudio(choisi);
    const initiales: Ligne[] = fichiers.map((f, i) => ({
      id: `${i}-${f.chemin}`,
      fichier: f,
      etiquettes: null,
      statut: "lecture",
      titre: "",
      artisteNom: "",
      artiste: null,
      album: "",
      genre: GENRE_PAR_DEFAUT,
      annee: "",
      doublon: null,
      importerQuandMeme: false,
      progression: 0,
    }));
    setLignes(() => initiales);
    // 1. Les balises, fichier par fichier.
    const lues: Ligne[] = [];
    for (const l of initiales) {
      let ligne: Ligne;
      try {
        const e = await window.bureau.lireEtiquettes(l.fichier.chemin);
        const duNom = titreDuNom(l.fichier.nom);
        ligne = {
          ...l,
          etiquettes: e,
          titre: (e.titre && !/ - /.test(e.titre) ? e.titre : duNom.titre).trim(),
          artisteNom: (duNom.artiste ?? e.artiste ?? "").trim(),
          album: e.album ?? "",
          annee: e.annee ? String(e.annee) : "",
          genre: e.genre && genres.includes(e.genre) ? e.genre : GENRE_PAR_DEFAUT,
          statut: "inspection",
        };
      } catch (err) {
        ligne = { ...l, statut: "erreur", erreur: err instanceof Error ? err.message : "Fichier illisible." };
      }
      lues.push(ligne);
      setLignes((liste) => liste.map((x) => (x.id === ligne.id ? ligne : x)));
    }
    // 2. Le rapprochement, par lots de cent.
    const aInspecter = lues.filter((l) => l.statut === "inspection");
    for (let i = 0; i < aInspecter.length; i += 100) {
      const tranche = aInspecter.slice(i, i + 100);
      try {
        const { resultats } = await api<{ resultats: { artiste: ArtisteOption | null; doublon: Ligne["doublon"] }[] }>("/api/import/inspect", {
          corps: { items: tranche.map((l) => ({ titre: l.titre || l.fichier.nom, artiste: l.artisteNom || undefined })) },
        });
        setLignes((liste) =>
          liste.map((l) => {
            const k = tranche.findIndex((x) => x.id === l.id);
            if (k < 0) return l;
            const r = resultats[k];
            const avec: Ligne = { ...l, artiste: r.artiste, doublon: r.doublon, statut: "pret" };
            return { ...avec, statut: complet(avec) };
          }),
        );
      } catch (err) {
        setErreur(err instanceof Error ? err.message : "Le rapprochement a échoué.");
        setLignes((liste) => liste.map((l) => (tranche.some((x) => x.id === l.id) ? { ...l, statut: complet(l) } : l)));
      }
    }
    setPhase("repos");
  }, [genres, setLignes]);

  const envoyerLigne = useCallback(
    async (l: Ligne) => {
      modifier(l.id, { statut: "envoi", progression: 0 });
      try {
        const e = l.etiquettes!;
        // La pochette : celle du fichier, sinon la photo de l'artiste.
        let coverUrl = l.artiste!.coverUrl ?? "";
        if (e.pochette) {
          const octets = Uint8Array.from(atob(e.pochette.base64), (c) => c.charCodeAt(0));
          const id = await televerser(new Blob([octets], { type: e.pochette.mime }), `${l.artiste!.stageName} - ${l.titre}.${e.pochette.mime.includes("png") ? "png" : "jpg"}`, e.pochette.mime, "covers", undefined, () => undefined);
          coverUrl = `/media/${id}`;
        }
        const audio = await window.bureau.lireFichier(l.fichier.chemin);
        const type = /\.m4a$|\.aac$/i.test(l.fichier.nom) ? "audio/mp4" : /\.flac$/i.test(l.fichier.nom) ? "audio/flac" : /\.wav$/i.test(l.fichier.nom) ? "audio/wav" : /\.ogg$|\.opus$/i.test(l.fichier.nom) ? "audio/ogg" : "audio/mpeg";
        const ext = type === "audio/mpeg" ? "mp3" : l.fichier.nom.slice(l.fichier.nom.lastIndexOf(".") + 1).toLowerCase();
        const fichierId = await televerser(new Blob([audio], { type }), `${l.artiste!.stageName} - ${l.titre}.${ext}`, type, "songs", e.duree ?? undefined, (p) => modifier(l.id, { progression: p }));
        const albumId = await albumExistant(l.artiste!._id, l.album);
        const annee = Number(l.annee);
        const releaseDate = annee >= 1950 && annee <= new Date().getFullYear() + 1 ? `${annee}-01-01T00:00:00+03:00` : new Date().toISOString();
        const { song } = await api<{ song: { _id: string } }>("/api/songs", {
          corps: {
            title: l.titre.trim(),
            audioUrl: `ks:${fichierId}`,
            coverUrl,
            duration: e.duree,
            genre: l.genre,
            releaseDate,
            artistId: l.artiste!._id,
            featuringIds: [],
            ...(albumId ? { albumId } : {}),
            ...(e.compositeur ? { composer: e.compositeur } : {}),
            ...(e.bpm ? { bpm: e.bpm, bpmSource: "balise" } : {}),
          },
        });
        modifier(l.id, { statut: "termine", progression: 100, songId: song._id });
      } catch (err) {
        modifier(l.id, { statut: "erreur", erreur: err instanceof ErreurApi ? err.message : err instanceof Error ? err.message : "Envoi impossible." });
      }
    },
    [modifier],
  );

  const envoyerTout = useCallback(async () => {
    arret.current = false;
    const ids = courantes.current.filter((l) => l.statut === "pret").map((l) => l.id);
    if (ids.length === 0) return;
    setLot(ids);
    setPhase("envoi");
    setErreur(null);
    for (const id of ids) {
      if (arret.current) break;
      const l = courantes.current.find((x) => x.id === id);
      if (!l || l.statut !== "pret") continue;
      await envoyerLigne(l);
    }
    setPhase("repos");
    const lotFinal = courantes.current.filter((l) => ids.includes(l.id));
    const publies = lotFinal.filter((l) => l.statut === "termine").length;
    const echecs = lotFinal.filter((l) => l.statut === "erreur").length;
    // Prévenir qui travaille ailleurs : sur une autre page, ou dans une autre application.
    try {
      new Notification("Téléversement terminé", {
        body: `${publies} titre${publies > 1 ? "s" : ""} publié${publies > 1 ? "s" : ""}${echecs ? `, ${echecs} en erreur` : ""}${arret.current ? " (arrêté)" : ""}.`,
        silent: true,
      });
    } catch {
      // Notifications indisponibles : l'avancement reste visible dans le logiciel.
    }
  }, [envoyerLigne]);

  const arreter = useCallback(() => {
    arret.current = true;
  }, []);

  const vider = useCallback(() => {
    if (phase !== "repos") return;
    setDossier(null);
    setLot([]);
    setErreur(null);
    setLignes(() => []);
  }, [phase, setLignes]);

  const avancement = useMemo<Avancement>(() => {
    if (phase === "analyse") {
      const lues = lignes.filter((l) => l.statut !== "lecture").length;
      return { phase, faits: lues, aFaire: lignes.length, enCours: 0, titreEnCours: null };
    }
    const duLot = lignes.filter((l) => lot.includes(l.id));
    const enCours = duLot.find((l) => l.statut === "envoi");
    return {
      phase,
      faits: duLot.filter((l) => l.statut === "termine" || l.statut === "erreur").length,
      aFaire: duLot.length,
      enCours: enCours?.progression ?? 0,
      titreEnCours: enCours ? enCours.titre || enCours.fichier.nom : null,
    };
  }, [phase, lignes, lot]);

  const valeur = useMemo<Televersements>(
    () => ({ dossier, lignes, genres, phase, erreur, avancement, choisir, envoyerTout, arreter, modifier, vider }),
    [dossier, lignes, genres, phase, erreur, avancement, choisir, envoyerTout, arreter, modifier, vider],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}
