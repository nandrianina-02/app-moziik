import { useEffect, useState, type DragEvent } from "react";
import { Check, ExternalLink, FileAudio, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import { adresseSite, api, telechargerAuthentifie } from "../api";
import { Bascule, Bouton, Champ, Chargement, Erreur, Pastille, Selection, Tiroir, ZoneTexte, formatDate, formatDuree, formatNombre } from "../composants";
import { annoncer, confirmer } from "../interactions";
import { adresseImage } from "../session";
import { preferences } from "../preferences";
import { televerser } from "../envoi";
import { decoder, decouper, encoderVersions, type Qualite } from "../encodage";
import { LANGUES, LANGUE_PAR_DEFAUT } from "../metadonnees";
import { albumsDe, typeVideo } from "../televersements";
import type { ArtisteOption } from "../artistes";
import type { FichierAudio, PochetteLue } from "../../../partage/types";
import { ArtisteChoisi, AssistanceIA, ChampDecoupe, ChampParoles, ChoixArtiste, Compteur, DoublonEnDirect, Ecouteur, Invites, Libelle, SaisieTags, Section, Tempo, ZoneClip, ZoneImage, messageDe, type Decoupe, type SourceTempo } from "./champsTitre";
import clsx from "../clsx";

/*
 * La modification d'un titre du catalogue : tout ce que permet la page
 * /son/[id]/modifier du site, sur les mêmes routes (GET et PATCH
 * /api/songs/[id]), plus ce que l'administration y fait d'autre (validation,
 * refus, remise en attente, suppression).
 *
 * Deux règles du site guident l'enregistrement :
 * - une date de sortie envoyée fait passer le titre en « publié » ou
 *   « programmé » : elle n'est envoyée que pour un titre déjà publié ou
 *   programmé, et seulement si elle a changé (une correction ne redate pas) ;
 * - changer la découpe d'un titre qui a ses qualités d'écoute exige de les
 *   renvoyer encodées de nouveau (sinon 409) : on les refait ici, depuis la
 *   source relue sur le site, avant d'enregistrer.
 */

type Statut = "draft" | "scheduled" | "published" | "rejected";

interface Titre {
  _id: string;
  title: string;
  artist?: { _id: string; stageName: string; verified?: boolean; coverUrl?: string } | null;
  featuring?: { artist?: { _id: string; stageName: string; verified?: boolean } | null; confirmed?: boolean }[];
  album?: { _id: string; title: string; type?: string } | null;
  audioUrl?: string;
  audioVariantes?: Record<Qualite, string> | null;
  videoUrl?: string;
  coverUrl?: string;
  duration: number;
  originalDuration?: number;
  trimStart?: number | null;
  trimEnd?: number | null;
  genre: string;
  language?: string;
  lyrics?: string;
  description?: string;
  tags?: string[];
  composer?: string;
  producer?: string;
  bpm?: number;
  bpmSource?: SourceTempo;
  musicalKey?: string;
  isrc?: string;
  copyright?: string;
  explicit?: boolean;
  status: Statut;
  releaseDate?: string;
  univers?: string;
  playsCount?: number;
  likesCount?: number;
  sharesCount?: number;
  createdAt?: string;
}

/** Ce que la liste du catalogue doit savoir après une modification. */
export interface Resume {
  _id: string;
  title: string;
  genre: string;
  status: Statut;
  releaseDate?: string;
  explicit?: boolean;
  coverUrl?: string;
  duration: number;
  artist?: { _id: string; stageName: string; verified?: boolean } | null;
  featuring?: { artist?: { _id: string; stageName: string } | null }[];
}

const STATUTS: Record<Statut, { libelle: string; ton: "succes" | "attention" | "danger" }> = {
  published: { libelle: "Publié", ton: "succes" },
  scheduled: { libelle: "Programmé", ton: "attention" },
  draft: { libelle: "En attente", ton: "attention" },
  rejected: { libelle: "Refusé", ton: "danger" },
};

/** Date et heure à Antananarivo (UTC+3), le fuseau par défaut du formulaire du site. */
function enLocal(iso?: string): { date: string; heure: string } {
  if (!iso) return { date: "", heure: "00:00" };
  const t = new Date(new Date(iso).getTime() + 3 * 3600_000).toISOString();
  return { date: t.slice(0, 10), heure: t.slice(11, 16) };
}

interface Formulaire {
  titre: string;
  artiste: ArtisteOption | null;
  featuring: ArtisteOption[];
  /** "" : single ; "nouveau" : un album créé à l'enregistrement, nommé par `nouvelAlbum`. */
  albumId: string;
  nouvelAlbum: string;
  genre: string;
  langue: string;
  date: string;
  heure: string;
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
  bpmSource?: SourceTempo;
  decoupe: Decoupe;
  pochette: PochetteLue | null;
  audio: { fichier: FichierAudio; duree: number } | null;
  clip: { mode: "garder" | "retirer" } | { mode: "nouveau"; fichier: FichierAudio };
}

function depuisTitre(t: Titre): Formulaire {
  const { date, heure } = enLocal(t.releaseDate);
  return {
    titre: t.title,
    artiste: t.artist ? { _id: t.artist._id, stageName: t.artist.stageName, verified: t.artist.verified, coverUrl: t.artist.coverUrl } : null,
    featuring: (t.featuring ?? []).map((f) => f.artist).filter((a): a is { _id: string; stageName: string; verified?: boolean } => Boolean(a)),
    albumId: t.album?._id ?? "",
    nouvelAlbum: "",
    genre: t.genre,
    langue: t.language || LANGUE_PAR_DEFAUT,
    date,
    heure,
    explicite: Boolean(t.explicit),
    description: t.description ?? "",
    tags: t.tags ?? [],
    paroles: t.lyrics ?? "",
    compositeur: t.composer ?? "",
    producteur: t.producer ?? "",
    copyright: t.copyright ?? "",
    isrc: t.isrc ?? "",
    tonalite: t.musicalKey ?? "",
    bpm: t.bpm ? String(t.bpm) : "",
    bpmSource: t.bpmSource,
    decoupe: { debut: t.trimStart ?? null, fin: t.trimEnd ?? null },
    pochette: null,
    audio: null,
    clip: { mode: "garder" },
  };
}

export function EditionTitre({ id, genres, fonctionsIA, onFermer, onModifie, onSupprime }: { id: string; genres: string[]; fonctionsIA: string[]; onFermer: () => void; onModifie: (r: Resume) => void; onSupprime: (id: string) => void }) {
  const [titre, setTitre] = useState<Titre | null>(null);
  const [f, setF] = useState<Formulaire | null>(null);
  const [initial, setInitial] = useState<string>("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [etape, setEtape] = useState<string | null>(null);
  const [albums, setAlbums] = useState<{ _id: string; title: string; type?: string }[]>([]);

  useEffect(() => {
    let actif = true;
    api<{ song: Titre }>(`/api/songs/${id}`)
      .then((r) => {
        if (!actif) return;
        setTitre(r.song);
        const formulaire = depuisTitre(r.song);
        setF(formulaire);
        setInitial(JSON.stringify(formulaire));
      })
      .catch((e: Error) => actif && setErreur(e.message));
    return () => {
      actif = false;
    };
  }, [id]);

  const artisteId = f?.artiste?._id;
  useEffect(() => {
    if (!artisteId) return setAlbums([]);
    let actif = true;
    void albumsDe(artisteId).then((a) => actif && setAlbums(a));
    return () => {
      actif = false;
    };
  }, [artisteId]);

  const maj = (p: Partial<Formulaire>) => setF((avant) => (avant ? { ...avant, ...p } : avant));
  const modifie = f !== null && JSON.stringify(f) !== initial;
  const occupe = etape !== null;

  // La source d'écoute et de mesure : le nouveau fichier choisi, sinon l'original relu sur le site (brut, avec le jeton).
  const lireAudio = async () => (f?.audio ? new Blob([await window.bureau.lireFichier(f.audio.fichier.chemin)]) : telechargerAuthentifie(`/api/stream/${id}?brut=1`));
  const dureeComplete = f?.audio ? f.audio.duree : (titre?.originalDuration ?? titre?.duration ?? 0);
  const decoupeChangee = titre && f ? (f.decoupe.debut ?? null) !== (titre.trimStart ?? null) || (f.decoupe.fin ?? null) !== (titre.trimEnd ?? null) : false;
  const dateModifiable = titre?.status === "published" || titre?.status === "scheduled";

  async function fermer() {
    if (occupe) return;
    if (modifie && !(await confirmer({ titre: "Fermer sans enregistrer ?", message: "Les modifications de cette fiche seront perdues.", confirmer: "Fermer sans enregistrer", danger: true }))) return;
    onFermer();
  }

  /** Les trois qualités d'écoute, découpe appliquée, depuis une source donnée. */
  async function qualitesDepuis(source: Blob, nom: string, duree: number): Promise<Record<Qualite, string> | null> {
    if (!preferences().qualites) return null;
    try {
      setEtape("Encodage des qualités d'écoute");
      const canaux = decouper(await decoder(source), f!.decoupe.debut, f!.decoupe.fin);
      const versions = await encoderVersions(canaux, (v) => setEtape(`Encodage ${Math.round(v * 100)} %`));
      const ids = {} as Record<Qualite, string>;
      for (const [qualite, blob] of Object.entries(versions) as [Qualite, Blob][]) {
        setEtape(`Envoi de la qualité ${qualite === "low" ? "basse" : qualite === "medium" ? "moyenne" : "haute"}`);
        ids[qualite] = await televerser(blob, `${nom}-${qualite}.mp3`, "audio/mpeg", "songs", duree, () => undefined);
      }
      return ids;
    } catch {
      // Sans qualités, le site lit la source : le titre reste écoutable.
      return null;
    }
  }

  async function enregistrer() {
    if (!titre || !f || occupe) return;
    if (!f.titre.trim()) return setErreur("Le titre est vide.");
    if (!f.artiste) return setErreur("Choisissez l'artiste principal.");
    if (f.albumId === "nouveau" && !f.nouvelAlbum.trim()) return setErreur("Donnez un nom au nouvel album.");
    setErreur(null);
    const notes: string[] = [];
    try {
      const nom = `${f.artiste.stageName} - ${f.titre.trim()}`;
      const corps: Record<string, unknown> = {
        title: f.titre.trim(),
        genre: f.genre,
        language: f.langue,
        explicit: f.explicite,
        description: f.description.slice(0, 1000),
        tags: f.tags,
        lyrics: f.paroles.slice(0, 20000),
        composer: f.compositeur.trim(),
        producer: f.producteur.trim(),
        copyright: f.copyright.trim(),
        isrc: f.isrc.trim(),
        musicalKey: f.tonalite.trim(),
        featuringIds: f.featuring.map((a) => a._id).filter((x) => x !== f.artiste!._id),
        trimStart: f.decoupe.debut,
        trimEnd: f.decoupe.fin,
      };
      const bpm = Number(f.bpm);
      if (bpm > 0) Object.assign(corps, { bpm: Math.round(bpm), bpmSource: f.bpmSource ?? "manuel" });
      if (f.artiste._id !== titre.artist?._id) corps.artistId = f.artiste._id;

      // Pochette.
      let coverUrl = titre.coverUrl ?? "";
      if (f.pochette) {
        setEtape("Envoi de la pochette");
        const octets = Uint8Array.from(atob(f.pochette.base64), (c) => c.charCodeAt(0));
        const ext = f.pochette.mime.includes("png") ? "png" : f.pochette.mime.includes("webp") ? "webp" : "jpg";
        coverUrl = `/media/${await televerser(new Blob([octets], { type: f.pochette.mime }), `${nom}.${ext}`, f.pochette.mime, "covers", undefined, () => undefined)}`;
        corps.coverUrl = coverUrl;
      }

      // Audio : un fichier remplacé, ou la même source avec une autre découpe.
      if (f.audio) {
        setEtape("Envoi du nouveau fichier audio");
        const source = new Blob([await window.bureau.lireFichier(f.audio.fichier.chemin)]);
        const type = /\.flac$/i.test(f.audio.fichier.nom) ? "audio/flac" : /\.wav$/i.test(f.audio.fichier.nom) ? "audio/wav" : /\.(m4a|aac)$/i.test(f.audio.fichier.nom) ? "audio/mp4" : /\.(ogg|opus)$/i.test(f.audio.fichier.nom) ? "audio/ogg" : "audio/mpeg";
        const ext = f.audio.fichier.nom.slice(f.audio.fichier.nom.lastIndexOf(".") + 1).toLowerCase();
        const sourceId = await televerser(new Blob([source], { type }), `${nom}.${ext}`, type, "songs", f.audio.duree, (p) => setEtape(`Envoi du nouveau fichier audio ${p} %`));
        corps.audioUrl = `ks:${sourceId}`;
        corps.duration = f.audio.duree;
        const variantes = await qualitesDepuis(source, nom, f.audio.duree);
        corps.audioVariantes = variantes;
        if (!variantes) notes.push("sans qualités d'écoute (le site lit la source)");
      } else if (decoupeChangee && titre.audioUrl?.startsWith("ks:")) {
        setEtape("Lecture du fichier d'origine");
        const source = await telechargerAuthentifie(`/api/stream/${id}?brut=1`);
        const variantes = await qualitesDepuis(source, nom, dureeComplete);
        corps.audioVariantes = variantes;
        if (!variantes) notes.push("découpe enregistrée sans qualités d'écoute (le site lit la source)");
      }

      // Clip : nouveau, retiré (chaîne vide), ou inchangé (absent du corps).
      if (f.clip.mode === "nouveau") {
        setEtape("Envoi du clip");
        const typeClip = typeVideo(f.clip.fichier.nom);
        const octets = await window.bureau.lireFichier(f.clip.fichier.chemin);
        corps.videoUrl = `/media/${await televerser(new Blob([octets], { type: typeClip }), f.clip.fichier.nom, typeClip, "videos", undefined, (p) => setEtape(`Envoi du clip ${p} %`))}`;
      } else if (f.clip.mode === "retirer") corps.videoUrl = "";

      // Date de sortie : seulement pour un titre déjà publié ou programmé, et seulement si elle a changé.
      const avant = enLocal(titre.releaseDate);
      if (dateModifiable && f.date && (f.date !== avant.date || f.heure !== avant.heure)) {
        corps.releaseDate = new Date(`${f.date}T${f.heure || "00:00"}:00+03:00`).toISOString();
      }

      // Album : existant, single, ou créé maintenant chez l'artiste.
      if (f.albumId === "nouveau") {
        setEtape("Création de l'album");
        const { album } = await api<{ album: { _id: string } }>("/api/albums", {
          corps: { title: f.nouvelAlbum.trim(), coverUrl, type: "album", releaseDate: (corps.releaseDate as string) ?? titre.releaseDate ?? new Date().toISOString(), artistId: f.artiste._id },
        });
        corps.albumId = album._id;
      } else corps.albumId = f.albumId;

      setEtape("Enregistrement");
      const { song } = await api<{ song: Titre }>(`/api/songs/${id}`, { methode: "PATCH", corps });
      setTitre(song);
      const neuf = depuisTitre(song);
      setF(neuf);
      setInitial(JSON.stringify(neuf));
      onModifie(resume(song));
      annoncer(notes.length ? `Enregistré, ${notes.join(", ")}` : "Titre enregistré");
    } catch (e) {
      setErreur(messageDe(e, "L'enregistrement a échoué."));
    } finally {
      setEtape(null);
    }
  }

  async function decider(decision: "approve" | "reject") {
    if (!titre) return;
    const ok = await confirmer(
      decision === "reject"
        ? { titre: `Refuser « ${titre.title} » ?`, message: "Le titre ne sera plus visible du public. L'artiste voit le refus dans son espace.", confirmer: "Refuser", danger: true }
        : { titre: `Valider « ${titre.title} » ?`, message: "Il sera publié aussitôt, ou à sa date de sortie si elle est à venir.", confirmer: "Valider et publier" },
    );
    if (!ok) return;
    setEtape(decision === "approve" ? "Validation" : "Refus");
    try {
      await api(`/api/admin/songs/${id}/moderate`, { corps: { decision } });
      const { song } = await api<{ song: Titre }>(`/api/songs/${id}`);
      setTitre(song);
      onModifie(resume(song));
      annoncer(decision === "approve" ? "Titre validé" : "Titre refusé");
    } catch (e) {
      setErreur(messageDe(e, "Décision refusée."));
    } finally {
      setEtape(null);
    }
  }

  async function remettreEnAttente() {
    if (!titre) return;
    const ok = await confirmer({ titre: `Retirer « ${titre.title} » du public ?`, message: "Le titre repasse en attente de validation : il n'est plus écoutable ni visible tant qu'il n'est pas validé de nouveau.", confirmer: "Remettre en attente", danger: true });
    if (!ok) return;
    setEtape("Remise en attente");
    try {
      const { song } = await api<{ song: Titre }>(`/api/songs/${id}`, { methode: "PATCH", corps: { status: "draft" } });
      setTitre(song);
      onModifie(resume(song));
      annoncer("Titre remis en attente");
    } catch (e) {
      setErreur(messageDe(e, "Changement refusé."));
    } finally {
      setEtape(null);
    }
  }

  async function supprimer() {
    if (!titre) return;
    const ok = await confirmer({
      titre: `Supprimer « ${titre.title} » ?`,
      message: "Le titre disparaît du catalogue, des playlists et des statistiques, et ses fichiers sont retirés du stockage. C'est définitif.",
      confirmer: "Supprimer définitivement",
      danger: true,
    });
    if (!ok) return;
    setEtape("Suppression");
    try {
      await api(`/api/songs/${id}`, { methode: "DELETE" });
      annoncer("Titre supprimé");
      onSupprime(id);
    } catch (e) {
      setErreur(messageDe(e, "Suppression refusée."));
      setEtape(null);
    }
  }

  const apercuPochette = f?.pochette ? `data:${f.pochette.mime};base64,${f.pochette.base64}` : adresseImage(titre?.coverUrl ?? null);
  const statut = titre ? STATUTS[titre.status] : null;

  return (
    <Tiroir
      titre={titre?.title ?? "Titre"}
      sousTitre={titre ? `${titre.artist?.stageName ?? ""}${titre.album ? ` · ${titre.album.title}` : ""}` : undefined}
      largeur={640}
      onFermer={() => void fermer()}
      pied={
        <div className="flex items-center justify-between gap-3">
          <span className={clsx("min-w-0 truncate text-[12.5px]", etape ? "text-accent" : "text-texte-2")}>{etape ? `${etape}…` : modifie ? "Modifications non enregistrées." : "Aucune modification."}</span>
          <div className="flex shrink-0 items-center gap-2">
            {modifie && !occupe && titre && (
              <Bouton variante="discret" onClick={() => setF(depuisTitre(titre))} title="Annuler les modifications de la fiche">
                <Undo2 size={14} /> Annuler
              </Bouton>
            )}
            <Bouton enCours={etape === "Enregistrement"} disabled={!modifie || occupe} onClick={() => void enregistrer()}>
              <Check size={14} /> Enregistrer
            </Bouton>
          </div>
        </div>
      }
    >
      {!titre || !f ? (
        erreur ? <Erreur message={erreur} /> : <Chargement texte="Lecture du titre" />
      ) : (
        <fieldset disabled={occupe} className="min-w-0 space-y-7">
          <div className="flex gap-5">
            <ZoneImage apercu={apercuPochette} legende={f.pochette ? "Nouvelle image (envoyée à l'enregistrement)" : "Pochette en ligne"} onImage={(pochette) => maj({ pochette })} retour={f.pochette ? { libelle: "Garder la pochette en ligne", action: () => maj({ pochette: null }) } : undefined} />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {statut && <Pastille texte={statut.libelle} ton={statut.ton} />}
                <span className="text-[12.5px] text-texte-2 tabular-nums">{formatDuree(titre.duration)}</span>
                {titre.univers && <span className="text-[12.5px] text-texte-3">{titre.univers === "christian" ? "Évangélique" : "Général"}</span>}
                {!titre.audioVariantes && titre.audioUrl?.startsWith("ks:") && <Pastille texte="sans qualités" ton="attention" />}
              </div>
              <Ecouteur cle={f.audio?.fichier.chemin ?? id} source={lireAudio} duree={dureeComplete} decoupe={f.decoupe} />
              <dl className="grid grid-cols-3 gap-2 border-y border-filet py-2 text-[12px]">
                <div>
                  <dt className="text-texte-3">Écoutes</dt>
                  <dd className="font-semibold tabular-nums">{formatNombre(titre.playsCount ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-texte-3">J'aime</dt>
                  <dd className="font-semibold tabular-nums">{formatNombre(titre.likesCount ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-texte-3">Ajouté</dt>
                  <dd className="font-semibold">{formatDate(titre.createdAt)}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-1.5">
                {(titre.status === "draft" || titre.status === "rejected") && (
                  <Bouton className="h-8 text-[12.5px]" onClick={() => void decider("approve")}>
                    <Check size={13} /> Valider
                  </Bouton>
                )}
                {(titre.status === "published" || titre.status === "scheduled") && (
                  <Bouton variante="trait" className="h-8 text-[12.5px]" onClick={() => void remettreEnAttente()}>
                    <RotateCcw size={13} /> Remettre en attente
                  </Bouton>
                )}
                {titre.status !== "rejected" && (
                  <Bouton variante="trait" className="h-8 text-[12.5px]" onClick={() => void decider("reject")}>
                    <X size={13} /> Refuser
                  </Bouton>
                )}
                <Bouton variante="discret" className="h-8 text-[12.5px]" onClick={() => void window.bureau.ouvrirExterne(`${adresseSite()}/son/${id}`)}>
                  <ExternalLink size={13} /> Sur le site
                </Bouton>
              </div>
            </div>
          </div>
          <Erreur message={erreur} />

          <Section titre="Identité">
            <Champ libelle="Titre" value={f.titre} maxLength={200} onChange={(e) => maj({ titre: e.target.value })} />
            <DoublonEnDirect titre={f.titre} artisteId={f.artiste?._id} exclure={id} />
            <div>
              <Libelle>Artiste principal</Libelle>
              {f.artiste ? (
                <ArtisteChoisi artiste={f.artiste} onRetirer={() => maj({ artiste: null })} />
              ) : (
                <ChoixArtiste onChoisir={(a) => maj({ artiste: a, featuring: f.featuring.filter((x) => x._id !== a._id), albumId: "" })} />
              )}
              {f.artiste && titre.artist && f.artiste._id !== titre.artist._id && <p className="mt-1 text-[12px] text-attention">Le titre passera chez {f.artiste.stageName} ; son album est remis à « single » sauf choix d'un album de cet artiste.</p>}
            </div>
            <Invites featuring={f.featuring} exclure={f.artiste ? [f.artiste._id] : []} onChange={({ featuring }) => maj({ featuring })} />
          </Section>

          <Section titre="Publication">
            <div className="grid grid-cols-2 gap-3">
              <Selection libelle="Genre" value={f.genre} onChange={(e) => maj({ genre: e.target.value })}>
                {!genres.includes(f.genre) && <option value={f.genre}>{f.genre}</option>}
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Selection>
              <Selection libelle="Langue" value={f.langue} onChange={(e) => maj({ langue: e.target.value })}>
                {!LANGUES.includes(f.langue) && <option value={f.langue}>{f.langue}</option>}
                {LANGUES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </Selection>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Selection libelle="Album" value={f.albumId} onChange={(e) => maj({ albumId: e.target.value })}>
                <option value="">Single (sans album)</option>
                {f.albumId && f.albumId !== "nouveau" && !albums.some((a) => a._id === f.albumId) && titre.album && <option value={titre.album._id}>{titre.album.title}</option>}
                {albums.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.title}
                    {a.type && a.type !== "album" ? ` (${a.type})` : ""}
                  </option>
                ))}
                <option value="nouveau">Nouvel album…</option>
              </Selection>
              {f.albumId === "nouveau" && <Champ libelle="Nom du nouvel album" value={f.nouvelAlbum} maxLength={200} onChange={(e) => maj({ nouvelAlbum: e.target.value })} />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle="Date de sortie" type="date" value={f.date} disabled={!dateModifiable} onChange={(e) => maj({ date: e.target.value })} />
              <Champ libelle="Heure (Antananarivo)" type="time" value={f.heure} disabled={!dateModifiable} onChange={(e) => maj({ heure: e.target.value })} />
            </div>
            <p className="-mt-1.5 text-[12px] text-texte-3">
              {!dateModifiable
                ? "Titre en attente : la date se modifie une fois le titre validé (l'enregistrer la publierait sans validation)."
                : f.date && new Date(`${f.date}T${f.heure || "00:00"}:00+03:00`).getTime() > Date.now()
                  ? "Date à venir : la sortie sera programmée."
                  : "Date passée : le titre reste publié, avec cette date de sortie."}
            </p>
            <div className="divide-y divide-filet border-y border-filet">
              <Bascule libelle="Contenu explicite" aide="Paroles réservées à un public averti." valeur={f.explicite} onChange={(v) => maj({ explicite: v })} disabled={occupe} />
            </div>
          </Section>

          {fonctionsIA.includes("publication") && (
            <AssistanceIA
              titre={f.titre}
              artiste={f.artiste?.stageName ?? ""}
              paroles={f.paroles}
              album={albums.find((a) => a._id === f.albumId)?.title ?? f.nouvelAlbum}
              valeurs={{ genre: f.genre, langue: f.langue, tags: f.tags, description: f.description }}
              genres={genres}
              onChange={maj}
            />
          )}

          <Section titre="Présentation">
            <div>
              <ZoneTexte libelle="Description" value={f.description} maxLength={1000} onChange={(e) => maj({ description: e.target.value })} placeholder="L'histoire du titre, son contexte, les musiciens…" />
              <Compteur valeur={f.description.length} max={1000} />
            </div>
            <SaisieTags tags={f.tags} onChange={(tags) => maj({ tags })} />
            <ChampParoles valeur={f.paroles} onChange={(paroles) => maj({ paroles })} />
          </Section>

          <Section titre="Crédits et données techniques">
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle="Compositeur" value={f.compositeur} maxLength={200} onChange={(e) => maj({ compositeur: e.target.value })} />
              <Champ libelle="Producteur" value={f.producteur} maxLength={200} onChange={(e) => maj({ producteur: e.target.value })} />
              <Champ libelle="Copyright" value={f.copyright} maxLength={300} onChange={(e) => maj({ copyright: e.target.value })} />
              <Champ libelle="ISRC" value={f.isrc} maxLength={20} onChange={(e) => maj({ isrc: e.target.value.toUpperCase() })} />
              <Champ libelle="Tonalité" value={f.tonalite} maxLength={20} onChange={(e) => maj({ tonalite: e.target.value })} />
              <Tempo bpm={f.bpm} origine={f.bpmSource} audio={lireAudio} onChange={(bpm, bpmSource) => maj({ bpm, bpmSource })} />
            </div>
          </Section>

          <Section titre="Fichiers">
            <RemplacerAudio actuel={f.audio} onChoisir={(audio) => maj({ audio, decoupe: { debut: null, fin: null } })} onAnnuler={() => maj({ audio: null, decoupe: { debut: titre.trimStart ?? null, fin: titre.trimEnd ?? null } })} />
            <ChampDecoupe
              key={f.audio?.fichier.chemin ?? "origine"}
              decoupe={f.decoupe}
              duree={dureeComplete}
              onChange={(decoupe) => maj({ decoupe })}
              note={decoupeChangee && !f.audio ? "Les qualités d'écoute seront encodées de nouveau à l'enregistrement." : undefined}
            />
            <ZoneClip
              actuel={f.clip.mode === "nouveau" ? f.clip.fichier : f.clip.mode === "garder" && titre.videoUrl ? { nom: "Clip en ligne" } : null}
              onChoisir={(fichier) => maj({ clip: { mode: "nouveau", fichier } })}
              onRetirer={() => maj({ clip: titre.videoUrl ? { mode: "retirer" } : { mode: "garder" } })}
            />
          </Section>

          <Section titre="Zone sensible">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12.5px] text-texte-2">Supprimer le titre, ses fichiers et ses statistiques. Pour seulement le retirer du public, préférez « Remettre en attente » ou « Refuser ».</p>
              <Bouton variante="danger" className="shrink-0" onClick={() => void supprimer()}>
                <Trash2 size={14} /> Supprimer
              </Bouton>
            </div>
          </Section>
        </fieldset>
      )}
    </Tiroir>
  );
}

/** Remplacer le fichier audio : choisi ou glissé ; sa durée est lue dans le fichier. */
function RemplacerAudio({ actuel, onChoisir, onAnnuler }: { actuel: { fichier: FichierAudio; duree: number } | null; onChoisir: (a: { fichier: FichierAudio; duree: number }) => void; onAnnuler: () => void }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);
  const [lecture, setLecture] = useState(false);
  async function prendre(fichiers: Promise<FichierAudio[]>) {
    setErreur(null);
    setLecture(true);
    try {
      const fichier = (await fichiers)[0];
      if (!fichier) return;
      const e = await window.bureau.lireEtiquettes(fichier.chemin);
      if (!e.duree) throw new Error("Durée illisible dans ce fichier.");
      onChoisir({ fichier, duree: e.duree });
    } catch (e) {
      setErreur(messageDe(e, "Fichier illisible."));
    } finally {
      setLecture(false);
    }
  }
  function deposer(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSurvol(false);
    const f = e.dataTransfer.files[0];
    if (f) void prendre(window.bureau.resoudreChemins([window.bureau.cheminDe(f)]));
  }
  return (
    <div>
      <Libelle>Fichier audio</Libelle>
      <div
        data-depot
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={deposer}
        className={clsx("flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-[12.5px]", survol ? "border-dashed border-accent" : "border-filet")}
      >
        <span className="flex min-w-0 items-center gap-2">
          <FileAudio size={15} className="shrink-0 text-texte-3" />
          <span className="truncate">{actuel ? `${actuel.fichier.nom} · ${formatDuree(actuel.duree)}` : "Fichier en ligne. Glissez un fichier ici pour le remplacer."}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <Bouton variante="trait" className="h-8 text-[12.5px]" enCours={lecture} onClick={() => void prendre(window.bureau.choisirFichiers())}>
            Remplacer
          </Bouton>
          {actuel && (
            <Bouton variante="discret" className="h-8 text-[12.5px]" onClick={onAnnuler}>
              Garder l'original
            </Bouton>
          )}
        </span>
      </div>
      {actuel && <p className="mt-1 text-[12px] text-texte-3">Le nouveau fichier part à l'enregistrement, avec ses qualités d'écoute ; la découpe repart de zéro.</p>}
      {erreur && <p className="mt-1 text-[12px] text-danger">{erreur}</p>}
    </div>
  );
}

/** Le résumé que la liste du catalogue garde. */
function resume(s: Titre): Resume {
  return {
    _id: s._id,
    title: s.title,
    genre: s.genre,
    status: s.status,
    releaseDate: s.releaseDate,
    explicit: s.explicit,
    coverUrl: s.coverUrl,
    duration: s.duration,
    artist: s.artist ? { _id: s.artist._id, stageName: s.artist.stageName, verified: s.artist.verified } : null,
    featuring: s.featuring?.map((x) => ({ artist: x.artist ? { _id: x.artist._id, stageName: x.artist.stageName } : null })),
  };
}

