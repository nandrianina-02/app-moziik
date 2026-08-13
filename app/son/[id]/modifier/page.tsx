"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CoverDropzone } from "@/components/song/CoverDropzone";
import { AudioDropzone, formatBytes } from "@/components/song/AudioDropzone";
import { SongPreviewSidebar, type ChecklistItem } from "@/components/song/SongPreviewSidebar";
import { FeaturingPicker } from "@/components/modals/FeaturingPicker";
import { ArtistSinglePicker } from "@/components/modals/ArtistSinglePicker";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { useToast } from "@/context/ToastProvider";
import { useSiteConfig } from "@/context/SiteConfigProvider";

const LANGUAGES = ["Malagasy", "Français", "Anglais", "Autre"];
// Décalages fixes (pas de gestion de l'heure d'été) — suffisant pour une
// planification de publication, où la précision à l'heure près prime sur
// l'exactitude DST.
const TIMEZONES = [
  { value: "+03:00", label: "(GMT+03:00) Antananarivo" },
  { value: "+00:00", label: "(GMT+00:00) UTC" },
  { value: "+01:00", label: "(GMT+01:00) Paris" },
  { value: "-05:00", label: "(GMT-05:00) New York" },
];

type ArtistOption = { _id: string; stageName: string; verified?: boolean };

type SongDoc = {
  _id: string;
  title: string;
  artist: (ArtistOption & { coverUrl?: string }) | null;
  featuring: { artist: ArtistOption; confirmed: boolean }[];
  album?: { _id: string; title: string } | null;
  audioUrl: string;
  coverUrl: string;
  duration: number;
  genre: string;
  lyrics?: string;
  description?: string;
  tags?: string[];
  language?: string;
  composer?: string;
  producer?: string;
  bpm?: number;
  musicalKey?: string;
  isrc?: string;
  copyright?: string;
  explicit: boolean;
  status: "draft" | "scheduled" | "published" | "rejected";
  releaseDate: string;
  updatedAt?: string;
};

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

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
function toTimeInputValue(date: Date) {
  return date.toISOString().slice(11, 16);
}

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

function deriveFileName(url: string) {
  try {
    const clean = url.split("?")[0];
    const last = clean.split("/").pop() ?? "audio";
    return decodeURIComponent(last);
  } catch {
    return "fichier-audio";
  }
}

