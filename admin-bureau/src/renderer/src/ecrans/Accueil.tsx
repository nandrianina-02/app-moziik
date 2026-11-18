import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as EvenementSouris, type ReactNode } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Compass,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  House,
  ImagePlus,
  LayoutGrid,
  Library,
  Link2,
  ListChecks,
  Pencil,
  Pin,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  Settings2,
  SquareUser,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { adresseSite, api } from "../api";
import { televerser } from "../envoi";
import { adresseImage } from "../session";
import { BarreCollante, Bascule, Bouton, Carte, Champ, Chargement, EnTete, Erreur, Pastille, Selection, Tiroir, Vide, formatDate, formatNombre } from "../composants";
import { annoncer, confirmer, ouvrirMenu, type EntreeMenu } from "../interactions";
import clsx from "../clsx";

// --- Types et libellés -----------------------------------------------------------

type Groupe = "home" | "discover" | "radio" | "library" | "detail";
type TypeContenu = "song" | "album" | "artist" | "playlist" | "event";

interface Filtres {
  publicOnly: boolean;
  verifiedOnly: boolean;
  premiumOnly: boolean;
}

interface Section {
  _id: string;
  key: string;
  slug?: string;
  title: string;
  enabled: boolean;
  position: number;
  mode: "auto" | "manual";
  limit: number;
  filters: Filtres;
  univers?: string;
  modeEcoute?: string;
}

interface Reglages {
  heroMode: "auto" | "manual";
  recommendationMode: "auto" | "manual";
  theme: string;
  updatedAt?: string;
}

interface Epingle {
  _id: string;
  contentType: TypeContenu | "custom";
  contentId?: string;
  section: string;
  priority: number;
  startDate?: string;
  endDate?: string;
  title: string;
  coverUrl?: string;
}

interface Stats {
  sectionsTotal: number;
  sectionsActive: number;
  pinnedTotal: number;
  pinnedActive: number;
  totalViews: number;
  viewsTrendPct: number | null;
  engagementRatePct: number | null;
}

interface CarteHub {
  _id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  coverUrl?: string;
  linkHref: string;
  enabled: boolean;
  position: number;
}

interface Resultat {
  _id: string;
  title: string;
  coverUrl?: string;
}

/**
 * Les groupes de pages du site. Chaque groupe rassemble des écrans jumeaux :
 * une section configurée pour « Radio » vaut aussi pour les classements.
 * Le groupe « détail » n'a pas de page fixe à prévisualiser : il dépend
 * d'un artiste, d'un album ou d'un titre précis.
 */
const GROUPES: { cle: Groupe; court: string; libelle: string; icone: LucideIcon; apercu: string | null }[] = [
  { cle: "home", court: "Accueil", libelle: "Accueil", icone: House, apercu: "/" },
  { cle: "discover", court: "Découvrir", libelle: "Recherche et Découvrir", icone: Compass, apercu: "/titres" },
  { cle: "radio", court: "Radio", libelle: "Radio et Classements", icone: Radio, apercu: "/radio" },
  { cle: "library", court: "Bibliothèque", libelle: "Bibliothèque et Évènements", icone: Library, apercu: "/bibliotheque" },
  { cle: "detail", court: "Détail", libelle: "Pages artiste, album et titre", icone: SquareUser, apercu: null },
];

const TYPES_SECTION: Record<string, string> = {
  hero: "Bannière",
  for_you: "Pour vous",
  recently_played: "Écoutés récemment",
  new_releases: "Nouveautés",
  top_tracks: "Top titres",
  albums: "Albums",
  trending_artists: "Artistes tendance",
  recommendations: "Recommandations",
  playlists: "Playlists",
  genres: "Genres",
  events: "Évènements",
  radio: "Radio",
  premium: "Premium",
  activity: "Activité",
  custom: "Personnalisée",
};

// Le tri que le moteur du site applique en mode automatique : affiché pour
// que l'on sache ce que « automatique » veut dire pour chaque section.
const TRIS: Record<string, string> = {
  hero: "par priorité",
  for_you: "cartes dans l'ordre choisi",
  recently_played: "historique de chaque auditeur",
  new_releases: "date de sortie, la plus récente d'abord",
  top_tracks: "score d'écoute",
  albums: "score d'écoute",
  trending_artists: "score d'écoute",
  recommendations: "pertinence pour l'auditeur",
  playlists: "popularité",
  genres: "popularité",
  events: "date, la plus proche d'abord",
  premium: "choix manuel",
  activity: "date, la plus récente d'abord",
  custom: "choix manuel",
};

// Miroir de `manualCapableKeys` (lib/homeContentEngine.ts du site) : seules
// ces sections savent afficher du contenu épinglé en mode manuel.
const SECTIONS_EPINGLABLES = new Set(["new_releases", "top_tracks", "recommendations", "playlists", "albums", "trending_artists", "events", "custom"]);

const UNIVERS: Record<string, string> = { general: "Général", christian: "Évangélique" };
const MODES_ECOUTE: Record<string, string> = {
  voyage: "Voyage",
  sport: "Sport",
  etude: "Étude / Concentration",
  travail: "Travail",
  sommeil: "Sommeil",
  relaxation: "Relaxation",
  romance: "Romance",
  fete: "Fête",
  matin: "Matin",
  nuit: "Nuit",
  decouverte: "Découverte",
  tendance: "Tendance",
};

const TYPES_CONTENU: Record<TypeContenu, string> = {
  song: "Titre",
  album: "Album",
  artist: "Artiste",
  playlist: "Playlist",
  event: "Évènement",
};
const libelleContenu = (t: Epingle["contentType"]) => (t === "custom" ? "Bannière personnalisée" : TYPES_CONTENU[t]);

const THEMES: Record<string, string> = { system: "Système", light: "Clair", dark: "Sombre" };

const FILTRES_DEFAUT: Filtres = { publicOnly: true, verifiedOnly: false, premiumOnly: false };

const message = (e: unknown, defaut = "Erreur inattendue.") => (e instanceof Error && e.message ? e.message : defaut);

function periode(debut?: string, fin?: string) {
  if (debut && fin) return `du ${formatDate(debut)} au ${formatDate(fin)}`;
  if (debut) return `à partir du ${formatDate(debut)}`;
  if (fin) return `jusqu'au ${formatDate(fin)}`;
  return "sans limite de date";
}

/** La clé sous laquelle le site range le contenu épinglé d'une section. */
const cleEpingle = (s: Section) => (s.key === "hero" ? "hero" : (s.slug ?? s.key));

/** Les champs d'une section qui diffèrent de la version enregistrée : seuls ceux-là partent. */
function ecarts(s: Section, o: Section): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if (s.title.trim() !== o.title) c.title = s.title.trim();
  if (s.enabled !== o.enabled) c.enabled = s.enabled;
  if (s.mode !== o.mode) c.mode = s.mode;
  if (s.limit !== o.limit) c.limit = s.limit;
  if (s.filters.verifiedOnly !== o.filters.verifiedOnly || s.filters.publicOnly !== o.filters.publicOnly || s.filters.premiumOnly !== o.filters.premiumOnly) c.filters = s.filters;
  return c;
}

/** Ce qui empêcherait le site d'accepter une section : mieux vaut le dire avant d'envoyer. */
function invalidite(s: Section): string | null {
  const t = s.title.trim();
  if (t.length < 1 || t.length > 80) return "le titre doit faire de 1 à 80 caractères";
  if (!Number.isInteger(s.limit) || s.limit < 1 || s.limit > 100) return "la limite doit être un nombre entier de 1 à 100";
  return null;
}

/**
 * Une image pour le site (bannière, carte « Pour vous ») : envoyée dans le
 * dossier des ressources du site, rendue comme adresse /media/… que le site
 * sait servir.
 */
async function envoyerImage(f: File, surProgression: (p: number) => void): Promise<string> {
  if (!f.type.startsWith("image/")) throw new Error("Choisissez une image (JPEG, PNG ou WebP).");
  if (f.size > 8 * 1024 * 1024) throw new Error("Image trop lourde : 8 Mo au plus.");
  const id = await televerser(f, f.name, f.type, "site-assets", undefined, surProgression);
  return `/media/${id}`;
}

