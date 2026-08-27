"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Controller, useForm } from "react-hook-form";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Clock3,
  FileText,
  Globe2,
  Hash,
  Info,
  Loader2,
  Rocket,
  Save,
  ShieldAlert,
  Sparkles,
  Tag as TagIcon,
  Timer,
  Users2,
  LucideIcon,
} from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { Switch } from "@/components/ui/Switch";
import { TagInput } from "@/components/ui/TagInput";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CoverDropzone } from "@/components/song/CoverDropzone";
import { AudioDropzone, formatBytes } from "@/components/song/AudioDropzone";
import { SongPreviewSidebar, type ChecklistItem } from "@/components/song/SongPreviewSidebar";
import { FeaturingPicker } from "@/components/modals/FeaturingPicker";
import { ArtistSinglePicker } from "@/components/modals/ArtistSinglePicker";
import { MetadataAutofill, type ChampDetecte, type RapportMetadonnees } from "@/components/song/MetadataAutofill";
import { DuplicateWarning, type DoublonTitre } from "@/components/song/DuplicateWarning";
import { SongAiAssist } from "@/components/song/SongAiAssist";
import {
  libererPochette,
  lireMetadonneesAudio,
  titreDepuisNomDeFichier,
  type MetadonneesAudio,
} from "@/lib/audioMetadata";
import {
  albumCorrespondant,
  genreCorrespondant,
  isrcNormalise,
  langueCorrespondante,
  memeNom,
  separerFeaturing,
  tonaliteCourte,
} from "@/lib/metadataMapping";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { readApiError } from "@/lib/readApiError";
import { useToast } from "@/context/ToastProvider";
import { useSiteConfig, useIADisponible } from "@/context/SiteConfigProvider";

// Constantes, helpers et SectionCard identiques à app/son/[id]/modifier —
// c'est la même expérience de saisie, seule la persistance change
// (POST /api/songs au lieu de PATCH /api/songs/[id]).
const LANGUAGES = ["Malagasy", "Français", "Anglais", "Autre"];
const TIMEZONES = [
  { value: "+03:00", label: "(GMT+03:00) Antananarivo" },
  { value: "+00:00", label: "(GMT+00:00) UTC" },
  { value: "+01:00", label: "(GMT+01:00) Paris" },
  { value: "-05:00", label: "(GMT-05:00) New York" },
];

type ArtistOption = { _id: string; stageName: string; verified?: boolean };
type OwnAlbum = { _id: string; title: string; type: string };

type FormValues = {
  title: string;
  genre: string;
  albumId: string;
  language: string;
  composer: string;
  producer: string;
  lyrics: string;
  description: string;
  bpm: string;
  musicalKey: string;
  isrc: string;
  copyright: string;
  explicit: boolean;
  releaseMode: "now" | "schedule";
  releaseDateInput: string;
  releaseTimeInput: string;
  timezone: string;
};

