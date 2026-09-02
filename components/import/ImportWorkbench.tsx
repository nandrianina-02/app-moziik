"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CircleAlert,
  CircleCheck,
  Copy,
  FolderOpen,
  HardDrive,
  Info,
  Loader2,
  UploadCloud,
  Upload,
} from "lucide-react";
import { ImportRow } from "@/components/import/ImportRow";
import {
  estImportable,
  recalculerStatut,
  type AlbumOption,
  type ArtisteOption,
  type LigneImport,
} from "@/components/import/types";
import { estFichierAudio, formaterOctets, lireMetadonneesAudio, titreDepuisNomDeFichier } from "@/lib/audioMetadata";
import { estimerTempo } from "@/lib/bpm";
import { creerPochetteParDefaut } from "@/lib/defaultCover";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { readApiError } from "@/lib/readApiError";
import { useToast } from "@/context/ToastProvider";
import { useSiteConfig } from "@/context/SiteConfigProvider";

const MAX_MO = 100; // aligné sur l'envoi unitaire et sur la limite Cloudinary
const ANALYSES_SIMULTANEES = 3;
const ENVOIS_SIMULTANES = 2;

const parIdEnEchec = (lot: LigneImport[], ligne: LigneImport) => lot.some((l) => l.id === ligne.id);

/** Exécute `tache` sur chaque élément, `limite` en vol à la fois. */
async function enParallele<T>(items: T[], limite: number, tache: (item: T) => Promise<void>) {
  let curseur = 0;
  const ouvriers = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (curseur < items.length) {
      const index = curseur++;
      await tache(items[index]);
    }
  });
  await Promise.all(ouvriers);
}

function Compteur({
  valeur,
  label,
  couleur = "text-ink",
  icone: Icone,
}: {
  valeur: string | number;
  label: string;
  couleur?: string;
  icone?: typeof Info;
}) {
  return (
    <div className="min-w-0 px-4 text-center">
      <p className={`flex items-center justify-center gap-1.5 text-2xl font-display ${couleur}`}>
        {Icone && <Icone size={16} />}
        {valeur}
      </p>
      <p className="mt-0.5 truncate text-xs text-ink-muted">{label}</p>
    </div>
  );
}

/**
 * Le poste d'import par lot, pour l'administration comme pour un artiste.
 *
 * Un seul composant plutôt que deux pages : la lecture des balises, la
 * détection des doublons, les pochettes intégrées et l'envoi en parallèle
 * sont exactement le même travail. Ce qui change tient en deux props —
 * qui importe, et pour qui.
 */
