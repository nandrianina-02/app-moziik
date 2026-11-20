import { Component, createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Bell,
  ChevronDown,
  Download,
  ExternalLink,
  FolderInput,
  LayoutDashboard,
  LibraryBig,
  LifeBuoy,
  LogOut,
  Megaphone,
  Mic2,
  ChartLine,
  Moon,
  Music,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trophy,
  Upload,
  Users,
  WifiOff,
  ChartNoAxesCombined,
  Timer,
  Disc3,
  ListMusic,
  Split,
  CopyCheck,
  CalendarClock,
  Tags,
  Award,
  MessageCircleWarning,
  BookOpen,
  Globe,
  Sparkles,
  TextQuote,
  Gauge,
  PanelsTopLeft,
  type LucideIcon,
} from "lucide-react";
import { FournisseurSession, useSession } from "./session";
import { api, adresseSite } from "./api";
import { Avatar, Barres, Bouton, Champ, Erreur, formatNombre } from "./composants";
import { TableauDeBord } from "./ecrans/TableauDeBord";
import { Import } from "./ecrans/Import";
import { Catalogue } from "./ecrans/Catalogue";
import { Classements } from "./ecrans/Classements";
import { Artistes } from "./ecrans/Artistes";
import { Statistiques } from "./ecrans/Statistiques";
import { Annonces } from "./ecrans/Annonces";
import { Assistance } from "./ecrans/Assistance";
import { Paroles } from "./ecrans/Paroles";
import { Accueil } from "./ecrans/Accueil";
import { Aide } from "./ecrans/Aide";
import { ParametresSite } from "./ecrans/ParametresSite";
import { Selections } from "./ecrans/Selections";
import { Taches } from "./ecrans/Taches";
import { IA } from "./ecrans/IA";
import { Analyses } from "./ecrans/Analyses";
import { Univers } from "./ecrans/Univers";
import { Albums } from "./ecrans/Albums";
import { Playlists } from "./ecrans/Playlists";
import { Badges } from "./ecrans/Badges";
import { Escalades } from "./ecrans/Escalades";
import { Doublons } from "./ecrans/Doublons";
import { Annees } from "./ecrans/Annees";
import { Genres } from "./ecrans/Genres";
import { Bpm } from "./ecrans/Bpm";
import { Moderation } from "./ecrans/Moderation";
import { Comptes } from "./ecrans/Comptes";
import { Reglages } from "./ecrans/Reglages";
import { preferences, reglerPreferences, themeEffectif, usePreferences, zoomVoisin } from "./preferences";
import { libelleVue, raccourciVue } from "./vues";
import { HoteConfirmation, HoteMenu, annoncer, brancherAnnonces, confirmer } from "./interactions";
import { Palette } from "./palette";
import { derniereVersion, plusRecente } from "./miseajour";
import { FournisseurTeleversements, useTeleversements } from "./televersements";
import { FournisseurPage } from "./page";
import logo from "./assets/icon-mark.png";
import clsx from "./clsx";

export type Page =
  | "tableau"
  | "statistiques"
  | "analyses"
  | "classements"
  | "taches"
  | "catalogue"
  | "artistes"
  | "albums"
  | "playlists"
  | "import"
  | "univers"
  | "selections"
  | "paroles"
  | "bpm"
  | "accueil"
  | "moderation"
  | "doublons"
  | "annees"
  | "genres"
  | "comptes"
  | "badges"
  | "annonces"
  | "assistance"
  | "escalades"
  | "aide"
  | "site"
  | "ia"
  | "reglages";

/** Ce que l'API d'administration renvoie sur l'ensemble de la plateforme. */
export interface Stats {
  members: number;
  artists: number;
  publishedSongs: number;
  pendingSongs: number;
  pendingEvents: number;
  activeSubscriptions: number;
  albumsCount: number;
  playlistsCount: number;
  trends?: { members?: number; artists?: number; songs?: number; subscriptions?: number };
  sparklines?: { members?: number[]; artists?: number[]; songs?: number[] };
  recentActivity?: { type: "member" | "artist" | "song" | "event"; message: string; at: string }[];
}

/** Ce qui attend l'administration, rangé par page de l'administration web. */
type ATraiter = Partial<Record<"/admin/messages" | "/admin/selections" | "/admin/genres" | "/admin/doublons" | "/admin/annees", number>>;

export interface Tache {
  libelle: string;
  nombre: number;
  ouvrir: () => void;
}

interface Coquille {
  aller: (page: Page, recherche?: string, statut?: "draft") => void;
  stats: Stats | null;
  erreurStats: string | null;
  taches: Tache[];
  rafraichir: () => void;
}

const ContexteCoquille = createContext<Coquille | null>(null);
export function useCoquille() {
  const c = useContext(ContexteCoquille);
  if (!c) throw new Error("useCoquille hors de la coquille");
  return c;
}

const ouvrirSurLeSite = (chemin: string) => void window.bureau.ouvrirExterne(`${adresseSite()}${chemin}`);

