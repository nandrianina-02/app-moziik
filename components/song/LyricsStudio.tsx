"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Crosshair,
  Eraser,
  FileUp,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Sparkles,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";
import {
  analyserParoles,
  formaterTemps,
  lireTemps,
  versLRC,
  type LigneEditable,
} from "@/lib/lyrics";

/**
 * L'atelier de paroles : saisie, import LRC, et calage sur l'audio.
 *
 * DEUX MODES, UNE SEULE SOURCE
 *
 * Le mode texte montre les paroles nues, le mode synchronisé montre les
 * mêmes lignes avec leur horodatage. Ils ne stockent pas deux choses
 * différentes : les deux écrivent le champ `lyrics` au format LRC, et
 * passer de l'un à l'autre ne perd rien — une ligne calée reste calée
 * après un passage par le mode texte, tant qu'on n'a pas touché à son
 * contenu.
 *
 * POURQUOI LE CALAGE SE FAIT ICI ET PAS DANS UN OUTIL EXTERNE
 *
 * Caler des paroles demande d'écouter le morceau exactement tel qu'il
 * sera servi — découpe comprise. Un fichier LRC fabriqué ailleurs, à
 * partir du master, décale tout le morceau si l'artiste a rogné deux
 * secondes d'intro. L'atelier lit donc `/api/stream/<id>`, la même
 * adresse que le lecteur.
 */

/** Ce que « reculer » et « avancer » déplacent. */
const SAUT_S = 5;

type Mode = "texte" | "synchro";

function lignesDepuisLRC(brut: string): LigneEditable[] {
  const paroles = analyserParoles(brut);
  return paroles.lignes.map((l) => ({ temps: l.temps, texte: l.texte }));
}

