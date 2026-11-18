import { Component, createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Bell,
  ChevronDown,
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
  Users,
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
import { Moderation } from "./ecrans/Moderation";
import { Comptes } from "./ecrans/Comptes";
import { Reglages } from "./ecrans/Reglages";
import { preferences, reglerPreferences, themeEffectif, usePreferences, zoomVoisin } from "./preferences";
import { libelleVue, raccourciVue } from "./vues";
import { FournisseurTeleversements, useTeleversements } from "./televersements";
import logo from "./assets/icon-mark.png";
import clsx from "./clsx";

export type Page = "tableau" | "catalogue" | "artistes" | "classements" | "statistiques" | "comptes" | "import" | "moderation" | "annonces" | "reglages";

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

const NAVIGATION: { cle: Page; libelle: string; icone: LucideIcon }[] = [
  { cle: "tableau", libelle: "Tableau de bord", icone: LayoutDashboard },
  { cle: "catalogue", libelle: "Musiques", icone: Music },
  { cle: "artistes", libelle: "Artistes", icone: Mic2 },
  { cle: "classements", libelle: "Classements", icone: Trophy },
  { cle: "statistiques", libelle: "Statistiques", icone: ChartLine },
  { cle: "comptes", libelle: "Utilisateurs", icone: Users },
  { cle: "import", libelle: "Téléversements", icone: FolderInput },
  { cle: "moderation", libelle: "Modération", icone: ShieldCheck },
  { cle: "annonces", libelle: "Annonces", icone: Megaphone },
  { cle: "reglages", libelle: "Paramètres", icone: Settings },
];

/** Ce qui ne vit que dans l'administration web : on l'ouvre dans le navigateur. */
const SUR_LE_SITE: { chemin: string; libelle: string; icone: LucideIcon; compteur?: keyof ATraiter }[] = [
  { chemin: "/admin/messages", libelle: "Assistance", icone: LifeBuoy, compteur: "/admin/messages" },
  { chemin: "/admin/selections", libelle: "Sélections", icone: LibraryBig, compteur: "/admin/selections" },
];

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
  const [recherche, setRecherche] = useState<{ q: string; statut?: "draft"; n: number }>({ q: "", n: 0 });
  const [replie, setReplie] = useState(false);
  const prefs = usePreferences();
  const theme = themeEffectif(prefs);
  const [version, setVersion] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreurStats, setErreurStats] = useState<string | null>(null);
  const [aTraiter, setATraiter] = useState<ATraiter>({});
  const utilisateur = etat.phase === "connecte" ? etat.utilisateur : null;
  const { avancement } = useTeleversements();

  useEffect(() => {
    void window.bureau.version().then(setVersion);
  }, []);

  const aller = useCallback((p: Page, q?: string, statut?: "draft") => {
    setPage(p);
    if (q !== undefined || statut) setRecherche((r) => ({ q: q ?? "", statut, n: r.n + 1 }));
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
      if (e.key === "+" || e.key === "=") zoom(1);
      else if (e.key === "-") zoom(-1);
      else if (e.key === "0") zoom(0);
      else return;
      e.preventDefault();
    };
    window.addEventListener("wheel", molette, { passive: false });
    window.addEventListener("keydown", touche);
    return () => {
      window.removeEventListener("wheel", molette);
      window.removeEventListener("keydown", touche);
    };
  }, []);
  useEffect(() => {
    if (!annonce) return;
    const t = setTimeout(() => setAnnonce(null), 1400);
    return () => clearTimeout(t);
  }, [annonce]);

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
    { libelle: "Messages d'assistance non lus", nombre: aTraiter["/admin/messages"] ?? 0, ouvrir: () => ouvrirSurLeSite("/admin/messages") },
    { libelle: "Doublons à trancher", nombre: aTraiter["/admin/doublons"] ?? 0, ouvrir: () => ouvrirSurLeSite("/admin/doublons") },
    { libelle: "Années de sortie douteuses", nombre: aTraiter["/admin/annees"] ?? 0, ouvrir: () => ouvrirSurLeSite("/admin/annees") },
    { libelle: "Genres proposés", nombre: aTraiter["/admin/genres"] ?? 0, ouvrir: () => ouvrirSurLeSite("/admin/genres") },
    { libelle: "Sélections à valider", nombre: aTraiter["/admin/selections"] ?? 0, ouvrir: () => ouvrirSurLeSite("/admin/selections") },
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
            {NAVIGATION.map((p) => (
              <EntreeNav
                key={p.cle}
                icone={p.icone}
                libelle={p.libelle}
                replie={replie}
                actif={page === p.cle}
                compteur={p.cle === "moderation" ? stats?.pendingEvents : p.cle === "catalogue" ? stats?.pendingSongs : undefined}
                activite={p.cle === "import" && avancement.phase !== "repos" ? `${avancement.faits}/${avancement.aFaire}` : undefined}
                onClick={() => aller(p.cle)}
              />
            ))}

            <div className={clsx("mt-5 mb-1.5 text-[11px] font-semibold tracking-wider text-texte-3 uppercase", replie ? "text-center" : "px-3")}>{replie ? "Site" : "Sur le site"}</div>
            {SUR_LE_SITE.map((l) => (
              <EntreeNav
                key={l.chemin}
                icone={l.icone}
                libelle={l.libelle}
                replie={replie}
                externe
                compteur={l.compteur ? aTraiter[l.compteur] : undefined}
                onClick={() => ouvrirSurLeSite(l.chemin)}
              />
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
          <div className={clsx("border-t border-filet py-3 text-[11px] text-texte-3", replie ? "text-center" : "px-5")}>
            {replie ? `v${version}` : `Moziik Admin v${version}`}
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
            <RechercheGlobale onChercher={(q) => aller("catalogue", q)} />
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
                  fermer={() => {
                    // Se déconnecter couperait l'envoi en cours au milieu d'un fichier.
                    if (avancement.phase !== "repos" && !window.confirm("Un téléversement est en cours. Se déconnecter l'interrompt. Continuer ?")) return;
                    void fermer();
                  }}
                />
              )}
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-auto px-7 py-6" key={page}>
            <GardeFou>
            <div className="animate-paraitre mx-auto max-w-[1360px]">
              {page === "tableau" && <TableauDeBord />}
              {page === "catalogue" && <Catalogue key={recherche.n} rechercheInitiale={recherche.q} statutInitial={recherche.statut} />}
              {page === "artistes" && <Artistes />}
              {page === "classements" && <Classements />}
              {page === "statistiques" && <Statistiques />}
              {page === "annonces" && <Annonces />}
              {page === "comptes" && <Comptes />}
              {page === "import" && <Import />}
              {page === "moderation" && <Moderation />}
              {page === "reglages" && <Reglages />}
            </div>
            </GardeFou>
          </main>
        </div>
      </div>
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

function RechercheGlobale({ onChercher }: { onChercher: (q: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onChercher(q.trim());
      }}
      className="relative w-full max-w-[460px]"
    >
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-texte-3" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher une musique, un artiste…"
        className="h-10 w-full rounded-xl border border-filet bg-surface-2 pr-3 pl-10 text-[13px] outline-none placeholder:text-texte-3 focus:border-accent"
      />
    </form>
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