/**
 * La navigation, en cinq sections comme l'administration du site : tout
 * ce que le site permet d'administrer se fait ici, sans navigateur.
 */
const SECTIONS: { titre: string; court: string; pages: { cle: Page; libelle: string; icone: LucideIcon }[] }[] = [
  {
    titre: "Pilotage",
    court: "Pilot.",
    pages: [
      { cle: "tableau", libelle: "Tableau de bord", icone: LayoutDashboard },
      { cle: "statistiques", libelle: "Statistiques", icone: ChartLine },
      { cle: "analyses", libelle: "Analyses", icone: ChartNoAxesCombined },
      { cle: "classements", libelle: "Classements", icone: Trophy },
      { cle: "taches", libelle: "Tâches planifiées", icone: Timer },
    ],
  },
  {
    titre: "Catalogue",
    court: "Catal.",
    pages: [
      { cle: "catalogue", libelle: "Musiques", icone: Music },
      { cle: "artistes", libelle: "Artistes", icone: Mic2 },
      { cle: "albums", libelle: "Albums", icone: Disc3 },
      { cle: "playlists", libelle: "Playlists", icone: ListMusic },
      { cle: "import", libelle: "Téléversements", icone: FolderInput },
      { cle: "univers", libelle: "Univers", icone: Split },
      { cle: "selections", libelle: "Sélections", icone: LibraryBig },
      { cle: "paroles", libelle: "Paroles", icone: TextQuote },
      { cle: "bpm", libelle: "Tempo (BPM)", icone: Gauge },
    ],
  },
  {
    titre: "Qualité",
    court: "Qual.",
    pages: [
      { cle: "moderation", libelle: "Modération", icone: ShieldCheck },
      { cle: "doublons", libelle: "Doublons", icone: CopyCheck },
      { cle: "annees", libelle: "Années de sortie", icone: CalendarClock },
      { cle: "genres", libelle: "Genres", icone: Tags },
    ],
  },
  {
    titre: "Communauté",
    court: "Comm.",
    pages: [
      { cle: "comptes", libelle: "Utilisateurs", icone: Users },
      { cle: "badges", libelle: "Badges", icone: Award },
      { cle: "annonces", libelle: "Annonces", icone: Megaphone },
      { cle: "assistance", libelle: "Assistance", icone: LifeBuoy },
      { cle: "escalades", libelle: "Escalades", icone: MessageCircleWarning },
      { cle: "aide", libelle: "Centre d'aide", icone: BookOpen },
    ],
  },
  {
    titre: "Site",
    court: "Site",
    pages: [
      { cle: "accueil", libelle: "Pages du site", icone: PanelsTopLeft },
      { cle: "site", libelle: "Paramètres du site", icone: Globe },
      { cle: "ia", libelle: "Intelligence artificielle", icone: Sparkles },
      { cle: "reglages", libelle: "Préférences", icone: Settings },
    ],
  },
];
export const NAVIGATION = SECTIONS.flatMap((s) => s.pages);


export function App() {
  return (
    <FournisseurSession>
      <Racine />
    </FournisseurSession>
  );
}

function Racine() {
  const { etat } = useSession();
  if (etat.phase === "demarrage") return <EcranOuverture />;
  if (etat.phase === "deconnecte") return <Connexion message={etat.message} />;
  // Les téléversements vivent au-dessus des pages : ils continuent quand on
  // en change, et ne s'arrêtent qu'à la déconnexion.
  return (
    <FournisseurTeleversements>
      <Coquille />
    </FournisseurTeleversements>
  );
}

/** Le lancement : le logo et ses barres, le temps de rouvrir la session. */
function EcranOuverture() {
  return (
    <div className="grid h-full place-items-center">
      <div className="animate-paraitre flex flex-col items-center gap-5">
        <img src={logo} alt="" className="h-14 w-14 rounded-2xl" />
        <div className="flex items-center gap-3 text-[13px] text-texte-3">
          <Barres /> Ouverture de la session…
        </div>
      </div>
    </div>
  );
}