export function LyricsStudio({
  songId,
  valeur,
  onChange,
  className = "",
}: {
  songId: string;
  /** Le LRC courant, tel qu'il sera enregistré. */
  valeur: string;
  onChange: (lrc: string) => void;
  className?: string;
}) {
  const pushToast = useToast();
  const [mode, setMode] = useState<Mode>("texte");
  const [enregistrement, setEnregistrement] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);

  /**
   * Les lignes en cours d'édition, tenues ICI et pas relues du LRC.
   *
   * La version précédente les recalculait depuis `valeur` à chaque frappe.
   * Or `analyserParoles` n'est pas l'inverse de `versLRC` : elle rogne les
   * espaces, et surtout elle **trie par temps en rejetant les lignes non
   * horodatées à la fin**. Dès la deuxième ligne marquée, tout ce qui
   * restait à caler sautait en bas de la liste et le curseur désignait le
   * mauvais vers. C'était le bon comportement pour lire des paroles, et le
   * pire possible pour les écrire.
   *
   * Le sens de circulation est donc à sens unique pendant l'édition :
   * l'état local produit le LRC, jamais l'inverse. On ne relit la chaîne
   * que lorsqu'elle change pour une autre raison que nos propres frappes —
   * un import de fichier, ou l'arrivée du morceau.
   */
  const [lignes, setLignes] = useState<LigneEditable[]>(() => lignesDepuisLRC(valeur));
  const metaRef = useRef<Record<string, string>>(analyserParoles(valeur).meta);
  const dernierEmis = useRef(valeur);

  useEffect(() => {
    if (valeur === dernierEmis.current) return;
    dernierEmis.current = valeur;
    metaRef.current = analyserParoles(valeur).meta;
    setLignes(lignesDepuisLRC(valeur));
  }, [valeur]);

  const calees = lignes.filter((l) => l.temps !== null).length;
  const aDuTexte = lignes.some((l) => l.texte.trim().length > 0);

  /* ------------------------------------------------------------ audio -- */

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enLecture, setEnLecture] = useState(false);
  const [position, setPosition] = useState(0);
  const [duree, setDuree] = useState(0);
  /** La ligne que « Marquer » va caler. */
  const [curseur, setCurseur] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const surTemps = () => setPosition(audio.currentTime);
    const surDuree = () => setDuree(Number.isFinite(audio.duration) ? audio.duration : 0);
    const surPlay = () => setEnLecture(true);
    const surPause = () => setEnLecture(false);
    audio.addEventListener("timeupdate", surTemps);
    audio.addEventListener("loadedmetadata", surDuree);
    audio.addEventListener("play", surPlay);
    audio.addEventListener("pause", surPause);
    return () => {
      audio.removeEventListener("timeupdate", surTemps);
      audio.removeEventListener("loadedmetadata", surDuree);
      audio.removeEventListener("play", surPlay);
      audio.removeEventListener("pause", surPause);
    };
  }, []);

  const basculerLecture = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  }, []);

  const deplacer = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || Infinity, audio.currentTime + delta));
  }, []);

  function allerA(secondes: number) {
    const audio = audioRef.current;
    if (audio) audio.currentTime = secondes;
  }

  /* ---------------------------------------------------------- édition -- */

  const remplacer = useCallback(
    (suivantes: LigneEditable[]) => {
      setLignes(suivantes);
      const lrc = versLRC(suivantes, metaRef.current);
      // Mémorisé avant d'émettre : sans cela, l'écho du parent passerait
      // pour un changement extérieur et rejouerait `analyserParoles` sur
      // ce qu'on vient d'écrire — donc le tri, donc le saut.
      dernierEmis.current = lrc;
      onChange(lrc);
    },
    [onChange]
  );

  function majLigne(i: number, patch: Partial<LigneEditable>) {
    remplacer(lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function supprimerLigne(i: number) {
    const suivantes = lignes.filter((_, j) => j !== i);
    remplacer(suivantes);
    setCurseur((c) => Math.max(0, Math.min(c, suivantes.length - 1)));
  }

  function ajouterLigne(apres: number) {
    const suivantes = [...lignes];
    suivantes.splice(apres + 1, 0, { temps: null, texte: "" });
    remplacer(suivantes);
    setCurseur(apres + 1);
  }

  function deplacerLigne(i: number, sens: -1 | 1) {
    const j = i + sens;
    if (j < 0 || j >= lignes.length) return;
    const suivantes = [...lignes];
    [suivantes[i], suivantes[j]] = [suivantes[j], suivantes[i]];
    remplacer(suivantes);
    setCurseur(j);
  }

  /**
   * Cale la ligne au curseur sur la position courante, puis avance.
   *
   * L'enchaînement — marquer, descendre d'une ligne — est tout l'intérêt
   * de l'outil : on lance le morceau et on tape en rythme. S'arrêter sur
   * la ligne calée obligerait à deux gestes par vers.
   */
  function marquer() {
    const audio = audioRef.current;
    if (!audio || curseur >= lignes.length) return;
    remplacer(lignes.map((l, j) => (j === curseur ? { ...l, temps: audio.currentTime } : l)));
    setCurseur((c) => Math.min(c + 1, lignes.length - 1));
  }

  /* --------------------------------------------------------- fichiers -- */

  async function importerLRC(fichier: File) {
    // 1 Mo : un LRC de mille lignes en fait cinquante. Au-delà, ce n'est
    // pas un fichier de paroles, et on ne veut pas le lire en mémoire.
    if (fichier.size > 1_000_000) {
      pushToast("error", "Ce fichier est trop volumineux pour des paroles.");
      return;
    }
    try {
      const texte = await fichier.text();
      const lu = analyserParoles(texte);
      if (!lu.lignes.some((l) => l.texte.trim())) {
        pushToast("error", "Ce fichier ne contient aucune parole lisible.");
        return;
      }
      onChange(texte.trim());
      setMode(lu.synchronisees ? "synchro" : "texte");
      pushToast(
        "success",
        lu.synchronisees
          ? `${lu.lignes.filter((l) => l.temps !== null).length} lignes synchronisées importées.`
          : "Paroles importées — elles ne sont pas horodatées."
      );
    } catch {
      pushToast("error", "Le fichier n'a pas pu être lu.");
    }
  }

  async function enregistrer() {
    setEnregistrement(true);
    try {
      const res = await fetch(`/api/songs/${songId}/lyrics`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: valeur }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Les paroles n'ont pas été enregistrées."));
      pushToast("success", "Paroles enregistrées.");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setEnregistrement(false);
    }
  }

  function toutEffacer() {
    remplacer([]);
    setCurseur(0);
  }

  /** Retire tous les horodatages sans toucher au texte. */
  function desynchroniser() {
    remplacer(lignes.map((l) => ({ ...l, temps: null })));
  }

  /* ------------------------------------------------------------ rendu -- */

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Barre de mode et actions de fichier */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-border p-0.5" role="tablist">
          {(
            [
              { id: "texte" as Mode, label: "Texte", icone: Type },
              { id: "synchro" as Mode, label: "Synchronisé", icone: Sparkles },
            ]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === m.id ? "bg-accent text-base" : "text-ink-muted hover:text-ink"
              }`}
            >
              <m.icone size={14} /> {m.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => fichierRef.current?.click()}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-accent hover:text-accent"
        >
          <FileUp size={14} /> Importer un .lrc
        </button>
        <input
          ref={fichierRef}
          type="file"
          accept=".lrc,.txt,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importerLRC(f);
            // Remis à zéro pour qu'un second import du même fichier
            // déclenche bien un nouvel évènement.
            e.target.value = "";
          }}
        />

        <span className="ml-auto flex items-center gap-2">
          {aDuTexte && (
            <span className="text-xs text-ink-muted">
              {lignes.filter((l) => l.texte.trim()).length} lignes
              {calees > 0 ? ` · ${calees} calées` : " · non synchronisées"}
            </span>
          )}
          <button
            type="button"
            onClick={enregistrer}
            disabled={enregistrement}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {enregistrement ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer les paroles
          </button>
        </span>
      </div>

      {mode === "texte" ? (
        <ModeTexte
          lignes={lignes}
          // Le texte vient de l'état local, pas d'une relecture du LRC :
          // sinon taper une espace en fin de vers la verrait disparaître
          // aussitôt, rognée par l'analyse.
          paroles={lignes.map((l) => l.texte).join("\n")}
          synchronisees={calees > 0}
          onTexte={(texte) => {
            // Réassocie les horodatages ligne à ligne tant que le nombre
            // de lignes ne change pas : retoucher une faute de frappe ne
            // doit pas défaire une synchronisation faite à la main.
            const nouvelles = texte.split(/\r?\n/);
            const memeDecoupage = nouvelles.length === lignes.length;
            remplacer(
              nouvelles.map((t, i) => ({
                temps: memeDecoupage ? lignes[i].temps : null,
                texte: t,
              }))
            );
          }}
        />
      ) : (
        <ModeSynchro
          lignes={lignes}
          curseur={curseur}
          setCurseur={setCurseur}
          position={position}
          duree={duree}
          enLecture={enLecture}
          onBasculer={basculerLecture}
          onDeplacer={deplacer}
          onAllerA={allerA}
          onMarquer={marquer}
          onMajLigne={majLigne}
          onSupprimer={supprimerLigne}
          onAjouter={ajouterLigne}
          onDeplacerLigne={deplacerLigne}
        />
      )}

      {aDuTexte && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {calees > 0 && (
            <button
              type="button"
              onClick={desynchroniser}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-warning hover:text-warning"
            >
              <Eraser size={13} /> Retirer les horodatages
            </button>
          )}
          <button
            type="button"
            onClick={toutEffacer}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-danger hover:text-danger"
          >
            <Trash2 size={13} /> Supprimer les paroles
          </button>
        </div>
      )}

      {/* Une seule instance, hors des deux modes : la recréer à chaque
          bascule couperait la lecture en cours de calage. */}
      <audio ref={audioRef} src={`/api/stream/${songId}?q=low`} preload="metadata" />
    </div>
  );
}

/* ------------------------------------------------------------- texte -- */

function ModeTexte({
  lignes,
  paroles,
  synchronisees,
  onTexte,
}: {
  lignes: LigneEditable[];
  paroles: string;
  synchronisees: boolean;
  onTexte: (texte: string) => void;
}) {
  return (
    <div className="space-y-2">
      <textarea
        value={paroles}
        onChange={(e) => onTexte(e.target.value)}
        rows={14}
        placeholder={"Écrivez ou collez les paroles, une ligne par vers.\n\nJe marche dans ta lumière\nTu guides tous mes pas"}
        className="w-full resize-y rounded-xl border border-border bg-base px-4 py-3 font-mono text-sm leading-relaxed outline-none focus:border-accent"
      />
      <p className="text-xs text-ink-muted">
        {synchronisees
          ? "Les horodatages sont conservés. Ajouter ou retirer une ligne les remet à zéro — passez en mode synchronisé pour les ajuster."
          : "Une ligne par vers. Passez ensuite en mode synchronisé pour les caler sur l'audio."}
        {lignes.length > 0 && " Les lignes vides séparent les couplets et ne sont pas affichées."}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- synchro -- */

function ModeSynchro({
  lignes,
  curseur,
  setCurseur,
  position,
  duree,
  enLecture,
  onBasculer,
  onDeplacer,
  onAllerA,
  onMarquer,
  onMajLigne,
  onSupprimer,
  onAjouter,
  onDeplacerLigne,
}: {
  lignes: LigneEditable[];
  curseur: number;
  setCurseur: (i: number) => void;
  position: number;
  duree: number;
  enLecture: boolean;
  onBasculer: () => void;
  onDeplacer: (delta: number) => void;
  onAllerA: (s: number) => void;
  onMarquer: () => void;
  onMajLigne: (i: number, patch: Partial<LigneEditable>) => void;
  onSupprimer: (i: number) => void;
  onAjouter: (apres: number) => void;
  onDeplacerLigne: (i: number, sens: -1 | 1) => void;
}) {
  const listeRef = useRef<HTMLOListElement>(null);
  const [saisieTemps, setSaisieTemps] = useState<{ i: number; valeur: string } | null>(null);

  // La ligne au curseur reste visible pendant qu'on descend en rythme.
  //
  // Défilement calculé dans la liste, et non `scrollIntoView` : celui-ci
  // fait aussi défiler tous les ancêtres, donc la page entière — à chaque
  // vers marqué, le formulaire sautait sous les doigts.
  useEffect(() => {
    const liste = listeRef.current;
    const el = liste?.children[curseur] as HTMLElement | undefined;
    if (!liste || !el) return;
    const haut = el.offsetTop;
    const bas = haut + el.offsetHeight;
    if (haut < liste.scrollTop) liste.scrollTop = haut;
    else if (bas > liste.scrollTop + liste.clientHeight) {
      liste.scrollTop = bas - liste.clientHeight;
    }
  }, [curseur]);

  if (lignes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-ink-muted">
        Écrivez d&apos;abord les paroles en mode texte, ou importez un fichier .lrc.
      </p>
    );
  }

  const courante = lignes[curseur];

  return (
    <div className="space-y-3">
      {/* Le poste de pilotage */}
      <div className="rounded-xl2 border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBasculer}
            aria-label={enLecture ? "Mettre en pause" : "Lire"}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-base transition-colors hover:bg-accent-hover"
          >
            {enLecture ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => onDeplacer(-SAUT_S)}
            aria-label={`Reculer de ${SAUT_S} secondes`}
            className="flex h-10 items-center gap-1 rounded-xl border border-border px-3 text-sm text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            <RotateCcw size={15} /> {SAUT_S}s
          </button>
          <button
            type="button"
            onClick={() => onDeplacer(SAUT_S)}
            aria-label={`Avancer de ${SAUT_S} secondes`}
            className="flex h-10 items-center gap-1 rounded-xl border border-border px-3 text-sm text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            <RotateCw size={15} /> {SAUT_S}s
          </button>
          <span className="font-mono text-sm tabular-nums text-ink-muted">
            {formaterTemps(position)} / {duree > 0 ? formaterTemps(duree) : "--:--"}
          </span>
        </div>

        <p className="mt-3 truncate rounded-lg bg-base px-3 py-2 text-sm">
          {courante?.texte?.trim() || <span className="text-ink-muted">Ligne vide</span>}
        </p>

        <button
          type="button"
          onClick={onMarquer}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-base transition-colors hover:bg-accent-hover"
        >
          <Crosshair size={16} /> Marquer le début — {formaterTemps(position)}
        </button>
        <p className="mt-2 text-center text-[11px] text-ink-muted">
          Lancez la lecture et marquez chaque vers au moment où il commence. Le curseur descend
          tout seul.
        </p>
      </div>

      {/* Les lignes */}
      <ol ref={listeRef} className="relative max-h-[420px] space-y-1 overflow-y-auto pr-1">
        {lignes.map((ligne, i) => {
          const auCurseur = i === curseur;
          const enSaisie = saisieTemps?.i === i;
          return (
            <li
              key={i}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                auCurseur ? "border-accent bg-accent/5" : "border-transparent hover:bg-base"
              }`}
            >
              {enSaisie ? (
                <span className="flex shrink-0 items-center gap-1">
                  <input
                    autoFocus
                    value={saisieTemps.valeur}
                    onChange={(e) => setSaisieTemps({ i, valeur: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setSaisieTemps(null);
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onMajLigne(i, { temps: lireTemps(saisieTemps.valeur) });
                        setSaisieTemps(null);
                      }
                    }}
                    aria-label="Horodatage de la ligne"
                    placeholder="00:12.40"
                    className="w-24 rounded-md border border-accent bg-base px-1.5 py-1 font-mono text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onMajLigne(i, { temps: lireTemps(saisieTemps.valeur) });
                      setSaisieTemps(null);
                    }}
                    aria-label="Valider l'horodatage"
                    className="rounded-md p-1 text-accent hover:bg-accent/10"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaisieTemps(null)}
                    aria-label="Annuler"
                    className="rounded-md p-1 text-ink-muted hover:bg-base"
                  >
                    <X size={13} />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCurseur(i);
                    if (ligne.temps !== null) onAllerA(ligne.temps);
                  }}
                  onDoubleClick={() =>
                    setSaisieTemps({ i, valeur: ligne.temps === null ? "" : formaterTemps(ligne.temps) })
                  }
                  title={
                    ligne.temps === null
                      ? "Pas encore calée — double-cliquez pour saisir"
                      : "Écouter à partir d'ici — double-cliquez pour corriger"
                  }
                  className={`w-[74px] shrink-0 rounded-md px-1.5 py-1 text-left font-mono text-xs tabular-nums transition-colors ${
                    ligne.temps === null
                      ? "text-ink-muted/60 hover:bg-base"
                      : "text-accent hover:bg-accent/10"
                  }`}
                >
                  {ligne.temps === null ? "--:--.--" : formaterTemps(ligne.temps)}
                </button>
              )}

              <input
                value={ligne.texte}
                onChange={(e) => onMajLigne(i, { texte: e.target.value })}
                onFocus={() => setCurseur(i)}
                aria-label={`Texte de la ligne ${i + 1}`}
                placeholder="(ligne vide — séparation de couplet)"
                className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-sm outline-none focus:bg-base"
              />

              <span className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => onDeplacerLigne(i, -1)}
                  disabled={i === 0}
                  aria-label="Monter cette ligne"
                  className="rounded-md p-1 text-ink-muted transition-colors hover:bg-base hover:text-ink disabled:opacity-30"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeplacerLigne(i, 1)}
                  disabled={i === lignes.length - 1}
                  aria-label="Descendre cette ligne"
                  className="rounded-md p-1 text-ink-muted transition-colors hover:bg-base hover:text-ink disabled:opacity-30"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onAjouter(i)}
                  aria-label="Insérer une ligne en dessous"
                  className="rounded-md p-1 text-ink-muted transition-colors hover:bg-base hover:text-accent"
                >
                  <Plus size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onSupprimer(i)}
                  aria-label="Supprimer cette ligne"
                  className="rounded-md p-1 text-ink-muted transition-colors hover:bg-base hover:text-danger"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
