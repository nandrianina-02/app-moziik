import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ErreurApi } from "./api";
import { televerser } from "./envoi";
import { decoder, decouper, encoderVersions, type Qualite } from "./encodage";
import { preferences } from "./preferences";
import { annoncer } from "./interactions";
import { chercherArtistes, type ArtisteOption } from "./artistes";
import { LANGUE_PAR_DEFAUT, genreCorrespondant, isrcNormalise, langueCorrespondante, memeNom, separerFeaturing, tagsPropres, tonaliteCourte } from "./metadonnees";
import type { Etiquettes, FichierAudio, PochetteLue } from "../../partage/types";

export type { ArtisteOption } from "./artistes";

/*
 * Les téléversements, hors de l'écran qui les montre : la lecture des
 * fichiers, le rapprochement et l'envoi vivent ici, au niveau de la
 * coquille, et continuent quand on passe sur une autre page. L'écran
 * Téléversements n'en est qu'une vue ; en y revenant, on retrouve
 * l'avancement où il en est.
 *
 * Chaque ligne porte tous les champs du formulaire de publication du site
 * (app/son/nouveau/page.tsx), remplis depuis les balises comme le fait son
 * remplissage automatique. Les mêmes routes que le site (inspect,
 * fichiers/envoi, songs) : rien n'entre au catalogue par une autre porte.
 */

export type Statut = "lecture" | "inspection" | "pret" | "incomplet" | "doublon" | "envoi" | "termine" | "erreur";

export interface Decoupe {
  /** Secondes depuis le début du fichier ; null : depuis le début. */
  debut: number | null;
  /** Secondes depuis le début du fichier ; null : jusqu'à la fin. */
  fin: number | null;
}

export interface Ligne {
  id: string;
  fichier: FichierAudio;
  etiquettes: Etiquettes | null;
  statut: Statut;
  erreur?: string;
  titre: string;
  /** Le titre sans « (feat. X) », appliqué une fois les invités rattachés à un profil. */
  titreSansMention?: string | null;
  artisteNom: string;
  artiste: ArtisteOption | null;
  featuring: ArtisteOption[];
  /** Invités lus dans le fichier mais sans profil retrouvé : à rattacher ou créer. */
  invitesNonTrouves: string[];
  album: string;
  genre: string;
  langue: string;
  /** AAAA-MM-JJ ; vide : publié maintenant. Une date future programme la sortie. */
  dateSortie: string;
  /** Enregistrer comme brouillon : le titre attend la validation au lieu de paraître. */
  brouillon: boolean;
  explicite: boolean;
  description: string;
  tags: string[];
  paroles: string;
  compositeur: string;
  producteur: string;
  copyright: string;
  isrc: string;
  tonalite: string;
  bpm: string;
  bpmSource?: "manuel" | "balise" | "analyse";
  /** Une image choisie ou glissée : elle remplace celle du fichier. */
  pochette: PochetteLue | null;
  /** Clip vidéo facultatif, envoyé avec le titre. */
  video: FichierAudio | null;
  decoupe: Decoupe;
  doublon: { title: string; artistName: string; certain: boolean } | null;
  importerQuandMeme: boolean;
  progression: number;
  /** Ce que fait l'envoi en ce moment : source, encodage, qualités, publication. */
  etape?: string;
  /** Publié, mais avec une réserve (sans album, sans qualités d'écoute). */
  note?: string;
  songId?: string;
}

const TYPES_AUDIO: [RegExp, string][] = [
  [/\.(m4a|aac)$/i, "audio/mp4"],
  [/\.flac$/i, "audio/flac"],
  [/\.wav$/i, "audio/wav"],
  [/\.(ogg|opus)$/i, "audio/ogg"],
];
const typeAudio = (nom: string) => TYPES_AUDIO.find(([re]) => re.test(nom))?.[1] ?? "audio/mpeg";

const TYPES_VIDEO: [RegExp, string][] = [
  [/\.mov$/i, "video/quicktime"],
  [/\.webm$/i, "video/webm"],
  [/\.m4v$/i, "video/x-m4v"],
];
export const typeVideo = (nom: string) => TYPES_VIDEO.find(([re]) => re.test(nom))?.[1] ?? "video/mp4";

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