function BoutonIcone({ icone: Icone, titre, onClick, disabled, danger }: { icone: LucideIcon; titre: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={titre}
      aria-label={titre}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-texte-3 transition-colors disabled:cursor-not-allowed disabled:opacity-30",
        danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-surface-2 hover:text-texte",
      )}
    >
      <Icone size={15} />
    </button>
  );
}

function Vignette({ src, taille = 40, className }: { src?: string; taille?: number; className?: string }) {
  const url = adresseImage(src);
  return (
    <span className={clsx("grid shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 text-texte-3", className)} style={{ width: taille, height: taille }}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={Math.round(taille * 0.38)} />}
    </span>
  );
}

// --- L'écran -----------------------------------------------------------------------

type CibleContenu = { slug: string; titre: string; aide?: string };

/**
 * Les pages publiques du site : ordre, affichage et réglages des sections
 * de chaque groupe de pages, contenu épinglé, cartes « Pour vous » et
 * paramètres généraux. Les sections et les paramètres se modifient en
 * local et partent ensemble avec « Enregistrer » ; le contenu épinglé et
 * les cartes, eux, s'enregistrent à chaque geste, comme sur le site.
 */
export function Accueil() {
  const [groupe, setGroupe] = useState<Groupe>("home");
  const [origine, setOrigine] = useState<Section[] | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [reglagesOrigine, setReglagesOrigine] = useState<Reglages | null>(null);
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [epingles, setEpingles] = useState<Epingle[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [echecs, setEchecs] = useState<string[]>([]);
  const [enregistrement, setEnregistrement] = useState(false);
  const [deplie, setDeplie] = useState<string | null>(null);
  const [glisse, setGlisse] = useState<string | null>(null);
  const [cibleContenu, setCibleContenu] = useState<CibleContenu | null>(null);
  const [cartesOuvertes, setCartesOuvertes] = useState(false);
  const [creation, setCreation] = useState(false);
  // Un changement d'onglet rapide ne doit pas laisser une réponse ancienne
  // écraser celle du groupe affiché.
  const requete = useRef(0);
  const groupeCourant = useRef<Groupe>(groupe);

  const chargerEpingles = useCallback(
    () =>
      api<{ pinned: Epingle[] }>("/api/admin/homepage/pinned")
        .then((r) => setEpingles(r.pinned ?? []))
        .catch((e) => setErreur(`Contenu épinglé indisponible : ${message(e)}`)),
    [],
  );
  const chargerStats = useCallback(
    (g: Groupe) =>
      api<Stats>(`/api/admin/homepage/stats?page=${g}`)
        .then((s) => g === groupeCourant.current && setStats(s))
        .catch(() => undefined),
    [],
  );

  const charger = useCallback(
    async (g: Groupe) => {
      const n = ++requete.current;
      groupeCourant.current = g;
      setOrigine(null);
      setStats(null);
      setErreur(null);
      setEchecs([]);
      setDeplie(null);
      try {
        const [accueil, epi, st] = await Promise.all([
          api<{ sections: Section[]; settings: Reglages }>(`/api/admin/homepage?page=${g}`),
          api<{ pinned: Epingle[] }>("/api/admin/homepage/pinned").catch(() => null),
          api<Stats>(`/api/admin/homepage/stats?page=${g}`).catch(() => null),
        ]);
        if (n !== requete.current) return;
        const propres = (accueil.sections ?? []).map((s) => ({ ...s, filters: { ...FILTRES_DEFAUT, ...s.filters } })).sort((a, b) => a.position - b.position);
        setOrigine(propres);
        setSections(propres);
        setReglagesOrigine(accueil.settings);
        setReglages(accueil.settings);
        setEpingles(epi?.pinned ?? []);
        setStats(st);
        if (!epi) setErreur("Le contenu épinglé n'a pas pu être chargé.");
      } catch (e) {
        if (n === requete.current) setErreur(message(e, "Impossible de charger la configuration des pages."));
      }
    },
    [],
  );

  useEffect(() => {
    void charger(groupe);
  }, [groupe, charger]);

  const parId = useMemo(() => new Map((origine ?? []).map((s) => [s._id, s])), [origine]);
  const ordreChange = useMemo(() => (origine ? sections.map((s) => s._id).join("|") !== origine.map((s) => s._id).join("|") : false), [sections, origine]);
  const modifiees = useMemo(
    () =>
      sections.filter((s) => {
        const o = parId.get(s._id);
        return o !== undefined && Object.keys(ecarts(s, o)).length > 0;
      }),
    [sections, parId],
  );
  const reglagesChanges = Boolean(
    reglages &&
      reglagesOrigine &&
      (reglages.heroMode !== reglagesOrigine.heroMode || reglages.recommendationMode !== reglagesOrigine.recommendationMode || reglages.theme !== reglagesOrigine.theme),
  );
  const modifie = ordreChange || modifiees.length > 0 || reglagesChanges;
  const invalides = sections.map((s) => ({ s, raison: invalidite(s) })).filter((x) => x.raison !== null);

  const groupeInfo = GROUPES.find((g) => g.cle === groupe)!;

  async function abandonnerSiModifie(titre: string) {
    if (!modifie) return true;
    return confirmer({
      titre,
      message: "Des modifications ne sont pas enregistrées : elles seront perdues.",
      confirmer: "Abandonner les modifications",
      danger: true,
    });
  }

  async function changerGroupe(g: Groupe) {
    if (g === groupe) return;
    if (!(await abandonnerSiModifie("Changer de page ?"))) return;
    setGroupe(g);
  }

  async function actualiser() {
    if (!(await abandonnerSiModifie("Recharger la configuration ?"))) return;
    void charger(groupe);
  }

  const majSection = (id: string, p: Partial<Section>) => setSections((liste) => liste.map((s) => (s._id === id ? { ...s, ...p } : s)));

  // La bannière reste en tête, comme sur le site : ni elle ne bouge, ni
  // une autre section ne passe devant elle.
  const fixe = (s: Section | undefined) => s?.key === "hero";
  const peutDeplacer = (i: number, sens: -1 | 1) => {
    const j = i + sens;
    return j >= 0 && j < sections.length && !fixe(sections[i]) && !fixe(sections[j]);
  };
  function deplacer(i: number, sens: -1 | 1) {
    if (!peutDeplacer(i, sens)) return;
    setSections((liste) => {
      const n = [...liste];
      [n[i], n[i + sens]] = [n[i + sens], n[i]];
      return n;
    });
  }
  function deposer(cibleId: string) {
    const depuis = sections.findIndex((s) => s._id === glisse);
    const vers = sections.findIndex((s) => s._id === cibleId);
    setGlisse(null);
    if (depuis < 0 || vers < 0 || depuis === vers || fixe(sections[depuis]) || fixe(sections[vers])) return;
    setSections((liste) => {
      const n = [...liste];
      const [deplacee] = n.splice(depuis, 1);
      n.splice(vers, 0, deplacee);
      return n;
    });
  }

  /**
   * Envoie tout en une fois : l'ordre, puis chaque section modifiée, puis les
   * paramètres. Chaque réponse est vérifiée ; ce qui a réussi devient la
   * nouvelle référence, ce qui a échoué reste en attente pour un nouvel
   * essai, et la liste des échecs est affichée.
   */
  async function enregistrer() {
    if (!modifie || !origine) return;
    if (invalides.length > 0) {
      setErreur(`« ${invalides[0].s.title.trim() || "Sans titre"} » : ${invalides[0].raison}.`);
      return;
    }
    const points: string[] = [];
    if (ordreChange) points.push("l'ordre des sections");
    if (modifiees.length > 0) points.push(`${modifiees.length} section${modifiees.length > 1 ? "s" : ""} modifiée${modifiees.length > 1 ? "s" : ""}`);
    if (reglagesChanges) points.push("les paramètres généraux");
    const ok = await confirmer({
      titre: "Publier ces changements ?",
      message: (
        <>
          Page « {groupeInfo.libelle} » : {points.join(", ")}. Les visiteurs du site verront le résultat dans la minute.
        </>
      ),
      confirmer: "Enregistrer",
    });
    if (!ok) return;

    setEnregistrement(true);
    setErreur(null);
    const rates: string[] = [];

    let ordreOk = !ordreChange;
    if (ordreChange) {
      try {
        await api(`/api/admin/homepage/sections?page=${groupe}`, { methode: "PATCH", corps: { order: sections.map((s, i) => ({ id: s._id, position: i })) } });
        ordreOk = true;
      } catch (e) {
        rates.push(`Ordre des sections : ${message(e)}`);
      }
    }

    const envois = modifiees.map((s) => ({ s, corps: ecarts(s, parId.get(s._id)!) }));
    const resultats = await Promise.allSettled(envois.map(({ s, corps }) => api<{ section?: Section }>(`/api/admin/homepage/sections/${s._id}`, { methode: "PATCH", corps })));
    const reussies = new Map<string, Section>();
    resultats.forEach((r, i) => {
      const { s } = envois[i];
      if (r.status === "fulfilled") reussies.set(s._id, { ...s, title: s.title.trim() });
      else rates.push(`« ${parId.get(s._id)?.title ?? s.title} » : ${message(r.reason)}`);
    });

    let nouveauxReglages = reglagesOrigine;
    if (reglagesChanges && reglages) {
      try {
        const r = await api<{ settings?: Reglages }>("/api/admin/homepage", {
          methode: "PATCH",
          corps: { heroMode: reglages.heroMode, recommendationMode: reglages.recommendationMode, theme: reglages.theme },
        });
        nouveauxReglages = r.settings ?? reglages;
      } catch (e) {
        rates.push(`Paramètres généraux : ${message(e)}`);
      }
    }

    // La nouvelle référence : l'ordre local si son envoi a réussi, et pour
    // chaque section sa version locale si son envoi a réussi. Le reste de
    // l'écart demeure, donc le bouton Enregistrer reste actif pour réessayer.
    const base = ordreOk ? sections.map((s) => parId.get(s._id)!) : origine;
    const nouvelleOrigine = base.map((o, i) => {
      const faite = reussies.get(o._id);
      return { ...(faite ?? o), position: ordreOk ? i : o.position };
    });
    setOrigine(nouvelleOrigine);
    if (nouveauxReglages) {
      setReglagesOrigine(nouveauxReglages);
      if (rates.every((r) => !r.startsWith("Paramètres"))) setReglages(nouveauxReglages);
    }
    setEchecs(rates);
    setEnregistrement(false);
    void chargerStats(groupe);
    if (rates.length === 0) annoncer("Modifications publiées sur le site");
  }

  async function supprimerSection(s: Section) {
    const nb = (epingles ?? []).filter((p) => p.section === cleEpingle(s)).length;
    const ok = await confirmer({
      titre: `Supprimer la section « ${s.title} » ?`,
      message: (
        <>
          Elle disparaît tout de suite du site.
          {nb > 0 ? ` Ses ${nb} élément${nb > 1 ? "s" : ""} épinglé${nb > 1 ? "s" : ""} ${nb > 1 ? "sont supprimés" : "est supprimé"} avec elle.` : " Le contenu qui lui était épinglé est supprimé avec elle."} Cette action ne s'annule pas.
        </>
      ),
      confirmer: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/homepage/sections/${s._id}`, { methode: "DELETE" });
      // Retirée des deux côtés : les autres modifications en cours restent intactes.
      setSections((l) => l.filter((x) => x._id !== s._id));
      setOrigine((l) => (l ? l.filter((x) => x._id !== s._id) : l));
      setEpingles((l) => (l ? l.filter((p) => p.section !== cleEpingle(s)) : l));
      if (deplie === s._id) setDeplie(null);
      annoncer("Section supprimée");
      void chargerStats(groupe);
    } catch (e) {
      setErreur(`Suppression refusée : ${message(e)}`);
    }
  }

  async function retirerEpingle(p: Epingle) {
    const ok = await confirmer({
      titre: "Retirer cet élément ?",
      message: `« ${p.title} » quitte la section où il était épinglé. Il reste au catalogue.`,
      confirmer: "Retirer",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/homepage/pinned/${p._id}`, { methode: "DELETE" });
      setEpingles((l) => (l ? l.filter((x) => x._id !== p._id) : l));
      annoncer("Élément retiré");
      void chargerStats(groupe);
    } catch (e) {
      setErreur(`Retrait refusé : ${message(e)}`);
    }
  }

  function ouvrirContenu(s: Section) {
    if (s.key === "hero") setCibleContenu({ slug: "hero", titre: "Bannière", aide: "Affichée quand le mode de la bannière est « Manuel », dans les paramètres généraux." });
    else setCibleContenu({ slug: cleEpingle(s), titre: s.title });
  }

  function menuSection(e: EvenementSouris, s: Section, i: number) {
    const epinglable = s.key === "hero" || (s.mode === "manual" && SECTIONS_EPINGLABLES.has(s.key));
    const entrees: EntreeMenu[] = [
      s.key !== "hero" && { libelle: deplie === s._id ? "Replier" : "Modifier", icone: Pencil, action: () => setDeplie(deplie === s._id ? null : s._id) },
      { libelle: s.enabled ? "Masquer sur le site" : "Afficher sur le site", icone: s.enabled ? EyeOff : Eye, action: () => majSection(s._id, { enabled: !s.enabled }) },
      "separateur",
      { libelle: "Monter", icone: ArrowUp, desactive: !peutDeplacer(i, -1), action: () => deplacer(i, -1) },
      { libelle: "Descendre", icone: ArrowDown, desactive: !peutDeplacer(i, 1), action: () => deplacer(i, 1) },
      "separateur",
      s.key === "for_you" && { libelle: "Gérer les cartes", icone: LayoutGrid, action: () => setCartesOuvertes(true) },
      epinglable && { libelle: s.key === "hero" ? "Gérer la bannière" : "Gérer le contenu épinglé", icone: Pin, action: () => ouvrirContenu(s) },
      s.key === "custom" && "separateur",
      s.key === "custom" && { libelle: "Supprimer la section", icone: Trash2, danger: true, action: () => void supprimerSection(s) },
    ];
    ouvrirMenu(e, entrees, s.title);
  }

  // Le contenu épinglé des sections de ce groupe seulement : la bannière
  // n'existe que sur l'accueil.
  const clesGroupe = useMemo(() => new Set(sections.map(cleEpingle)), [sections]);
  const titreParCle = useMemo(() => new Map(sections.map((s) => [cleEpingle(s), s.key === "hero" ? "Bannière" : s.title])), [sections]);
  const epinglesGroupe = (epingles ?? []).filter((p) => clesGroupe.has(p.section)).sort((a, b) => b.priority - a.priority);

  return (
    <>
      <EnTete
        titre="Pages du site"
        texte="Les sections de chaque page publique : ordre, affichage, contenu mis en avant."
        action={
          <>
            <Bouton
              variante="trait"
              disabled={!groupeInfo.apercu}
              title={groupeInfo.apercu ? undefined : "Ces pages dépendent d'un artiste, d'un album ou d'un titre : pas d'adresse unique à ouvrir."}
              onClick={() => groupeInfo.apercu && void window.bureau.ouvrirExterne(`${adresseSite()}${groupeInfo.apercu}`)}
            >
              <ExternalLink size={14} /> Aperçu
            </Bouton>
            <Bouton variante="trait" onClick={() => void actualiser()}>
              <RefreshCw size={14} /> Actualiser
            </Bouton>
          </>
        }
      />

      <BarreCollante className="animate-monter decale-1">
        <div className="flex rounded-lg border border-filet bg-surface p-0.5" role="tablist">
          {GROUPES.map((g) => (
            <button
              key={g.cle}
              role="tab"
              aria-selected={groupe === g.cle}
              title={g.libelle}
              onClick={() => void changerGroupe(g.cle)}
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                groupe === g.cle ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte",
              )}
            >
              <g.icone size={14} /> {g.court}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {modifie && !enregistrement && <span className="animate-paraitre text-[12.5px] text-attention">Modifications non enregistrées</span>}
          <Bouton disabled={!modifie || !origine} enCours={enregistrement} onClick={() => void enregistrer()}>
            <Save size={14} /> Enregistrer
          </Bouton>
        </div>
      </BarreCollante>

      <div className="space-y-4">
        <Erreur message={erreur} />
        {echecs.length > 0 && (
          <div className="animate-paraitre rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-[13px] text-danger">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">
                {echecs.length} envoi{echecs.length > 1 ? "s ont" : " a"} échoué. Le reste est publié ; ce qui a échoué reste à enregistrer.
              </p>
              <button onClick={() => setEchecs([])} className="shrink-0 text-danger/80 hover:text-danger" title="Masquer">
                <X size={15} />
              </button>
            </div>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              {echecs.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!origine ? (
        !erreur && <Chargement texte="Chargement des sections" />
      ) : (
        <div className="mt-4 space-y-5">
          {groupe !== "home" && (
            <p className="animate-monter decale-1 border-l-2 border-filet pl-3 text-[12.5px] leading-relaxed text-texte-3">
              Ces sections arrivent désactivées : rien ne change sur le site tant que vous n'en activez pas une. Une fois active, elle s'affiche sur toutes les pages du
              groupe « {groupeInfo.libelle} ».
            </p>
          )}

          <Indicateurs stats={stats} />

          <div className="grid grid-cols-12 gap-5">
            <Carte
              titre={`Sections — ${groupeInfo.libelle}`}
              className="animate-monter decale-3 col-span-12 min-w-0 xl:col-span-8"
              corps="p-0 pt-3"
              action={
                <Bouton variante="trait" className="h-8" onClick={() => setCreation((v) => !v)}>
                  {creation ? <X size={14} /> : <Plus size={14} />} {creation ? "Fermer" : "Nouvelle section"}
                </Bouton>
              }
            >
              <p className="px-5 text-[12.5px] text-texte-3">Glissez une ligne ou utilisez les flèches pour changer l'ordre. Clic droit pour toutes les actions.</p>
              {creation && (
                <NouvelleSection
                  groupe={groupe}
                  onCreee={(s) => {
                    const propre = { ...s, filters: { ...FILTRES_DEFAUT, ...s.filters } };
                    setSections((l) => [...l, propre]);
                    setOrigine((l) => (l ? [...l, propre] : l));
                    setCreation(false);
                    void chargerStats(groupe);
                    annoncer("Section créée");
                    // La section est vide tant que rien n'y est épinglé : on enchaîne.
                    setCibleContenu({ slug: cleEpingle(propre), titre: propre.title });
                  }}
                />
              )}
              {sections.length === 0 ? (
                <Vide texte="Aucune section dans ce groupe de pages." />
              ) : (
                <ul className="mt-3 divide-y divide-filet border-t border-filet">
                  {sections.map((s, i) => (
                    <LigneSection
                      key={s._id}
                      section={s}
                      rang={i}
                      decale={i < 6 ? i + 1 : 0}
                      modifiee={modifiees.some((m) => m._id === s._id)}
                      deplie={deplie === s._id}
                      enGlisse={glisse === s._id}
                      nbEpingles={(epingles ?? []).filter((p) => p.section === cleEpingle(s)).length}
                      peutMonter={peutDeplacer(i, -1)}
                      peutDescendre={peutDeplacer(i, 1)}
                      onMaj={(p) => majSection(s._id, p)}
                      onDeplacer={(sens) => deplacer(i, sens)}
                      onDeplier={() => setDeplie(deplie === s._id ? null : s._id)}
                      onContenu={() => ouvrirContenu(s)}
                      onCartes={() => setCartesOuvertes(true)}
                      onSupprimer={() => void supprimerSection(s)}
                      onMenu={(e) => menuSection(e, s, i)}
                      onGlisser={() => setGlisse(s._id)}
                      onFinGlisse={() => setGlisse(null)}
                      onDeposer={() => deposer(s._id)}
                    />
                  ))}
                </ul>
              )}
            </Carte>

            <div className="col-span-12 space-y-5 xl:col-span-4">
              <Carte titre="Contenu épinglé" className="animate-monter decale-4" corps="px-5 pb-4 pt-2">
                <p className="mb-2 text-[12.5px] text-texte-3">Ce qui est mis en avant sur ces pages, par priorité décroissante.</p>
                {!epingles ? (
                  <Chargement />
                ) : epinglesGroupe.length === 0 ? (
                  <p className="py-4 text-[13px] text-texte-3">
                    Rien d'épinglé ici. Passez une section en mode manuel, puis utilisez <Pin size={12} className="inline align-[-1px]" /> sur sa ligne.
                  </p>
                ) : (
                  <ul className="max-h-[420px] divide-y divide-filet overflow-y-auto">
                    {epinglesGroupe.map((p) => (
                      <li
                        key={p._id}
                        className="animate-paraitre flex items-center gap-3 py-2.5"
                        onContextMenu={(e) =>
                          ouvrirMenu(
                            e,
                            [
                              {
                                libelle: "Ouvrir la section",
                                icone: Pin,
                                action: () => {
                                  const s = sections.find((x) => cleEpingle(x) === p.section);
                                  if (s) ouvrirContenu(s);
                                },
                              },
                              "separateur",
                              { libelle: "Retirer", icone: Trash2, danger: true, action: () => void retirerEpingle(p) },
                            ],
                            p.title,
                          )
                        }
                      >
                        <Vignette src={p.coverUrl} taille={40} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="truncate text-[13px] font-medium">{p.title}</span>
                            {p.priority !== 0 && <Pastille texte={`P${p.priority}`} ton="accent" />}
                          </div>
                          <div className="truncate text-[12px] text-texte-3">
                            {libelleContenu(p.contentType)} · {titreParCle.get(p.section) ?? p.section}
                          </div>
                          <div className="truncate text-[12px] text-texte-3">{periode(p.startDate, p.endDate)}</div>
                        </div>
                        <BoutonIcone icone={Trash2} titre="Retirer" danger onClick={() => void retirerEpingle(p)} />
                      </li>
                    ))}
                  </ul>
                )}
              </Carte>

              {reglages && (
                <Carte titre="Paramètres généraux" className="animate-monter decale-5" corps="px-5 pb-5 pt-2">
                  <p className="mb-3 text-[12.5px] text-texte-3">Communs à toutes les pages. Enregistrés avec le bouton Enregistrer.</p>
                  <div className="space-y-3">
                    <Selection libelle="Bannière d'accueil" value={reglages.heroMode} onChange={(e) => setReglages({ ...reglages, heroMode: e.target.value as Reglages["heroMode"] })}>
                      <option value="auto">Automatique : les sorties mises en avant par le site</option>
                      <option value="manual">Manuel : le contenu épinglé dans la bannière</option>
                    </Selection>
                    <Selection
                      libelle="Recommandations"
                      value={reglages.recommendationMode}
                      onChange={(e) => setReglages({ ...reglages, recommendationMode: e.target.value as Reglages["recommendationMode"] })}
                    >
                      <option value="auto">Automatiques</option>
                      <option value="manual">Désactivées</option>
                    </Selection>
                    <Selection libelle="Thème par défaut" value={reglages.theme} onChange={(e) => setReglages({ ...reglages, theme: e.target.value })}>
                      {Object.entries(THEMES).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                      {!(reglages.theme in THEMES) && <option value={reglages.theme}>{reglages.theme}</option>}
                    </Selection>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-filet pt-3 text-[12px] text-texte-3">
                    <span>Dernière mise à jour</span>
                    <span className="tabular-nums">{formatDate(reglagesOrigine?.updatedAt)}</span>
                  </div>
                </Carte>
              )}

              {groupe === "home" && (
                <Carte titre="Cartes « Pour vous »" className="animate-monter decale-6" corps="px-5 pb-5 pt-2">
                  <p className="text-[12.5px] leading-relaxed text-texte-3">
                    Les raccourcis de la section « Pour vous ». Une carte sans image prend la pochette du contenu vers lequel elle mène.
                  </p>
                  <Bouton variante="trait" className="mt-3" onClick={() => setCartesOuvertes(true)}>
                    <LayoutGrid size={14} /> Gérer les cartes
                  </Bouton>
                </Carte>
              )}
            </div>
          </div>
        </div>
      )}

      {cibleContenu && (
        <TiroirContenu
          cible={cibleContenu}
          elements={(epingles ?? []).filter((p) => p.section === cibleContenu.slug).sort((a, b) => b.priority - a.priority)}
          onAjoute={async () => {
            await chargerEpingles();
            void chargerStats(groupe);
          }}
          onRetirer={(p) => void retirerEpingle(p)}
          onFermer={() => setCibleContenu(null)}
        />
      )}
      {cartesOuvertes && <TiroirCartes onFermer={() => setCartesOuvertes(false)} />}
    </>
  );
}

// --- Indicateurs ---------------------------------------------------------------------

function Tuile({ icone: Icone, libelle, valeur, aide, decale }: { icone: LucideIcon; libelle: string; valeur: string; aide: ReactNode; decale: number }) {
  return (
    <div className={clsx("animate-monter rounded-2xl border border-filet bg-surface p-4", `decale-${decale}`)}>
      <div className="flex items-center gap-1.5 text-[12px] text-texte-3">
        <Icone size={13} /> {libelle}
      </div>
      <div className="mt-1 font-titre text-[22px] font-semibold tabular-nums">{valeur}</div>
      <div className="mt-0.5 text-[12px] text-texte-3">{aide}</div>
    </div>
  );
}

function Indicateurs({ stats }: { stats: Stats | null }) {
  const tendance = stats?.viewsTrendPct;
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Tuile icone={ListChecks} decale={1} libelle="Sections actives" valeur={stats ? `${formatNombre(stats.sectionsActive)} / ${formatNombre(stats.sectionsTotal)}` : "—"} aide="Affichées sur le site" />
      <Tuile icone={Pin} decale={2} libelle="Contenu épinglé" valeur={formatNombre(stats?.pinnedActive)} aide={stats ? `En avant aujourd'hui, ${formatNombre(stats.pinnedTotal)} au total` : "—"} />
      <Tuile
        icone={Activity}
        decale={3}
        libelle="Taux d'engagement"
        valeur={typeof stats?.engagementRatePct === "number" ? `${stats.engagementRatePct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—"}
        aide="Écoutes rapportées aux vues de l'accueil, 30 jours"
      />
      <Tuile
        icone={Eye}
        decale={4}
        libelle="Vues de l'accueil"
        valeur={formatNombre(stats?.totalViews)}
        aide={
          typeof tendance === "number" ? (
            <span className={clsx("inline-flex items-center gap-1", tendance >= 0 ? "text-succes" : "text-danger")}>
              {tendance >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {tendance >= 0 ? "+" : ""}
              {tendance.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % sur le mois précédent
            </span>
          ) : (
            "Mesurées sur l'accueil seulement"
          )
        }
      />
    </div>
  );
}

// --- Une section ---------------------------------------------------------------------

function LigneSection({
  section: s,
  rang,
  decale,
  modifiee,
  deplie,
  enGlisse,
  nbEpingles,
  peutMonter,
  peutDescendre,
  onMaj,
  onDeplacer,
  onDeplier,
  onContenu,
  onCartes,
  onSupprimer,
  onMenu,
  onGlisser,
  onFinGlisse,
  onDeposer,
}: {
  section: Section;
  rang: number;
  decale: number;
  modifiee: boolean;
  deplie: boolean;
  enGlisse: boolean;
  nbEpingles: number;
  peutMonter: boolean;
  peutDescendre: boolean;
  onMaj: (p: Partial<Section>) => void;
  onDeplacer: (sens: -1 | 1) => void;
  onDeplier: () => void;
  onContenu: () => void;
  onCartes: () => void;
  onSupprimer: () => void;
  onMenu: (e: EvenementSouris) => void;
  onGlisser: () => void;
  onFinGlisse: () => void;
  onDeposer: () => void;
}) {
  const hero = s.key === "hero";
  const perso = s.key === "custom";
  const epinglable = hero || (s.mode === "manual" && SECTIONS_EPINGLABLES.has(s.key));
  const raison = invalidite(s);
  // Glisser une ligne dépliée gênerait la sélection du texte dans ses champs.
  const deplacable = !hero && !deplie;

  return (
    <li
      draggable={deplacable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onGlisser();
      }}
      onDragEnd={onFinGlisse}
      onDragOver={(e) => !hero && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDeposer();
      }}
      onContextMenu={onMenu}
      className={clsx("animate-paraitre", decale > 0 && `decale-${decale}`, enGlisse && "opacity-40", modifiee && "shadow-[inset_3px_0_0_var(--attention)]")}
    >
      <div className={clsx("flex items-center gap-3 px-4 py-2.5", !s.enabled && "text-texte-3")}>
        <span className={clsx("grid w-5 shrink-0 place-items-center text-texte-3", deplacable && "cursor-grab")} title={hero ? "Toujours affichée en premier" : "Glisser pour déplacer"}>
          {hero ? <Pin size={14} /> : <GripVertical size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-y-1">
            <span className={clsx("truncate text-[13.5px] font-semibold", s.enabled ? "text-texte" : "text-texte-3")}>{s.title.trim() || "Sans titre"}</span>
            <Pastille texte={TYPES_SECTION[s.key] ?? s.key} />
            {s.univers && <Pastille texte={UNIVERS[s.univers] ?? s.univers} />}
            {s.modeEcoute && <Pastille texte={`Mode ${MODES_ECOUTE[s.modeEcoute] ?? s.modeEcoute}`} ton="accent" />}
            {raison && <Pastille texte="À corriger" ton="danger" />}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-texte-3">
            {hero ? "Toujours en premier" : `Position ${rang + 1}`} · {s.mode === "auto" ? `Automatique, ${TRIS[s.key] ?? "tri du site"}` : "Manuel"} · {s.limit} élément{s.limit > 1 ? "s" : ""} au plus
            {epinglable && ` · ${nbEpingles} épinglé${nbEpingles > 1 ? "s" : ""}`}
            {s.modeEcoute ? " · visible dans ce mode seulement" : s.univers ? " · visible dans cet univers seulement" : ""}
          </div>
        </div>
        <div className="w-[118px] shrink-0 [&_label]:py-0">
          <Bascule libelle={s.enabled ? "Affichée" : "Masquée"} valeur={s.enabled} onChange={(v) => onMaj({ enabled: v })} />
        </div>
        <div className="flex shrink-0 items-center">
          <BoutonIcone icone={ArrowUp} titre="Monter" disabled={!peutMonter} onClick={() => onDeplacer(-1)} />
          <BoutonIcone icone={ArrowDown} titre="Descendre" disabled={!peutDescendre} onClick={() => onDeplacer(1)} />
          {s.key === "for_you" && <BoutonIcone icone={LayoutGrid} titre="Gérer les cartes" onClick={onCartes} />}
          {epinglable && <BoutonIcone icone={hero ? Settings2 : Pin} titre={hero ? "Gérer la bannière" : "Gérer le contenu épinglé"} onClick={onContenu} />}
          {perso && <BoutonIcone icone={Trash2} titre="Supprimer la section" danger onClick={onSupprimer} />}
          {!hero && (
            <button
              type="button"
              onClick={onDeplier}
              title={deplie ? "Replier" : "Modifier"}
              aria-expanded={deplie}
              className="grid h-8 w-8 place-items-center rounded-lg text-texte-3 hover:bg-surface-2 hover:text-texte"
            >
              <ChevronDown size={15} className={clsx("transition-transform duration-150", deplie && "rotate-180")} />
            </button>
          )}
        </div>
      </div>

      {deplie && (
        <div className="animate-paraitre border-t border-filet bg-surface-2/40 px-4 py-4 pl-12">
          <div className="grid grid-cols-12 gap-4">
            <Champ libelle="Titre affiché" className="col-span-12 lg:col-span-6" maxLength={80} value={s.title} onChange={(e) => onMaj({ title: e.target.value })} />
            {perso ? (
              <div className="col-span-6 lg:col-span-3">
                <span className="mb-1.5 block text-[12px] font-medium text-texte-2">Mode</span>
                <p className="flex h-9 items-center text-[13px] text-texte-2">Manuel, toujours</p>
              </div>
            ) : (
              <Selection libelle="Mode" className="col-span-6 lg:col-span-3" value={s.mode} onChange={(e) => onMaj({ mode: e.target.value as Section["mode"] })}>
                <option value="auto">Automatique</option>
                <option value="manual">Manuel (épinglé)</option>
              </Selection>
            )}
            <Champ
              libelle="Limite"
              className="col-span-6 lg:col-span-3"
              type="number"
              min={1}
              max={100}
              value={Number.isFinite(s.limit) ? s.limit : ""}
              onChange={(e) => onMaj({ limit: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
            />
          </div>
          {raison && <p className="mt-2 text-[12.5px] text-danger">Pour enregistrer, {raison}.</p>}
          {s.mode === "manual" && !perso && !SECTIONS_EPINGLABLES.has(s.key) && (
            <p className="mt-2 text-[12.5px] text-attention">Cette section ne sait pas afficher de contenu épinglé : en mode manuel, elle restera vide.</p>
          )}
          <div className="mt-2 max-w-xl">
            <Bascule
              libelle="Artistes vérifiés seulement"
              aide="Appliqué aux nouveautés, au top des titres et aux artistes tendance, en mode automatique."
              valeur={s.filters.verifiedOnly}
              onChange={(v) => onMaj({ filters: { ...s.filters, verifiedOnly: v } })}
            />
          </div>
        </div>
      )}
    </li>
  );
}

function NouvelleSection({ groupe, onCreee }: { groupe: Groupe; onCreee: (s: Section) => void }) {
  const [titre, setTitre] = useState("");
  const [limite, setLimite] = useState("8");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const n = Number(limite);
  const pret = titre.trim().length > 0 && Number.isInteger(n) && n >= 1 && n <= 100;

  async function creer() {
    if (!pret) return;
    setEnCours(true);
    setErreur(null);
    try {
      const { section } = await api<{ section: Section }>("/api/admin/homepage/sections", { corps: { title: titre.trim(), limit: n, page: groupe } });
      onCreee(section);
    } catch (e) {
      setErreur(message(e, "Création refusée."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form
      className="animate-paraitre mx-5 mt-3 rounded-xl border border-dashed border-filet p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void creer();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Champ libelle="Titre de la section" className="min-w-[220px] flex-1" maxLength={80} autoFocus value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Sélection du mois" />
        <Champ libelle="Limite" className="w-24" type="number" min={1} max={100} value={limite} onChange={(e) => setLimite(e.target.value)} />
        <Bouton type="submit" disabled={!pret} enCours={enCours}>
          <Plus size={14} /> Créer
        </Bouton>
      </div>
      <p className="mt-2 text-[12px] text-texte-3">
        Une section personnalisée est toujours en mode manuel et s'ajoute à la fin. Elle est active dès sa création, mais n'apparaît sur le site qu'une fois du contenu épinglé.
      </p>
      <div className="mt-2 empty:hidden">
        <Erreur message={erreur} />
      </div>
    </form>
  );
}

// --- Contenu épinglé d'une section ----------------------------------------------------

function TiroirContenu({
  cible,
  elements,
  onAjoute,
  onRetirer,
  onFermer,
}: {
  cible: CibleContenu;
  elements: Epingle[];
  onAjoute: () => Promise<void>;
  onRetirer: (p: Epingle) => void;
  onFermer: () => void;
}) {
  const [mode, setMode] = useState<"existant" | "perso">("existant");
  const [type, setType] = useState<TypeContenu>("song");
  const [saisie, setSaisie] = useState("");
  const [resultats, setResultats] = useState<Resultat[] | null>(null);
  const [choisi, setChoisi] = useState<Resultat | null>(null);
  const [titre, setTitre] = useState("");
  const [sousTitre, setSousTitre] = useState("");
  const [lien, setLien] = useState("");
  const [image, setImage] = useState("");
  const [envoi, setEnvoi] = useState<number | null>(null);
  const [priorite, setPriorite] = useState("0");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const recherche = useRef(0);

  // La recherche part après une courte pause de frappe ; une réponse plus
  // ancienne que la dernière demande est ignorée.
  useEffect(() => {
    setChoisi(null);
    setResultats(null);
    const n = ++recherche.current;
    const t = setTimeout(() => {
      api<{ results: Resultat[] }>(`/api/admin/homepage/content-search?type=${type}&q=${encodeURIComponent(saisie.trim())}`)
        .then((r) => n === recherche.current && setResultats(r.results ?? []))
        .catch(() => n === recherche.current && setResultats([]));
    }, 300);
    return () => clearTimeout(t);
  }, [type, saisie]);

  async function changerImage(f: File) {
    setErreur(null);
    setEnvoi(0);
    try {
      setImage(await envoyerImage(f, setEnvoi));
    } catch (e) {
      setErreur(message(e, "Envoi de l'image impossible."));
    } finally {
      setEnvoi(null);
    }
  }

  const prio = Number(priorite);
  const problemes = [
    mode === "existant" && !choisi && "choisissez un contenu dans la liste",
    mode === "perso" && (titre.trim().length === 0 || titre.trim().length > 80) && "le titre doit faire de 1 à 80 caractères",
    mode === "perso" && (lien.trim().length === 0 || lien.trim().length > 300) && "le lien est obligatoire",
    !Number.isInteger(prio) && "la priorité doit être un nombre entier",
    debut && fin && fin < debut && "la fin doit suivre le début",
  ].filter(Boolean) as string[];

  async function ajouter() {
    if (problemes.length > 0) return setErreur(`Pour ajouter, ${problemes[0]}.`);
    const base = { section: cible.slug, priority: prio, startDate: debut || undefined, endDate: fin || undefined };
    const corps =
      mode === "existant"
        ? { contentType: type, contentId: choisi!._id, ...base }
        : {
            contentType: "custom",
            customTitle: titre.trim(),
            customSubtitle: sousTitre.trim() || undefined,
            customCoverUrl: image || undefined,
            customHref: lien.trim(),
            ...base,
          };
    setEnCours(true);
    setErreur(null);
    try {
      await api("/api/admin/homepage/pinned", { corps });
      annoncer(`Ajouté à « ${cible.titre} »`);
      setChoisi(null);
      setTitre("");
      setSousTitre("");
      setLien("");
      setImage("");
      await onAjoute();
    } catch (e) {
      setErreur(message(e, "Ajout refusé."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Tiroir
      titre={`Contenu — ${cible.titre}`}
      sousTitre={cible.aide ?? "Les éléments épinglés, par priorité décroissante."}
      largeur={520}
      onFermer={onFermer}
      pied={
        <Bouton enCours={enCours} disabled={envoi !== null} onClick={() => void ajouter()}>
          <Plus size={14} /> Ajouter à la section
        </Bouton>
      }
    >
      <section className="animate-monter">
        <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-texte-3 uppercase">Éléments actuels</h3>
        {elements.length === 0 ? (
          <p className="text-[13px] text-texte-3">Vide pour l'instant : ajoutez un premier élément ci-dessous pour que la section s'affiche.</p>
        ) : (
          <ul className="divide-y divide-filet rounded-xl border border-filet">
            {elements.map((p) => (
              <li
                key={p._id}
                className="animate-paraitre flex items-center gap-3 px-3 py-2"
                onContextMenu={(e) => ouvrirMenu(e, [{ libelle: "Retirer", icone: Trash2, danger: true, action: () => onRetirer(p) }], p.title)}
              >
                <Vignette src={p.coverUrl} taille={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{p.title}</div>
                  <div className="truncate text-[12px] text-texte-3">
                    {libelleContenu(p.contentType)} · priorité {p.priority} · {periode(p.startDate, p.endDate)}
                  </div>
                </div>
                <BoutonIcone icone={Trash2} titre="Retirer" danger onClick={() => onRetirer(p)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="animate-monter decale-1 mt-6 border-t border-filet pt-5">
        <h3 className="mb-3 text-[12px] font-semibold tracking-wide text-texte-3 uppercase">Ajouter</h3>
        <div className="mb-4 flex rounded-lg border border-filet bg-surface-2 p-0.5">
          {(
            [
              ["existant", "Contenu du catalogue", Search],
              ["perso", "Bannière personnalisée", Link2],
            ] as const
          ).map(([m, libelle, Icone]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={clsx(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                mode === m ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte",
              )}
            >
              <Icone size={14} /> {libelle}
            </button>
          ))}
        </div>

        {mode === "existant" ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Selection className="w-36" value={type} onChange={(e) => setType(e.target.value as TypeContenu)}>
                {Object.entries(TYPES_CONTENU).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Selection>
              <div className="relative flex-1">
                <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texte-3" />
                <input
                  value={saisie}
                  onChange={(e) => setSaisie(e.target.value)}
                  placeholder="Rechercher par nom"
                  className="h-9 w-full rounded-lg border border-filet bg-surface-2 pr-3 pl-8 text-[13px] text-texte outline-none placeholder:text-texte-3 focus:border-accent"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-filet">
              {resultats === null ? (
                <div className="px-3">
                  <Chargement texte="Recherche" />
                </div>
              ) : resultats.length === 0 ? (
                <p className="px-3 py-6 text-center text-[13px] text-texte-3">Aucun résultat.</p>
              ) : (
                <ul className="divide-y divide-filet">
                  {resultats.map((r) => (
                    <li key={r._id}>
                      <button
                        type="button"
                        onClick={() => setChoisi(r)}
                        className={clsx(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors",
                          choisi?._id === r._id ? "bg-accent/10 shadow-[inset_3px_0_0_var(--accent)]" : "hover:bg-surface-2",
                        )}
                      >
                        <Vignette src={r.coverUrl} taille={32} className="rounded-md" />
                        <span className="min-w-0 flex-1 truncate">{r.title}</span>
                        {choisi?._id === r._id && <Pastille texte="Choisi" ton="accent" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="group relative block h-32 cursor-pointer overflow-hidden rounded-xl border border-filet bg-surface-2">
              {image && <img src={adresseImage(image) ?? undefined} alt="" className="h-full w-full object-cover" />}
              <span className={clsx("absolute inset-0 grid place-items-center content-center gap-1 text-[12.5px]", image ? "bg-black/45 text-white" : "text-texte-3 group-hover:text-texte")}>
                <ImagePlus size={18} />
                {envoi !== null ? `Envoi ${envoi} %` : image ? "Changer l'image" : "Choisir une image"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={envoi !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void changerImage(f);
                }}
              />
            </label>
            <Champ libelle="Titre" maxLength={80} value={titre} onChange={(e) => setTitre(e.target.value)} />
            <Champ libelle="Sous-titre (facultatif)" maxLength={160} value={sousTitre} onChange={(e) => setSousTitre(e.target.value)} />
            <Champ libelle="Lien" maxLength={300} value={lien} onChange={(e) => setLien(e.target.value)} placeholder="/evenements ou https://…" aide="Une page du site, qui commence par /, ou une adresse https://." />
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-filet pt-4">
          <Champ libelle="Priorité" type="number" step={1} value={priorite} onChange={(e) => setPriorite(e.target.value)} />
          <Champ libelle="Début" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
          <Champ libelle="Fin" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
        <p className="mt-2 text-[12px] text-texte-3">La priorité la plus haute passe en premier. Sans dates, l'élément reste en place jusqu'à ce qu'on le retire.</p>
        <div className="mt-3">
          <Erreur message={erreur} />
        </div>
      </section>
    </Tiroir>
  );
}

// --- Cartes « Pour vous » ------------------------------------------------------------------

/**
 * Les cartes de la section « Pour vous ». Chaque geste part aussitôt au
 * site (comme sur la page web) : il n'y a pas de brouillon à enregistrer.
 */
function TiroirCartes({ onFermer }: { onFermer: () => void }) {
  const [cartes, setCartes] = useState<CarteHub[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [titre, setTitre] = useState("");
  const [lien, setLien] = useState("/");
  const [creation, setCreation] = useState(false);

  const charger = useCallback(
    () =>
      api<{ cards: CarteHub[] }>("/api/admin/homepage/hub-cards")
        .then((r) => setCartes([...(r.cards ?? [])].sort((a, b) => a.position - b.position)))
        .catch((e) => setErreur(message(e, "Impossible de charger les cartes."))),
    [],
  );
  useEffect(() => {
    void charger();
  }, [charger]);

  /** Envoie une modification ; rend vrai si le site l'a acceptée. */
  async function modifier(id: string, champs: Partial<CarteHub>): Promise<boolean> {
    // Contrairement aux sections, une carte s'enregistre aussitôt : l'afficher
    // ou la masquer change la page d'accueil publique, d'où la confirmation.
    if (champs.enabled !== undefined) {
      const carte = cartes?.find((c) => c._id === id);
      const ok = await confirmer({
        titre: champs.enabled ? `Afficher la carte « ${carte?.title ?? ""} » ?` : `Masquer la carte « ${carte?.title ?? ""} » ?`,
        message: champs.enabled ? "Elle apparaît tout de suite dans la section « Pour vous » de l'accueil." : "Elle disparaît tout de suite de la section « Pour vous » ; elle reste ici, prête à être réaffichée.",
        confirmer: champs.enabled ? "Afficher" : "Masquer",
      });
      if (!ok) return false;
    }
    setErreur(null);
    try {
      const { card } = await api<{ card?: CarteHub }>(`/api/admin/homepage/hub-cards/${id}`, { methode: "PATCH", corps: champs });
      setCartes((l) => (l ? l.map((c) => (c._id === id ? { ...c, ...champs, ...(card ?? {}) } : c)) : l));
      return true;
    } catch (e) {
      setErreur(`Modification refusée : ${message(e)}`);
      return false;
    }
  }

  async function deplacer(i: number, sens: -1 | 1) {
    if (!cartes) return;
    const j = i + sens;
    if (j < 0 || j >= cartes.length) return;
    const avant = cartes;
    const n = [...cartes];
    [n[i], n[j]] = [n[j], n[i]];
    setCartes(n);
    setErreur(null);
    try {
      await api("/api/admin/homepage/hub-cards", { methode: "PATCH", corps: { order: n.map((c, k) => ({ id: c._id, position: k })) } });
    } catch (e) {
      // L'ordre affiché doit rester celui du site : on revient en arrière.
      setCartes(avant);
      setErreur(`Réorganisation refusée : ${message(e)}`);
    }
  }

  async function supprimer(c: CarteHub) {
    const ok = await confirmer({
      titre: `Supprimer la carte « ${c.title} » ?`,
      message: "Elle disparaît tout de suite de la section « Pour vous ». Cette action ne s'annule pas.",
      confirmer: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/homepage/hub-cards/${c._id}`, { methode: "DELETE" });
      setCartes((l) => (l ? l.filter((x) => x._id !== c._id) : l));
      annoncer("Carte supprimée");
    } catch (e) {
      setErreur(`Suppression refusée : ${message(e)}`);
    }
  }

  const pret = titre.trim().length > 0 && titre.trim().length <= 60 && lien.trim().length > 0 && lien.trim().length <= 300;
  async function creer() {
    if (!pret) return;
    setCreation(true);
    setErreur(null);
    try {
      const { card } = await api<{ card: CarteHub }>("/api/admin/homepage/hub-cards", { corps: { title: titre.trim(), linkHref: lien.trim(), enabled: true } });
      setCartes((l) => [...(l ?? []), card]);
      setTitre("");
      setLien("/");
      annoncer("Carte créée");
    } catch (e) {
      setErreur(message(e, "Création refusée."));
    } finally {
      setCreation(false);
    }
  }

  return (
    <Tiroir
      titre="Cartes « Pour vous »"
      sousTitre="Une carte sans image prend la pochette du contenu vers lequel elle mène."
      largeur={580}
      onFermer={onFermer}
    >
      <Erreur message={erreur} />
      {!cartes ? (
        !erreur && <Chargement />
      ) : (
        <>
          {cartes.length === 0 ? (
            <Vide texte="Aucune carte pour l'instant." />
          ) : (
            <ul className={clsx("space-y-3", erreur && "mt-3")}>
              {cartes.map((c, i) => (
                <LigneCarte
                  key={c._id}
                  carte={c}
                  decale={i < 6 ? i + 1 : 0}
                  premiere={i === 0}
                  derniere={i === cartes.length - 1}
                  onModifier={(champs) => modifier(c._id, champs)}
                  onDeplacer={(sens) => void deplacer(i, sens)}
                  onSupprimer={() => void supprimer(c)}
                  onErreur={setErreur}
                />
              ))}
            </ul>
          )}

          <form
            className="mt-5 border-t border-filet pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void creer();
            }}
          >
            <h3 className="mb-3 text-[12px] font-semibold tracking-wide text-texte-3 uppercase">Nouvelle carte</h3>
            <div className="flex items-end gap-2">
              <Champ libelle="Titre" className="flex-1" maxLength={60} value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Mix du jour" />
              <Champ libelle="Lien" className="flex-1" maxLength={300} value={lien} onChange={(e) => setLien(e.target.value)} placeholder="/recherche?q=chill" />
              <Bouton type="submit" disabled={!pret} enCours={creation}>
                <Plus size={14} /> Ajouter
              </Bouton>
            </div>
          </form>
        </>
      )}
    </Tiroir>
  );
}

function LigneCarte({
  carte: c,
  decale,
  premiere,
  derniere,
  onModifier,
  onDeplacer,
  onSupprimer,
  onErreur,
}: {
  carte: CarteHub;
  decale: number;
  premiere: boolean;
  derniere: boolean;
  onModifier: (champs: Partial<CarteHub>) => Promise<boolean>;
  onDeplacer: (sens: -1 | 1) => void;
  onSupprimer: () => void;
  onErreur: (m: string | null) => void;
}) {
  const [titre, setTitre] = useState(c.title);
  const [badge, setBadge] = useState(c.badge ?? "");
  const [sousTitre, setSousTitre] = useState(c.subtitle ?? "");
  const [lien, setLien] = useState(c.linkHref);
  const [envoi, setEnvoi] = useState<number | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  /**
   * Un champ part au site quand on le quitte, s'il a changé. Une valeur
   * refusée d'avance (titre ou lien vide) revient à l'ancienne plutôt que
   * de laisser croire qu'elle est enregistrée.
   */
  async function quitter(champ: "title" | "badge" | "subtitle" | "linkHref", valeur: string, remettre: (v: string) => void, ancienne: string, obligatoire: boolean) {
    const v = valeur.trim();
    if (v === ancienne) return;
    if (obligatoire && v.length === 0) {
      remettre(ancienne);
      return onErreur(champ === "title" ? "Le titre d'une carte est obligatoire." : "Le lien d'une carte est obligatoire.");
    }
    if (!(await onModifier({ [champ]: v }))) remettre(ancienne);
  }

  async function changerImage(f: File) {
    onErreur(null);
    setEnvoi(0);
    try {
      const url = await envoyerImage(f, setEnvoi);
      await onModifier({ coverUrl: url });
    } catch (e) {
      onErreur(message(e, "Envoi de l'image impossible."));
    } finally {
      setEnvoi(null);
    }
  }

  return (
    <li
      className={clsx("animate-monter rounded-xl border border-filet p-3", decale > 0 && `decale-${decale}`, !c.enabled && "bg-surface-2/40")}
      onContextMenu={(e) =>
        ouvrirMenu(
          e,
          [
            { libelle: c.enabled ? "Désactiver" : "Activer", icone: c.enabled ? EyeOff : Eye, action: () => void onModifier({ enabled: !c.enabled }) },
            { libelle: "Changer l'image", icone: ImagePlus, action: () => fichier.current?.click() },
            { libelle: "Retirer l'image", icone: X, desactive: !c.coverUrl, action: () => void onModifier({ coverUrl: "" }) },
            "separateur",
            { libelle: "Monter", icone: ArrowUp, desactive: premiere, action: () => onDeplacer(-1) },
            { libelle: "Descendre", icone: ArrowDown, desactive: derniere, action: () => onDeplacer(1) },
            "separateur",
            { libelle: "Supprimer", icone: Trash2, danger: true, action: onSupprimer },
          ],
          c.title,
        )
      }
    >
      <div className="flex items-start gap-3">
        <label className="group relative h-[72px] w-[72px] shrink-0 cursor-pointer overflow-hidden rounded-lg bg-surface-2" title="Changer l'image">
          {c.coverUrl && <img src={adresseImage(c.coverUrl) ?? undefined} alt="" className="h-full w-full object-cover" />}
          <span
            className={clsx(
              "absolute inset-0 grid place-items-center text-[11px] transition-colors",
              c.coverUrl ? "bg-black/30 text-white/90 group-hover:bg-black/55" : "text-texte-3 group-hover:text-texte",
            )}
          >
            {envoi !== null ? `${envoi} %` : <ImagePlus size={17} />}
          </span>
          <input
            ref={fichier}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={envoi !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void changerImage(f);
            }}
          />
        </label>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex gap-2">
            <input
              aria-label="Titre"
              value={titre}
              maxLength={60}
              onChange={(e) => setTitre(e.target.value)}
              onBlur={() => void quitter("title", titre, setTitre, c.title, true)}
              placeholder="Titre (ex. Mix du jour)"
              className={CHAMP_LIGNE}
            />
            <input
              aria-label="Badge"
              value={badge}
              maxLength={10}
              onChange={(e) => setBadge(e.target.value)}
              onBlur={() => void quitter("badge", badge, setBadge, c.badge ?? "", false)}
              placeholder="Badge"
              className={clsx(CHAMP_LIGNE, "w-24 flex-none")}
            />
          </div>
          <input
            aria-label="Sous-titre"
            value={sousTitre}
            maxLength={140}
            onChange={(e) => setSousTitre(e.target.value)}
            onBlur={() => void quitter("subtitle", sousTitre, setSousTitre, c.subtitle ?? "", false)}
            placeholder="Sous-titre"
            className={CHAMP_LIGNE}
          />
          <div className="relative">
            <Link2 size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-texte-3" />
            <input
              aria-label="Lien"
              value={lien}
              maxLength={300}
              onChange={(e) => setLien(e.target.value)}
              onBlur={() => void quitter("linkHref", lien, setLien, c.linkHref, true)}
              placeholder="/recherche?q=chill ou #new_releases"
              className={clsx(CHAMP_LIGNE, "pl-7")}
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="w-[104px] [&_label]:py-0">
            <Bascule libelle={c.enabled ? "Active" : "Inactive"} valeur={c.enabled} onChange={(v) => void onModifier({ enabled: v })} />
          </div>
          <div className="flex items-center">
            <BoutonIcone icone={ArrowUp} titre="Monter" disabled={premiere} onClick={() => onDeplacer(-1)} />
            <BoutonIcone icone={ArrowDown} titre="Descendre" disabled={derniere} onClick={() => onDeplacer(1)} />
            <BoutonIcone icone={Trash2} titre="Supprimer" danger onClick={onSupprimer} />
          </div>
        </div>
      </div>
    </li>
  );
}

const CHAMP_LIGNE = "h-8 w-full min-w-0 flex-1 rounded-lg border border-filet bg-surface-2 px-2.5 text-[13px] text-texte outline-none placeholder:text-texte-3 focus:border-accent";