function formatRelative(dateIso?: string) {
  if (!dateIso) return null;
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const minutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  return rtf.format(-days, "day");
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

export default function EditSongPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();
  const siteConfig = useSiteConfig();
  const pushToast = useToast();
  const isAdmin = session?.user?.role === "admin";

  const [song, setSong] = useState<SongDoc | null>(null);
  const GENRES = useMemo(() => {
    const base = siteConfig.genres.length > 0 ? siteConfig.genres : ["Autre"];
    // Si le genre déjà attribué au titre a été retiré de la liste des
    // réglages depuis, on le garde disponible ici : sinon le <select>
    // afficherait silencieusement le premier genre de la liste à la
    // place, changeant la valeur du titre sans que l'artiste s'en rende compte.
    if (song?.genre && !base.includes(song.genre)) return [song.genre, ...base];
    return base;
  }, [siteConfig.genres, song?.genre]);
  const [ownArtistId, setOwnArtistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
    reset,
    formState: { errors, isDirty },
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

  // --- Chargement du son -----------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/songs/${id}`);
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data = await res.json();
        const doc: SongDoc = data.song;
        if (cancelled) return;

        setSong(doc);
        setFeaturing(doc.featuring?.map((f) => f.artist).filter(Boolean) ?? []);
        setTargetArtist(doc.artist ?? null);
        setTags(doc.tags ?? []);

        const release = new Date(doc.releaseDate);
        const isFuture = release.getTime() > Date.now();
        reset({
          title: doc.title,
          genre: doc.genre,
          albumId: doc.album?._id ?? "",
          language: doc.language ?? LANGUAGES[0],
          composer: doc.composer ?? "",
          producer: doc.producer ?? "",
          lyrics: doc.lyrics ?? "",
          description: doc.description ?? "",
          bpm: doc.bpm ? String(doc.bpm) : "",
          musicalKey: doc.musicalKey ?? "",
          isrc: doc.isrc ?? "",
          copyright: doc.copyright ?? "",
          explicit: doc.explicit,
          releaseMode: isFuture ? "schedule" : "now",
          releaseDateInput: toDateInputValue(release),
          releaseTimeInput: toTimeInputValue(release),
          timezone: TIMEZONES[0].value,
        });
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, reset]);

  // Profil artiste du visiteur (pour la vérification de propriété — un
  // artiste ne peut modifier que ses propres morceaux).
  useEffect(() => {
    if (status !== "authenticated" || isAdmin) return;
    fetch("/api/artist/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setOwnArtistId(data?.artist?._id ?? null))
      .catch(() => {});
  }, [status, isAdmin]);

  // Albums de l'artiste concerné, pour le sélecteur "Album".
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

  // Aperçus locaux (cover / audio) — révoqués proprement au changement.
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

  const canManage =
    isAdmin || (session?.user?.role === "artist" && !!ownArtistId && ownArtistId === song?.artist?._id);

  const effectiveCoverUrl = coverPreviewUrl ?? song?.coverUrl ?? null;
  const effectiveAudioUrl = audioPreviewUrl ?? song?.audioUrl ?? null;
  const effectiveDuration = pendingDuration ?? song?.duration ?? 0;

  const checklist: ChecklistItem[] = useMemo(() => {
    const hasAudio = Boolean(effectiveAudioUrl) && !uploadingAudio;
    const hasCover = Boolean(effectiveCoverUrl);
    const hasMetadata = Boolean(watchedTitle?.trim()) && Boolean(watchedGenre);
    return [
      {
        key: "audio",
        label: "Fichier audio valide",
        detail: hasAudio
          ? `${audioFile ? formatBytes(audioFile.size) : "Fichier actuel"} · ${
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
  }, [effectiveAudioUrl, effectiveCoverUrl, watchedTitle, watchedGenre, effectiveDuration, uploadingAudio, audioFile]);

  const hasUnsavedChanges = isDirty || Boolean(coverFile) || Boolean(audioFile) || extraTouched;

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
    if (!song) return;
    if (!values.title.trim()) {
      pushToast("error", "Le titre est requis.");
      return;
    }
    if (isAdmin && !targetArtist) {
      pushToast("error", "Choisis l'artiste concerné par ce son.");
      return;
    }

    setSaving(mode);
    try {
      let coverUrl = song.coverUrl;
      if (coverFile) {
        setUploadingCover(true);
        const upload = await uploadToCloudinaryClient(coverFile, "covers");
        coverUrl = upload.url;
        setUploadingCover(false);
      }

      let audioUrl = song.audioUrl;
      let duration = song.duration;
      if (audioFile) {
        setUploadingAudio(true);
        const upload = await uploadToCloudinaryClient(audioFile, "songs", setAudioProgress);
        audioUrl = upload.url;
        duration = Math.round(upload.duration ?? pendingDuration ?? song.duration);
        setUploadingAudio(false);
        setAudioProgress(0);
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
        coverUrl,
        audioUrl,
        duration,
        featuringIds: featuring.map((a) => a._id),
      };

      if (isAdmin && targetArtist) payload.artistId = targetArtist._id;

      if (mode === "publish") {
        const releaseDate =
          values.releaseMode === "now"
            ? new Date().toISOString()
            : buildReleaseISO(values.releaseDateInput, values.releaseTimeInput, values.timezone);
        if (!releaseDate) {
          pushToast("error", "Choisis une date et une heure de publication valides.");
          setSaving(null);
          setUploadingCover(false);
          setUploadingAudio(false);
          return;
        }
        payload.releaseDate = releaseDate;
      }
      // En mode brouillon, on n'envoie volontairement pas releaseDate : le
      // statut actuel du son (brouillon / planifié / publié) est préservé.

      const res = await fetch(`/api/songs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Réponse invalide du serveur." }));
        throw new Error(data.error ?? "La mise à jour a échoué.");
      }

      const data = await res.json();
      setSong(data.song);
      setCoverFile(null);
      setAudioFile(null);
      setPendingDuration(null);
      setExtraTouched(false);

      pushToast(
        "success",
        mode === "draft"
          ? "Brouillon enregistré."
          : values.releaseMode === "now"
            ? "Titre publié avec succès."
            : "Publication programmée."
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "La mise à jour a échoué.";
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

  // --- États de garde ----------------------------------------------------
  if (status === "loading" || loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <EqualizerLoader />
      </div>
    );
  }

  if (notFound || !song) {
    return (
      <div className="px-6 py-16 text-center md:px-10">
        <ShieldAlert size={28} className="mx-auto mb-3 text-ink-muted" />
        <p className="text-sm text-ink-muted">Ce son est introuvable.</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="px-6 py-16 text-center md:px-10">
        <ShieldAlert size={28} className="mx-auto mb-3 text-ink-muted" />
        <p className="text-sm text-ink-muted">Tu n&apos;as pas accès à cette page.</p>
      </div>
    );
  }

  const lastSavedLabel = formatRelative(song.updatedAt);
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
              <h1 className="text-xl font-display leading-tight sm:text-2xl">Modifier le titre</h1>
              <p className="text-sm text-ink-muted">Modifiez les informations de votre morceau.</p>
              {lastSavedLabel && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-verified">
                  <span className="h-1.5 w-1.5 rounded-full bg-verified" />
                  Dernière modification {lastSavedLabel}
                </p>
              )}
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
              {publishLabel}
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
                  previewUrl={effectiveCoverUrl}
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
                  {!isAdmin && song.artist && (
                    <div>
                      <span className="mb-1.5 block text-sm text-ink-muted">Artiste principal</span>
                      <div className="flex items-center gap-1.5 rounded-xl border border-border bg-base px-3.5 py-2.5 text-sm">
                        {song.artist.stageName}
                        {song.artist.verified && <BadgeCheck size={13} className="text-verified" />}
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
                fileName={audioFile ? audioFile.name : song.audioUrl ? deriveFileName(song.audioUrl) : "Aucun fichier"}
                fileSizeLabel={audioFile ? formatBytes(audioFile.size) : "Fichier actuel"}
                audioSrc={effectiveAudioUrl}
                isNewFile={Boolean(audioFile)}
                uploading={uploadingAudio}
                uploadProgress={audioProgress}
                onFileSelected={(f) => {
                  setAudioFile(f);
                  setExtraTouched(true);
                }}
                onDurationDetected={setPendingDuration}
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
                    <span className="block text-xs text-ink-muted">Le titre sera visible immédiatement sur Moziik.</span>
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
                {publishLabel}
              </button>
            </div>
          </div>

          {/* Aperçu + checklist */}
          <SongPreviewSidebar
            coverPreview={effectiveCoverUrl}
            title={watchedTitle}
            artistName={targetArtist?.stageName ?? song.artist?.stageName ?? ""}
            genre={watchedGenre}
            language={watchedLanguage}
            duration={effectiveDuration}
            audioSrc={effectiveAudioUrl}
            checklist={checklist}
          />
        </div>
      </div>

      {confirmDiscard && (
        <ConfirmDialog
          title="Abandonner les modifications ?"
          description="Les changements non enregistrés seront perdus."
          confirmLabel="Abandonner"
          busy={false}
          onConfirm={() => router.back()}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </form>
  );
}