// Le genre d'un fichier sans balise utilisable : réglable dans les Paramètres.
const genreParDefaut = () => preferences().genreDefaut || "Afrobeat";

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

/** La pochette qui partira : celle choisie, sinon celle du fichier. */
export const pochetteDe = (l: Ligne): PochetteLue | null => l.pochette ?? l.etiquettes?.pochette ?? null;

/** Ce qui manque encore pour publier, dans les mots de la fiche. */
export function manques(l: Ligne): string[] {
  const m: string[] = [];
  if (!l.titre.trim()) m.push("le titre");
  if (!l.artiste) m.push("l'artiste");
  if (!l.genre) m.push("le genre");
  if (!pochetteDe(l) && !l.artiste?.coverUrl) m.push("une pochette");
  if (!l.etiquettes?.duree) m.push("la durée du fichier");
  const { debut, fin } = l.decoupe;
  if (debut !== null && fin !== null && fin - debut < 1) m.push("une découpe d'au moins une seconde");
  return m;
}

const complet = (l: Ligne): Statut => {
  if (l.doublon && l.doublon.certain && !l.importerQuandMeme) return "doublon";
  return manques(l).length === 0 ? "pret" : "incomplet";
};
const recalculer = (l: Ligne): Ligne => (["pret", "incomplet", "doublon"].includes(l.statut) ? { ...l, statut: complet(l) } : l);

/** La date de sortie envoyée au site : minuit à Antananarivo, comme le formulaire du site par défaut. */
export function dateDeSortieIso(l: Pick<Ligne, "dateSortie">): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(l.dateSortie) ? `${l.dateSortie}T00:00:00+03:00` : new Date().toISOString();
}

/** Les albums d'un artiste, pour le choix dans la fiche et le rapprochement à l'envoi. */
export async function albumsDe(artisteId: string): Promise<{ _id: string; title: string; type?: string }[]> {
  try {
    const { albums } = await api<{ albums: { _id: string; title: string; type?: string }[] }>(`/api/albums?artist=${artisteId}`);
    return albums ?? [];
  } catch {
    return [];
  }
}

async function albumExistant(artisteId: string, titre: string): Promise<string | null> {
  if (!titre.trim()) return null;
  const cle = (s: string) => s.trim().toLowerCase();
  return (await albumsDe(artisteId)).find((a) => cle(a.title) === cle(titre))?._id ?? null;
}

/** Une ligne neuve, remplie depuis les balises comme le remplissage automatique du site. */
function ligneDepuisBalises(f: FichierAudio, e: Etiquettes, genres: string[]): Ligne {
  const duNom = titreDuNom(f.nom);
  const titre = (e.titre && !/ - /.test(e.titre) ? e.titre : duNom.titre).trim();
  const artisteNom = (duNom.artiste ?? e.artiste ?? "").trim();
  const invites = separerFeaturing(titre, e.artistes, artisteNom);
  // Un commentaire de téléchargement (« Downloaded from… », une adresse) n'est pas une description.
  const description = e.description && !/https?:\/\/|www\.|\.com\b/i.test(e.description) ? e.description.slice(0, 1000) : "";
  return {
    ...ligneVide(f),
    etiquettes: e,
    statut: "inspection",
    titre,
    titreSansMention: invites.titreSansMention,
    artisteNom,
    invitesNonTrouves: invites.noms,
    album: e.album ?? "",
    genre: genreCorrespondant(e.genre, genres) ?? genreParDefaut(),
    langue: langueCorrespondante(e.langue) ?? LANGUE_PAR_DEFAUT,
    dateSortie: e.dateSortie ?? (e.annee ? `${e.annee}-01-01` : ""),
    explicite: e.explicite ?? false,
    description,
    tags: tagsPropres([...(e.genresSecondaires ?? []), ...(e.motsCles ?? [])]),
    paroles: (e.paroles ?? "").slice(0, 20000),
    compositeur: e.compositeur ?? "",
    producteur: e.producteur ?? "",
    copyright: e.copyright ?? "",
    isrc: isrcNormalise(e.isrc) ?? "",
    tonalite: tonaliteCourte(e.tonalite) ?? "",
    bpm: e.bpm ? String(e.bpm) : "",
    bpmSource: e.bpm ? "balise" : undefined,
  };
}