function buildReleaseISO(dateStr: string, timeStr: string, tz: string): string | null {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
  const negative = tz.startsWith("-");
  const [tzH, tzM] = tz.replace("+", "").replace("-", "").split(":").map(Number);
  const offsetMinutes = (negative ? -1 : 1) * (tzH * 60 + tzM);
  const utcMillis = Date.UTC(y, m - 1, d, hh, mm) - offsetMinutes * 60000;
  return new Date(utcMillis).toISOString();
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl2 border border-border bg-surface p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-2">
        <Icon size={15} className="text-ink-muted" />
        <div>
          <h2 className="text-sm font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function NewSongPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const siteConfig = useSiteConfig();
  // useMemo, et pas un simple ternaire : le tableau serait recréé à chaque
  // rendu et ferait changer l'identité des rappels qui en dépendent.
  const GENRES = useMemo(() => (siteConfig.genres.length > 0 ? siteConfig.genres : ["Autre"]), [siteConfig.genres]);
  const pushToast = useToast();
  const isAdmin = session?.user?.role === "admin";

  const [ownArtist, setOwnArtist] = useState<ArtistOption | null>(null);
  const [artistLoading, setArtistLoading] = useState(true);
  const [featuring, setFeaturing] = useState<ArtistOption[]>([]);
  const [targetArtist, setTargetArtist] = useState<ArtistOption | null>(null);
  const [albums, setAlbums] = useState<OwnAlbum[]>([]);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [pendingDuration, setPendingDuration] = useState<number | null>(null);

  const [tags, setTags] = useState<string[]>([]);
  const [extraTouched, setExtraTouched] = useState(false);
  const iaPublication = useIADisponible("publication");

  // Lecture automatique des balises du fichier audio.
  const [rapport, setRapport] = useState<RapportMetadonnees | null>(null);
  const metaRef = useRef<MetadonneesAudio | null>(null);
  /** Photographie du formulaire juste avant le remplissage, pour l'annuler. */
  const avantRemplissageRef = useRef<{
    valeurs: FormValues;
    tags: string[];
    featuring: ArtistOption[];
    cover: File | null;
    artiste: ArtistOption | null;
  } | null>(null);

  /** Titre identique deja au catalogue de l'artiste vise, le cas echeant. */
  const [doublon, setDoublon] = useState<DoublonTitre | null>(null);

  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: "",
      genre: GENRES[0],
      albumId: "",
      language: LANGUAGES[0],
      composer: "",
      producer: "",
      lyrics: "",
      description: "",
      bpm: "",
      musicalKey: "",
      isrc: "",
      copyright: "",
      explicit: false,
      releaseMode: "now",
      releaseDateInput: "",
      releaseTimeInput: "",
      timezone: TIMEZONES[0].value,
    },
  });

  const releaseMode = watch("releaseMode");
  const watchedTitle = watch("title");
  const watchedGenre = watch("genre");
  const watchedLanguage = watch("language");
  const watchedDescription = watch("description");

  // Profil artiste du visiteur : pour un artiste, c'est automatiquement
  // lui-même (pas de choix) ; un admin doit choisir via ArtistSinglePicker.
  useEffect(() => {
    if (status !== "authenticated") return;
    if (isAdmin) {
      setArtistLoading(false);
      return;
    }
    fetch("/api/artist/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setOwnArtist(data?.artist ?? null);
        setTargetArtist(data?.artist ?? null);
      })
      .catch(() => {})
      .finally(() => setArtistLoading(false));
  }, [status, isAdmin]);

  useEffect(() => {
    const artistId = targetArtist?._id;
    if (!artistId) {
      setAlbums([]);
      return;
    }
    fetch(`/api/albums?artist=${artistId}`)
      .then((res) => (res.ok ? res.json() : { albums: [] }))
      .then((data) => setAlbums(data.albums ?? []))
      .catch(() => setAlbums([]));
  }, [targetArtist?._id]);

  /**
   * Le titre saisi existe-t-il deja chez cet artiste ?
   *
   * Interroge le serveur avec un temps mort : le champ se remplit lettre
   * par lettre, et une requete par frappe interrogerait la base des
   * dizaines de fois pour un seul titre. La requete precedente est
   * annulee, sans quoi deux reponses en vol pourraient arriver dans le
   * desordre et afficher un avertissement perime.
   */
  useEffect(() => {
    const titre = watchedTitle?.trim();
    const artistId = targetArtist?._id;
    if (!titre || titre.length < 2 || !artistId) {
      setDoublon(null);
      return;
    }
    const controleur = new AbortController();
    const minuteur = setTimeout(() => {
      fetch(`/api/songs/duplicate?title=${encodeURIComponent(titre)}&artistId=${artistId}`, {
        signal: controleur.signal,
      })
        .then((res) => (res.ok ? res.json() : { doublon: null }))
        .then((data) => setDoublon(data.doublon ?? null))
        // Annulation ou coupure reseau : pas d'avertissement, et surtout
        // pas d'erreur affichee. L'absence de verification ne doit jamais
        // empecher de publier.
        .catch(() => {});
    }, 450);
    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, [watchedTitle, targetArtist?._id]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  useEffect(() => {
    if (!audioFile) {
      setAudioPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioFile);
    setAudioPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  /**
   * Profil artiste portant exactement ce nom de scène, ou rien.
   *
   * L'égalité est vérifiée côté client parce que /api/artists cherche par
   * sous-chaîne : « Nao » remonterait « Naomi ». Un rapprochement approximatif
   * attribuerait le morceau au mauvais artiste — mieux vaut ne rien proposer.
   */
  const chercherArtiste = useCallback(async (nom: string): Promise<ArtistOption | null> => {
    try {
      const res = await fetch(`/api/artists?search=${encodeURIComponent(nom)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { artists: ArtistOption[] };
      return data.artists.find((a) => memeNom(a.stageName, nom)) ?? null;
    } catch {
      return null;
    }
  }, []);

  /**
   * Reporte dans le formulaire tout ce que le fichier déclare.
   *
   * Par défaut, un champ déjà rempli n'est pas écrasé : l'artiste qui a
   * commencé à saisir avant de déposer son fichier ne doit pas voir son
   * texte disparaître. Le compte rendu signale ces champs, et le bouton
   * « Écraser mes saisies » rejoue le remplissage sans cette réserve.
   */
  const remplirDepuisMetadonnees = useCallback(
    async (meta: MetadonneesAudio, nomFichier: string, ecraser: boolean) => {
      const valeurs = getValues();
      const champs: ChampDetecte[] = [];
      const vide = (v?: string) => !v || !v.trim();

      const poser = (cle: keyof FormValues, libelle: string, valeur: string | null, dejaRempli: boolean) => {
        if (!valeur) return;
        if (dejaRempli && !ecraser) {
          champs.push({ champ: libelle, valeur, etat: "conserve", note: "champ déjà rempli, non écrasé" });
          return;
        }
        setValue(cle, valeur as never, { shouldDirty: true });
        champs.push({ champ: libelle, valeur, etat: "applique" });
      };

      /* --- Titre et invités.
         « Titre (feat. X) » alimente deux champs distincts ici. On ne retire
         la mention du titre que pour les invités réellement rapprochés à un
         profil : sinon l'information disparaîtrait du formulaire. */
      const titreBrut = meta.titre || titreDepuisNomDeFichier(nomFichier);
      const { titreSansMention, noms } = separerFeaturing(titreBrut, meta.artistes, meta.artiste);

      const invites = (await Promise.all(noms.map(chercherArtiste))).filter(
        (a): a is ArtistOption => !!a && a._id !== targetArtist?._id
      );
      const inconnus = noms.filter((n) => !invites.some((a) => memeNom(a.stageName, n)));

      const titreRetenu = titreSansMention && invites.length > 0 ? titreSansMention : titreBrut;
      poser("title", "Titre", titreRetenu, !vide(valeurs.title));
      if (!meta.titre && champs.length > 0 && champs[champs.length - 1].champ === "Titre") {
        champs[champs.length - 1].note = "déduit du nom du fichier, aucune balise de titre";
      }

      if (invites.length > 0 && (featuring.length === 0 || ecraser)) {
        setFeaturing(invites);
        champs.push({ champ: "Featuring", valeur: invites.map((a) => a.stageName).join(", "), etat: "applique" });
      } else if (invites.length > 0) {
        champs.push({
          champ: "Featuring",
          valeur: invites.map((a) => a.stageName).join(", "),
          etat: "conserve",
          note: "featuring déjà renseigné",
        });
      }
      if (inconnus.length > 0) {
        champs.push({
          champ: "Featuring non rapproché",
          valeur: inconnus.join(", "),
          etat: "sans-correspondance",
          note: "aucun profil artiste à ce nom sur Moziik",
        });
      }

      /* --- Album : rapproché tout de suite si la liste de l'artiste est
         déjà chargée. Pour un artiste elle l'est depuis le montage de la
         page ; pour l'administration elle n'arrive qu'après que les balises
         ont désigné l'artiste, d'où l'effet de rattrapage plus bas. */
      if (meta.album && albums.length > 0) {
        const trouve = albumCorrespondant(meta.album, albums);
        if (trouve) poser("albumId", "Album", trouve._id, !vide(valeurs.albumId));
        else
          champs.push({
            champ: "Album",
            valeur: meta.album,
            etat: "sans-correspondance",
            note: "aucun album de cet artiste à ce nom",
          });
        // `poser` afficherait l'identifiant : on remet le titre lisible.
        const ligne = champs.find((c) => c.champ === "Album");
        if (ligne && trouve) ligne.valeur = trouve.title;
      }

      /* --- Genre et langue : listes fermées du site, d'où le rapprochement. */
      const genre = genreCorrespondant(meta.genre, GENRES);
      if (genre) poser("genre", "Genre", genre, valeurs.genre !== GENRES[0]);
      else if (meta.genre)
        champs.push({
          champ: "Genre",
          valeur: meta.genre,
          etat: "sans-correspondance",
          note: "absent de la liste des genres du site",
        });

      const langue = langueCorrespondante(meta.langue, LANGUAGES);
      if (langue) poser("language", "Langue", langue, valeurs.language !== LANGUAGES[0]);

      poser("composer", "Compositeur", meta.compositeur ?? null, !vide(valeurs.composer));
      poser("producer", "Producteur", meta.producteur ?? null, !vide(valeurs.producer));
      poser("musicalKey", "Tonalité", tonaliteCourte(meta.tonalite), !vide(valeurs.musicalKey));
      poser("isrc", "ISRC", isrcNormalise(meta.isrc), !vide(valeurs.isrc));
      poser("copyright", "Copyright", meta.copyright ?? null, !vide(valeurs.copyright));
      poser("bpm", "BPM", meta.bpm ? String(Math.round(meta.bpm)) : null, !vide(valeurs.bpm));
      poser("description", "Description", meta.description ?? null, !vide(valeurs.description));

      if (meta.paroles) {
        const dejaRempli = !vide(valeurs.lyrics);
        if (dejaRempli && !ecraser) {
          champs.push({ champ: "Paroles", valeur: "présentes dans le fichier", etat: "conserve", note: "champ déjà rempli, non écrasé" });
        } else {
          setValue("lyrics", meta.paroles, { shouldDirty: true });
          champs.push({
            champ: "Paroles",
            valeur: `${meta.paroles.split("\n").length} lignes`,
            etat: "applique",
            note: meta.parolesSynchronisees
              ? "synchronisées (LRC) — elles défileront dans le lecteur"
              : "texte simple, sans minutage",
          });
        }
      }

      /* --- Contenu explicite : seule une balise sans ambiguïté coche la case. */
      if (typeof meta.explicite === "boolean" && (ecraser || meta.explicite !== valeurs.explicit)) {
        setValue("explicit", meta.explicite, { shouldDirty: true });
        champs.push({ champ: "Contenu explicite", valeur: meta.explicite ? "oui" : "non", etat: "applique" });
      }

      /* --- Tags : genres secondaires et mots-clés du fichier. */
      const motsCles = [...(meta.genresSecondaires ?? []), ...(meta.motsCles ?? [])].filter(Boolean);
      if (motsCles.length > 0) {
        const fusion = [...tags];
        for (const mot of motsCles) if (!fusion.some((t) => memeNom(t, mot))) fusion.push(mot);
        if (fusion.length !== tags.length) {
          setTags(fusion);
          champs.push({ champ: "Tags", valeur: motsCles.join(", "), etat: "applique" });
        }
      }

      /* --- Date de sortie : ne bascule en publication programmée que pour
         une date à venir. Une date passée décrit la sortie d'origine, pas
         un moment de publication sur Moziik. */
      if (meta.dateSortie) {
        const prevue = new Date(`${meta.dateSortie}T00:00:00`);
        if (prevue.getTime() > Date.now()) {
          setValue("releaseMode", "schedule", { shouldDirty: true });
          setValue("releaseDateInput", meta.dateSortie, { shouldDirty: true });
          if (vide(valeurs.releaseTimeInput) || ecraser) setValue("releaseTimeInput", "00:00", { shouldDirty: true });
          champs.push({
            champ: "Date de sortie",
            valeur: meta.dateSortie,
            etat: "applique",
            note: "publication programmée — vérifie l'heure",
          });
        } else {
          champs.push({
            champ: "Date de sortie",
            valeur: meta.dateSortie,
            etat: "conserve",
            note: "date passée : la publication reste immédiate",
          });
        }
      } else if (meta.annee) {
        champs.push({ champ: "Année", valeur: String(meta.annee), etat: "conserve", note: "date incomplète dans le fichier" });
      }

      /* --- Pochette intégrée. */
      if (meta.pochette && (!coverFile || ecraser)) {
        setCoverFile(meta.pochette.fichier);
        champs.push({
          champ: "Pochette",
          valeur:
            meta.pochette.largeur && meta.pochette.hauteur
              ? `${meta.pochette.largeur} × ${meta.pochette.hauteur} px`
              : "image intégrée",
          etat: "applique",
          note: meta.nbPochettes > 1 ? `${meta.nbPochettes} images dans le fichier, la plus définie retenue` : undefined,
        });
      } else if (meta.pochette) {
        champs.push({ champ: "Pochette", valeur: "image intégrée", etat: "conserve", note: "pochette déjà choisie" });
      }

      if (meta.duree) setPendingDuration(Math.round(meta.duree));

      /* --- Artiste principal : réservé à l'administration, seul rôle qui
         peut publier pour le compte d'un autre. */
      if (isAdmin && meta.artiste) {
        const trouve = await chercherArtiste(meta.artiste);
        if (trouve && (!targetArtist || ecraser)) {
          setTargetArtist(trouve);
          champs.push({ champ: "Artiste principal", valeur: trouve.stageName, etat: "applique" });
        } else if (trouve) {
          champs.push({ champ: "Artiste principal", valeur: trouve.stageName, etat: "conserve", note: "artiste déjà choisi" });
        } else {
          champs.push({
            champ: "Artiste principal",
            valeur: meta.artiste,
            etat: "sans-correspondance",
            note: "aucun profil artiste à ce nom sur Moziik",
          });
        }
      }

      setExtraTouched(true);
      return champs;
    },
    [
      GENRES,
      albums,
      chercherArtiste,
      coverFile,
      featuring.length,
      getValues,
      isAdmin,
      setValue,
      tags,
      targetArtist,
    ]
  );

  /** Lance l'analyse d'un fichier déposé et publie le compte rendu. */
  const analyserFichier = useCallback(
    async (fichier: File, ecraser = false) => {
      setRapport({ nomFichier: fichier.name, champs: [], enCours: true });
      if (!ecraser) {
        avantRemplissageRef.current = {
          valeurs: getValues(),
          tags,
          featuring,
          cover: coverFile,
          artiste: targetArtist,
        };
      }
      try {
        const meta = ecraser && metaRef.current ? metaRef.current : await lireMetadonneesAudio(fichier);
        metaRef.current = meta;
        const champs = await remplirDepuisMetadonnees(meta, fichier.name, ecraser);
        // L'aperçu d'objet créé par la lecture ne sert pas ici : la page
        // recrée le sien à partir du File. Le libérer évite une fuite.
        libererPochette(meta.pochette);
        setRapport({
          nomFichier: fichier.name,
          technique: [meta.format, meta.debit ? `${Math.round(meta.debit / 1000)} kb/s` : null]
            .filter(Boolean)
            .join(" · "),
          champs,
        });
      } catch {
        setRapport({
          nomFichier: fichier.name,
          champs: [],
          erreur: "Impossible de lire les métadonnées de ce fichier — les champs restent à remplir à la main.",
        });
      }
    },
    [coverFile, featuring, getValues, remplirDepuisMetadonnees, tags, targetArtist]
  );

  /**
   * L'album ne peut être rapproché qu'une fois la liste de l'artiste
   * chargée — pour l'administration, cette liste n'arrive qu'après que les
   * balises ont désigné l'artiste. D'où ce rattrapage séparé.
   */
  useEffect(() => {
    const nomAlbum = metaRef.current?.album;
    if (!nomAlbum || albums.length === 0 || getValues("albumId")) return;
    const trouve = albumCorrespondant(nomAlbum, albums);
    setValue("albumId", trouve ? trouve._id : "", { shouldDirty: true });
    setRapport((prev) =>
      prev && !prev.champs.some((c) => c.champ === "Album")
        ? {
            ...prev,
            champs: [
              ...prev.champs,
              trouve
                ? { champ: "Album", valeur: trouve.title, etat: "applique" as const }
                : {
                    champ: "Album",
                    valeur: nomAlbum,
                    etat: "sans-correspondance" as const,
                    note: "aucun album de cet artiste à ce nom",
                  },
            ],
          }
        : prev
    );
  }, [albums, getValues, setValue]);

  /** Rétablit le formulaire tel qu'il était avant la lecture des balises. */
  function annulerRemplissage() {
    const avant = avantRemplissageRef.current;
    if (!avant) return;
    reset(avant.valeurs);
    setTags(avant.tags);
    setFeaturing(avant.featuring);
    setCoverFile(avant.cover);
    setTargetArtist(avant.artiste);
    setRapport(null);
    metaRef.current = null;
  }

  const effectiveDuration = pendingDuration ?? 0;

  const checklist: ChecklistItem[] = useMemo(() => {
    const hasAudio = Boolean(audioFile) && !uploadingAudio;
    const hasCover = Boolean(coverFile);
    const hasMetadata = Boolean(watchedTitle?.trim()) && Boolean(watchedGenre);
    return [
      {
        key: "audio",
        label: "Fichier audio valide",
        detail: hasAudio
          ? `${formatBytes(audioFile!.size)} · ${
              effectiveDuration
                ? `${Math.floor(effectiveDuration / 60)}:${String(Math.floor(effectiveDuration % 60)).padStart(2, "0")}`
                : "—"
            }`
          : "En attente d'un fichier audio",
        done: hasAudio,
      },
      {
        key: "cover",
        label: "Pochette ajoutée",
        detail: hasCover ? "Format carré recommandé" : "Ajoute une pochette",
        done: hasCover,
      },
      {
        key: "metadata",
        label: "Métadonnées complètes",
        detail: hasMetadata ? "Titre et genre renseignés" : "Titre et genre requis",
        done: hasMetadata,
      },
      {
        key: "ready",
        label: "Prêt à publier",
        detail: hasAudio && hasCover && hasMetadata ? "Ton titre est prêt à être publié" : "Complète les étapes ci-dessus",
        done: hasAudio && hasCover && hasMetadata,
      },
    ];
  }, [audioFile, coverFile, watchedTitle, watchedGenre, effectiveDuration, uploadingAudio]);

  const hasUnsavedChanges = Boolean(coverFile) || Boolean(audioFile) || Boolean(watchedTitle) || extraTouched;

  function handleTagsChange(next: string[]) {
    setTags(next);
    setExtraTouched(true);
  }
  function handleFeaturingChange(next: ArtistOption[]) {
    setFeaturing(next);
    setExtraTouched(true);
  }
  function handleTargetArtistChange(next: ArtistOption | null) {
    setTargetArtist(next);
    setExtraTouched(true);
  }

  async function persist(values: FormValues, mode: "draft" | "publish") {
    if (!values.title.trim()) {
      pushToast("error", "Le titre est requis.");
      return;
    }
    if (!coverFile || !audioFile) {
      pushToast("error", "Ajoute un fichier audio et une pochette.");
      return;
    }
    if (!targetArtist) {
      pushToast("error", isAdmin ? "Choisis l'artiste concerné par ce son." : "Profil artiste introuvable.");
      return;
    }

    setSaving(mode);
    try {
      setUploadingCover(true);
      const coverUpload = await uploadToCloudinaryClient(coverFile, "covers");
      setUploadingCover(false);

      setUploadingAudio(true);
      const audioUpload = await uploadToCloudinaryClient(audioFile, "songs", setAudioProgress);
      setUploadingAudio(false);
      setAudioProgress(0);

      let releaseDate = new Date().toISOString();
      if (mode === "publish") {
        const computed =
          values.releaseMode === "now"
            ? new Date().toISOString()
            : buildReleaseISO(values.releaseDateInput, values.releaseTimeInput, values.timezone);
        if (!computed) {
          pushToast("error", "Choisis une date et une heure de publication valides.");
          setSaving(null);
          return;
        }
        releaseDate = computed;
      }

      const payload: Record<string, unknown> = {
        title: values.title.trim(),
        genre: values.genre,
        albumId: values.albumId || "",
        language: values.language,
        composer: values.composer.trim(),
        producer: values.producer.trim(),
        lyrics: values.lyrics,
        description: values.description,
        tags,
        bpm: values.bpm ? Number(values.bpm) : undefined,
        musicalKey: values.musicalKey.trim(),
        isrc: values.isrc.trim(),
        copyright: values.copyright.trim(),
        explicit: values.explicit,
        coverUrl: coverUpload.url,
        audioUrl: audioUpload.url,
        duration: Math.round(audioUpload.duration ?? pendingDuration ?? 0),
        featuringIds: featuring.map((a) => a._id),
        releaseDate,
        artistId: targetArtist._id,
        saveAsDraft: mode === "draft",
      };

      const res = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await readApiError(res, "La publication a échoué."));

      const data = await res.json();

      pushToast(
        "success",
        !isAdmin
          ? "Titre envoyé pour validation."
          : mode === "draft"
            ? "Brouillon enregistré."
            : values.releaseMode === "now"
              ? "Titre publié avec succès."
              : "Publication programmée."
      );

      router.push(`/son/${data.song._id}/modifier`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "La publication a échoué.";
      pushToast("error", message);
    } finally {
      setSaving(null);
      setUploadingCover(false);
      setUploadingAudio(false);
    }
  }

  function handleCancel() {
    if (hasUnsavedChanges) {
      setConfirmDiscard(true);
    } else {
      router.back();
    }
  }

  if (status === "loading" || artistLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 size={22} className="animate-spin text-ink-muted" />
      </div>
    );
  }

  const canManage = isAdmin || Boolean(ownArtist);

  if (!canManage) {
    return (
      <div className="px-6 py-16 text-center md:px-10">
        <ShieldAlert size={28} className="mx-auto mb-3 text-ink-muted" />
        <p className="text-sm text-ink-muted">
          Tu dois avoir un profil artiste pour publier un son.
        </p>
      </div>
    );
  }

  const busy = saving !== null;
  const publishLabel = releaseMode === "now" ? "Publier le titre" : "Programmer la publication";

  return (
    <form onSubmit={handleSubmit((values) => persist(values, "publish"))}>
      {/* En-tête */}
      <div className="border-b border-border px-6 py-5 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Retour"
              className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-base hover:text-ink"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-display leading-tight sm:text-2xl">Publier un nouveau titre</h1>
              <p className="text-sm text-ink-muted">
                {isAdmin
                  ? "Ajoute un son au catalogue pour le compte d'un artiste."
                  : "Ton titre sera soumis à validation avant d'apparaître publiquement."}
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              disabled={busy}
              onClick={handleSubmit((values) => persist(values, "draft"))}
              className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
            >
              {saving === "draft" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Enregistrer comme brouillon
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {saving === "publish" ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
              {isAdmin ? publishLabel : "Soumettre pour validation"}
            </button>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="px-6 py-6 md:px-10 md:py-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* Colonne principale */}
          <div className="min-w-0 space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
              {/* Pochette */}
              <div className="rounded-xl2 border border-border bg-surface p-5 sm:p-6">
                <CoverDropzone
                  previewUrl={coverPreviewUrl}
                  onFile={(f) => {
                    setCoverFile(f);
                    setExtraTouched(true);
                  }}
                />
              </div>

              {/* Informations */}
              <SectionCard icon={Info} title="Informations">
                <div className="space-y-4">
                  <FormField label="Titre du morceau *" {...register("title", { required: true })} placeholder="Titre du morceau" />
                  {errors.title && <p className="-mt-3 text-xs text-accent">Le titre est requis.</p>}
                  <DuplicateWarning doublon={doublon} />

                  {/* Propositions de l'IA. Rien ne s'applique tout seul :
                      chaque champ se pose separement, et le panneau dit
                      lesquels ecraseraient une saisie. */}
                  <SongAiAssist
                    disponible={iaPublication}
                    langues={LANGUAGES}
                    donnees={() => ({
                      title: getValues("title"),
                      artistName: (isAdmin ? targetArtist?.stageName : ownArtist?.stageName) ?? "",
                      lyrics: getValues("lyrics"),
                      album: albums.find((a) => a._id === getValues("albumId"))?.title,
                    })}
                    valeurs={{
                      genre: watchedGenre,
                      language: watchedLanguage,
                      tags,
                      description: watchedDescription,
                    }}
                    onAppliquer={(champs) => {
                      if (champs.genre !== undefined) setValue("genre", champs.genre, { shouldDirty: true });
                      if (champs.language !== undefined)
                        setValue("language", champs.language, { shouldDirty: true });
                      if (champs.description !== undefined)
                        setValue("description", champs.description, { shouldDirty: true });
                      if (champs.tags) setTags(champs.tags);
                      // Le garde-fou de sortie de page doit compter ces
                      // champs comme une modification non enregistree.
                      setExtraTouched(true);
                    }}
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-ink-muted">Genre *</span>
                      <select
                        {...register("genre", { required: true })}
                        className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
                      >
                        {GENRES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm text-ink-muted">Album</span>
                      <select
                        {...register("albumId")}
                        className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
                      >
                        <option value="">Single</option>
                        {albums.map((a) => (
                          <option key={a._id} value={a._id}>
                            {a.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-sm text-ink-muted">Langue</span>
                    <select
                      {...register("language")}
                      className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent sm:max-w-[220px]"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>

                  {isAdmin && <ArtistSinglePicker selected={targetArtist} onChange={handleTargetArtistChange} />}
                  {!isAdmin && ownArtist && (
                    <div>
                      <span className="mb-1.5 block text-sm text-ink-muted">Artiste principal</span>
                      <div className="flex items-center gap-1.5 rounded-xl border border-border bg-base px-3.5 py-2.5 text-sm">
                        {ownArtist.stageName}
                        {ownArtist.verified && <BadgeCheck size={13} className="text-verified" />}
                      </div>
                    </div>
                  )}

                  <FeaturingPicker selected={featuring} onChange={handleFeaturingChange} />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField label="Compositeur" icon={Users2} {...register("composer")} placeholder="Nom du compositeur" />
                    <FormField label="Producteur" icon={Users2} {...register("producer")} placeholder="Nom du producteur" />
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Fichier audio */}
            <div className="rounded-xl2 border border-border bg-surface p-5 sm:p-6">
              <AudioDropzone
                fileName={audioFile ? audioFile.name : "Aucun fichier"}
                fileSizeLabel={audioFile ? formatBytes(audioFile.size) : "Aucun fichier"}
                audioSrc={audioPreviewUrl}
                isNewFile={Boolean(audioFile)}
                uploading={uploadingAudio}
                uploadProgress={audioProgress}
                onFileSelected={(f) => {
                  setAudioFile(f);
                  setExtraTouched(true);
                  analyserFichier(f);
                }}
                onDurationDetected={setPendingDuration}
              />

              {/* Compte rendu de la lecture des balises : ce que le fichier
                  portait, ce qui a été repris, ce qui ne correspond à rien
                  dans les listes du site. */}
              <MetadataAutofill
                rapport={rapport}
                onAppliquerQuandMeme={
                  rapport?.champs.some((c) => c.etat === "conserve") && audioFile
                    ? () => analyserFichier(audioFile, true)
                    : undefined
                }
                onAnnuler={avantRemplissageRef.current ? annulerRemplissage : undefined}
              />
            </div>

            {/* Publication */}
            <SectionCard icon={Rocket} title="Publication">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-4 py-3 transition-colors ${
                    releaseMode === "now" ? "border-accent bg-accent/5" : "border-border bg-base"
                  }`}
                >
                  <input type="radio" value="now" {...register("releaseMode")} className="mt-1 accent-accent" />
                  <span>
                    <span className="block text-sm font-medium">Publier maintenant</span>
                    <span className="block text-xs text-ink-muted">
                      {isAdmin
                        ? "Le titre sera visible immédiatement sur Moziik."
                        : "Ta demande de publication sera envoyée immédiatement à validation."}
                    </span>
                  </span>
                </label>

                <label
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-4 py-3 transition-colors ${
                    releaseMode === "schedule" ? "border-accent bg-accent/5" : "border-border bg-base"
                  }`}
                >
                  <input type="radio" value="schedule" {...register("releaseMode")} className="mt-1 accent-accent" />
                  <span>
                    <span className="block text-sm font-medium">Programmer la publication</span>
                    <span className="block text-xs text-ink-muted">Choisissez la date et l&apos;heure de publication.</span>
                  </span>
                </label>
              </div>

              {releaseMode === "schedule" && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    label="Date de sortie"
                    type="date"
                    icon={Calendar}
                    {...register("releaseDateInput", { required: releaseMode === "schedule" })}
                  />
                  <FormField
                    label="Heure"
                    type="time"
                    icon={Clock3}
                    {...register("releaseTimeInput", { required: releaseMode === "schedule" })}
                  />
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-sm text-ink-muted">
                      <Globe2 size={14} /> Fuseau horaire
                    </span>
                    <select
                      {...register("timezone")}
                      className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </SectionCard>

            {/* Informations supplémentaires */}
            <SectionCard icon={FileText} title="Informations supplémentaires">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm text-ink-muted">Paroles (optionnel)</span>
                  <textarea
                    {...register("lyrics")}
                    rows={6}
                    maxLength={5000}
                    placeholder="Écrivez ou collez les paroles de votre morceau ici..."
                    className="w-full resize-none rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm text-ink-muted">Description (optionnel)</span>
                  <textarea
                    {...register("description")}
                    rows={6}
                    maxLength={1000}
                    placeholder="Décrivez votre morceau, son histoire, son inspiration..."
                    className="w-full resize-none rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </label>
              </div>

              <div className="mt-4">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm text-ink-muted">
                  <TagIcon size={14} /> Tags
                </span>
                <TagInput value={tags} onChange={handleTagsChange} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <FormField label="BPM" icon={Timer} type="number" min={0} max={400} {...register("bpm")} placeholder="98" />
                <FormField label="Tonalité" {...register("musicalKey")} placeholder="C#m" />
                <FormField label="ISRC (optionnel)" icon={Hash} {...register("isrc")} placeholder="MG-MZK-25-00001" />
                <FormField label="Copyright" {...register("copyright")} placeholder="© 2026 Moziik Records" />
              </div>

              <div className="mt-5 flex items-start justify-between gap-4 rounded-xl border border-border bg-base px-4 py-3.5">
                <div className="flex items-start gap-2.5">
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-ink-muted" />
                  <div>
                    <p className="text-sm font-medium">Contenu explicite</p>
                    <p className="text-xs text-ink-muted">
                      Ce contenu contient-il des paroles ou des images à caractère explicite ?
                    </p>
                  </div>
                </div>
                <Controller
                  name="explicit"
                  control={control}
                  render={({ field }) => <Switch checked={field.value} onChange={field.onChange} />}
                />
              </div>
            </SectionCard>

            {/* Actions (mobile + bas de page) */}
            <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSubmit((values) => persist(values, "draft"))}
                className="flex items-center justify-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
              >
                {saving === "draft" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Enregistrer comme brouillon
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center justify-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {saving === "publish" ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
                {isAdmin ? publishLabel : "Soumettre pour validation"}
              </button>
            </div>
          </div>

          {/* Aperçu + checklist */}
          <SongPreviewSidebar
            coverPreview={coverPreviewUrl}
            title={watchedTitle}
            artistName={targetArtist?.stageName ?? ""}
            genre={watchedGenre}
            language={watchedLanguage}
            duration={effectiveDuration}
            audioSrc={audioPreviewUrl}
            checklist={checklist}
          />
        </div>
      </div>

      {confirmDiscard && (
        <ConfirmDialog
          title="Abandonner cette publication ?"
          description="Les informations saisies seront perdues."
          confirmLabel="Abandonner"
          busy={false}
          onConfirm={() => router.back()}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </form>
  );
}
