import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as SourisReact } from "react";
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  Check,
  Crosshair,
  Eraser,
  ExternalLink,
  Eye,
  FileUp,
  Music,
  Pause,
  PenLine,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  Search,
  Trash2,
  Type,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { adresseSite, api, telechargerAuthentifie } from "../api";
import { BarreCollante, Barres, Bouton, Chargement, EnTete, Erreur, Pagination, Pastille, Table, Tiroir, Vide, formatNombre } from "../composants";
import { annoncer, classeChoisi, confirmer, ouvrirMenu, useSelection } from "../interactions";
import { arreter } from "../lecture";
import { usePageActive } from "../page";
import { adresseImage } from "../session";
import clsx from "../clsx";
import { analyserParoles, formaterTemps, ligneActive, lireTemps, versLRC, type LigneEditable } from "../paroles";

/*
 * Les paroles du catalogue : ce qui manque, ce qui reste à caler, et
 * l'atelier de synchronisation ouvert sur place. Reprend la page
 * /admin/paroles du site et son atelier (LyricsStudio), avec ce qu'un
 * poste de travail permet en plus : raccourcis clavier pour caler en
 * rythme, dépôt d'un fichier .lrc, aperçu du défilement.
 */

type Etat = "aucune" | "texte" | "synchro";

interface Titre {
  _id: string;
  title: string;
  coverUrl?: string;
  status: string;
  playsCount?: number;
  etat: Etat;
  artist?: { stageName?: string } | null;
}

interface Reponse {
  compteurs: Record<Etat, number>;
  titres: Titre[];
  suite: boolean;
  page: number;
}

/** La taille de page du site : la pagination se calcule sur la même. */
const PAR_PAGE = 30;
/** Le plafond de la route PUT : vérifié avant l'envoi pour un message clair. */
const MAX_CARACTERES = 20000;
/** Ce que « reculer » et « avancer » déplacent, comme sur le site. */
const SAUT_S = 5;
/** Le pas d'ajustement fin d'un horodatage. */
const PAS_S = 0.1;

const FILTRES: { valeur: Etat | null; libelle: string; icone: LucideIcon }[] = [
  { valeur: null, libelle: "Tous", icone: Music },
  { valeur: "aucune", libelle: "Sans paroles", icone: X },
  { valeur: "texte", libelle: "Texte seul", icone: Type },
  { valeur: "synchro", libelle: "Synchronisées", icone: AudioLines },
];

const ETATS: Record<Etat, { libelle: string; ton: "neutre" | "attention" | "succes" }> = {
  aucune: { libelle: "Sans paroles", ton: "neutre" },
  texte: { libelle: "Texte seul", ton: "attention" },
  synchro: { libelle: "Synchronisées", ton: "succes" },
};

const STATUTS: Record<string, { libelle: string; ton: "neutre" | "succes" | "attention" | "danger" }> = {
  published: { libelle: "Publié", ton: "succes" },
  scheduled: { libelle: "Programmé", ton: "attention" },
  draft: { libelle: "Brouillon", ton: "attention" },
  rejected: { libelle: "Refusé", ton: "danger" },
};