function ligneVide(f: FichierAudio): Ligne {
  return {
    id: f.chemin,
    fichier: f,
    etiquettes: null,
    statut: "lecture",
    titre: "",
    artisteNom: "",
    artiste: null,
    featuring: [],
    invitesNonTrouves: [],
    album: "",
    genre: genreParDefaut(),
    langue: LANGUE_PAR_DEFAUT,
    dateSortie: "",
    brouillon: false,
    explicite: false,
    description: "",
    tags: [],
    paroles: "",
    compositeur: "",
    producteur: "",
    copyright: "",
    isrc: "",
    tonalite: "",
    bpm: "",
    pochette: null,
    video: null,
    decoupe: { debut: null, fin: null },
    doublon: null,
    importerQuandMeme: false,
    progression: 0,
  };
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
  /** Étape du fichier en cours : source, encodage, qualités, publication. */
  etape?: string;
}

interface Televersements {
  dossier: string | null;
  lignes: Ligne[];
  genres: string[];
  /** Fonctions d'IA ouvertes sur le site (SiteConfig.aiFeatures) : « publication » permet les suggestions. */
  fonctionsIA: string[];
  phase: Phase;
  erreur: string | null;
  avancement: Avancement;
  /** Ajoute le contenu d'un dossier. */
  choisir: () => Promise<void>;
  /** Ajoute des fichiers choisis un à un. */
  choisirFichiers: () => Promise<void>;
  /** Ajoute des fichiers et dossiers glissés (chemins sur le disque). */
  deposer: (chemins: string[]) => Promise<void>;
  envoyerTout: () => Promise<void>;
  arreter: () => void;
  modifier: (id: string, patch: Partial<Ligne>) => void;
  /** La même correction sur plusieurs lignes (modification groupée). */
  modifierPlusieurs: (ids: string[], patch: Partial<Ligne> | ((l: Ligne) => Partial<Ligne>)) => void;
  /** Retire des lignes de la liste (rien n'est supprimé du disque ni du site). */
  retirer: (ids: string[]) => void;
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
  const [fonctionsIA, setFonctionsIA] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("repos");
  // Lue par `ajouter`, qui peut être appelé depuis un dépôt sans être recréé à chaque phase.
  const phaseRef = useRef<Phase>("repos");
  phaseRef.current = phase;
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
    api<{ genres?: string[]; aiFeatures?: string[] }>("/api/site-config")
      .then((c) => {
        setGenres(c.genres ?? []);
        setFonctionsIA(c.aiFeatures ?? []);
      })
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

  const modifierPlusieurs = useCallback(
    (ids: string[], patch: Partial<Ligne> | ((l: Ligne) => Partial<Ligne>)) =>
      setLignes((liste) => liste.map((l) => (ids.includes(l.id) && l.statut !== "envoi" && l.statut !== "termine" ? recalculer({ ...l, ...(typeof patch === "function" ? patch(l) : patch) }) : l))),
    [setLignes],
  );

  /**
   * Les invités lus dans le fichier, rattachés à leur profil quand le nom
   * correspond exactement (comme le site). Tous retrouvés : la mention
   * « (feat. X) » quitte le titre ; sinon elle reste, l'information n'est
   * pas perdue.
   */
  const rattacherInvites = useCallback(async (l: Ligne): Promise<Partial<Ligne>> => {
    const trouves: ArtisteOption[] = [];
    const restants: string[] = [];
    for (const nom of l.invitesNonTrouves) {
      const profil = (await chercherArtistes(nom)).find((a) => memeNom(a.stageName, nom) && a._id !== l.artiste?._id);
      if (profil) trouves.push(profil);
      else restants.push(nom);
    }
    const tous = restants.length === 0 && trouves.length > 0;
    return {
      featuring: [...l.featuring, ...trouves.filter((t) => !l.featuring.some((f) => f._id === t._id))],
      invitesNonTrouves: restants,
      ...(tous && l.titreSansMention ? { titre: l.titreSansMention, titreSansMention: null } : {}),
    };
  }, []);