export function ImportWorkbench({
  estAdmin,
  artisteImpose,
}: {
  estAdmin: boolean;
  /**
   * Quand un artiste importe pour lui-même : chaque ligne lui est
   * rattachée d'office, et le sélecteur d'artiste disparaît. Le nom lu
   * dans les balises n'a plus rien à rapprocher.
   */
  artisteImpose?: ArtisteOption;
}) {
  const pushToast = useToast();
  const siteConfig = useSiteConfig();
  const genres = useMemo(() => (siteConfig.genres.length > 0 ? siteConfig.genres : ["Autre"]), [siteConfig.genres]);

  const [lignes, setLignes] = useState<LigneImport[]>([]);
  const [survol, setSurvol] = useState(false);
  const [importEnCours, setImportEnCours] = useState(false);
  // Un artiste ne publie jamais directement : ses envois deviennent des
  // brouillons soumis à validation (c'est /api/songs qui le décide, ce
  // choix ne fait que le refléter à l'écran).
  const [modePublication, setModePublication] = useState<"publier" | "brouillon">(
    estAdmin ? "publier" : "brouillon"
  );
  const [dateDeSortie, setDateDeSortie] = useState<"maintenant" | "annee">("maintenant");
  const [lectureId, setLectureId] = useState<string | null>(null);
  const [albumsParArtiste, setAlbumsParArtiste] = useState<Record<string, AlbumOption[]>>({});

  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lignesRef = useRef<LigneImport[]>([]);
  lignesRef.current = lignes;

  const majLigne = useCallback((id: string, champs: Partial<LigneImport>) => {
    setLignes((prev) => prev.map((l) => (l.id === id ? recalculerStatut({ ...l, ...champs }) : l)));
  }, []);

  // Les URL d'objet (audio et pochettes) survivent au démontage si on ne
  // les révoque pas : on nettoie tout ce qui reste en quittant la page.
  useEffect(() => {
    return () => {
      for (const l of lignesRef.current) {
        URL.revokeObjectURL(l.apercuAudio);
        if (l.apercuPochette) URL.revokeObjectURL(l.apercuPochette);
        if (l.pochetteIntegree && l.pochetteIntegree.apercu !== l.apercuPochette) {
          URL.revokeObjectURL(l.pochetteIntegree.apercu);
        }
      }
      audioRef.current?.pause();
    };
  }, []);

  // Albums de chaque artiste rapproché : un morceau ne peut rejoindre qu'un
  // album existant, jamais un album créé à la volée par l'import.
  useEffect(() => {
    const manquants = [...new Set(lignes.map((l) => l.artiste?._id).filter((id): id is string => !!id))].filter(
      (id) => !(id in albumsParArtiste)
    );
    if (manquants.length === 0) return;
    let annule = false;
    (async () => {
      const entrees = await Promise.all(
        manquants.map(async (id) => {
          try {
            const res = await fetch(`/api/albums?artist=${id}`);
            const data = res.ok ? await res.json() : { albums: [] };
            return [id, (data.albums ?? []) as AlbumOption[]] as const;
          } catch {
            return [id, [] as AlbumOption[]] as const;
          }
        })
      );
      if (annule) return;
      setAlbumsParArtiste((prev) => ({ ...prev, ...Object.fromEntries(entrees) }));
    })();
    return () => {
      annule = true;
    };
  }, [lignes, albumsParArtiste]);

  // Présélection de l'album dès que la liste de l'artiste est connue et que
  // la balise porte un titre d'album correspondant.
  useEffect(() => {
    setLignes((prev) => {
      let change = false;
      const suivant = prev.map((l) => {
        if (l.albumId || !l.album || !l.artiste) return l;
        const albums = albumsParArtiste[l.artiste._id];
        if (!albums) return l;
        const trouve = albums.find((a) => a.title.trim().toLowerCase() === l.album.trim().toLowerCase());
        if (!trouve) return l;
        change = true;
        return { ...l, albumId: trouve._id };
      });
      return change ? suivant : prev;
    });
  }, [albumsParArtiste]);

  // ---------------------------------------------------------------- ajout

  async function ajouterFichiers(liste: FileList | File[]) {
    const fichiers = Array.from(liste);
    const nouvelles: LigneImport[] = [];
    const rejets: string[] = [];

    for (const fichier of fichiers) {
      if (!estFichierAudio(fichier)) {
        rejets.push(`${fichier.name} — format non audio`);
        continue;
      }
      if (fichier.size > MAX_MO * 1024 * 1024) {
        rejets.push(`${fichier.name} — dépasse ${MAX_MO} Mo`);
        continue;
      }
      // Même nom ET même taille : c'est le même fichier redéposé.
      const dejaLa = lignesRef.current.some((l) => l.fichier.name === fichier.name && l.fichier.size === fichier.size);
      if (dejaLa || nouvelles.some((l) => l.fichier.name === fichier.name && l.fichier.size === fichier.size)) {
        rejets.push(`${fichier.name} — déjà dans la liste`);
        continue;
      }

      nouvelles.push({
        id: `${fichier.name}-${fichier.size}-${nouvelles.length}-${lignesRef.current.length}`,
        fichier,
        statut: "analyse",
        titre: titreDepuisNomDeFichier(fichier.name),
        artisteNom: "",
        album: "",
        albumId: "",
        genre: genres[0],
        annee: "",
        piste: "",
        compositeur: "",
        bpm: "",
        sourcePochette: "defaut",
        apercuPochette: null,
        pochette: null,
        pochetteIntegree: null,
        artiste: artisteImpose ?? null,
        doublon: null,
        inspecte: false,
        importerMalgreDoublon: false,
        apercuAudio: URL.createObjectURL(fichier),
        progression: 0,
      });
    }

    if (rejets.length > 0) {
      pushToast("error", rejets.length === 1 ? rejets[0] : `${rejets.length} fichiers ignorés (format, taille ou doublon).`);
    }
    if (nouvelles.length === 0) return;

    setLignes((prev) => [...prev, ...nouvelles]);
    await analyser(nouvelles);
  }

  async function analyser(cibles: LigneImport[]) {
    await enParallele(cibles, ANALYSES_SIMULTANEES, async (ligne) => {
      try {
        const meta = await lireMetadonneesAudio(ligne.fichier);
        const titre = meta.titre || titreDepuisNomDeFichier(ligne.fichier.name);

        // Ordre de préférence : pochette du fichier, puis pochette Moziik.
        // Le remplacement manuel vient par-dessus, à la demande.
        let sourcePochette: LigneImport["sourcePochette"] = "integree";
        let pochette = meta.pochette?.fichier ?? null;
        let apercuPochette = meta.pochette?.apercu ?? null;
        if (!pochette) {
          sourcePochette = "defaut";
          pochette = await creerPochetteParDefaut(titre, titreDepuisNomDeFichier(ligne.fichier.name));
          // Marque le titre ayant servi au dessin : sans elle, l'effet de
          // regénération redessinerait aussitôt la même image.
          Object.defineProperty(pochette, "__titre", { value: titre, enumerable: false });
          apercuPochette = URL.createObjectURL(pochette);
        }

        const genreDetecte = meta.genre
          ? genres.find((g) => g.toLowerCase() === meta.genre!.toLowerCase()) ?? meta.genre
          : genres[0];

        // Le tempo : la balise d'abord, elle ne se discute pas. À défaut,
        // on le mesure — la plupart des fichiers n'en portent aucune, et
        // huit modes d'écoute en dépendent (lib/modes.ts). Une mesure peu
        // sûre ou ambiguë ne donne rien : mieux vaut un champ vide qu'une
        // berceuse rangée dans « Sport ».
        let bpm = meta.bpm ? String(Math.round(meta.bpm)) : "";
        let bpmSource: LigneImport["bpmSource"] = meta.bpm ? "balise" : undefined;
        if (!bpm) {
          const estimation = await estimerTempo(ligne.fichier);
          if (estimation && !estimation.ambigu) {
            bpm = String(estimation.bpm);
            bpmSource = "analyse";
          }
        }

        majLigne(ligne.id, {
          statut: "incomplet",
          meta,
          titre,
          artisteNom: meta.artiste ?? "",
          album: meta.album ?? "",
          genre: genreDetecte,
          annee: meta.annee ? String(meta.annee) : "",
          piste: meta.piste ? String(meta.piste) : "",
          compositeur: meta.compositeur ?? "",
          bpm,
          bpmSource,
          sourcePochette,
          pochette,
          apercuPochette,
          pochetteIntegree: meta.pochette
            ? {
                fichier: meta.pochette.fichier,
                apercu: meta.pochette.apercu,
                largeur: meta.pochette.largeur,
                hauteur: meta.pochette.hauteur,
              }
            : null,
        });
      } catch (err) {
        majLigne(ligne.id, {
          statut: "erreur",
          inspecte: true, // rien à rapprocher : ni titre ni artiste exploitables
          erreur:
            err instanceof Error && err.message
              ? `Métadonnées illisibles : ${err.message}`
              : "Métadonnées introuvables ou fichier corrompu.",
        });
      }
    });
  }

  /**
   * Rapprochement serveur — artiste et doublon — en un aller-retour par
   * lot. Déclenché par l'état plutôt qu'appelé à la fin de l'analyse : la
   * référence `lignesRef` n'est à jour qu'après un rendu, et un lot de
   * deux fichiers s'analysait plus vite que React ne re-rendait, laissant
   * des lignes jamais inspectées.
   */
  const inspectionEnCours = useRef(false);
  const monte = useRef(true);
  useEffect(() => () => {
    monte.current = false;
  }, []);

  useEffect(() => {
    const aInspecter = lignes.filter((l) => l.meta && !l.inspecte);
    if (aInspecter.length === 0 || inspectionEnCours.current) return;
    inspectionEnCours.current = true;

    // Pas d'annulation au nettoyage de l'effet : `lignes` change à chaque
    // fichier analysé, donc la requête en vol serait jetée à tous les coups
    // et plus aucune ligne ne serait rapprochée. Les résultats étant
    // appliqués par identifiant, les recevoir en retard reste correct.
    (async () => {
      try {
        const res = await fetch("/api/import/inspect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: aInspecter.map((l) => ({ titre: l.titre, artiste: l.artisteNom || undefined })),
          }),
        });
        if (!res.ok) throw new Error(await readApiError(res, "Vérification impossible."));
        const { resultats } = (await res.json()) as {
          resultats: { artiste: ArtisteOption | null; doublon: LigneImport["doublon"] }[];
        };
        if (!monte.current) return;
        const parId = new Map(aInspecter.map((l, i) => [l.id, resultats[i]]));
        setLignes((prev) =>
          prev.map((l) => {
            const r = parId.get(l.id);
            if (!r) return l;
            return recalculerStatut({ ...l, inspecte: true, artiste: l.artiste ?? r.artiste, doublon: r.doublon });
          })
        );
      } catch (err) {
        if (!monte.current) return;
        // Sans marquage, l'effet retenterait en boucle sur la même erreur.
        setLignes((prev) => prev.map((l) => (parIdEnEchec(aInspecter, l) ? { ...l, inspecte: true } : l)));
        pushToast("error", err instanceof Error ? err.message : "Vérification des doublons impossible.");
      } finally {
        inspectionEnCours.current = false;
      }
    })();
  }, [lignes, pushToast]);

  // ------------------------------------------------------------- pochette

  async function remplacerPochette(id: string, fichier: File) {
    const ligne = lignesRef.current.find((l) => l.id === id);
    if (!ligne) return;
    if (ligne.apercuPochette && ligne.apercuPochette !== ligne.pochetteIntegree?.apercu) {
      URL.revokeObjectURL(ligne.apercuPochette);
    }
    majLigne(id, {
      sourcePochette: "manuelle",
      pochette: fichier,
      apercuPochette: URL.createObjectURL(fichier),
    });
  }

  function retablirPochette(id: string) {
    const ligne = lignesRef.current.find((l) => l.id === id);
    if (!ligne?.pochetteIntegree) return;
    if (ligne.apercuPochette && ligne.apercuPochette !== ligne.pochetteIntegree.apercu) {
      URL.revokeObjectURL(ligne.apercuPochette);
    }
    majLigne(id, {
      sourcePochette: "integree",
      pochette: ligne.pochetteIntegree.fichier,
      apercuPochette: ligne.pochetteIntegree.apercu,
    });
  }

  /**
   * La pochette par défaut porte les initiales du titre : si le titre
   * change, l'image affichée doit changer avec lui — sinon l'aperçu
   * mentirait sur ce qui sera réellement envoyé.
   */
  useEffect(() => {
    const minuteur = setTimeout(async () => {
      for (const ligne of lignesRef.current) {
        if (ligne.sourcePochette !== "defaut" || !ligne.titre.trim()) continue;
        const attendu = `${titreDepuisNomDeFichier(ligne.fichier.name)}-pochette-moziik.png`;
        if (ligne.pochette?.name !== attendu) continue;
        const dejaAJour = ligne.pochette && (ligne.pochette as File & { __titre?: string }).__titre === ligne.titre;
        if (dejaAJour) continue;
        try {
          const nouvelle = await creerPochetteParDefaut(ligne.titre, titreDepuisNomDeFichier(ligne.fichier.name));
          Object.defineProperty(nouvelle, "__titre", { value: ligne.titre, enumerable: false });
          if (ligne.apercuPochette) URL.revokeObjectURL(ligne.apercuPochette);
          majLigne(ligne.id, { pochette: nouvelle, apercuPochette: URL.createObjectURL(nouvelle) });
        } catch {
          /* la pochette précédente reste valable */
        }
      }
    }, 500);
    return () => clearTimeout(minuteur);
  }, [lignes, majLigne]);

  // --------------------------------------------------------------- lecture

  function basculerLecture(id: string) {
    const ligne = lignesRef.current.find((l) => l.id === id);
    if (!ligne) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    if (lectureId === id) {
      audio.pause();
      setLectureId(null);
      return;
    }
    audio.src = ligne.apercuAudio;
    audio.play().catch(() => pushToast("error", "Lecture impossible pour ce fichier."));
    audio.onended = () => setLectureId(null);
    setLectureId(id);
  }

  function supprimer(id: string) {
    const ligne = lignesRef.current.find((l) => l.id === id);
    if (ligne) {
      URL.revokeObjectURL(ligne.apercuAudio);
      if (ligne.apercuPochette) URL.revokeObjectURL(ligne.apercuPochette);
      if (ligne.pochetteIntegree && ligne.pochetteIntegree.apercu !== ligne.apercuPochette) {
        URL.revokeObjectURL(ligne.pochetteIntegree.apercu);
      }
    }
    if (lectureId === id) {
      audioRef.current?.pause();
      setLectureId(null);
    }
    setLignes((prev) => prev.filter((l) => l.id !== id));
  }

  // ---------------------------------------------------------------- import

  async function importer() {
    const cibles = lignesRef.current.filter(estImportable);
    if (cibles.length === 0) return;

    setImportEnCours(true);
    audioRef.current?.pause();
    setLectureId(null);

    let reussis = 0;
    const echecs: string[] = [];
    /** albumId → morceaux créés, rattachés en une seule écriture par album. */
    const aRattacher = new Map<string, string[]>();

    await enParallele(cibles, ENVOIS_SIMULTANES, async (cible) => {
      const ligne = lignesRef.current.find((l) => l.id === cible.id) ?? cible;
      majLigne(ligne.id, { statut: "envoi", progression: 3 });
      try {
        if (!ligne.pochette) throw new Error("Pochette manquante.");
        if (!ligne.artiste) throw new Error("Artiste non rapproché.");
        const duree = Math.round(ligne.meta?.duree ?? 0);
        if (duree <= 0) throw new Error("Durée introuvable.");

        const pochetteEnvoyee = await uploadToCloudinaryClient(ligne.pochette, "covers");
        majLigne(ligne.id, { progression: 12 });

        const audioEnvoye = await uploadToCloudinaryClient(ligne.fichier, "songs", (pct) =>
          majLigne(ligne.id, { progression: 12 + Math.round(pct * 0.8) })
        );
        majLigne(ligne.id, { progression: 94 });

        const annee = Number(ligne.annee);
        const releaseDate =
          dateDeSortie === "annee" && Number.isFinite(annee) && annee > 1900 && annee <= new Date().getFullYear()
            ? new Date(Date.UTC(annee, 0, 1)).toISOString()
            : new Date().toISOString();

        const res = await fetch("/api/songs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: ligne.titre.trim(),
            genre: ligne.genre,
            artistId: ligne.artiste._id,
            albumId: ligne.albumId || "",
            composer: ligne.compositeur.trim() || undefined,
            bpm: ligne.bpm ? Number(ligne.bpm) : undefined,
            bpmSource: ligne.bpm ? ligne.bpmSource : undefined,
            coverUrl: pochetteEnvoyee.url,
            audioUrl: audioEnvoye.url,
            duration: Math.round(audioEnvoye.duration ?? duree),
            releaseDate,
            saveAsDraft: modePublication === "brouillon",
          }),
        });
        if (!res.ok) throw new Error(await readApiError(res, "Création du morceau refusée."));
        const { song } = await res.json();

        if (ligne.albumId) {
          aRattacher.set(ligne.albumId, [...(aRattacher.get(ligne.albumId) ?? []), String(song._id)]);
        }

        reussis++;
        majLigne(ligne.id, { statut: "termine", progression: 100, songId: String(song._id) });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Import impossible.";
        echecs.push(`${ligne.fichier.name} — ${message}`);
        // On repasse par "incomplet" pour que recalculerStatut reprenne la
        // main : le message d'erreur reste, la ligne redevient corrigeable.
        setLignes((prev) =>
          prev.map((l) => (l.id === ligne.id ? recalculerStatut({ ...l, statut: "incomplet", erreur: message, progression: 0 }) : l))
        );
      }
    });

    // Rattachement aux albums : une seule écriture par album, après coup.
    // Deux morceaux du même album envoyés en parallèle se seraient écrasés
    // l'un l'autre en lecture-modification-écriture.
    for (const [albumId, songIds] of aRattacher) {
      try {
        const res = await fetch(`/api/albums/${albumId}`);
        if (!res.ok) continue;
        const { album } = await res.json();
        const existants: string[] = (album.songs ?? []).map((s: { _id?: string } | string) =>
          typeof s === "string" ? s : String(s._id)
        );
        await fetch(`/api/albums/${albumId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songs: [...new Set([...existants, ...songIds])] }),
        });
      } catch {
        pushToast("error", "Morceaux créés, mais le rattachement à l'album a échoué.");
      }
    }

    setImportEnCours(false);
    if (reussis > 0) {
      pushToast(
        "success",
        `${reussis} morceau${reussis > 1 ? "x" : ""} ${modePublication === "brouillon" ? "enregistré" : "publié"}${
          reussis > 1 ? "s" : ""
        }.`
      );
    }
    if (echecs.length > 0) pushToast("error", `${echecs.length} import${echecs.length > 1 ? "s" : ""} en échec.`);
  }

  // ---------------------------------------------------------------- rendu

  const compteurs = useMemo(() => {
    const total = lignes.length;
    const prets = lignes.filter((l) => l.statut === "pret").length;
    const erreurs = lignes.filter((l) => l.statut === "erreur").length;
    const doublons = lignes.filter((l) => l.statut === "doublon").length;
    const aCompleter = lignes.filter((l) => l.statut === "incomplet").length;
    const importes = lignes.filter((l) => l.statut === "termine").length;
    const octets = lignes.reduce((s, l) => s + l.fichier.size, 0);
    const avecPochette = lignes.filter((l) => l.sourcePochette === "integree").length;
    return { total, prets, erreurs, doublons, aCompleter, importes, octets, avecPochette };
  }, [lignes]);

  const analyseEnCours = lignes.some((l) => l.statut === "analyse");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-display text-ink">Import de musiques</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Déposez plusieurs fichiers : titre, artiste, album, genre, durée et pochette intégrée sont lus
            automatiquement dans les balises, sans rien envoyer avant votre validation.
          </p>
        </div>
        <Link
          href="/admin/musiques"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
        >
          <FolderOpen size={14} /> Voir le catalogue
        </Link>
      </div>

      {/* Zone de dépôt */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          if (e.dataTransfer.files.length > 0) ajouterFichiers(e.dataTransfer.files);
        }}
        className={`rounded-xl2 border-2 border-dashed px-6 py-10 text-center transition-colors ${
          survol ? "border-accent bg-accent/5" : "border-border bg-surface"
        }`}
      >
        <UploadCloud size={34} className="mx-auto mb-3 text-accent" />
        <p className="text-sm font-medium text-ink">Glissez-déposez vos fichiers audio ici</p>
        <p className="my-2 text-xs text-ink-muted">ou</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
        >
          <FolderOpen size={15} /> Sélectionner des fichiers
        </button>
        <p className="mt-3 text-[11px] text-ink-muted">MP3, WAV, FLAC, M4A/AAC, OGG — max {MAX_MO} Mo par fichier</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.oga,.opus"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) ajouterFichiers(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {lignes.length > 0 && (
        <>
          {/* Synthèse */}
          <div className="flex flex-wrap items-center justify-center gap-y-4 divide-x divide-border rounded-xl2 border border-border bg-surface py-5">
            <Compteur valeur={compteurs.total} label="Fichiers sélectionnés" />
            <Compteur valeur={compteurs.prets} label="Prêts à importer" couleur="text-verified" />
            <Compteur valeur={compteurs.aCompleter} label="À compléter" couleur="text-warning" />
            <Compteur valeur={compteurs.doublons} label="Doublons" couleur="text-warning" icone={Copy} />
            <Compteur valeur={compteurs.erreurs} label="En erreur" couleur="text-danger" />
            <Compteur valeur={`${compteurs.avecPochette}/${compteurs.total}`} label="Pochettes intégrées" />
            <Compteur valeur={formaterOctets(compteurs.octets)} label="Taille totale" icone={HardDrive} />
          </div>

          {/* Réglages du lot */}
          <div className="grid grid-cols-1 gap-4 rounded-xl2 border border-border bg-surface p-5 sm:grid-cols-2">
            {estAdmin ? (
              <label className="block">
                <span className="mb-1.5 block text-sm text-ink-muted">Publication</span>
                <select
                  value={modePublication}
                  onChange={(e) => setModePublication(e.target.value as "publier" | "brouillon")}
                  className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent"
                >
                  <option value="publier">Publier immédiatement</option>
                  <option value="brouillon">Enregistrer en brouillon</option>
                </select>
              </label>
            ) : (
              <p className="rounded-xl border border-border bg-base px-4 py-2.5 text-sm text-ink-muted">
                Vos morceaux partent en brouillon et seront mis en ligne après validation.
              </p>
            )}
            <label className="block">
              <span className="mb-1.5 block text-sm text-ink-muted">Date de sortie</span>
              <select
                value={dateDeSortie}
                onChange={(e) => setDateDeSortie(e.target.value as "maintenant" | "annee")}
                className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent"
              >
                <option value="maintenant">Aujourd&apos;hui</option>
                <option value="annee">Année lue dans les balises</option>
              </select>
            </label>
          </div>

          {/* Liste */}
          <div className="space-y-3">
            {lignes.map((ligne) => (
              <ImportRow
                key={ligne.id}
                ligne={ligne}
                genres={genres}
                artisteVerrouille={Boolean(artisteImpose)}
                albums={ligne.artiste ? albumsParArtiste[ligne.artiste._id] ?? [] : []}
                enLecture={lectureId === ligne.id}
                onLecture={() => basculerLecture(ligne.id)}
                onModifier={(champs) => majLigne(ligne.id, champs)}
                onArtiste={(artiste) => majLigne(ligne.id, { artiste, albumId: "" })}
                onPochette={(f) => remplacerPochette(ligne.id, f)}
                onRetablirPochette={() => retablirPochette(ligne.id)}
                onSupprimer={() => supprimer(ligne.id)}
                onForcerDoublon={(v) => majLigne(ligne.id, { importerMalgreDoublon: v })}
              />
            ))}
          </div>

          {/* Barre d'action */}
          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-border bg-surface/95 p-4 backdrop-blur-md">
            <p className="flex min-w-0 items-center gap-2 text-xs text-ink-muted">
              {compteurs.importes > 0 ? (
                <CircleCheck size={14} className="shrink-0 text-verified" />
              ) : (
                <Info size={14} className="shrink-0" />
              )}
              <span className="min-w-0">
                {compteurs.importes > 0 && `${compteurs.importes} importé${compteurs.importes > 1 ? "s" : ""} · `}
                {compteurs.prets} prêt{compteurs.prets > 1 ? "s" : ""}
                {compteurs.aCompleter > 0 && ` · ${compteurs.aCompleter} à compléter`}
                {compteurs.doublons > 0 && ` · ${compteurs.doublons} doublon${compteurs.doublons > 1 ? "s" : ""} écarté${compteurs.doublons > 1 ? "s" : ""}`}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  for (const l of lignesRef.current) {
                    URL.revokeObjectURL(l.apercuAudio);
                    if (l.apercuPochette) URL.revokeObjectURL(l.apercuPochette);
                  }
                  audioRef.current?.pause();
                  setLectureId(null);
                  setLignes([]);
                }}
                disabled={importEnCours}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
              >
                Tout retirer
              </button>
              <button
                type="button"
                onClick={importer}
                disabled={importEnCours || analyseEnCours || compteurs.prets === 0}
                className="flex items-center gap-1.5 rounded-full bg-accent px-5 py-2 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {importEnCours ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                Importer {compteurs.prets} fichier{compteurs.prets > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </>
      )}

      {lignes.length === 0 && (
        <p className="flex items-center justify-center gap-2 py-6 text-xs text-ink-muted">
          <CircleAlert size={14} />
          Chaque fichier reste sur votre poste tant que vous n&apos;avez pas lancé l&apos;import.
        </p>
      )}
    </div>
  );
}