export function Paroles() {
  // Par défaut, ce qui reste à caler : c'est la file de travail, comme sur le site.
  const [etat, setEtat] = useState<Etat | null>("texte");
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<Titre | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let actif = true;
    const q = recherche.trim();
    // Une frappe sur deux ne mérite pas sa requête.
    const minuterie = setTimeout(
      () => {
        setChargement(true);
        const params = new URLSearchParams({ page: String(page) });
        if (etat) params.set("etat", etat);
        if (q) params.set("q", q);
        api<Reponse>(`/api/admin/paroles?${params}`)
          .then((r) => {
            if (!actif) return;
            setDonnees(r);
            setErreur(null);
          })
          .catch((e) => actif && setErreur(e instanceof Error ? e.message : "Impossible de charger les paroles du catalogue."))
          .finally(() => actif && setChargement(false));
      },
      q ? 300 : 0,
    );
    return () => {
      actif = false;
      clearTimeout(minuterie);
    };
  }, [etat, recherche, page, version]);

  const titres = donnees?.titres ?? [];
  const compteurs = donnees?.compteurs;
  const total = compteurs ? compteurs.aucune + compteurs.texte + compteurs.synchro : 0;
  const totalFiltre = compteurs ? (etat ? compteurs[etat] : total) : 0;
  // Les compteurs et `suite` viennent de la même requête, mais `suite` fait foi
  // pour la page suivante : c'est lui que le site calcule sur la page réelle.
  const pages = Math.max(Math.ceil(totalFiltre / PAR_PAGE), donnees?.suite ? page + 1 : page, 1);
  const couverture = total > 0 && compteurs ? Math.round((compteurs.synchro / total) * 100) : 0;

  const ouvrir = useCallback((id: string) => setOuvert(titres.find((t) => t._id === id) ?? null), [titres]);
  const sel = useSelection(
    titres.map((t) => t._id),
    ouvrir,
  );

  const lienTitre = (id: string) => `${adresseSite()}/son/${id}`;

  async function effacer(t: Titre) {
    const ok = await confirmer({
      titre: `Effacer les paroles de « ${t.title} » ?`,
      message: "Le texte et la synchronisation disparaissent du site et de l'application. Cette action ne peut pas être annulée.",
      confirmer: "Effacer les paroles",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/songs/${t._id}/lyrics`, { methode: "DELETE" });
      annoncer("Paroles effacées");
      setVersion((v) => v + 1);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Les paroles n'ont pas été effacées.");
    }
  }

  function menuTitre(e: SourisReact, rang: number) {
    sel.surMenu(rang);
    const t = titres[rang];
    if (!t) return;
    ouvrirMenu(
      e,
      [
        { libelle: "Ouvrir l'atelier", icone: PenLine, raccourci: "Entrée", action: () => setOuvert(t) },
        { libelle: "Voir sur le site", icone: ExternalLink, action: () => void window.bureau.ouvrirExterne(lienTitre(t._id)) },
        "separateur",
        t.etat !== "aucune" && { libelle: "Effacer les paroles", icone: Trash2, danger: true, action: () => void effacer(t) },
      ],
      t.title,
    );
  }

  const pagination = donnees && <Pagination page={page} pages={pages} total={Math.max(totalFiltre, titres.length)} taille={PAR_PAGE} onPage={setPage} />;

  return (
    <>
      <EnTete
        titre="Paroles"
        texte={compteurs ? `${couverture} % du catalogue défile en rythme · ${formatNombre(total)} titre${total > 1 ? "s" : ""}` : "Paroles du catalogue et atelier de synchronisation"}
        action={
          <Bouton variante="trait" onClick={() => setVersion((v) => v + 1)}>
            <RefreshCw size={14} /> Actualiser
          </Bouton>
        }
      />

      {compteurs && total > 0 && (
        // Une seule barre segmentée : la part de chaque état, sans légende à décoder.
        <div className="animate-monter decale-1 -mt-3 mb-5 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-filet" title={`${compteurs.synchro} synchronisées, ${compteurs.texte} en texte seul, ${compteurs.aucune} sans paroles`}>
          <span className="bg-succes transition-[width] duration-300" style={{ width: `${(compteurs.synchro / total) * 100}%` }} />
          <span className="bg-attention/70 transition-[width] duration-300" style={{ width: `${(compteurs.texte / total) * 100}%` }} />
        </div>
      )}

      <BarreCollante className="animate-monter decale-2">
        <div className="relative w-72">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texte-3" />
          <input
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher un titre"
            className="h-9 w-full rounded-lg border border-filet bg-surface pr-3 pl-9 text-[13px] outline-none placeholder:text-texte-3 focus:border-accent"
          />
        </div>
        <div className="flex rounded-lg border border-filet bg-surface p-0.5" role="tablist" aria-label="État des paroles">
          {FILTRES.map(({ valeur, libelle, icone: Icone }) => {
            const actif = etat === valeur;
            const n = compteurs ? (valeur ? compteurs[valeur] : total) : null;
            return (
              <button
                key={libelle}
                role="tab"
                aria-selected={actif}
                onClick={() => {
                  setEtat(valeur);
                  setPage(1);
                }}
                className={clsx(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  actif ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte",
                )}
              >
                <Icone size={13} />
                {libelle}
                {n !== null && <span className={clsx("tabular-nums", actif ? "opacity-80" : "text-texte-3")}>{formatNombre(n)}</span>}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {chargement && donnees && <Barres taille={14} />}
          {pagination}
        </div>
      </BarreCollante>

      <Erreur message={erreur} />

      {!donnees ? (
        !erreur && <Chargement texte="Lecture du catalogue" />
      ) : titres.length === 0 ? (
        <Vide texte={recherche.trim() ? `Aucun titre pour « ${recherche.trim()} » dans cette catégorie.` : "Aucun titre dans cette catégorie."} />
      ) : (
        <div className={clsx("transition-opacity duration-200", chargement && "opacity-60")}>
          <Table
            entetes={[
              { libelle: "", largeur: "64px" },
              "Titre",
              "Artiste",
              { libelle: "Statut", largeur: "120px" },
              { libelle: "Écoutes", droite: true, largeur: "90px" },
              { libelle: "Paroles", largeur: "140px" },
              { libelle: "", largeur: "170px" },
            ]}
          >
            {titres.map((t, rang) => (
              <tr
                key={t._id}
                data-rang={rang}
                onClick={(e) => sel.surClic(e, rang)}
                onDoubleClick={(e) => sel.surDoubleClic(e, rang)}
                onContextMenu={(e) => menuTitre(e, rang)}
                className={clsx("cursor-default", classeChoisi(sel.estChoisi(t._id), "ligne"))}
              >
                <td>
                  <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-md bg-surface-2 text-texte-3">
                    {t.coverUrl ? <img src={adresseImage(t.coverUrl) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Music size={16} />}
                  </div>
                </td>
                <td className="font-medium">{t.title}</td>
                <td className="text-texte-2">{t.artist?.stageName ?? "Artiste supprimé"}</td>
                <td>
                  <Pastille texte={STATUTS[t.status]?.libelle ?? t.status} ton={STATUTS[t.status]?.ton ?? "neutre"} />
                </td>
                <td className="text-right text-texte-2 tabular-nums">{formatNombre(t.playsCount ?? 0)}</td>
                <td>
                  <Pastille texte={ETATS[t.etat]?.libelle ?? t.etat} ton={ETATS[t.etat]?.ton ?? "neutre"} />
                </td>
                <td className="text-right">
                  <Bouton variante="trait" className="h-8" onClick={() => setOuvert(t)}>
                    <PenLine size={14} /> Ouvrir l'atelier
                  </Bouton>
                </td>
              </tr>
            ))}
          </Table>
          <div className="mt-4">{pagination}</div>
        </div>
      )}

      {ouvert && (
        <Atelier
          key={ouvert._id}
          titre={ouvert}
          onFermer={(aEnregistre) => {
            setOuvert(null);
            // L'état du titre (et les compteurs) a pu changer : la liste est relue.
            if (aEnregistre) setVersion((v) => v + 1);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------- atelier -- */

type Mode = "texte" | "synchro" | "apercu";

const MODES: { id: Mode; libelle: string; icone: LucideIcon; touche: string }[] = [
  { id: "texte", libelle: "Texte", icone: Type, touche: "1" },
  { id: "synchro", libelle: "Synchronisation", icone: Crosshair, touche: "2" },
  { id: "apercu", libelle: "Aperçu", icone: Eye, touche: "3" },
];

function lignesDepuisLRC(brut: string): LigneEditable[] {
  return analyserParoles(brut).lignes.map((l) => ({ temps: l.temps, texte: l.texte }));
}

/**
 * Les balises d'en-tête à réécrire, sans `offset`.
 *
 * `analyserParoles` applique déjà le décalage aux horodatages qu'elle rend :
 * réécrire ces temps corrigés AVEC la balise ferait appliquer le décalage
 * une seconde fois à la prochaine lecture. Tant qu'on ne touche à rien, le
 * texte d'origine est conservé tel quel, balise comprise.
 */
function metaSansDecalage(brut: string): Record<string, string> {
  const meta = { ...analyserParoles(brut).meta };
  delete meta.offset;
  return meta;
}

/** Vrai si la touche vise un champ où l'on écrit : les raccourcis s'effacent alors. */
function cibleDeSaisie(cible: EventTarget | null) {
  const el = cible as HTMLElement | null;
  return Boolean(el?.closest?.("textarea, select, [contenteditable], input:not([type=range]):not([type=checkbox]):not([type=file])"));
}

function Atelier({ titre, onFermer }: { titre: Titre; onFermer: (aEnregistre: boolean) => void }) {
  /** Les paroles telles que le site les a : null tant qu'on ne les a pas lues. */
  const [enregistre, setEnregistre] = useState<string | null>(null);
  /** Le LRC qui partira à l'enregistrement. */
  const [valeur, setValeur] = useState("");
  const [lignes, setLignes] = useState<LigneEditable[]>([]);
  const [mode, setMode] = useState<Mode>("texte");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<"enregistrer" | "effacer" | null>(null);
  const [survol, setSurvol] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);

  /*
   * Comme sur le site, les lignes en cours d'édition sont tenues ici et non
   * relues du LRC à chaque frappe : `analyserParoles` trie par temps et
   * rejette les lignes non horodatées à la fin, si bien que dès la deuxième
   * ligne calée, tout ce qui restait à caler sautait en bas de la liste.
   * L'état local produit le LRC, jamais l'inverse, sauf au chargement et à
   * l'import d'un fichier.
   *
   * Les références doublent l'état pour les raccourcis : deux touches
   * frappées entre deux rendus doivent voir la ligne déjà avancée.
   */
  const lignesRef = useRef<LigneEditable[]>([]);
  const metaRef = useRef<Record<string, string>>({});
  const [curseur, setCurseurEtat] = useState(0);
  const curseurRef = useRef(0);
  /** La ligne que « −0,1 s » et « +0,1 s » ajustent : la dernière marquée, ou celle qu'on a choisie. */
  const cibleRef = useRef(0);
  /** Les lignes marquées, dans l'ordre, pour « défaire » au clavier. */
  const marques = useRef<number[]>([]);
  /** Une fois le remplacement confirmé, les enregistrements suivants écrasent notre propre travail. */
  const remplacementConfirme = useRef(false);
  const aEnregistre = useRef(false);

  const placer = useCallback((i: number) => {
    const borne = Math.max(0, Math.min(i, lignesRef.current.length - 1));
    curseurRef.current = borne;
    cibleRef.current = borne;
    setCurseurEtat(borne);
  }, []);

  const charger = useCallback((brut: string) => {
    const suivantes = lignesDepuisLRC(brut);
    lignesRef.current = suivantes;
    metaRef.current = metaSansDecalage(brut);
    marques.current = [];
    setLignes(suivantes);
    setValeur(brut);
    curseurRef.current = 0;
    cibleRef.current = 0;
    setCurseurEtat(0);
  }, []);

  const remplacer = useCallback((suivantes: LigneEditable[]) => {
    lignesRef.current = suivantes;
    setLignes(suivantes);
    setValeur(versLRC(suivantes, metaRef.current));
  }, []);

  useEffect(() => {
    let actif = true;
    api<{ raw?: string }>(`/api/songs/${titre._id}/lyrics`)
      .then((r) => {
        if (!actif) return;
        const brut = r.raw ?? "";
        setEnregistre(brut);
        charger(brut);
        // Des paroles déjà là attendent d'être calées : on ouvre sur le calage.
        setMode(brut.trim() ? "synchro" : "texte");
      })
      .catch((e) => actif && setErreur(e instanceof Error ? e.message : "Impossible de lire les paroles de ce titre."));
    return () => {
      actif = false;
    };
  }, [titre._id, charger]);

  const modifie = enregistre !== null && valeur !== enregistre;
  const calees = lignes.filter((l) => l.temps !== null).length;
  const vers = lignes.filter((l) => l.texte.trim()).length;

  /* ------------------------------------------------------------ audio -- */

  /*
   * L'audio est téléchargé avec le jeton puis lu depuis la mémoire : un
   * <audio src="/api/stream/..."> partirait sans en-tête Authorization,
   * serait refusé sur un brouillon et compté comme écoute anonyme. On lit
   * la même adresse que le lecteur du site, découpe comprise : un calage
   * fait sur le master décalerait tout si l'intro a été rognée.
   */
  const audioRef = useRef<HTMLAudioElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [audioErreur, setAudioErreur] = useState<string | null>(null);
  const [enLecture, setEnLecture] = useState(false);
  const [position, setPosition] = useState(0);
  const [duree, setDuree] = useState(0);

  useEffect(() => {
    // Un seul son à la fois dans le logiciel : l'extrait en cours se tait.
    arreter();
    const audio = audioRef.current;
    let actif = true;
    let url: string | null = null;
    telechargerAuthentifie(`/api/stream/${titre._id}?q=low`)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (actif) setSource(url);
        else URL.revokeObjectURL(url);
      })
      .catch((e) => actif && setAudioErreur(e instanceof Error ? e.message : "Lecture impossible."));
    return () => {
      actif = false;
      audio?.pause();
      if (url) URL.revokeObjectURL(url);
    };
  }, [titre._id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // Suivi à l'image près pendant la lecture : `timeupdate` ne passe que
    // quatre fois par seconde, trop peu pour lire un centième en calant.
    let trame = 0;
    const suivre = () => {
      setPosition(audio.currentTime);
      trame = requestAnimationFrame(suivre);
    };
    const surPlay = () => {
      setEnLecture(true);
      cancelAnimationFrame(trame);
      trame = requestAnimationFrame(suivre);
    };
    const surPause = () => {
      setEnLecture(false);
      cancelAnimationFrame(trame);
      setPosition(audio.currentTime);
    };
    const surTemps = () => setPosition(audio.currentTime);
    const surDuree = () => setDuree(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.addEventListener("play", surPlay);
    audio.addEventListener("pause", surPause);
    audio.addEventListener("ended", surPause);
    audio.addEventListener("seeked", surTemps);
    audio.addEventListener("timeupdate", surTemps);
    audio.addEventListener("loadedmetadata", surDuree);
    audio.addEventListener("durationchange", surDuree);
    return () => {
      cancelAnimationFrame(trame);
      audio.removeEventListener("play", surPlay);
      audio.removeEventListener("pause", surPause);
      audio.removeEventListener("ended", surPause);
      audio.removeEventListener("seeked", surTemps);
      audio.removeEventListener("timeupdate", surTemps);
      audio.removeEventListener("loadedmetadata", surDuree);
      audio.removeEventListener("durationchange", surDuree);
    };
  }, []);

  const basculerLecture = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  }, []);

  const allerA = useCallback((secondes: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    audio.currentTime = Math.max(0, Math.min(Number.isFinite(audio.duration) ? audio.duration : Infinity, secondes));
    setPosition(audio.currentTime);
  }, []);

  const deplacer = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (audio) allerA(audio.currentTime + delta);
  }, [allerA]);

  /* ---------------------------------------------------------- édition -- */

  const majLigne = useCallback(
    (i: number, patch: Partial<LigneEditable>) => remplacer(lignesRef.current.map((l, j) => (j === i ? { ...l, ...patch } : l))),
    [remplacer],
  );

  const supprimerLigne = useCallback(
    (i: number) => {
      marques.current = [];
      remplacer(lignesRef.current.filter((_, j) => j !== i));
      placer(Math.min(curseurRef.current, lignesRef.current.length - 1));
    },
    [remplacer, placer],
  );

  const ajouterLigne = useCallback(
    (apres: number) => {
      const suivantes = [...lignesRef.current];
      suivantes.splice(apres + 1, 0, { temps: null, texte: "" });
      marques.current = [];
      remplacer(suivantes);
      placer(apres + 1);
    },
    [remplacer, placer],
  );

  const deplacerLigne = useCallback(
    (i: number, sens: -1 | 1) => {
      const j = i + sens;
      const suivantes = [...lignesRef.current];
      if (j < 0 || j >= suivantes.length) return;
      [suivantes[i], suivantes[j]] = [suivantes[j], suivantes[i]];
      marques.current = [];
      remplacer(suivantes);
      placer(j);
    },
    [remplacer, placer],
  );

  const decaler = useCallback(
    (i: number, delta: number) => {
      const l = lignesRef.current[i];
      if (!l || l.temps === null) return;
      // Arrondi au centième : la précision du LRC, sans dérive de flottants à force d'appuis.
      majLigne(i, { temps: Math.max(0, Math.round((l.temps + delta) * 100) / 100) });
      cibleRef.current = i;
    },
    [majLigne],
  );

  /**
   * Cale la ligne au curseur sur la position courante, puis avance.
   *
   * L'enchaînement — marquer, descendre d'une ligne — est tout l'intérêt de
   * l'outil : on lance le morceau et on tape en rythme.
   */
  const marquer = useCallback(() => {
    const audio = audioRef.current;
    const c = curseurRef.current;
    if (!audio || !audio.src || c >= lignesRef.current.length) return;
    majLigne(c, { temps: audio.currentTime });
    marques.current.push(c);
    placer(c + 1);
    // Le réglage fin vise la ligne qu'on vient de marquer, pas la suivante.
    cibleRef.current = c;
  }, [majLigne, placer]);

  /** Défait le dernier marquage : la ligne perd son temps et le curseur y revient. */
  const defaire = useCallback(() => {
    const i = marques.current.pop();
    if (i === undefined || i >= lignesRef.current.length) return;
    majLigne(i, { temps: null });
    placer(i);
  }, [majLigne, placer]);

  /** Lit depuis une ligne ; non calée, depuis la dernière ligne calée au-dessus. */
  const ecouterDepuis = useCallback(
    (i: number) => {
      const ls = lignesRef.current;
      let t: number | null = null;
      for (let j = i; j >= 0 && t === null; j--) t = ls[j]?.temps ?? null;
      placer(i);
      allerA(t ?? 0);
      const audio = audioRef.current;
      if (audio?.src && audio.paused) void audio.play().catch(() => undefined);
    },
    [placer, allerA],
  );

  const choisirLigne = useCallback(
    (i: number) => {
      placer(i);
      const t = lignesRef.current[i]?.temps;
      if (t !== null && t !== undefined) allerA(t);
    },
    [placer, allerA],
  );

  async function desynchroniser() {
    const ok = await confirmer({
      titre: "Retirer tous les horodatages ?",
      message: "Le texte reste intact. Rien n'est modifié sur le site avant « Enregistrer ».",
      confirmer: "Retirer les horodatages",
    });
    if (!ok) return;
    marques.current = [];
    remplacer(lignesRef.current.map((l) => ({ ...l, temps: null })));
    placer(0);
  }

  /* --------------------------------------------------------- fichiers -- */

  async function importer(fichier: File) {
    // 1 Mo : un LRC de mille lignes en fait cinquante. Au-delà, ce n'est pas
    // un fichier de paroles, et on ne veut pas le lire en mémoire.
    if (fichier.size > 1_000_000) return setErreur("Ce fichier est trop volumineux pour des paroles.");
    let texte: string;
    try {
      texte = await fichier.text();
    } catch {
      return setErreur("Le fichier n'a pas pu être lu.");
    }
    const lu = analyserParoles(texte);
    if (!lu.lignes.some((l) => l.texte.trim())) return setErreur("Ce fichier ne contient aucune parole lisible.");
    if (lignesRef.current.some((l) => l.texte.trim())) {
      const ok = await confirmer({
        titre: "Remplacer le contenu de l'atelier ?",
        message: `Les paroles en cours d'édition seront remplacées par celles de « ${fichier.name} ». Rien n'est modifié sur le site avant « Enregistrer ».`,
        confirmer: "Importer",
      });
      if (!ok) return;
    }
    setErreur(null);
    charger(texte.trim());
    setMode(lu.synchronisees ? "synchro" : "texte");
    annoncer(lu.synchronisees ? `${lu.lignes.filter((l) => l.temps !== null).length} lignes synchronisées importées` : "Paroles importées, sans horodatage");
  }

  /* ------------------------------------------------------- site -- */

  async function enregistrer() {
    if (enregistre === null || enCours) return;
    if (valeur === enregistre) return annoncer("Rien à enregistrer");
    if (valeur.length > MAX_CARACTERES) {
      return setErreur(`Paroles trop longues : ${formatNombre(valeur.length)} caractères, ${formatNombre(MAX_CARACTERES)} au plus.`);
    }
    if (enregistre.trim() && !remplacementConfirme.current) {
      const vide = !valeur.trim();
      const ok = await confirmer({
        titre: vide ? "Retirer les paroles de ce titre ?" : "Remplacer les paroles enregistrées ?",
        message: vide
          ? "L'atelier est vide : enregistrer efface les paroles du site et de l'application."
          : "La version du site est remplacée par celle de l'atelier. Les auditeurs la voient aussitôt.",
        confirmer: vide ? "Effacer les paroles" : "Remplacer",
        danger: vide,
      });
      if (!ok) return;
      remplacementConfirme.current = true;
    }
    setEnCours("enregistrer");
    setErreur(null);
    try {
      const r = await api<{ raw?: string; lyrics?: { synced?: boolean } }>(`/api/songs/${titre._id}/lyrics`, { methode: "PUT", corps: { raw: valeur } });
      const brut = r.raw ?? "";
      setEnregistre(brut);
      // Le site range des paroles vides comme absentes : l'atelier suit, sans
      // toucher au curseur quand le texte revient identique.
      if (brut !== valeur) charger(brut);
      aEnregistre.current = true;
      annoncer(r.lyrics?.synced ? "Paroles synchronisées enregistrées" : brut ? "Paroles enregistrées" : "Paroles retirées");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Les paroles n'ont pas été enregistrées.");
    } finally {
      setEnCours(null);
    }
  }

  async function effacerDuSite() {
    const ok = await confirmer({
      titre: `Effacer les paroles de « ${titre.title} » ?`,
      message: "Le texte et la synchronisation disparaissent du site et de l'application. Cette action ne peut pas être annulée.",
      confirmer: "Effacer les paroles",
      danger: true,
    });
    if (!ok) return;
    setEnCours("effacer");
    setErreur(null);
    try {
      await api(`/api/songs/${titre._id}/lyrics`, { methode: "DELETE" });
      setEnregistre("");
      charger("");
      setMode("texte");
      aEnregistre.current = true;
      annoncer("Paroles effacées");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Les paroles n'ont pas été effacées.");
    } finally {
      setEnCours(null);
    }
  }

  // La fermeture (bouton, Échap, clic à côté) passe par la même garde : un
  // calage d'une demi-heure ne doit pas se perdre sur un geste machinal.
  const modifieRef = useRef(false);
  const onFermerRef = useRef(onFermer);
  useLayoutEffect(() => {
    modifieRef.current = modifie;
    onFermerRef.current = onFermer;
  });
  const fermer = useCallback(async () => {
    if (modifieRef.current) {
      const ok = await confirmer({
        titre: "Fermer sans enregistrer ?",
        message: "Les modifications faites dans l'atelier seront perdues.",
        confirmer: "Fermer sans enregistrer",
        danger: true,
      });
      if (!ok) return;
    }
    onFermerRef.current(aEnregistre.current);
  }, []);

  /* ---------------------------------------------------------- clavier -- */

  // Les raccourcis lisent toujours la dernière version des actions, sans
  // réinscrire l'écouteur à chaque image de la lecture.
  const actions = useRef({ mode, enregistrer, setMode });
  useLayoutEffect(() => {
    actions.current = { mode, enregistrer, setMode };
  });

  // L'atelier quitté reste ouvert, masqué : ses raccourcis (Ctrl + S, Espace…) se taisent jusqu'au retour.
  const pageActive = usePageActive();
  // Quitter la page coupait le son en fermant l'atelier ; masqué, il se met en pause.
  useEffect(() => {
    if (!pageActive) audioRef.current?.pause();
  }, [pageActive]);
  useEffect(() => {
    if (!pageActive) return;
    const touche = (e: KeyboardEvent) => {
      // Une confirmation ou un menu ouvert a la main sur le clavier.
      if (document.querySelector('[role="alertdialog"], [role="menu"]')) return;
      const { mode: m, enregistrer: sauver, setMode: changerMode } = actions.current;
      const mod = e.ctrlKey || e.metaKey;
      const traite = () => {
        e.preventDefault();
        e.stopPropagation();
      };

      // Ctrl + S et Ctrl + 1/2/3 valent partout, même en cours de frappe.
      if (mod && !e.altKey && !e.shiftKey) {
        if (e.key === "s" || e.key === "S") {
          traite();
          void sauver();
          return;
        }
        const choisi = MODES.find((x) => x.touche === e.key);
        if (choisi) {
          traite();
          changerMode(choisi.id);
          return;
        }
      }

      const saisie = cibleDeSaisie(e.target);
      // Une commande atteinte à la tabulation garde Entrée et Espace pour elle.
      const surCommande = Boolean((e.target as HTMLElement | null)?.closest?.("button, a"));
      if (saisie || mod || e.altKey || (surCommande && (e.key === "Enter" || e.key === " "))) {
        // Sans cela, la liste derrière le tiroir changerait de sélection.
        if (!saisie && (mod ? e.key === "a" : ["ArrowUp", "ArrowDown", "Home", "End", "Enter"].includes(e.key))) e.stopPropagation();
        return;
      }

      if (m !== "texte") {
        if (e.key === " ") return (traite(), basculerLecture());
        if (e.key === "ArrowLeft") return (traite(), deplacer(e.shiftKey ? -1 : -SAUT_S));
        if (e.key === "ArrowRight") return (traite(), deplacer(e.shiftKey ? 1 : SAUT_S));
      }
      if (m === "synchro") {
        if (e.key === "Enter" || e.key === "m" || e.key === "M") return (traite(), marquer());
        if (e.key === "Backspace") return (traite(), defaire());
        if (e.key === "ArrowUp") return (traite(), placer(curseurRef.current - 1));
        if (e.key === "ArrowDown") return (traite(), placer(curseurRef.current + 1));
        if (e.key === "-") return (traite(), decaler(cibleRef.current, -PAS_S));
        if (e.key === "+" || e.key === "=") return (traite(), decaler(cibleRef.current, PAS_S));
        if (e.key === "p" || e.key === "P") return (traite(), ecouterDepuis(curseurRef.current));
      }
      if (["ArrowUp", "ArrowDown", "Home", "End", "Enter"].includes(e.key)) e.stopPropagation();
    };
    window.addEventListener("keydown", touche, true);
    return () => window.removeEventListener("keydown", touche, true);
  }, [basculerLecture, deplacer, marquer, defaire, placer, decaler, ecouterDepuis, pageActive]);

  /* ------------------------------------------------------------ rendu -- */

  const statut = STATUTS[titre.status]?.libelle ?? titre.status;
  const pret = enregistre !== null;

  return (
    <Tiroir
      titre={titre.title}
      sousTitre={`${titre.artist?.stageName ?? "Artiste supprimé"} · ${statut}`}
      // Fonction stable : le tiroir réinscrit sa touche Échap à chaque changement,
      // et l'atelier se redessine à chaque image pendant la lecture.
      onFermer={fermer}
      largeur={Math.min(820, window.innerWidth - 48)}
      pied={
        pret && (
          <>
            <span className={clsx("mr-auto flex items-center gap-1.5 self-center text-[12.5px]", modifie ? "text-attention" : "text-texte-3")}>
              {modifie ? (
                "Modifications non enregistrées"
              ) : (
                <>
                  <Check size={14} className="text-succes" /> À jour avec le site
                </>
              )}
            </span>
            {enregistre?.trim() && (
              <Bouton variante="danger" enCours={enCours === "effacer"} disabled={enCours !== null} onClick={() => void effacerDuSite()}>
                <Trash2 size={14} /> Effacer les paroles
              </Bouton>
            )}
            <Bouton variante="trait" onClick={() => void window.bureau.ouvrirExterne(`${adresseSite()}/son/${titre._id}`)}>
              <ExternalLink size={14} /> Voir sur le site
            </Bouton>
            <Bouton enCours={enCours === "enregistrer"} disabled={!modifie || enCours !== null} onClick={() => void enregistrer()} title="Ctrl + S">
              <Save size={14} /> Enregistrer
            </Bouton>
          </>
        )
      }
    >
      <div
        className="relative flex h-full min-h-[420px] flex-col gap-4"
        // Un clic sur une commande ne lui donne pas le focus : Espace et
        // Entrée restent des raccourcis de calage au lieu de rejouer le
        // dernier bouton cliqué. Le champ en cours de frappe est quitté.
        onMouseDownCapture={(e) => {
          if (!(e.target as HTMLElement).closest("button")) return;
          e.preventDefault();
          const actif = document.activeElement as HTMLElement | null;
          if (actif && cibleDeSaisie(actif)) actif.blur();
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSurvol(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          const f = e.dataTransfer.files?.[0];
          if (f && pret) void importer(f);
        }}
      >
        {/* Une seule instance, hors des modes : la recréer à chaque bascule couperait le calage en cours. */}
        <audio ref={audioRef} src={source ?? undefined} preload="auto" />

        <Erreur message={erreur} />

        {!pret ? (
          !erreur && <Chargement texte="Lecture des paroles" />
        ) : (
          <>
            <div className="animate-monter flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-filet bg-surface-2 p-0.5" role="tablist" aria-label="Mode de l'atelier">
                {MODES.map((x) => (
                  <button
                    key={x.id}
                    role="tab"
                    aria-selected={mode === x.id}
                    title={`Ctrl + ${x.touche}`}
                    onClick={() => setMode(x.id)}
                    className={clsx(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                      mode === x.id ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte",
                    )}
                  >
                    <x.icone size={14} /> {x.libelle}
                  </button>
                ))}
              </div>
              <Bouton variante="trait" className="h-8" onClick={() => fichierRef.current?.click()} title="Ou déposez un fichier sur l'atelier">
                <FileUp size={14} /> Importer un .lrc
              </Bouton>
              <input
                ref={fichierRef}
                type="file"
                accept=".lrc,.txt,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  // Remis à zéro pour qu'un second import du même fichier déclenche un nouvel évènement.
                  e.target.value = "";
                  if (f) void importer(f);
                }}
              />
              <span className="ml-auto text-[12px] text-texte-3 tabular-nums">
                {vers > 0 ? `${vers} vers · ${calees > 0 ? `${calees} calé${calees > 1 ? "s" : ""}` : "non synchronisés"}` : "Aucune parole"}
              </span>
            </div>

            {mode !== "texte" && (
              <Poste
                source={source}
                erreur={audioErreur}
                enLecture={enLecture}
                position={position}
                duree={duree}
                onBasculer={basculerLecture}
                onDeplacer={deplacer}
                onAllerA={allerA}
              />
            )}

            {mode === "texte" && (
              <ModeTexte
                texte={lignes.map((l) => l.texte).join("\n")}
                synchronisees={calees > 0}
                onTexte={(texte) => {
                  // Réassocie les horodatages ligne à ligne tant que le nombre de
                  // lignes ne change pas : corriger une faute de frappe ne doit pas
                  // défaire une synchronisation faite à la main.
                  const nouvelles = texte.split(/\r?\n/);
                  const avant = lignesRef.current;
                  const memeDecoupage = nouvelles.length === avant.length;
                  marques.current = [];
                  remplacer(nouvelles.map((t, i) => ({ temps: memeDecoupage ? avant[i].temps : null, texte: t })));
                }}
              />
            )}

            {mode === "synchro" && (
              <ModeSynchro
                lignes={lignes}
                curseur={curseur}
                position={position}
                pret={source !== null}
                onMarquer={marquer}
                onDefaire={defaire}
                onDecalerCible={(delta) => decaler(cibleRef.current, delta)}
                onChoisir={choisirLigne}
                onEcouter={ecouterDepuis}
                onPlacer={placer}
                onMaj={majLigne}
                onDecaler={decaler}
                onSupprimer={supprimerLigne}
                onAjouter={ajouterLigne}
                onDeplacerLigne={deplacerLigne}
              />
            )}

            {mode === "apercu" && <ModeApercu valeur={valeur} position={position} onAllerA={(t) => (allerA(t), audioRef.current?.paused && basculerLecture())} />}

            {vers > 0 && calees > 0 && mode !== "apercu" && (
              <div className="flex items-center gap-2 border-t border-filet pt-3">
                <Bouton variante="discret" className="h-8 text-[12px]" onClick={() => void desynchroniser()}>
                  <Eraser size={14} /> Retirer les horodatages
                </Bouton>
              </div>
            )}
          </>
        )}

        {survol && (
          <div className="animate-paraitre pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-surface/90 text-[13px] font-semibold text-accent">
            <span className="flex items-center gap-2">
              <FileUp size={18} /> Déposer le fichier .lrc
            </span>
          </div>
        )}
      </div>
    </Tiroir>
  );
}

/* --------------------------------------------------------- transport -- */

function Poste({
  source,
  erreur,
  enLecture,
  position,
  duree,
  onBasculer,
  onDeplacer,
  onAllerA,
}: {
  source: string | null;
  erreur: string | null;
  enLecture: boolean;
  position: number;
  duree: number;
  onBasculer: () => void;
  onDeplacer: (delta: number) => void;
  onAllerA: (s: number) => void;
}) {
  if (erreur) {
    return <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger">Audio indisponible : {erreur} Le texte reste modifiable, mais le calage demande l'écoute.</p>;
  }
  if (!source) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-filet bg-surface-2 px-4 py-3 text-[13px] text-texte-3">
        <Barres taille={14} /> Téléchargement de l'audio…
      </div>
    );
  }
  return (
    <div className="animate-paraitre flex items-center gap-3 rounded-xl border border-filet bg-surface-2 px-3 py-2.5">
      <button
        onClick={onBasculer}
        title={enLecture ? "Pause (Espace)" : "Lire (Espace)"}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-sur-accent transition-colors hover:bg-accent-fort"
      >
        {enLecture ? <Pause size={17} /> : <Play size={17} className="translate-x-px" />}
      </button>
      <button onClick={() => onDeplacer(-SAUT_S)} title={`Reculer de ${SAUT_S} s (flèche gauche)`} className="flex h-9 items-center gap-1 rounded-lg px-2 text-[12.5px] text-texte-2 hover:bg-surface hover:text-texte">
        <RotateCcw size={15} /> {SAUT_S} s
      </button>
      <button onClick={() => onDeplacer(SAUT_S)} title={`Avancer de ${SAUT_S} s (flèche droite)`} className="flex h-9 items-center gap-1 rounded-lg px-2 text-[12.5px] text-texte-2 hover:bg-surface hover:text-texte">
        <RotateCw size={15} /> {SAUT_S} s
      </button>
      <input
        type="range"
        min={0}
        max={duree || 0}
        step={0.01}
        value={Math.min(position, duree || 0)}
        onChange={(e) => onAllerA(Number(e.target.value))}
        aria-label="Position dans le morceau"
        className="min-w-0 flex-1 accent-[var(--accent)]"
      />
      <span className="shrink-0 font-mono text-[12.5px] text-texte-2 tabular-nums">
        {formaterTemps(position)} / {duree > 0 ? formaterTemps(duree) : "--:--"}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- texte -- */

function ModeTexte({ texte, synchronisees, onTexte }: { texte: string; synchronisees: boolean; onTexte: (texte: string) => void }) {
  return (
    <div className="animate-paraitre flex min-h-0 flex-1 flex-col gap-2">
      <textarea
        value={texte}
        onChange={(e) => onTexte(e.target.value)}
        spellCheck={false}
        placeholder={"Écrivez ou collez les paroles, une ligne par vers.\n\nJe marche dans ta lumière\nTu guides tous mes pas"}
        className="min-h-[280px] w-full flex-1 resize-none rounded-xl border border-filet bg-surface-2 px-4 py-3 font-mono text-[13px] leading-relaxed text-texte outline-none placeholder:text-texte-3 focus:border-accent"
      />
      <p className="text-[12px] text-texte-3">
        {synchronisees
          ? "Les horodatages sont conservés tant que le nombre de lignes ne change pas. Ajouter ou retirer une ligne les remet à zéro : passez en synchronisation pour les ajuster."
          : "Une ligne par vers ; une ligne vide sépare deux couplets. Passez ensuite en synchronisation (Ctrl + 2) pour caler chaque vers sur l'audio."}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- synchro -- */

function Touche({ children }: { children: string }) {
  return <kbd className="rounded border border-filet bg-surface px-1.5 py-px font-sans text-[11px] text-texte-2">{children}</kbd>;
}

function ModeSynchro({
  lignes,
  curseur,
  position,
  pret,
  onMarquer,
  onDefaire,
  onDecalerCible,
  ...liste
}: {
  lignes: LigneEditable[];
  curseur: number;
  position: number;
  pret: boolean;
  onMarquer: () => void;
  onDefaire: () => void;
  onDecalerCible: (delta: number) => void;
  onChoisir: (i: number) => void;
  onEcouter: (i: number) => void;
  onPlacer: (i: number) => void;
  onMaj: (i: number, patch: Partial<LigneEditable>) => void;
  onDecaler: (i: number, delta: number) => void;
  onSupprimer: (i: number) => void;
  onAjouter: (apres: number) => void;
  onDeplacerLigne: (i: number, sens: -1 | 1) => void;
}) {
  // La ligne chantée à cet instant, dans l'ordre de l'édition (pas trié) :
  // elle montre si le calage tombe juste pendant la réécoute.
  const jouee = useMemo(() => {
    let meilleure = -1;
    let temps = -Infinity;
    lignes.forEach((l, i) => {
      if (l.temps !== null && l.temps <= position && l.temps >= temps) {
        temps = l.temps;
        meilleure = i;
      }
    });
    return position > 0 ? meilleure : -1;
  }, [lignes, position]);

  if (lignes.length === 0) {
    return <Vide texte="Écrivez d'abord les paroles en mode texte, ou importez un fichier .lrc." />;
  }

  const courante = lignes[curseur];
  const suivante = lignes.slice(curseur + 1).find((l) => l.texte.trim());

  return (
    <div className="animate-paraitre flex min-h-0 flex-1 flex-col gap-3">
      <div className="rounded-xl border border-filet px-4 py-3">
        <div className="flex items-baseline justify-between gap-3 text-[11.5px] text-texte-3">
          <span>
            Ligne {curseur + 1} sur {lignes.length}
          </span>
          {suivante && <span className="truncate">Ensuite : {suivante.texte}</span>}
        </div>
        <p className="mt-1 truncate text-[15px] font-medium">{courante?.texte?.trim() || <span className="text-texte-3">Ligne vide</span>}</p>
        <div className="mt-3 flex items-center gap-2">
          <Bouton className="h-10 flex-1 justify-center text-[13.5px]" disabled={!pret} onClick={onMarquer}>
            <Crosshair size={16} /> Marquer le début · {formaterTemps(position)}
          </Bouton>
          <Bouton variante="trait" className="h-10" onClick={onDefaire} title="Défaire le dernier marquage (Retour arrière)">
            <Undo2 size={15} />
          </Bouton>
          <Bouton variante="trait" className="h-10 tabular-nums" onClick={() => onDecalerCible(-PAS_S)} title="Avancer de 0,1 s la dernière ligne calée (touche moins)">
            −0,1 s
          </Bouton>
          <Bouton variante="trait" className="h-10 tabular-nums" onClick={() => onDecalerCible(PAS_S)} title="Retarder de 0,1 s la dernière ligne calée (touche plus)">
            +0,1 s
          </Bouton>
        </div>
        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-texte-3">
          <span>
            <Touche>Espace</Touche> lecture
          </span>
          <span>
            <Touche>Entrée</Touche> marquer
          </span>
          <span>
            <Touche>Retour arrière</Touche> défaire
          </span>
          <span>
            <Touche>←</Touche> <Touche>→</Touche> 5 s (Maj : 1 s)
          </span>
          <span>
            <Touche>↑</Touche> <Touche>↓</Touche> ligne
          </span>
          <span>
            <Touche>−</Touche> <Touche>+</Touche> 0,1 s
          </span>
          <span>
            <Touche>P</Touche> lire la ligne
          </span>
          <span>
            <Touche>Ctrl + S</Touche> enregistrer
          </span>
        </p>
      </div>

      <ListeSynchro lignes={lignes} curseur={curseur} jouee={jouee} {...liste} />
    </div>
  );
}

const ListeSynchro = memo(function ListeSynchro({
  lignes,
  curseur,
  jouee,
  onChoisir,
  onEcouter,
  onPlacer,
  onMaj,
  onDecaler,
  onSupprimer,
  onAjouter,
  onDeplacerLigne,
}: {
  lignes: LigneEditable[];
  curseur: number;
  jouee: number;
  onChoisir: (i: number) => void;
  onEcouter: (i: number) => void;
  onPlacer: (i: number) => void;
  onMaj: (i: number, patch: Partial<LigneEditable>) => void;
  onDecaler: (i: number, delta: number) => void;
  onSupprimer: (i: number) => void;
  onAjouter: (apres: number) => void;
  onDeplacerLigne: (i: number, sens: -1 | 1) => void;
}) {
  const listeRef = useRef<HTMLOListElement>(null);
  const [saisie, setSaisie] = useState<{ i: number; valeur: string } | null>(null);

  // La ligne au curseur reste visible pendant qu'on descend en rythme.
  // Défilement calculé dans la liste, et non `scrollIntoView` : celui-ci
  // ferait aussi défiler le tiroir, qui sauterait sous les doigts.
  useEffect(() => {
    const liste = listeRef.current;
    const el = liste?.children[curseur] as HTMLElement | undefined;
    if (!liste || !el) return;
    const haut = el.offsetTop;
    const bas = haut + el.offsetHeight;
    if (haut < liste.scrollTop) liste.scrollTop = haut;
    else if (bas > liste.scrollTop + liste.clientHeight) liste.scrollTop = bas - liste.clientHeight;
  }, [curseur]);

  function valider(i: number, texte: string) {
    onMaj(i, { temps: lireTemps(texte) });
    setSaisie(null);
  }

  const icone = "grid h-7 w-7 place-items-center rounded-md text-texte-3 transition-colors hover:bg-surface-2 hover:text-texte disabled:opacity-30";

  return (
    <ol ref={listeRef} className="relative min-h-[200px] flex-1 space-y-0.5 overflow-y-auto pr-1">
      {lignes.map((ligne, i) => {
        const auCurseur = i === curseur;
        const enSaisie = saisie?.i === i;
        return (
          <li
            key={i}
            className={clsx(
              "group flex items-center gap-1.5 rounded-lg border px-1.5 py-1 transition-colors",
              auCurseur ? "border-accent/60 bg-accent/[0.07]" : "border-transparent hover:bg-surface-2/60",
              i === jouee && "shadow-[inset_3px_0_0_var(--succes)]",
            )}
          >
            {enSaisie ? (
              <span className="flex shrink-0 items-center gap-0.5">
                <input
                  autoFocus
                  value={saisie.valeur}
                  onChange={(e) => setSaisie({ i, valeur: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      // Échap annule la saisie sans fermer le tiroir.
                      e.stopPropagation();
                      setSaisie(null);
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      valider(i, saisie.valeur);
                    }
                  }}
                  aria-label="Horodatage de la ligne"
                  placeholder="00:12.40"
                  className="h-7 w-[84px] rounded-md border border-accent bg-surface-2 px-1.5 font-mono text-[12px] outline-none"
                />
                <button onClick={() => valider(i, saisie.valeur)} title="Valider (Entrée)" className={clsx(icone, "text-accent")}>
                  <Check size={14} />
                </button>
                <button onClick={() => setSaisie(null)} title="Annuler (Échap)" className={icone}>
                  <X size={14} />
                </button>
              </span>
            ) : (
              <button
                onClick={() => onChoisir(i)}
                onDoubleClick={() => setSaisie({ i, valeur: ligne.temps === null ? "" : formaterTemps(ligne.temps) })}
                title={ligne.temps === null ? "Pas encore calée. Double-clic pour saisir un temps" : "Aller à ce temps. Double-clic pour corriger"}
                className={clsx(
                  "h-7 w-[84px] shrink-0 rounded-md px-1.5 text-left font-mono text-[12px] tabular-nums transition-colors",
                  ligne.temps === null ? "text-texte-3/60 hover:bg-surface-2" : "text-accent hover:bg-accent/10",
                )}
              >
                {ligne.temps === null ? "--:--.--" : formaterTemps(ligne.temps)}
              </button>
            )}

            <input
              value={ligne.texte}
              onChange={(e) => onMaj(i, { texte: e.target.value })}
              onFocus={() => onPlacer(i)}
              aria-label={`Texte de la ligne ${i + 1}`}
              placeholder="(ligne vide, séparation de couplet)"
              className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[13px] outline-none placeholder:text-texte-3/60 focus:bg-surface-2"
            />

            <span className={clsx("flex shrink-0 items-center transition-opacity", auCurseur ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
              {ligne.temps !== null && (
                <>
                  <button onClick={() => onDecaler(i, -PAS_S)} title="Avancer de 0,1 s" className={clsx(icone, "w-auto px-1 text-[11px] tabular-nums")}>
                    −0,1
                  </button>
                  <button onClick={() => onDecaler(i, PAS_S)} title="Retarder de 0,1 s" className={clsx(icone, "w-auto px-1 text-[11px] tabular-nums")}>
                    +0,1
                  </button>
                </>
              )}
              <button onClick={() => onEcouter(i)} title="Lire depuis cette ligne (P)" className={icone}>
                <Play size={13} />
              </button>
              <button onClick={() => onDeplacerLigne(i, -1)} disabled={i === 0} title="Monter cette ligne" className={icone}>
                <ArrowUp size={13} />
              </button>
              <button onClick={() => onDeplacerLigne(i, 1)} disabled={i === lignes.length - 1} title="Descendre cette ligne" className={icone}>
                <ArrowDown size={13} />
              </button>
              <button onClick={() => onAjouter(i)} title="Insérer une ligne en dessous" className={icone}>
                <Plus size={13} />
              </button>
              <button onClick={() => onSupprimer(i)} title="Supprimer cette ligne" className={clsx(icone, "hover:text-danger")}>
                <Trash2 size={13} />
              </button>
            </span>
          </li>
        );
      })}
    </ol>
  );
});

/* ------------------------------------------------------------ aperçu -- */

/**
 * Le résultat tel que le lecteur le lira : relu par `analyserParoles`,
 * donc trié, refrains dédoublés et décalage appliqué. C'est la vérification
 * de ce qui partira, pas une vue de l'édition.
 */
function ModeApercu({ valeur, position, onAllerA }: { valeur: string; position: number; onAllerA: (t: number) => void }) {
  const paroles = useMemo(() => analyserParoles(valeur), [valeur]);
  const active = paroles.synchronisees ? ligneActive(paroles.lignes, position) : -1;
  const listeRef = useRef<HTMLDivElement>(null);

  // La ligne chantée reste au tiers haut de l'aperçu, comme dans le lecteur.
  useEffect(() => {
    const liste = listeRef.current;
    const el = active >= 0 ? (liste?.children[active] as HTMLElement | undefined) : undefined;
    if (!liste || !el) return;
    liste.scrollTo({ top: Math.max(0, el.offsetTop - liste.clientHeight / 3), behavior: "smooth" });
  }, [active]);

  if (paroles.lignes.length === 0) return <Vide texte="Rien à prévisualiser : l'atelier est vide." />;

  return (
    <div className="animate-paraitre flex min-h-0 flex-1 flex-col gap-3">
      {!paroles.synchronisees && (
        <p className="rounded-lg bg-attention/10 px-3 py-2 text-[12.5px] text-attention">
          Ces paroles ne sont pas synchronisées : le lecteur les affichera en entier, sans défilement.
        </p>
      )}
      <div ref={listeRef} className="relative min-h-[200px] flex-1 overflow-y-auto rounded-xl border border-filet px-6 py-5">
        {paroles.lignes.map((l, i) =>
          l.texte ? (
            <button
              key={i}
              disabled={l.temps === null}
              onClick={() => l.temps !== null && onAllerA(l.temps)}
              className={clsx(
                "block w-full py-1 text-left font-titre text-[17px] leading-snug transition-colors duration-200 disabled:cursor-default",
                !paroles.synchronisees ? "text-texte" : i === active ? "font-semibold text-texte" : i < active ? "text-texte-2" : "text-texte-3 hover:text-texte-2",
              )}
            >
              {l.texte}
            </button>
          ) : (
            <div key={i} className="h-4" aria-hidden />
          ),
        )}
        {paroles.credits && <p className="mt-6 text-[12px] text-texte-3">Paroles : {paroles.credits}</p>}
      </div>
      <details className="text-[12px] text-texte-3">
        <summary className="cursor-default select-none hover:text-texte-2">Voir le LRC qui sera enregistré</summary>
        <pre data-selectionnable className="mt-2 max-h-48 overflow-auto rounded-lg bg-surface-2 px-3 py-2 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-texte-2">
          {valeur}
        </pre>
      </details>
    </div>
  );
}