  /**
   * Ajoute des fichiers à la liste, d'où qu'ils viennent (dossier, choix de
   * fichiers, glisser-déposer) : ceux déjà présents sont ignorés, seuls les
   * nouveaux sont lus et rapprochés. La liste n'est jamais remplacée.
   */
  const ajouter = useCallback(
    async (fichiers: FichierAudio[], origine: string) => {
      if (phaseRef.current !== "repos") {
        setErreur("Un travail est en cours : ajoutez ces fichiers une fois l'envoi terminé.");
        return;
      }
      const presents = new Set(courantes.current.map((l) => l.fichier.chemin));
      const nouveaux = fichiers.filter((f) => !presents.has(f.chemin));
      setErreur(fichiers.length === 0 ? "Aucun fichier audio dans ce qui a été choisi (MP3, M4A, FLAC, WAV, OGG, OPUS, WMA)." : null);
      if (nouveaux.length === 0) {
        if (fichiers.length > 0) annoncer("Ces fichiers sont déjà dans la liste");
        return;
      }
      setDossier(origine);
      setPhase("analyse");
      const initiales = nouveaux.map(ligneVide);
      setLignes((avant) => [...avant, ...initiales]);
      const ignores = fichiers.length - nouveaux.length;
      if (ignores > 0) annoncer(`${ignores} fichier${ignores > 1 ? "s" : ""} déjà dans la liste, ignoré${ignores > 1 ? "s" : ""}`);

      // 1. Les balises, fichier par fichier.
      const lues: Ligne[] = [];
      for (const l of initiales) {
        let ligne: Ligne;
        try {
          ligne = ligneDepuisBalises(l.fichier, await window.bureau.lireEtiquettes(l.fichier.chemin), genres);
        } catch (err) {
          ligne = { ...l, statut: "erreur", erreur: err instanceof Error ? err.message : "Fichier illisible." };
        }
        lues.push(ligne);
        setLignes((liste) => liste.map((x) => (x.id === ligne.id ? ligne : x)));
      }

      // 2. Le rapprochement (artiste, doublon), par lots de cent.
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

      // 3. Les invités, pour les seuls fichiers qui en déclarent.
      for (const l of courantes.current.filter((x) => initiales.some((i) => i.id === x.id) && x.invitesNonTrouves.length > 0)) {
        const patch = await rattacherInvites(l);
        setLignes((liste) => liste.map((x) => (x.id === l.id ? recalculer({ ...x, ...patch }) : x)));
      }
      setPhase("repos");
    },
    [genres, setLignes, rattacherInvites],
  );

  const choisir = useCallback(async () => {
    const choisi = await window.bureau.choisirDossier();
    if (!choisi) return;
    await ajouter(await window.bureau.listerAudio(choisi), choisi);
  }, [ajouter]);

  const choisirFichiers = useCallback(async () => {
    const fichiers = await window.bureau.choisirFichiers();
    if (fichiers.length) await ajouter(fichiers, `${fichiers.length} fichier${fichiers.length > 1 ? "s" : ""} choisi${fichiers.length > 1 ? "s" : ""}`);
  }, [ajouter]);

  /** Fichiers et dossiers glissés dans la fenêtre. */
  const deposer = useCallback(
    async (chemins: string[]) => {
      if (chemins.length === 0) return;
      const fichiers = await window.bureau.resoudreChemins(chemins);
      await ajouter(fichiers, chemins.length === 1 ? chemins[0] : `${chemins.length} éléments glissés`);
    },
    [ajouter],
  );

