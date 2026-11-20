import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, Check, Clapperboard, Gauge, ImagePlus, Loader2, Pause, Play, Plus, Search, Sparkles, Trash2, UserPlus, X } from "lucide-react";
import { api } from "../api";
import { Bouton, Champ, Erreur, formatDuree } from "../composants";
import { annoncer, confirmer } from "../interactions";
import { adresseImage } from "../session";
import { arreter as arreterExtrait } from "../lecture";
import { estimerTempo } from "../bpm";
import { chercherArtistes, creerArtiste, type ArtisteOption } from "../artistes";
import { LANGUES, genreCorrespondant, tagsPropres } from "../metadonnees";
import type { FichierAudio, PochetteLue } from "../../../partage/types";
import clsx from "../clsx";

/*
 * Les champs et outils d'un titre, communs à la fiche d'un fichier à
 * téléverser et à la modification d'un titre du catalogue : les deux
 * reprennent le formulaire du site (/son/nouveau, /son/[id]/modifier).
 */

export interface Decoupe {
  /** Secondes depuis le début du fichier ; null : depuis le début. */
  debut: number | null;
  /** Secondes depuis le début du fichier ; null : jusqu'à la fin. */
  fin: number | null;
}

/** Le message d'une erreur venue du processus principal, sans l'enveloppe d'Electron. */
export const messageDe = (e: unknown, defaut: string) => (e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : defaut);

export function Section({ titre, action, children }: { titre: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-filet pb-2">
        <h3 className="font-titre text-[14px] font-semibold">{titre}</h3>
        {action}
      </div>
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

export const Libelle = ({ children }: { children: ReactNode }) => <span className="mb-1.5 block text-[12px] font-medium text-texte-2">{children}</span>;

export function Compteur({ valeur, max }: { valeur: number; max: number }) {
  return <div className={clsx("mt-1 text-right text-[11px] tabular-nums", valeur > max * 0.9 ? "text-attention" : "text-texte-3")}>{`${valeur.toLocaleString("fr-FR")} / ${max.toLocaleString("fr-FR")}`}</div>;
}

/** Glisser au-dessus d'une zone : elle garde le dépôt pour elle (la coquille ne le reçoit pas). */
function useZoneDepot(recevoir: (f: File) => void) {
  const [survol, setSurvol] = useState(false);
  return {
    survol,
    props: {
      "data-depot": true,
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setSurvol(true);
      },
      onDragLeave: () => setSurvol(false),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setSurvol(false);
        const f = e.dataTransfer.files[0];
        if (f) recevoir(f);
      },
    },
  };
}