function Connexion({ message }: { message?: string }) {
  const { ouvrir, site, changerSite } = useSession();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(message ?? null);
  const [enCours, setEnCours] = useState(false);
  const [reglerSite, setReglerSite] = useState(false);
  const [siteSaisi, setSiteSaisi] = useState(site);
  useEffect(() => setSiteSaisi(site), [site]);

  async function valider(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      await ouvrir(email.trim(), motDePasse);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative flex flex-col justify-between overflow-hidden border-r border-filet bg-surface p-10">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-10 w-10 rounded-xl" />
          <div className="font-titre text-[20px] font-bold tracking-tight">
            Moziik <span className="font-medium text-texte-3">Admin</span>
          </div>
        </div>
        <div className="animate-monter max-w-[420px]">
          <h1 className="font-titre text-[34px] leading-[1.15] font-semibold tracking-tight">
            Le catalogue, les comptes et la modération, <span className="text-accent">depuis votre PC.</span>
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-texte-2">
            Importez un dossier de musique entier, corrigez les fiches et suivez l'activité de la plateforme. Le logiciel passe par l'API du site : les mêmes règles s'appliquent.
          </p>
        </div>
        <Egaliseur className="pointer-events-none absolute right-10 bottom-10 h-28 opacity-80" />
        <div className="text-[12px] text-texte-3">{site.replace(/^https?:\/\//, "")}</div>
      </div>

      <div className="grid place-items-center p-10">
        <form onSubmit={valider} className="animate-monter decale-2 w-[360px] space-y-4">
          <div className="mb-2">
            <h2 className="font-titre text-[22px] font-semibold tracking-tight">Connexion</h2>
            <p className="mt-1 text-[13px] text-texte-2">Avec votre compte administrateur du site.</p>
          </div>
          <Champ libelle="Adresse e-mail" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          <Champ libelle="Mot de passe" type="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
          <Erreur message={erreur} />
          <Bouton type="submit" enCours={enCours} disabled={!email || !motDePasse} className="h-10 w-full justify-center">
            Se connecter
          </Bouton>
          <div className="pt-2 text-[12px] text-texte-3">
            {reglerSite ? (
              <div className="flex items-end gap-2">
                <Champ libelle="Adresse du site" value={siteSaisi} onChange={(e) => setSiteSaisi(e.target.value)} className="flex-1" />
                <Bouton variante="trait" onClick={() => void changerSite(siteSaisi).then(() => setReglerSite(false))}>
                  Enregistrer
                </Bouton>
              </div>
            ) : (
              <>
                Site : {site.replace(/^https?:\/\//, "")} ·{" "}
                <button type="button" className="underline hover:text-texte" onClick={() => setReglerSite(true)}>
                  changer
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/** Le motif des barres du logo, étiré : un rappel de la marque, pas une donnée. */
export function Egaliseur({ className }: { className?: string }) {
  const hauteurs = [0.3, 0.55, 0.42, 0.78, 0.6, 1, 0.7, 0.88, 0.5, 0.66, 0.38, 0.58, 0.28];
  return (
    <div className={clsx("flex items-end gap-1.5", className)} aria-hidden>
      {hauteurs.map((h, i) => (
        <span key={i} className="w-2 rounded-full bg-accent" style={{ height: `${h * 100}%`, opacity: 0.35 + h * 0.65 }} />
      ))}
    </div>
  );
}

/** Ferme un panneau ancré au clic ailleurs ou à la touche Échap. */
function useFermeture(ouvert: boolean, fermer: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fermer();
    };
    const touche = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("mousedown", clic);
      document.removeEventListener("keydown", touche);
    };
  }, [ouvert, fermer]);
  return ref;
}

function Coquille() {
  const { etat, fermer } = useSession();
  const [page, setPage] = useState<Page>(() => preferences().pageDemarrage as Page);
  // Les pages déjà ouvertes, gardées montées : on y revient là où on les avait laissées.
  const [visitees, setVisitees] = useState<Page[]>(() => [preferences().pageDemarrage as Page]);
  // Une recherche ou un filtre transmis à une page (palette, cloche) : elle repart de là.
  const [demandes, setDemandes] = useState<Partial<Record<Page, Demande>>>({});
  const [replie, setReplie] = useState(false);
  const prefs = usePreferences();
  const theme = themeEffectif(prefs);
  const [version, setVersion] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreurStats, setErreurStats] = useState<string | null>(null);
  const [aTraiter, setATraiter] = useState<ATraiter>({});
  const utilisateur = etat.phase === "connecte" ? etat.utilisateur : null;
  const { avancement, choisir, deposer } = useTeleversements();
  // Ce qui attend sur chaque page, à côté de son entrée dans la barre latérale.
  const compteurDe = (cle: Page): number | undefined =>
    ({
      catalogue: stats?.pendingSongs,
      moderation: stats?.pendingEvents,
      assistance: aTraiter["/admin/messages"],
      doublons: aTraiter["/admin/doublons"],
      annees: aTraiter["/admin/annees"],
      genres: aTraiter["/admin/genres"],
      selections: aTraiter["/admin/selections"],
    })[cle as string];
  const [palette, setPalette] = useState(false);

  // Une nouvelle version se signale en bas de la barre latérale : vérifiée au
  // lancement, puis toutes les six heures pour un logiciel resté ouvert.
  const [majDisponible, setMajDisponible] = useState<string | null>(null);
  useEffect(() => {
    let installee = "";
    const verifier = () =>
      derniereVersion()
        .then((d) => setMajDisponible(installee && plusRecente(d.version, installee) ? d.version : null))
        .catch(() => undefined);
    void window.bureau.version().then((v) => {
      installee = v;
      setVersion(v);
      void verifier();
    });
    const minuterie = setInterval(verifier, 6 * 3600_000);
    return () => clearInterval(minuterie);
  }, []);

  const aller = useCallback((p: Page, q?: string, statut?: "draft") => {
    setPage(p);
    setVisitees((v) => (v.includes(p) ? v : [...v, p]));
    // Sans recherche ni filtre transmis, la page est rendue telle qu'on l'a quittée ;
    // avec, elle repart de la demande (« Titres en attente », recherche de la palette).
    if (q || statut) setDemandes((d) => ({ ...d, [p]: { q: q ?? "", statut, n: (d[p]?.n ?? 0) + 1 } }));
  }, []);

  const rafraichir = useCallback(() => {
    setErreurStats(null);
    api<Stats>("/api/admin/stats")
      .then(setStats)
      .catch((e: Error) => setErreurStats(e.message));
    api<ATraiter>("/api/admin/a-traiter")
      .then(setATraiter)
      .catch(() => undefined);
  }, []);

  // Raccourcis : Ctrl + molette change l'affichage de la liste de la page
  // (comme l'Explorateur Windows), ou la taille de l'interface s'il n'y a
  // pas de liste ; Ctrl + +, Ctrl + − et Ctrl + 0 règlent la taille.
  const [annonce, setAnnonce] = useState<{ texte: string; n: number } | null>(null);
  useEffect(() => {
    let dernier = 0;
    const montrer = (texte: string) => setAnnonce((a) => ({ texte, n: (a?.n ?? 0) + 1 }));
    // Les pages annoncent aussi par là (« Lien copié », « 3 titres validés »).
    brancherAnnonces(montrer);
    const zoom = (sens: 1 | -1 | 0) => montrer(`Taille de l'interface : ${Math.round(zoomVoisin(sens) * 100)} %`);
    const molette = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      // Un pavé tactile envoie des dizaines d'événements par geste : un cran à la fois.
      const maintenant = performance.now();
      if (maintenant - dernier < 200) return;
      dernier = maintenant;
      const sens = e.deltaY < 0 ? 1 : -1;
      const vue = raccourciVue(sens);
      if (vue) montrer(libelleVue(vue));
      else zoom(sens);
    };
    const touche = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey) return;
      if (e.key === "k" || e.key === "K") setPalette(true);
      else if (e.key === "+" || e.key === "=") zoom(1);
      else if (e.key === "-") zoom(-1);
      else if (e.key === "0") zoom(0);
      else return;
      e.preventDefault();
    };
    window.addEventListener("wheel", molette, { passive: false });
    const debrancher = () => brancherAnnonces(null);
    window.addEventListener("keydown", touche);
    return () => {
      debrancher();
      window.removeEventListener("wheel", molette);
      window.removeEventListener("keydown", touche);
    };
  }, []);
  useEffect(() => {
    if (!annonce) return;
    const t = setTimeout(() => setAnnonce(null), 1400);
    return () => clearTimeout(t);
  }, [annonce]);

  /*
   * Glisser-déposer : des fichiers audio ou des dossiers lâchés n'importe où
   * dans la fenêtre rejoignent les téléversements, et la page s'ouvre. Une
   * zone qui attend autre chose (une pochette, marquée data-depot) garde ce
   * qu'on y lâche. Le compteur suit les entrées et sorties imbriquées :
   * dragleave se déclenche à chaque enfant survolé.
   */
  const [survol, setSurvol] = useState(false);
  useEffect(() => {
    let profondeur = 0;
    const avecFichiers = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes("Files"));
    const dansUneZone = (e: DragEvent) => Boolean((e.target as HTMLElement | null)?.closest?.("[data-depot]"));
    const entree = (e: DragEvent) => {
      if (!avecFichiers(e)) return;
      profondeur++;
      setSurvol(!dansUneZone(e));
    };
    const dessus = (e: DragEvent) => {
      if (!avecFichiers(e)) return;
      // Sans preventDefault, Chromium refuse le dépôt.
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setSurvol(!dansUneZone(e));
    };
    const sortie = (e: DragEvent) => {
      if (!avecFichiers(e)) return;
      profondeur = Math.max(0, profondeur - 1);
      if (profondeur === 0) setSurvol(false);
    };
    const depot = (e: DragEvent) => {
      if (!avecFichiers(e)) return;
      e.preventDefault();
      profondeur = 0;
      setSurvol(false);
      if (dansUneZone(e)) return;
      const chemins = [...(e.dataTransfer?.files ?? [])].map((f) => window.bureau.cheminDe(f)).filter(Boolean);
      if (chemins.length === 0) return;
      aller("import");
      void deposer(chemins);
    };
    // Une zone qui reçoit le dépôt arrête sa propagation : la remise à zéro se fait donc à la descente (capture), avant elle.
    const fin = () => {
      profondeur = 0;
      setSurvol(false);
    };
    window.addEventListener("dragenter", entree);
    window.addEventListener("dragover", dessus);
    window.addEventListener("dragleave", sortie);
    window.addEventListener("drop", fin, true);
    window.addEventListener("dragend", fin, true);
    window.addEventListener("drop", depot);
    return () => {
      window.removeEventListener("dragenter", entree);
      window.removeEventListener("dragover", dessus);
      window.removeEventListener("dragleave", sortie);
      window.removeEventListener("drop", fin, true);
      window.removeEventListener("dragend", fin, true);
      window.removeEventListener("drop", depot);
    };
  }, [aller, deposer]);

  // Hors connexion, un bandeau le dit plutôt que de laisser les pages
  // échouer sans explication ; au retour du réseau, les compteurs se relisent.
  const [enLigne, setEnLigne] = useState(() => navigator.onLine);
  useEffect(() => {
    const hors = () => setEnLigne(false);
    const retour = () => {
      setEnLigne(true);
      rafraichir();
      annoncer("Connexion rétablie");
    };
    window.addEventListener("offline", hors);
    window.addEventListener("online", retour);
    return () => {
      window.removeEventListener("offline", hors);
      window.removeEventListener("online", retour);
    };
  }, [rafraichir]);

  // Les compteurs restent à jour pendant qu'on travaille, sans marteler la base.
  useEffect(() => {
    rafraichir();
    if (prefs.actualisation <= 0) return;
    const minuterie = setInterval(rafraichir, prefs.actualisation * 1000);
    return () => clearInterval(minuterie);
  }, [rafraichir, prefs.actualisation]);

  const taches: Tache[] = [
    { libelle: "Titres en attente de validation", nombre: stats?.pendingSongs ?? 0, ouvrir: () => aller("catalogue", "", "draft") },
    { libelle: "Évènements en attente", nombre: stats?.pendingEvents ?? 0, ouvrir: () => aller("moderation") },
    { libelle: "Messages d'assistance non lus", nombre: aTraiter["/admin/messages"] ?? 0, ouvrir: () => aller("assistance") },
    { libelle: "Doublons à trancher", nombre: aTraiter["/admin/doublons"] ?? 0, ouvrir: () => aller("doublons") },
    { libelle: "Années de sortie douteuses", nombre: aTraiter["/admin/annees"] ?? 0, ouvrir: () => aller("annees") },
    { libelle: "Genres proposés", nombre: aTraiter["/admin/genres"] ?? 0, ouvrir: () => aller("genres") },
    { libelle: "Sélections à valider", nombre: aTraiter["/admin/selections"] ?? 0, ouvrir: () => aller("selections") },
  ];

  // Le bouton de l'en-tête choisit explicitement l'autre thème, même si
  // les Paramètres suivaient Windows.
  function basculerTheme() {
    reglerPreferences({ theme: theme === "sombre" ? "clair" : "sombre" });
  }

  return (
    <ContexteCoquille.Provider value={{ aller, stats, erreurStats, taches, rafraichir }}>
      <div className="flex h-full">
        <aside className={clsx("flex shrink-0 flex-col border-r border-filet bg-surface transition-[width] duration-200", replie ? "w-[76px]" : "w-[248px]")}>
          <div className={clsx("flex h-[68px] items-center gap-3", replie ? "justify-center" : "px-5")}>
            <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-xl" />
            {!replie && (
              <div className="font-titre text-[19px] leading-none font-bold tracking-tight">
                Moziik <span className="font-medium text-texte-3">Admin</span>
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-2">
            {SECTIONS.map((section, i) => (
              <div key={section.titre} className={clsx(i > 0 && "mt-4")}>
                <div className={clsx("mb-1.5 text-[11px] font-semibold tracking-wider text-texte-3 uppercase", replie ? "text-center text-[9.5px]" : "px-3")}>
                  {replie ? section.court : section.titre}
                </div>
                {section.pages.map((p) => (
                  <EntreeNav
                    key={p.cle}
                    icone={p.icone}
                    libelle={p.libelle}
                    replie={replie}
                    actif={page === p.cle}
                    compteur={compteurDe(p.cle)}
                    activite={p.cle === "import" && avancement.phase !== "repos" ? `${avancement.faits}/${avancement.aFaire}` : undefined}
                    onClick={() => aller(p.cle)}
                  />
                ))}
              </div>
            ))}
          </nav>

          {!replie && (
            <div className="mx-3 mb-3 rounded-xl border border-filet bg-surface-2 p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <span className="h-2 w-2 rounded-full bg-succes" /> Connecté au site
              </div>
              <div className="mt-1 truncate text-[12px] text-texte-3">{adresseSite().replace(/^https?:\/\//, "")}</div>
              <Bouton variante="trait" className="mt-3 h-8 w-full justify-center text-[12px]" onClick={() => ouvrirSurLeSite("/admin")}>
                Administration web <ExternalLink size={13} />
              </Bouton>
            </div>
          )}
          <div className={clsx("border-t border-filet py-3 text-[11px] text-texte-3", replie ? "text-center" : "flex items-center justify-between gap-2 px-5")}>
            <span>{replie ? `v${version}` : `Moziik Admin v${version}`}</span>
            {majDisponible && (
              <button
                onClick={() => aller("reglages")}
                title={`Version ${majDisponible} disponible : l'installer depuis les Paramètres`}
                className={clsx("inline-flex items-center gap-1 font-semibold text-accent hover:underline", replie && "mt-1")}
              >
                <Download size={12} /> {replie ? "" : `v${majDisponible}`}
              </button>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[68px] shrink-0 items-center gap-4 border-b border-filet bg-surface px-6">
            <button
              onClick={() => setReplie((r) => !r)}
              title={replie ? "Déplier le menu" : "Replier le menu"}
              className="grid h-9 w-9 place-items-center rounded-lg text-texte-2 hover:bg-surface-2 hover:text-texte"
            >
              {replie ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            </button>
            <button
              onClick={() => setPalette(true)}
              className="flex h-10 w-full max-w-[460px] items-center gap-2.5 rounded-xl border border-filet bg-surface-2 px-3.5 text-left text-[13px] text-texte-3 transition-colors hover:border-texte-3/50"
            >
              <Search size={16} />
              <span className="flex-1 truncate">Rechercher une musique, un artiste, une page…</span>
              <kbd className="rounded-md border border-filet bg-surface px-1.5 py-0.5 text-[11px] font-semibold">Ctrl K</kbd>
            </button>
            {avancement.phase !== "repos" && page !== "import" && (
              <button
                onClick={() => aller("import")}
                title="Voir les téléversements"
                className="animate-paraitre flex shrink-0 items-center gap-2.5 rounded-xl border border-filet bg-surface-2 py-1.5 pr-3 pl-2.5 text-[12.5px] hover:border-accent"
              >
                <Barres taille={14} />
                <span className="font-semibold whitespace-nowrap tabular-nums">
                  {avancement.phase === "analyse" ? `Lecture ${avancement.faits}/${avancement.aFaire}` : `Envoi ${avancement.faits}/${avancement.aFaire}`}
                </span>
                {avancement.phase === "envoi" && (
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-filet">
                    <span
                      className="block h-full rounded-full bg-accent transition-[width] duration-300"
                      style={{ width: `${avancement.aFaire ? Math.round(((avancement.faits + avancement.enCours / 100) / avancement.aFaire) * 100) : 0}%` }}
                    />
                  </span>
                )}
              </button>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={basculerTheme}
                title={theme === "sombre" ? "Passer au thème clair" : "Passer au thème sombre"}
                className="grid h-9 w-9 place-items-center rounded-lg text-texte-2 hover:bg-surface-2 hover:text-texte"
              >
                {theme === "sombre" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <Cloche taches={taches} />
              <span className="mx-2 h-7 w-px bg-filet" />
              {utilisateur && (
                <MenuCompte
                  nom={utilisateur.name}
                  email={utilisateur.email}
                  image={utilisateur.avatarUrl}
                  aller={aller}
                  fermer={() =>
                    void confirmer({
                      titre: "Se déconnecter ?",
                      // Se déconnecter couperait l'envoi en cours au milieu d'un fichier.
                      message:
                        avancement.phase !== "repos"
                          ? "Un téléversement est en cours : se déconnecter l'interrompt, et le titre en cours d'envoi ne sera pas publié."
                          : "Il faudra saisir de nouveau l'e-mail et le mot de passe pour rouvrir la session sur ce PC.",
                      confirmer: "Se déconnecter",
                      danger: avancement.phase !== "repos",
                    }).then((ok) => ok && void fermer())
                  }
                />
              )}
            </div>
          </header>

          {/* Pas de marge haute sur la zone qui défile : une barre collante s'y colle à 0, au ras de l'en-tête. */}
          {!enLigne && (
            <div className="animate-paraitre flex items-center gap-2.5 border-b border-attention/30 bg-attention/10 px-7 py-2 text-[12.5px] text-attention">
              <WifiOff size={15} className="shrink-0" />
              Hors connexion : les données affichées peuvent dater, et les envois sont en pause. Reconnexion automatique dès le retour du réseau.
            </div>
          )}
          <div className="relative min-h-0 flex-1">
            {visitees.map((cle) => (
              <ZonePage key={cle} active={cle === page}>
                {ecran(cle, demandes[cle])}
              </ZonePage>
            ))}
          </div>
        </div>
      </div>
      {survol && (
        // Un voile sur toute la fenêtre pendant le survol : il dit ce que fera le dépôt. Il ne capte rien (pointer-events-none).
        <div className="animate-paraitre pointer-events-none fixed inset-0 z-50 grid place-items-center bg-fond/80 p-10">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent bg-surface px-14 py-10 text-center">
            <Upload size={30} className="text-accent" />
            <div className="font-titre text-[18px] font-semibold">Déposer pour téléverser</div>
            <p className="max-w-[340px] text-[13px] text-texte-2">Fichiers audio ou dossiers entiers : ils rejoignent la liste des téléversements, qui s'ouvre.</p>
          </div>
        </div>
      )}
      <HoteMenu />
      <HoteConfirmation />
      <Palette
        ouverte={palette}
        fermer={() => setPalette(false)}
        pages={NAVIGATION}
        aller={(p, q) => aller(p as Page, q)}
        theme={theme}
        basculerTheme={basculerTheme}
        rafraichir={rafraichir}
        choisirDossier={() => {
          aller("import");
          void choisir();
        }}
      />
      {annonce && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center" aria-live="polite">
          <div key={annonce.n} className="animate-monter rounded-xl border border-filet bg-surface px-4 py-2 text-[13px] font-semibold shadow-2xl shadow-black/30 first-letter:uppercase">
            {annonce.texte}
          </div>
        </div>
      )}
    </ContexteCoquille.Provider>
  );
}

function EntreeNav({
  icone: Icone,
  libelle,
  replie,
  actif,
  externe,
  compteur,
  activite,
  onClick,
}: {
  icone: LucideIcon;
  libelle: string;
  replie: boolean;
  actif?: boolean;
  externe?: boolean;
  compteur?: number;
  /** Un travail en cours sur cette page (« 3/40 ») : il reste visible d'ailleurs. */
  activite?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={replie ? libelle : undefined}
      aria-current={actif ? "page" : undefined}
      className={clsx(
        "group relative mb-1 flex h-10 w-full items-center gap-3 rounded-xl text-left text-[13.5px] font-medium transition-colors",
        replie ? "justify-center" : "px-3",
        actif ? "bg-accent text-sur-accent" : "text-texte-2 hover:bg-surface-2 hover:text-texte",
      )}
    >
      <Icone size={18} className="shrink-0" />
      {!replie && <span className="flex-1 truncate">{libelle}</span>}
      {!replie && externe && !compteur && <ExternalLink size={13} className="text-texte-3 opacity-0 group-hover:opacity-100" />}
      {activite !== undefined &&
        (replie ? (
          <span className="absolute top-1 right-2 h-2.5 w-2.5 animate-pulse rounded-full bg-accent ring-2 ring-surface" />
        ) : (
          <span className={clsx("flex items-center gap-1.5 text-[11.5px] font-semibold tabular-nums", actif ? "text-sur-accent" : "text-accent")}>
            <span className={clsx("h-1.5 w-1.5 animate-pulse rounded-full", actif ? "bg-sur-accent" : "bg-accent")} />
            {activite}
          </span>
        ))}
      {compteur ? (
        <span
          className={clsx(
            "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
            actif ? "bg-sur-accent text-accent" : "bg-accent text-sur-accent",
            replie && "absolute top-0.5 right-1.5 h-4 min-w-4 px-1 text-[10px]",
          )}
        >
          {compteur > 99 ? "99+" : compteur}
        </span>
      ) : null}
    </button>
  );
}

function Cloche({ taches }: { taches: Tache[] }) {
  const [ouvert, setOuvert] = useState(false);
  const fermer = useCallback(() => setOuvert(false), []);
  const ref = useFermeture(ouvert, fermer);
  const actives = taches.filter((t) => t.nombre > 0);
  const total = actives.reduce((s, t) => s + t.nombre, 0);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOuvert((o) => !o)}
        title="À traiter"
        className={clsx("relative grid h-9 w-9 place-items-center rounded-lg hover:bg-surface-2 hover:text-texte", ouvert ? "bg-surface-2 text-texte" : "text-texte-2")}
      >
        <Bell size={18} />
        {total > 0 && (
          <span className="absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-sur-accent tabular-nums">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>
      {ouvert && (
        <div className="animate-ouvrir absolute top-11 right-0 z-30 w-[340px] overflow-hidden rounded-2xl border border-filet bg-surface shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between border-b border-filet px-4 py-3">
            <span className="font-titre text-[14px] font-semibold">À traiter</span>
            <span className="text-[12px] text-texte-3">{total > 0 ? `${formatNombre(total)} en attente` : "Rien en attente"}</span>
          </div>
          {actives.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-texte-3">Tout est à jour.</p>
          ) : (
            <ul className="py-1.5">
              {actives.map((t) => (
                <li key={t.libelle}>
                  <button
                    onClick={() => {
                      setOuvert(false);
                      t.ouvrir();
                    }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[13px] hover:bg-surface-2"
                  >
                    {t.libelle}
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[12px] font-semibold text-accent tabular-nums">{formatNombre(t.nombre)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function MenuCompte({ nom, email, image, aller, fermer }: { nom: string; email: string; image?: string; aller: (p: Page) => void; fermer: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const fermerMenu = useCallback(() => setOuvert(false), []);
  const ref = useFermeture(ouvert, fermerMenu);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOuvert((o) => !o)} className="flex items-center gap-3 rounded-xl py-1 pr-2 pl-1 hover:bg-surface-2">
        <Avatar nom={nom} image={image} taille={36} />
        <div className="text-left leading-tight">
          <div className="max-w-[160px] truncate text-[13px] font-semibold">{nom}</div>
          <div className="text-[11.5px] text-texte-3">Administrateur</div>
        </div>
        <ChevronDown size={15} className="text-texte-3" />
      </button>
      {ouvert && (
        <div className="animate-ouvrir absolute top-12 right-0 z-30 w-[240px] overflow-hidden rounded-2xl border border-filet bg-surface py-1.5 shadow-2xl shadow-black/30">
          <div className="border-b border-filet px-4 pt-1.5 pb-3">
            <div className="truncate text-[13px] font-semibold">{nom}</div>
            <div className="truncate text-[12px] text-texte-3">{email}</div>
          </div>
          <ElementMenu icone={Settings} onClick={() => (setOuvert(false), aller("reglages"))}>
            Paramètres
          </ElementMenu>
          <ElementMenu icone={ExternalLink} onClick={() => (setOuvert(false), ouvrirSurLeSite("/"))}>
            Ouvrir Moziik
          </ElementMenu>
          <ElementMenu icone={LogOut} onClick={fermer} danger>
            Se déconnecter
          </ElementMenu>
        </div>
      )}
    </div>
  );
}

function ElementMenu({ icone: Icone, children, onClick, danger }: { icone: LucideIcon; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={clsx("flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] hover:bg-surface-2", danger ? "text-danger" : "text-texte")}>
      <Icone size={15} /> {children}
    </button>
  );
}

interface Demande {
  q: string;
  statut?: "draft";
  n: number;
}

/** L'écran d'une page ; une demande transmise le remonte (clé) avec sa recherche ou son filtre. */
function ecran(cle: Page, d: Demande | undefined): ReactNode {
  const q = d?.q ?? "";
  const n = d?.n ?? 0;
  switch (cle) {
    case "tableau": return <TableauDeBord />;
    case "catalogue": return <Catalogue key={n} rechercheInitiale={q} statutInitial={d?.statut} />;
    case "artistes": return <Artistes key={n} rechercheInitiale={q} />;
    case "comptes": return <Comptes key={n} rechercheInitiale={q} />;
    case "classements": return <Classements />;
    case "statistiques": return <Statistiques />;
    case "annonces": return <Annonces />;
    case "assistance": return <Assistance />;
    case "paroles": return <Paroles />;
    case "accueil": return <Accueil />;
    case "aide": return <Aide />;
    case "site": return <ParametresSite />;
    case "selections": return <Selections />;
    case "taches": return <Taches />;
    case "ia": return <IA />;
    case "analyses": return <Analyses />;
    case "univers": return <Univers />;
    case "albums": return <Albums />;
    case "playlists": return <Playlists />;
    case "badges": return <Badges />;
    case "escalades": return <Escalades />;
    case "doublons": return <Doublons />;
    case "annees": return <Annees />;
    case "genres": return <Genres />;
    case "bpm": return <Bpm />;
    case "import": return <Import />;
    case "moderation": return <Moderation />;
    case "reglages": return <Reglages />;
    default: return null;
  }
}

/**
 * La zone qui défile d'une page. Masquée par `visibility` et non retirée :
 * elle garde sa position de défilement, ses champs, ses panneaux ouverts, et
 * ses animations d'entrée ne se rejouent pas (un `display: none` les
 * relancerait au retour). `inert` la sort du clavier et de la tabulation.
 */
function ZonePage({ active, children }: { active: boolean; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.inert = !active;
  }, [active]);
  return (
    <main
      ref={ref}
      data-actif={active || undefined}
      aria-hidden={!active || undefined}
      className={clsx("absolute inset-0 overflow-auto px-7 pb-6", !active && "invisible")}
    >
      <FournisseurPage value={active}>
        <GardeFou>
          <div className="animate-paraitre mx-auto max-w-[1360px] pt-6">{children}</div>
        </GardeFou>
      </FournisseurPage>
    </main>
  );
}

/**
 * Une page qui plante (réponse inattendue du site, par exemple) ne doit pas
 * emporter toute la fenêtre : la barre latérale reste utilisable et on
 * peut réessayer.
 */
class GardeFou extends Component<{ children: ReactNode }, { erreur: Error | null }> {
  state = { erreur: null as Error | null };
  static getDerivedStateFromError(erreur: Error) {
    return { erreur };
  }
  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <div className="mx-auto mt-16 max-w-[460px] rounded-2xl border border-filet bg-surface p-6 text-center">
        <div className="font-titre text-[17px] font-semibold">Cette page n'a pas pu s'afficher</div>
        <p className="mt-2 text-[13px] text-texte-2">Le site a peut-être renvoyé une réponse inattendue. Détail : {this.state.erreur.message}</p>
        <Bouton className="mt-4" onClick={() => this.setState({ erreur: null })}>
          Réessayer
        </Bouton>
      </div>
    );
  }
}