  /**
   * L'album d'un titre : celui de l'artiste qui porte ce nom, sinon un album
   * créé ici, une seule fois même si dix titres du dossier y appartiennent.
   * Un site trop ancien pour créer l'album d'un artiste (route sans
   * artistId) laisse le titre en single, avec une note.
   */
  const albumsConnus = useRef(new Map<string, string>());
  const albumPour = useCallback(async (l: Ligne, coverUrl: string, releaseDate: string): Promise<{ id: string | null; note?: string }> => {
    const titre = l.album.trim();
    if (!titre) return { id: null };
    const cle = `${l.artiste!._id}|${titre.toLowerCase()}`;
    const connu = albumsConnus.current.get(cle);
    if (connu) return { id: connu };
    const existant = await albumExistant(l.artiste!._id, titre);
    if (existant) {
      albumsConnus.current.set(cle, existant);
      return { id: existant };
    }
    try {
      const { album } = await api<{ album: { _id: string } }>("/api/albums", {
        corps: { title: titre, coverUrl, type: "album", releaseDate, artistId: l.artiste!._id },
      });
      albumsConnus.current.set(cle, album._id);
      return { id: album._id };
    } catch (err) {
      return { id: null, note: `Publié sans album : ${err instanceof Error ? err.message : "création refusée"}.` };
    }
  }, []);