/** Une image JPEG, PNG ou WebP, choisie (clic) ou glissée. */
export function ZoneImage({ apercu, legende, onImage, retour }: { apercu: string | null; legende: string; onImage: (p: PochetteLue) => void; retour?: { libelle: string; action: () => void } }) {
  const [erreur, setErreur] = useState<string | null>(null);
  async function prendre(promesse: Promise<PochetteLue | null>) {
    setErreur(null);
    try {
      const p = await promesse;
      if (p) onImage(p);
    } catch (e) {
      setErreur(messageDe(e, "Image illisible."));
    }
  }
  const depot = useZoneDepot((f) => void prendre(window.bureau.lireImage(window.bureau.cheminDe(f))));
  return (
    <div className="w-[168px] shrink-0">
      <div
        {...depot.props}
        onClick={() => void prendre(window.bureau.choisirImage())}
        title="Cliquer ou glisser une image (JPEG, PNG, WebP)"
        className={clsx("relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-xl border bg-surface-2 transition-colors", depot.survol ? "border-dashed border-accent" : "border-filet hover:border-texte-3/50")}
      >
        {apercu ? <img src={apercu} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={26} className="text-texte-3" />}
        {depot.survol && <div className="absolute inset-0 grid place-items-center bg-black/55 text-[12px] font-semibold text-white">Déposer l'image</div>}
      </div>
      <div className="mt-1.5 text-[11.5px] text-texte-3">{legende}</div>
      {retour && (
        <button type="button" onClick={retour.action} className="mt-0.5 text-[11.5px] text-texte-2 hover:text-texte">
          {retour.libelle}
        </button>
      )}
      {erreur && <p className="mt-1 text-[11.5px] text-danger">{erreur}</p>}
    </div>
  );
}

/** Écoute d'un fichier (local ou relu sur le site), depuis le début de la découpe ; un seul son à la fois. */
export function Ecouteur({ source, duree, decoupe, cle }: { source: () => Promise<Blob>; duree: number; decoupe: Decoupe; cle: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const [lecture, setLecture] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [position, setPosition] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  // La découpe peut changer pendant l'écoute : l'arrêt en fin de découpe lit la valeur du moment.
  const bornes = useRef(decoupe);
  bornes.current = decoupe;

  // Une autre source (fichier remplacé) : l'ancienne lecture s'arrête et se libère.
  useEffect(() => {
    return () => {
      audio.current?.pause();
      audio.current = null;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = null;
      setLecture(false);
      setPosition(0);
    };
  }, [cle]);

  async function basculer() {
    if (lecture) return audio.current?.pause();
    arreterExtrait();
    setErreur(null);
    if (!audio.current) {
      setChargement(true);
      try {
        url.current = URL.createObjectURL(await source());
        const a = new Audio(url.current);
        a.ontimeupdate = () => {
          setPosition(a.currentTime);
          const fin = bornes.current.fin;
          if (fin !== null && a.currentTime >= fin) a.pause();
        };
        a.onplay = () => setLecture(true);
        a.onpause = () => setLecture(false);
        a.onended = () => setLecture(false);
        audio.current = a;
      } catch (e) {
        setErreur(messageDe(e, "Lecture impossible."));
        return;
      } finally {
        setChargement(false);
      }
    }
    const a = audio.current;
    const { debut, fin } = bornes.current;
    if (debut !== null && (a.currentTime < debut || (fin !== null && a.currentTime >= fin))) a.currentTime = debut;
    void a.play();
  }

  return (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={() => void basculer()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white hover:opacity-90" title={lecture ? "Pause" : "Écouter"}>
        {chargement ? <Loader2 size={15} className="animate-spin" /> : lecture ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
      </button>
      <div className="text-[12px] text-texte-2 tabular-nums">
        {position > 0 ? formatDuree(position) : "Écouter"}
        {duree ? ` / ${formatDuree(duree)}` : ""}
      </div>
      {erreur && <span className="text-[12px] text-danger">{erreur}</span>}
    </div>
  );
}

/** Le doublon, revérifié à chaque changement de titre ou d'artiste (/api/songs/duplicate), comme sur le site. */
export function DoublonEnDirect({ titre, artisteId, exclure }: { titre: string; artisteId?: string; exclure?: string }) {
  const [doublon, setDoublon] = useState<{ _id: string; title: string; status: string } | null>(null);
  const t = titre.trim();
  useEffect(() => {
    if (!artisteId || t.length < 2) return setDoublon(null);
    let actif = true;
    const minuterie = setTimeout(() => {
      api<{ doublon: { _id: string; title: string; status: string } | null }>(`/api/songs/duplicate?title=${encodeURIComponent(t)}&artistId=${artisteId}${exclure ? `&exclude=${exclure}` : ""}`)
        .then((r) => actif && setDoublon(r.doublon))
        .catch(() => actif && setDoublon(null));
    }, 450);
    return () => {
      actif = false;
      clearTimeout(minuterie);
    };
  }, [artisteId, t, exclure]);
  if (!doublon) return null;
  const etat = { published: "publié", draft: "en attente de validation", scheduled: "programmé", rejected: "refusé" }[doublon.status] ?? doublon.status;
  return (
    <p className="flex items-start gap-2 text-[12.5px] text-attention">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Cet artiste a déjà « {doublon.title} » ({etat}).
    </p>
  );
}

export function ArtisteChoisi({ artiste, onRetirer }: { artiste: ArtisteOption; onRetirer: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-y border-filet py-2">
      <span className="flex min-w-0 items-center gap-2.5 text-[13px]">
        {artiste.coverUrl ? <img src={adresseImage(artiste.coverUrl) ?? undefined} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="h-7 w-7 rounded-full bg-surface-2" />}
        <span className="truncate font-medium">{artiste.stageName}</span>
        {artiste.verified && <Check size={13} className="text-succes" />}
      </span>
      <button type="button" onClick={onRetirer} className="text-[12px] text-texte-2 hover:text-texte">
        Changer
      </button>
    </div>
  );
}

/**
 * Recherche d'un artiste dans les deux univers ; absent, il se crée (compte
 * artiste vérifié), après confirmation : c'est un compte de plus sur le site.
 */
export function ChoixArtiste({ initial = "", onChoisir, exclure = [] }: { initial?: string; onChoisir: (a: ArtisteOption) => void; exclure?: string[] }) {
  const [q, setQ] = useState(initial);
  const [resultats, setResultats] = useState<ArtisteOption[]>([]);
  const [recherche, setRecherche] = useState(false);
  const [creation, setCreation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const exclus = useRef(exclure);
  exclus.current = exclure;

  useEffect(() => {
    const terme = q.trim();
    if (terme.length < 2) return setResultats([]);
    let actif = true;
    setRecherche(true);
    const minuterie = setTimeout(() => {
      void chercherArtistes(terme).then((r) => {
        if (!actif) return;
        setResultats(r.filter((a) => !exclus.current.includes(a._id)));
        setRecherche(false);
      });
    }, 250);
    return () => {
      actif = false;
      clearTimeout(minuterie);
    };
  }, [q]);

  async function creer() {
    const nom = q.trim();
    const ok = await confirmer({ titre: `Créer l'artiste « ${nom} » ?`, message: "Un compte artiste vérifié est créé sur le site, avec une adresse @moziik.app que personne ne lit. Sa photo sera la pochette de son premier titre.", confirmer: "Créer l'artiste" });
    if (!ok) return;
    setCreation(true);
    setErreur(null);
    try {
      const a = await creerArtiste(nom);
      annoncer(`Artiste « ${a.stageName} » créé`);
      onChoisir(a);
    } catch (e) {
      setErreur(messageDe(e, "Création impossible."));
    } finally {
      setCreation(false);
    }
  }

  const exact = resultats.some((a) => a.stageName.trim().toLowerCase() === q.trim().toLowerCase());
  return (
    <div>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texte-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom d'artiste" className="h-9 w-full rounded-lg border border-filet bg-surface-2 pr-3 pl-8 text-[13px] outline-none focus:border-accent" />
        {recherche && <Loader2 size={14} className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-texte-3" />}
      </div>
      {q.trim().length >= 2 && (
        <ul className="mt-1 max-h-56 divide-y divide-filet overflow-auto rounded-lg border border-filet">
          {resultats.map((a) => (
            <li key={a._id}>
              <button type="button" onClick={() => onChoisir(a)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-surface-2">
                {a.coverUrl ? <img src={adresseImage(a.coverUrl) ?? undefined} alt="" className="h-6 w-6 rounded-full object-cover" /> : <span className="h-6 w-6 rounded-full bg-surface-2" />}
                <span className="truncate">{a.stageName}</span>
                {a.verified && <Check size={13} className="text-succes" />}
              </button>
            </li>
          ))}
          {!exact && !recherche && (
            <li>
              <button type="button" onClick={() => void creer()} disabled={creation} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-accent hover:bg-surface-2">
                {creation ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Créer l'artiste « {q.trim()} »
              </button>
            </li>
          )}
        </ul>
      )}
      {erreur && <p className="mt-1 text-[12px] text-danger">{erreur}</p>}
    </div>
  );
}

/**
 * Les invités : ceux rattachés à un profil, ceux lus dans le fichier sans
 * profil (à rattacher, créer ou ignorer), et l'ajout.
 */
export function Invites({ featuring, nonTrouves = [], exclure, onChange }: { featuring: ArtisteOption[]; nonTrouves?: string[]; exclure: string[]; onChange: (v: { featuring: ArtisteOption[]; nonTrouves: string[] }) => void }) {
  const [ajout, setAjout] = useState<string | null>(null);
  function ajouter(a: ArtisteOption, nomLu?: string) {
    onChange({ featuring: featuring.some((f) => f._id === a._id) ? featuring : [...featuring, a], nonTrouves: nomLu ? nonTrouves.filter((n) => n !== nomLu) : nonTrouves });
    setAjout(null);
  }
  return (
    <div>
      <Libelle>Invités (featuring)</Libelle>
      {(featuring.length > 0 || nonTrouves.length > 0) && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {featuring.map((f) => (
            <span key={f._id} className="inline-flex items-center gap-1.5 rounded-full border border-filet py-1 pr-1.5 pl-2.5 text-[12.5px]">
              {f.stageName}
              <button type="button" onClick={() => onChange({ featuring: featuring.filter((x) => x._id !== f._id), nonTrouves })} title="Retirer" className="text-texte-3 hover:text-texte">
                <X size={13} />
              </button>
            </span>
          ))}
          {nonTrouves.map((n) => (
            <span key={n} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-attention/60 py-1 pr-1.5 pl-2.5 text-[12.5px] text-attention" title="Lu dans le fichier, sans profil sur Moziik">
              {n}
              <button type="button" onClick={() => setAjout(n)} title="Rattacher ou créer" className="hover:text-texte">
                <Search size={13} />
              </button>
              <button type="button" onClick={() => onChange({ featuring, nonTrouves: nonTrouves.filter((x) => x !== n) })} title="Ignorer" className="hover:text-texte">
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
      {ajout !== null ? (
        <div className="space-y-1.5">
          <ChoixArtiste key={ajout} initial={ajout} exclure={[...exclure, ...featuring.map((f) => f._id)]} onChoisir={(a) => ajouter(a, ajout || undefined)} />
          <button type="button" onClick={() => setAjout(null)} className="text-[12px] text-texte-2 hover:text-texte">
            Annuler
          </button>
        </div>
      ) : (
        <Bouton variante="trait" className="h-8 text-[12.5px]" onClick={() => setAjout("")}>
          <Plus size={13} /> Ajouter un invité
        </Bouton>
      )}
    </div>
  );
}

/** Les tags comme le site : Entrée ou virgule pour ajouter, Retour arrière pour retirer le dernier, quinze au plus. */
export function SaisieTags({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [saisie, setSaisie] = useState("");
  const valider = () => {
    if (!saisie.trim()) return;
    onChange(tagsPropres([...tags, ...saisie.split(",")]));
    setSaisie("");
  };
  function touche(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      valider();
    } else if (e.key === "Backspace" && !saisie && tags.length) onChange(tags.slice(0, -1));
  }
  return (
    <div>
      <Libelle>Tags</Libelle>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-filet bg-surface-2 px-2 py-1.5 focus-within:border-accent">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-[12px]">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-texte-3 hover:text-texte" title="Retirer">
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={touche}
          onBlur={valider}
          disabled={tags.length >= 15}
          placeholder={tags.length >= 15 ? "Quinze tags au plus" : tags.length ? "" : "soirée, mariage, louange…"}
          className="min-w-[120px] flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-texte-3"
        />
      </div>
    </div>
  );
}

export type SourceTempo = "manuel" | "balise" | "analyse";

/** Le tempo : saisi, lu dans le fichier, ou mesuré (lib/bpm.ts du site). */
export function Tempo({ bpm, origine, audio, onChange }: { bpm: string; origine?: SourceTempo; audio: () => Promise<Blob>; onChange: (bpm: string, origine: SourceTempo) => void }) {
  const [mesure, setMesure] = useState(false);
  async function mesurer() {
    setMesure(true);
    try {
      const r = await estimerTempo(await audio());
      if (!r) return annoncer("Tempo introuvable : pas assez de rythme marqué");
      onChange(String(r.bpm), "analyse");
      annoncer(r.ambigu ? `${r.bpm} BPM, à vérifier (moitié ou double possible)` : `${r.bpm} BPM`);
    } catch {
      annoncer("Mesure du tempo impossible pour ce fichier");
    } finally {
      setMesure(false);
    }
  }
  return (
    <div>
      <Libelle>Tempo (BPM)</Libelle>
      <div className="flex gap-1.5">
        <input
          type="number"
          min={0}
          max={400}
          value={bpm}
          onChange={(e) => onChange(e.target.value, "manuel")}
          className="h-9 w-full min-w-0 rounded-lg border border-filet bg-surface-2 px-3 text-[13px] tabular-nums outline-none focus:border-accent"
        />
        <Bouton variante="trait" className="h-9 shrink-0 px-2.5" enCours={mesure} onClick={() => void mesurer()} title="Mesurer le tempo dans le fichier">
          <Gauge size={14} />
        </Bouton>
      </div>
      {origine && bpm && <span className="mt-1 block text-[11.5px] text-texte-3">{{ balise: "Lu dans le fichier", analyse: "Mesuré", manuel: "Saisi" }[origine]}</span>}
    </div>
  );
}

/** « 1:23 » ou « 83 » → 83 ; vide → null ; illisible → undefined. */
function lireTemps(texte: string): number | null | undefined {
  const t = texte.trim();
  if (!t) return null;
  const m = /^(?:(\d+):)?(\d{1,2}(?:[.,]\d)?)$/.exec(t);
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 60 + Number(m[2].replace(",", "."));
}
const ecrireTemps = (s: number | null) => (s === null ? "" : `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0").replace(/\.0$/, "")}`);

/** La découpe : seule la partie gardée est écoutée sur le site ; la source reste entière. */
export function ChampDecoupe({ decoupe, duree, onChange, note }: { decoupe: Decoupe; duree: number; onChange: (d: Decoupe) => void; note?: string }) {
  const [debut, setDebut] = useState(ecrireTemps(decoupe.debut));
  const [fin, setFin] = useState(ecrireTemps(decoupe.fin));
  const lu = { debut: lireTemps(debut), fin: lireTemps(fin) };
  const invalide = lu.debut === undefined || lu.fin === undefined || (lu.debut ?? 0) >= duree || (lu.fin !== null && lu.fin !== undefined && (lu.fin > duree || lu.fin - (lu.debut ?? 0) < 1));
  function appliquer() {
    if (invalide) return;
    onChange({ debut: lu.debut && lu.debut > 0 ? lu.debut : null, fin: lu.fin !== null && lu.fin !== undefined && lu.fin < duree ? lu.fin : null });
  }
  const garde = (decoupe.fin ?? duree) - (decoupe.debut ?? 0);
  return (
    <div>
      <Libelle>Découpe</Libelle>
      <div className="flex items-end gap-2">
        <Champ libelle="Début" value={debut} onChange={(e) => setDebut(e.target.value)} onBlur={appliquer} placeholder="0:00" className="w-28" />
        <Champ libelle="Fin" value={fin} onChange={(e) => setFin(e.target.value)} onBlur={appliquer} placeholder={duree ? formatDuree(duree) : "fin"} className="w-28" />
        {(decoupe.debut !== null || decoupe.fin !== null) && (
          <Bouton
            variante="discret"
            className="mb-0.5 h-9"
            onClick={() => {
              setDebut("");
              setFin("");
              onChange({ debut: null, fin: null });
            }}
          >
            Morceau entier
          </Bouton>
        )}
      </div>
      <p className={clsx("mt-1 text-[12px]", invalide ? "text-danger" : "text-texte-3")}>
        {invalide
          ? "Temps invalide : m:ss, dans la durée du fichier, une seconde au moins entre début et fin."
          : decoupe.debut === null && decoupe.fin === null
            ? "Le morceau entier est écouté. Le bouton d'écoute respecte la découpe."
            : `${formatDuree(garde)} gardées sur ${formatDuree(duree)}.`}
        {note && !invalide ? ` ${note}` : ""}
      </p>
    </div>
  );
}

/** Le clip vidéo : choisi ou glissé ; « Retirer » l'enlève. */
export function ZoneClip({ actuel, onChoisir, onRetirer }: { actuel: { nom: string; taille?: number } | null; onChoisir: (v: FichierAudio) => void; onRetirer: () => void }) {
  const [erreur, setErreur] = useState<string | null>(null);
  async function prendre(promesse: Promise<FichierAudio | null>) {
    setErreur(null);
    try {
      const v = await promesse;
      if (v) onChoisir(v);
    } catch (e) {
      setErreur(messageDe(e, "Vidéo illisible."));
    }
  }
  const depot = useZoneDepot((f) => void prendre(window.bureau.decrireVideo(window.bureau.cheminDe(f))));
  return (
    <div>
      <Libelle>Clip vidéo</Libelle>
      <div {...depot.props} className={clsx("flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-[12.5px]", depot.survol ? "border-dashed border-accent" : actuel ? "border-filet" : "border-dashed border-filet text-texte-2")}>
        {actuel ? (
          <span className="flex min-w-0 items-center gap-2">
            <Clapperboard size={15} className="shrink-0 text-texte-3" />
            <span className="truncate">{actuel.nom}</span>
            {actuel.taille ? <span className="shrink-0 text-texte-3">{(actuel.taille / 1048576).toFixed(0)} Mo</span> : null}
          </span>
        ) : (
          <span>Facultatif. Glissez une vidéo ici (MP4, MOV, WebM).</span>
        )}
        <span className="flex shrink-0 items-center gap-1.5">
          <Bouton variante="trait" className="h-8 text-[12.5px]" onClick={() => void prendre(window.bureau.choisirVideo())}>
            <Clapperboard size={13} /> {actuel ? "Remplacer" : "Choisir"}
          </Bouton>
          {actuel && (
            <Bouton variante="discret" className="h-8 text-[12.5px]" onClick={onRetirer}>
              <Trash2 size={13} /> Retirer
            </Bouton>
          )}
        </span>
      </div>
      {erreur && <p className="mt-1 text-[12px] text-danger">{erreur}</p>}
    </div>
  );
}

export interface ChampsIA {
  genre: string;
  langue: string;
  tags: string[];
  description: string;
}

interface Proposition {
  genre?: string | null;
  langue?: string | null;
  tags?: string[];
  description?: string | null;
  remarque?: string | null;
}

/**
 * L'assistance du site (POST /api/ai/song-metadata, fonction « publication ») :
 * genre, langue, tags et description proposés d'après le titre et les
 * paroles. Rien n'est appliqué sans un clic.
 */
export function AssistanceIA({ titre, artiste, paroles, album, valeurs, genres, onChange }: { titre: string; artiste: string; paroles: string; album: string; valeurs: ChampsIA; genres: string[]; onChange: (p: Partial<ChampsIA>) => void }) {
  const [proposition, setProposition] = useState<Proposition | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function demander() {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await api<{ proposition: Proposition }>("/api/ai/song-metadata", {
        corps: {
          title: titre.trim().slice(0, 200),
          artistName: artiste.slice(0, 200),
          ...(paroles.trim() ? { lyrics: paroles.slice(0, 8000) } : {}),
          ...(album.trim() ? { album: album.trim().slice(0, 200) } : {}),
          languages: LANGUES,
        },
      });
      setProposition(r.proposition);
    } catch (e) {
      setErreur(messageDe(e, "Suggestion impossible."));
    } finally {
      setEnCours(false);
    }
  }

  const elements: { cle: string; libelle: string; valeur: string; appliquer: Partial<ChampsIA>; deja: boolean }[] = [];
  if (proposition) {
    const genre = proposition.genre ? genreCorrespondant(proposition.genre, genres) : null;
    if (genre) elements.push({ cle: "genre", libelle: "Genre", valeur: genre, appliquer: { genre }, deja: valeurs.genre === genre });
    const langue = proposition.langue;
    if (langue && LANGUES.includes(langue)) elements.push({ cle: "langue", libelle: "Langue", valeur: langue, appliquer: { langue }, deja: valeurs.langue === langue });
    const tags = proposition.tags ?? [];
    if (tags.length) elements.push({ cle: "tags", libelle: "Tags", valeur: tags.join(", "), appliquer: { tags: tagsPropres([...valeurs.tags, ...tags]) }, deja: tags.every((t) => valeurs.tags.includes(t.toLowerCase())) });
    const description = proposition.description;
    if (description) elements.push({ cle: "description", libelle: "Description", valeur: description, appliquer: { description: description.slice(0, 1000) }, deja: valeurs.description === description });
  }

  return (
    <Section titre="Assistance">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-texte-2">Genre, langue, tags et description proposés d'après le titre et les paroles. Rien n'est appliqué sans votre accord.</p>
        <Bouton variante="trait" className="shrink-0" enCours={enCours} disabled={!titre.trim()} onClick={() => void demander()}>
          <Sparkles size={14} /> Proposer
        </Bouton>
      </div>
      {erreur && <Erreur message={erreur} />}
      {proposition && (
        <div className="border-y border-filet">
          {elements.length === 0 && <p className="py-2.5 text-[12.5px] text-texte-3">Aucune proposition exploitable.</p>}
          <ul className="divide-y divide-filet">
            {elements.map((x) => (
              <li key={x.cle} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0 text-[12.5px]">
                  <span className="font-medium">{x.libelle}</span>
                  <p className="mt-0.5 text-texte-2">{x.valeur}</p>
                </div>
                <Bouton variante={x.deja ? "discret" : "trait"} className="h-8 shrink-0 text-[12px]" disabled={x.deja} onClick={() => onChange(x.appliquer)}>
                  {x.deja ? "Appliqué" : "Appliquer"}
                </Bouton>
              </li>
            ))}
          </ul>
          {elements.some((x) => !x.deja) && (
            <div className="flex justify-end py-2.5">
              <Bouton className="h-8 text-[12px]" onClick={() => onChange(Object.assign({}, ...elements.filter((x) => !x.deja).map((x) => x.appliquer)))}>
                Tout appliquer
              </Bouton>
            </div>
          )}
          {proposition.remarque && <p className="pb-2.5 text-[12px] text-texte-3">{proposition.remarque}</p>}
        </div>
      )}
    </Section>
  );
}

/** Paroles : texte brut ou LRC horodaté, reconnu et signalé. */
export function ChampParoles({ valeur, onChange, action }: { valeur: string; onChange: (v: string) => void; action?: ReactNode }) {
  const lrc = /^\s*\[\d{1,2}:\d{2}/m.test(valeur);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Libelle>Paroles{lrc ? " · synchronisées (LRC)" : ""}</Libelle>
        {action}
      </div>
      <textarea
        value={valeur}
        maxLength={20000}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Texte brut, ou LRC horodaté pour le défilement synchronisé."
        className="min-h-[150px] w-full resize-y rounded-lg border border-filet bg-surface-2 px-3 py-2 font-mono text-[12.5px] leading-relaxed outline-none placeholder:font-sans placeholder:text-texte-3 focus:border-accent"
      />
      <Compteur valeur={valeur.length} max={20000} />
    </div>
  );
}