  const envoyerLigne = useCallback(
    async (l: Ligne) => {
      modifier(l.id, { statut: "envoi", progression: 0, etape: "Pochette", note: undefined, erreur: undefined });
      try {
        const e = l.etiquettes!;
        const nom = `${l.artiste!.stageName} - ${l.titre}`;
        // La pochette : celle choisie, sinon celle du fichier, sinon la photo de l'artiste.
        let coverUrl = l.artiste!.coverUrl ?? "";
        const image = pochetteDe(l);
        if (image) {
          const octets = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0));
          const ext = image.mime.includes("png") ? "png" : image.mime.includes("webp") ? "webp" : "jpg";
          const id = await televerser(new Blob([octets], { type: image.mime }), `${nom}.${ext}`, image.mime, "covers", undefined, () => undefined);
          coverUrl = `/media/${id}`;
        }

        // La source, telle quelle et entière : c'est d'elle que le site
        // repart pour refaire les qualités ou changer la découpe.
        const qualites = preferences().qualites;
        const partSource = qualites ? 30 : 90;
        modifier(l.id, { etape: "Source" });
        const brut = await window.bureau.lireFichier(l.fichier.chemin);
        const type = typeAudio(l.fichier.nom);
        const ext = type === "audio/mpeg" ? "mp3" : l.fichier.nom.slice(l.fichier.nom.lastIndexOf(".") + 1).toLowerCase();
        const source = new Blob([brut], { type });
        const sourceId = await televerser(source, `${nom}.${ext}`, type, "songs", e.duree ?? undefined, (p) => modifier(l.id, { progression: Math.round((p * partSource) / 100) }));

        // Les trois qualités d'écoute, découpe appliquée. Un format que le
        // moteur ne sait pas décoder n'empêche pas la publication : le site
        // lit alors la source.
        let audioVariantes: Record<Qualite, string> | undefined;
        const notes: string[] = [];
        if (qualites) {
          try {
            modifier(l.id, { etape: "Encodage", progression: partSource });
            const canaux = decouper(await decoder(source), l.decoupe.debut, l.decoupe.fin);
            const versions = await encoderVersions(canaux, (v) => modifier(l.id, { progression: partSource + Math.round(v * 30) }));
            modifier(l.id, { etape: "Qualités" });
            const tailles = Object.values(versions).reduce((s, b) => s + b.size, 0);
            let envoye = 0;
            const ids = {} as Record<Qualite, string>;
            for (const [qualite, blob] of Object.entries(versions) as [Qualite, Blob][]) {
              ids[qualite] = await televerser(blob, `${nom}-${qualite}.mp3`, "audio/mpeg", "songs", e.duree ?? undefined, (p) =>
                modifier(l.id, { progression: partSource + 30 + Math.round(((envoye + (blob.size * p) / 100) / tailles) * 25) }),
              );
              envoye += blob.size;
            }
            audioVariantes = ids;
          } catch (err) {
            notes.push(`Publié sans qualités d'écoute : ${err instanceof Error ? err.message : "encodage impossible"}.`);
          }
        }

        // Le clip, après l'audio comme sur le site.
        let videoUrl: string | undefined;
        if (l.video) {
          modifier(l.id, { etape: "Clip", progression: 86 });
          const octetsVideo = await window.bureau.lireFichier(l.video.chemin);
          const typeClip = typeVideo(l.video.nom);
          const idVideo = await televerser(new Blob([octetsVideo], { type: typeClip }), l.video.nom, typeClip, "videos", undefined, (p) => modifier(l.id, { progression: 86 + Math.round(p * 0.08) }));
          videoUrl = `/media/${idVideo}`;
        }

        modifier(l.id, { etape: "Publication", progression: 96 });
        const releaseDate = dateDeSortieIso(l);
        const album = await albumPour(l, coverUrl, releaseDate);
        if (album.note) notes.push(album.note);
        const bpm = Number(l.bpm);
        const { song } = await api<{ song: { _id: string } }>("/api/songs", {
          corps: {
            title: l.titre.trim(),
            audioUrl: `ks:${sourceId}`,
            ...(audioVariantes ? { audioVariantes } : {}),
            ...(videoUrl ? { videoUrl } : {}),
            coverUrl,
            duration: e.duree,
            trimStart: l.decoupe.debut,
            trimEnd: l.decoupe.fin,
            genre: l.genre,
            language: l.langue,
            releaseDate,
            saveAsDraft: l.brouillon,
            explicit: l.explicite,
            artistId: l.artiste!._id,
            featuringIds: l.featuring.map((f) => f._id).filter((id) => id !== l.artiste!._id),
            ...(album.id ? { albumId: album.id } : {}),
            ...(l.description.trim() ? { description: l.description.trim().slice(0, 1000) } : {}),
            ...(l.tags.length ? { tags: l.tags } : {}),
            ...(l.paroles.trim() ? { lyrics: l.paroles.slice(0, 20000) } : {}),
            ...(l.compositeur.trim() ? { composer: l.compositeur.trim() } : {}),
            ...(l.producteur.trim() ? { producer: l.producteur.trim() } : {}),
            ...(l.copyright.trim() ? { copyright: l.copyright.trim() } : {}),
            ...(l.isrc.trim() ? { isrc: l.isrc.trim() } : {}),
            ...(l.tonalite.trim() ? { musicalKey: l.tonalite.trim() } : {}),
            ...(bpm > 0 ? { bpm: Math.round(bpm), bpmSource: l.bpmSource ?? "manuel" } : {}),
          },
        });
        modifier(l.id, { statut: "termine", progression: 100, etape: undefined, songId: song._id, note: notes.join(" ") || undefined });
      } catch (err) {
        modifier(l.id, { statut: "erreur", etape: undefined, erreur: err instanceof ErreurApi ? err.message : err instanceof Error ? err.message : "Envoi impossible." });
      }
    },
    [modifier, albumPour],
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
    if (preferences().notifications) {
      try {
        new Notification("Téléversement terminé", {
          body: `${publies} titre${publies > 1 ? "s" : ""} publié${publies > 1 ? "s" : ""}${echecs ? `, ${echecs} en erreur` : ""}${arret.current ? " (arrêté)" : ""}.`,
          silent: true,
        });
      } catch {
        // Notifications indisponibles : l'avancement reste visible dans le logiciel.
      }
    }
  }, [envoyerLigne]);

  const arreter = useCallback(() => {
    arret.current = true;
  }, []);

  const retirer = useCallback((ids: string[]) => setLignes((liste) => liste.filter((l) => !ids.includes(l.id) || l.statut === "envoi")), [setLignes]);

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
      etape: enCours?.etape,
    };
  }, [phase, lignes, lot]);

  const valeur = useMemo<Televersements>(
    () => ({ dossier, lignes, genres, fonctionsIA, phase, erreur, avancement, choisir, choisirFichiers, deposer, envoyerTout, arreter, modifier, modifierPlusieurs, retirer, vider }),
    [dossier, lignes, genres, fonctionsIA, phase, erreur, avancement, choisir, choisirFichiers, deposer, envoyerTout, arreter, modifier, modifierPlusieurs, retirer, vider],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}
