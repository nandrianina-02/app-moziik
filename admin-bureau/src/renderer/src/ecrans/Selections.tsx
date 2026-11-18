import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Headphones,
  History,
  ListMusic,
  RefreshCw,
  Search,
  Sparkles,
  Undo2,
  Users,
  Wand2,
  X,
  XCircle,
} from "lucide-react";
import { api, adresseSite } from "../api";
import { adresseImage } from "../session";
import { Bascule, Bouton, Carte, Champ, Chargement, EnTete, Erreur, Pastille, Table, Vide, formatDate, formatDuree, formatNombre, formatRelatif } from "../composants";
import { annoncer, confirmer } from "../interactions";
import clsx from "../clsx";

type Univers = "general" | "christian";
type StatutAnalyse = "en_cours" | "a_valider" | "publiee" | "annulee" | "echouee";

interface Titre {
  _id: string;
  title: string;
  coverUrl: string;
  duration: number;
  artiste: string;
}

interface PlaylistProposee {
  _id: string;
  title: string;
  description: string;
  coverUrl: string;
  isPublic: boolean;
  followers: number;
  kind: string;
  recette: string;
  mode: string | null;
  statut: "brouillon" | "publiee" | "archivee";
  motif: string;
  rang: number;
  songs: Titre[];
}

interface Analyse {
  _id: string;
  from: string;
  to: string;
  fenetre: string;
  univers: Univers;
  statut: StatutAnalyse;
  declencheur: "cron" | "admin";
  stats?: { ecoutes?: number; auditeurs?: number; recherches?: number; nouveautes?: number; titresConsideres?: number };
  titreSection?: string;
  resume?: string;
  redigeParIA?: boolean;
  publieeLe: string | null;
  playlists: PlaylistProposee[];
}

interface LigneHistorique {
  _id: string;
  fenetre: string;
  statut: string;
  declencheur: string;
  publieeLe: string | null;
  erreur: string | null;
  createdAt: string;
}

interface Reglages {
  enabled: boolean;
  autoPublish: boolean;
  retentionWeeks: number;
  disabled: string[];
  sectionPosition: number;
}

/** RECETTES_INFO du site (lib/curation/labels.ts), rendu tel quel par la route. */
type Recettes = Record<string, { libelle: string; detail?: string; evangelique?: { libelle: string } }>;

interface Reponse {
  reglages: Reglages | null;
  recettes: Recettes;
  univers: Univers;
  universDisponibles?: { id: Univers; label: string }[];
  courante: Analyse | null;
  historique: LigneHistorique[];
}

/**
 * Copie de MODES et MODES_INFO (lib/modes.ts du site), réduite au libellé
 * et à l'explication : le logiciel ne peut pas importer le code du site.
 * À tenir alignée à la main ; un identifiant inconnu est refusé par la route.
 */
const MODES: { id: string; libelle: string; detail: string }[] = [
  { id: "voyage", libelle: "Voyage", detail: "Tempo moyen, morceaux qui tiennent la route, assez longs pour ne pas hacher le trajet." },
  { id: "sport", libelle: "Sport", detail: "Tempo élevé et régulier, morceaux qui soutiennent l'effort." },
  { id: "etude", libelle: "Étude / Concentration", detail: "Tempo lent, peu de rupture, rien d'explicite : de quoi rester en fond." },
  { id: "travail", libelle: "Travail", detail: "Tempo modéré, ambiance continue, rien d'explicite." },
  { id: "sommeil", libelle: "Sommeil", detail: "Les tempos les plus lents du catalogue, rien d'explicite." },
  { id: "relaxation", libelle: "Relaxation", detail: "Tempo lent à moyen, ambiances posées." },
  { id: "romance", libelle: "Romance", detail: "Ballades et morceaux d'amour, tempo lent à moyen." },
  { id: "fete", libelle: "Fête", detail: "Les tempos les plus élevés et les genres qui font danser." },
  { id: "matin", libelle: "Matin", detail: "Les titres que le public écoute effectivement le matin, entre 5 h et 11 h." },
  { id: "nuit", libelle: "Nuit", detail: "Les titres que le public écoute effectivement la nuit, entre 22 h et 5 h." },
  { id: "decouverte", libelle: "Découverte", detail: "Peu écoutés mais écoutés jusqu'au bout : ce que le catalogue cache." },
  { id: "tendance", libelle: "Tendance", detail: "Les titres dont l'écoute progresse le plus d'une semaine sur l'autre." },
];

const UNIVERS_PAR_DEFAUT: { id: Univers; label: string }[] = [
  { id: "general", label: "Général" },
  { id: "christian", label: "Évangélique" },
];

const STATUTS: Record<string, { libelle: string; ton: "neutre" | "succes" | "attention" | "danger" | "accent" }> = {
  en_cours: { libelle: "Analyse en cours", ton: "attention" },
  a_valider: { libelle: "À valider", ton: "accent" },
  publiee: { libelle: "Publiée sur l'accueil", ton: "succes" },
  annulee: { libelle: "Écartée", ton: "neutre" },
  echouee: { libelle: "Sans résultat", ton: "danger" },
};

const pluriel = (n: number) => (n > 1 ? "s" : "");

/**
 * Les sélections de la semaine : une analyse des écoutes, des recherches
 * et des sorties compose des playlists, et rien n'apparaît sur l'accueil
 * avant qu'un administrateur publie. Un univers à la fois, parce que les
 * deux analyses portent sur des catalogues disjoints et se valident
 * séparément.
 */
export function Selections() {
  const [univers, setUnivers] = useState<Univers>("general");
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [deplie, setDeplie] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const r = await api<Reponse>(`/api/admin/curation?univers=${univers}`);
      setDonnees({ ...r, historique: r.historique ?? [], recettes: r.recettes ?? {} });
      if (r.reglages) setReglages(r.reglages);
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible.");
    }
  }, [univers]);

  useEffect(() => {
    setDonnees(null);
    void charger();
  }, [charger]);

  /* --- réglages : chaque changement part seul, aussitôt --------------- */

  async function enregistrerReglage(champ: string, correctif: Partial<Reglages>, succes = "Réglage enregistré") {
    setOccupe(champ);
    try {
      const { reglages: neufs } = await api<{ reglages: Reglages }>("/api/admin/curation/settings", { methode: "PATCH", corps: correctif });
      setReglages(neufs);
      annoncer(succes);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement refusé.");
      void charger();
    } finally {
      setOccupe(null);
    }
  }

  /** Une recette ou un mode allumé ou éteint : la route attend la liste entière. */
  function basculerSelection(id: string, libelle: string, actif: boolean) {
    if (!reglages) return;
    const disabled = actif ? reglages.disabled.filter((d) => d !== id) : [...new Set([...reglages.disabled, id])];
    void enregistrerReglage(`disabled-${id}`, { disabled }, actif ? `« ${libelle} » réactivée` : `« ${libelle} » éteinte`);
  }

  /* --- gestes sur l'analyse -------------------------------------------- */

  async function agir(action: "analyser" | "publier" | "annuler" | "retirer", runId?: string) {
    setOccupe(action);
    setErreur(null);
    try {
      const r = await api<{ analyses?: { playlists: number }[]; publiees?: number; retirees?: number }>("/api/admin/curation", { corps: { action, runId } });
      if (action === "analyser") {
        // Le geste couvre les deux univers : on additionne ce que chacun a produit.
        const n = (r.analyses ?? []).reduce((s, a) => s + (a.playlists ?? 0), 0);
        annoncer(`${n} sélection${pluriel(n)} proposée${pluriel(n)} sur les deux univers`);
      } else if (action === "publier") annoncer("Sélections publiées sur l'accueil");
      else if (action === "retirer") annoncer("Sélections retirées de l'accueil");
      else annoncer("Analyse écartée");
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Opération refusée.");
    } finally {
      setOccupe(null);
    }
  }

  async function lancerAnalyse() {
    const enAttente = donnees?.courante?.statut === "a_valider";
    const ok = await confirmer({
      titre: enAttente ? "Remplacer la proposition en attente ?" : "Lancer une analyse ?",
      message: enAttente
        ? "L'analyse porte sur les deux univers. Les sélections en attente de validation, et les retouches que vous y avez faites, seront remplacées par la nouvelle proposition. L'opération peut prendre une minute."
        : "Les écoutes, recherches et sorties des sept derniers jours sont analysées pour les deux univers. Rien n'est publié : la proposition attendra votre validation. L'opération peut prendre une minute.",
      confirmer: enAttente ? "Relancer" : "Analyser",
      danger: enAttente,
    });
    if (ok) await agir("analyser");
  }

  async function publier(a: Analyse) {
    const n = a.playlists.filter((p) => p.statut !== "archivee").length;
    const ok = await confirmer({
      titre: `Publier ${n} sélection${pluriel(n)} ?`,
      message: "Elles deviennent visibles de tous sur l'accueil et dans les playlists publiques. Les sélections de la semaine précédente en sont retirées.",
      confirmer: "Publier",
    });
    if (ok) await agir("publier", a._id);
  }

  async function ecarter(a: Analyse) {
    const ok = await confirmer({
      titre: "Écarter cette analyse ?",
      message: "Les propositions sont supprimées et rien n'est publié. Une nouvelle analyse pourra être lancée ensuite.",
      confirmer: "Écarter",
      danger: true,
    });
    if (ok) await agir("annuler", a._id);
  }

  async function retirer(a: Analyse) {
    const ok = await confirmer({
      titre: "Retirer ces sélections de l'accueil ?",
      message: "La section disparaît de l'accueil pour tout le monde. Les playlists que des membres ont ajoutées à leur bibliothèque leur restent accessibles.",
      confirmer: "Retirer",
      danger: true,
    });
    if (ok) await agir("retirer", a._id);
  }

  /* --- retouches d'une proposition ------------------------------------- */

  const patcher = (id: string, corps: Record<string, unknown>) => api(`/api/admin/curation/playlist/${id}`, { methode: "PATCH", corps });

  async function retoucher(id: string, corps: Record<string, unknown>, succes = "Modification enregistrée") {
    setOccupe(`pl-${id}`);
    try {
      await patcher(id, corps);
      annoncer(succes);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Modification refusée.");
    } finally {
      // Dans les deux cas, l'écran revient à ce que le site a réellement retenu.
      await charger();
      setOccupe(null);
    }
  }

  /**
   * Échange le rang de deux voisines. Les deux appels partent ensemble,
   * mais l'écran ne se recharge qu'une fois : deux rechargements
   * concurrents pourraient afficher l'état d'avant le premier.
   */
  async function deplacer(liste: PlaylistProposee[], index: number, sens: -1 | 1) {
    const cible = index + sens;
    if (cible < 0 || cible >= liste.length) return;
    const a = liste[index];
    const b = liste[cible];
    // Deux rangs égaux ne s'échangent pas : on repart alors des positions affichées.
    const [ra, rb] = a.rang === b.rang ? [cible, index] : [b.rang, a.rang];
    setOccupe(`rang-${a._id}`);
    try {
      await Promise.all([patcher(a._id, { rang: Math.min(50, ra) }), patcher(b._id, { rang: Math.min(50, rb) })]);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Déplacement refusé.");
    } finally {
      await charger();
      setOccupe(null);
    }
  }

  async function retirerTitre(p: PlaylistProposee, t: Titre) {
    const ok = await confirmer({
      titre: `Retirer « ${t.title} » ?`,
      message: `Le titre quitte la sélection « ${p.title} ». Il ne revient qu'avec une nouvelle analyse.`,
      confirmer: "Retirer",
      danger: true,
    });
    if (ok) await retoucher(p._id, { retirerTitre: t._id }, "Titre retiré de la sélection");
  }

  const courante = donnees?.courante ?? null;
  const universListe = donnees?.universDisponibles?.length ? donnees.universDisponibles : UNIVERS_PAR_DEFAUT;
  const enAttente = courante?.statut === "a_valider";

  return (
    <>
      <EnTete
        titre="Sélections de la semaine"
        texte="Des playlists composées chaque semaine à partir de l'écoute réelle, publiées sur l'accueil après validation."
        action={
          <>
            <Bouton variante="trait" onClick={() => void charger()}>
              <RefreshCw size={14} /> Actualiser
            </Bouton>
            <Bouton enCours={occupe === "analyser"} disabled={occupe !== null || reglages?.enabled === false} onClick={() => void lancerAnalyse()}>
              <Sparkles size={14} /> {occupe === "analyser" ? "Analyse en cours" : "Lancer une analyse"}
            </Bouton>
          </>
        }
      />

      <div className="animate-monter decale-1 mb-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-filet bg-surface p-0.5">
          {universListe.map((u) => (
            <button
              key={u.id}
              onClick={() => setUnivers(u.id)}
              className={clsx("rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors", univers === u.id ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte")}
            >
              {u.label}
            </button>
          ))}
        </div>
        {reglages?.enabled === false && (
          <span className="flex items-center gap-1.5 text-[12.5px] text-attention">
            <AlertTriangle size={14} /> L'analyse hebdomadaire est désactivée dans les réglages.
          </span>
        )}
      </div>

      <div className="mb-4">
        <Erreur message={erreur} />
      </div>

      {!donnees ? (
        !erreur && <Chargement />
      ) : (
        <div className="space-y-5">
          {!courante ? (
            <Carte className="animate-monter decale-2">
              <div className="flex items-start gap-4">
                <Wand2 size={20} className="mt-0.5 shrink-0 text-accent" />
                <p className="text-[13px] text-texte-2">Aucune analyse pour cet univers. Lancez-en une, ou attendez le passage hebdomadaire.</p>
              </div>
            </Carte>
          ) : (
            <EnTeteAnalyse a={courante} occupe={occupe} onPublier={() => void publier(courante)} onEcarter={() => void ecarter(courante)} onRetirer={() => void retirer(courante)} />
          )}

          {courante && courante.playlists.length > 0 && (
            <section className="animate-monter decale-3">
              <h2 className="mb-3 text-[11px] font-semibold tracking-wide text-texte-3 uppercase">
                {courante.playlists.length} sélection{pluriel(courante.playlists.length)}
                {enAttente && " · retouchables jusqu'à la publication"}
              </h2>
              <div className="space-y-3">
                {courante.playlists.map((p, i) => (
                  <CartePlaylist
                    key={p._id}
                    p={p}
                    premiere={i === 0}
                    derniere={i === courante.playlists.length - 1}
                    modifiable={enAttente}
                    occupe={occupe !== null}
                    ouverte={deplie === p._id}
                    onDeplier={() => setDeplie(deplie === p._id ? null : p._id)}
                    onRetoucher={(corps, succes) => void retoucher(p._id, corps, succes)}
                    onMonter={() => void deplacer(courante.playlists, i, -1)}
                    onDescendre={() => void deplacer(courante.playlists, i, 1)}
                    onRetirerTitre={(t) => void retirerTitre(p, t)}
                  />
                ))}
              </div>
            </section>
          )}

          {reglages && (
            <ReglagesCuration
              r={reglages}
              recettes={donnees.recettes}
              univers={univers}
              occupe={occupe}
              enregistrer={enregistrerReglage}
              basculer={basculerSelection}
            />
          )}

          <section className="animate-monter decale-5">
            <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-texte-3 uppercase">
              <History size={13} /> Analyses précédentes
            </h2>
            {donnees.historique.length === 0 ? (
              <Vide texte="Aucune analyse pour l'instant." />
            ) : (
              <Table entetes={["Semaine", { libelle: "Lancée", largeur: "170px" }, { libelle: "Déclencheur", largeur: "130px" }, { libelle: "Publiée le", largeur: "140px" }, { libelle: "État", largeur: "190px" }]}>
                {donnees.historique.map((h) => {
                  const s = STATUTS[h.statut];
                  return (
                    <tr key={h._id} className="animate-paraitre">
                      <td>
                        <div className="font-medium">{h.fenetre}</div>
                        {h.erreur && <div className="mt-0.5 text-[12px] text-danger">{h.erreur}</div>}
                      </td>
                      <td className="text-texte-2" title={formatDate(h.createdAt)}>
                        {formatRelatif(h.createdAt)}
                      </td>
                      <td className="text-texte-2">{h.declencheur === "cron" ? "Automatique" : "À la main"}</td>
                      <td className="text-texte-2 tabular-nums">{formatDate(h.publieeLe)}</td>
                      <td>
                        <Pastille texte={s?.libelle ?? h.statut} ton={s?.ton ?? "neutre"} />
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function EnTeteAnalyse({ a, occupe, onPublier, onEcarter, onRetirer }: { a: Analyse; occupe: string | null; onPublier: () => void; onEcarter: () => void; onRetirer: () => void }) {
  const s = STATUTS[a.statut];
  const retenues = a.playlists.filter((p) => p.statut !== "archivee").length;
  const stats: { libelle: string; valeur?: number; icone: typeof Headphones }[] = [
    { libelle: "Écoutes", valeur: a.stats?.ecoutes, icone: Headphones },
    { libelle: "Auditeurs", valeur: a.stats?.auditeurs, icone: Users },
    { libelle: "Recherches", valeur: a.stats?.recherches, icone: Search },
    { libelle: "Sorties", valeur: a.stats?.nouveautes, icone: Sparkles },
    { libelle: "Titres considérés", valeur: a.stats?.titresConsideres, icone: ListMusic },
  ];
  return (
    <Carte className="animate-monter decale-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[12px] text-texte-3">
            <Pastille texte={s?.libelle ?? a.statut} ton={s?.ton ?? "neutre"} />
            {a.redigeParIA ? <Pastille texte="Rédigé par l'IA" ton="accent" /> : <Pastille texte="Titres de repli" />}
            <span className="ml-2">
              Semaine {a.fenetre} · {a.declencheur === "cron" ? "automatique" : "lancée à la main"}
              {a.publieeLe && ` · publiée le ${formatDate(a.publieeLe)}`}
            </span>
          </div>
          <h2 className="mt-2 font-titre text-[18px] font-semibold">{a.titreSection || "Sans titre de section"}</h2>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {a.statut === "a_valider" && (
            <>
              <Bouton variante="danger" disabled={occupe !== null} onClick={onEcarter}>
                <XCircle size={14} /> Écarter
              </Bouton>
              <Bouton enCours={occupe === "publier"} disabled={occupe !== null || retenues === 0} onClick={onPublier}>
                <CheckCircle2 size={14} /> Publier {retenues > 0 && `(${retenues})`}
              </Bouton>
            </>
          )}
          {a.statut === "publiee" && (
            <Bouton variante="danger" enCours={occupe === "retirer"} disabled={occupe !== null} onClick={onRetirer}>
              <Undo2 size={14} /> Retirer de l'accueil
            </Bouton>
          )}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map(({ libelle, valeur, icone: Icone }) => (
          <div key={libelle} className="rounded-xl bg-surface-2 px-4 py-3">
            <dt className="flex items-center gap-1.5 text-[11.5px] text-texte-3">
              <Icone size={13} /> {libelle}
            </dt>
            <dd className="mt-1 font-titre text-[18px] font-semibold tabular-nums">{formatNombre(valeur)}</dd>
          </div>
        ))}
      </dl>

      {a.resume && (
        <div className="mt-4 border-l-2 border-accent pl-4">
          <p className="text-[13px] leading-relaxed">{a.resume}</p>
          <p className="mt-1.5 text-[12px] text-texte-3">
            {a.redigeParIA ? "Synthèse et titres rédigés par l'IA : relisez avant de publier." : "Titres de repli : l'IA n'était pas disponible au moment de l'analyse."}
          </p>
        </div>
      )}

      {a.statut === "echouee" && (
        <p className="mt-4 flex items-start gap-2 text-[13px] text-attention">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> Aucune sélection n'atteint son minimum de titres sur cette période.
        </p>
      )}
    </Carte>
  );
}

function CartePlaylist({
  p,
  premiere,
  derniere,
  modifiable,
  occupe,
  ouverte,
  onDeplier,
  onRetoucher,
  onMonter,
  onDescendre,
  onRetirerTitre,
}: {
  p: PlaylistProposee;
  premiere: boolean;
  derniere: boolean;
  modifiable: boolean;
  occupe: boolean;
  ouverte: boolean;
  onDeplier: () => void;
  onRetoucher: (corps: Record<string, unknown>, succes?: string) => void;
  onMonter: () => void;
  onDescendre: () => void;
  onRetirerTitre: (t: Titre) => void;
}) {
  const ecartee = p.statut === "archivee";
  const editable = modifiable && !ecartee;
  const minutes = Math.round(p.songs.reduce((s, t) => s + (t.duration || 0), 0) / 60);
  const pochette = adresseImage(p.coverUrl);

  return (
    <article className={clsx("rounded-2xl border border-filet bg-surface p-4 transition-opacity", ecartee && "opacity-60")}>
      <div className="flex items-start gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2">
          {pochette ? <img src={pochette} alt="" className="h-full w-full object-cover" /> : <ListMusic size={20} className="text-texte-3" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center text-[12px] text-texte-3">
            <span>{p.recette || p.kind}</span>
            {ecartee ? <Pastille texte="écartée" /> : p.statut === "publiee" ? <Pastille texte="publiée" ton="succes" /> : <Pastille texte="proposée" ton="accent" />}
            {p.followers > 0 && (
              <span className="ml-2">
                {formatNombre(p.followers)} abonné{pluriel(p.followers)}
              </span>
            )}
          </div>

          {editable ? (
            <>
              <input
                key={`t-${p.title}`}
                defaultValue={p.title}
                maxLength={120}
                aria-label="Titre de la sélection"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (!v) e.target.value = p.title;
                  else if (v !== p.title) onRetoucher({ title: v }, "Titre enregistré");
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="-ml-2 mt-1 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-titre text-[15px] font-semibold outline-none transition-colors hover:border-filet focus:border-accent"
              />
              <textarea
                key={`d-${p.description}`}
                defaultValue={p.description}
                maxLength={400}
                rows={2}
                aria-label="Description de la sélection"
                placeholder="Sans description"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== p.description) onRetoucher({ description: v }, "Description enregistrée");
                }}
                className="-ml-2 w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13px] text-texte-2 outline-none transition-colors placeholder:text-texte-3 hover:border-filet focus:border-accent"
              />
            </>
          ) : (
            <>
              <h3 className="mt-1 font-titre text-[15px] font-semibold">{p.title}</h3>
              {p.description && <p className="mt-0.5 text-[13px] text-texte-2">{p.description}</p>}
            </>
          )}

          <p className="mt-1.5 text-[12px] text-texte-3">
            {p.songs.length} titre{pluriel(p.songs.length)} · {minutes} min{p.motif && <> · <span className="italic">{p.motif}</span></>}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {modifiable && (
            <div className="flex items-center gap-1">
              <button onClick={onMonter} disabled={premiere || occupe} title="Monter" className="grid h-8 w-8 place-items-center rounded-lg border border-filet text-texte-2 hover:text-texte disabled:opacity-30">
                <ChevronUp size={15} />
              </button>
              <button onClick={onDescendre} disabled={derniere || occupe} title="Descendre" className="grid h-8 w-8 place-items-center rounded-lg border border-filet text-texte-2 hover:text-texte disabled:opacity-30">
                <ChevronDown size={15} />
              </button>
            </div>
          )}
          {p.isPublic && (
            <button onClick={() => void window.bureau.ouvrirExterne(`${adresseSite()}/playlist/${p._id}`)} className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
              Voir sur le site <ExternalLink size={12} />
            </button>
          )}
        </div>
      </div>

      {modifiable && (
        <div className="mt-2 border-t border-filet">
          <Bascule
            libelle="Inclure dans la publication"
            aide={ecartee ? "Écartée : elle ne sera pas publiée." : "Une sélection écartée reste visible ici, mais ne part pas sur l'accueil."}
            valeur={!ecartee}
            disabled={occupe}
            onChange={(v) => onRetoucher({ inclure: v }, v ? "Sélection réintégrée" : "Sélection écartée")}
          />
        </div>
      )}

      <button onClick={onDeplier} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
        {ouverte ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {ouverte ? "Masquer les titres" : `Voir les ${p.songs.length} titres`}
      </button>

      {ouverte && (
        <ol className="animate-paraitre mt-2 divide-y divide-filet rounded-xl border border-filet">
          {p.songs.map((t, rang) => {
            const c = adresseImage(t.coverUrl);
            return (
              <li key={t._id} className="flex items-center gap-3 px-3 py-1.5 text-[13px]">
                <span className="w-5 shrink-0 text-right text-[12px] text-texte-3 tabular-nums">{rang + 1}</span>
                <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded bg-surface-2">
                  {c ? <img src={c} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ListMusic size={13} className="text-texte-3" />}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                <span className="min-w-0 flex-1 truncate text-texte-2">{t.artiste}</span>
                <span className="w-12 shrink-0 text-right text-[12px] text-texte-3 tabular-nums">{t.duration ? formatDuree(t.duration) : "—"}</span>
                {editable && (
                  <button onClick={() => onRetirerTitre(t)} disabled={occupe} title="Retirer de la sélection" className="grid h-7 w-7 shrink-0 place-items-center rounded text-texte-3 hover:bg-surface-2 hover:text-danger disabled:opacity-40">
                    <X size={14} />
                  </button>
                )}
              </li>
            );
          })}
          {p.songs.length === 0 && <li className="px-3 py-3 text-[12.5px] text-texte-3">Aucun titre.</li>}
        </ol>
      )}
    </article>
  );
}

function ReglagesCuration({
  r,
  recettes,
  univers,
  occupe,
  enregistrer,
  basculer,
}: {
  r: Reglages;
  recettes: Recettes;
  univers: Univers;
  occupe: string | null;
  enregistrer: (champ: string, correctif: Partial<Reglages>, succes?: string) => Promise<void>;
  basculer: (id: string, libelle: string, actif: boolean) => void;
}) {
  const [retention, setRetention] = useState(String(r.retentionWeeks));
  const [position, setPosition] = useState(String(r.sectionPosition));
  useEffect(() => setRetention(String(r.retentionWeeks)), [r.retentionWeeks]);
  useEffect(() => setPosition(String(r.sectionPosition)), [r.sectionPosition]);

  const libelleRecette = (id: string) => {
    const info = recettes[id];
    return univers === "christian" && info?.evangelique ? info.evangelique.libelle : (info?.libelle ?? id);
  };

  function validerNombre(saisie: string, actuel: number, min: number, max: number, champ: "retentionWeeks" | "sectionPosition", remettre: (v: string) => void) {
    const v = Number(saisie);
    if (!Number.isInteger(v) || v < min || v > max) return remettre(String(actuel));
    if (v !== actuel) void enregistrer(champ, { [champ]: v });
  }

  async function autoPublication(v: boolean) {
    if (v) {
      const ok = await confirmer({
        titre: "Publier sans validation ?",
        message: "Chaque analyse partira directement sur l'accueil, sans passer par cet écran : personne ne relira ce qui s'affiche en vitrine.",
        confirmer: "Activer",
        danger: true,
      });
      if (!ok) return;
    }
    await enregistrer("autoPublish", { autoPublish: v });
  }

  async function analyseHebdo(v: boolean) {
    if (!v) {
      const ok = await confirmer({
        titre: "Couper l'analyse hebdomadaire ?",
        message: "Plus aucune proposition ne sera composée automatiquement. Les sélections déjà publiées restent en place.",
        confirmer: "Couper",
        danger: true,
      });
      if (!ok) return;
    }
    await enregistrer("enabled", { enabled: v });
  }

  return (
    <Carte titre="Réglages" className="animate-monter decale-4" action={<span className="text-[12px] text-texte-3">Enregistrés aussitôt, pour les deux univers</span>}>
      <div className="grid grid-cols-1 gap-x-8 xl:grid-cols-2">
        <div className="divide-y divide-filet">
          <Bascule libelle="Analyse hebdomadaire" aide="Le passage automatique de chaque semaine. Les sélections déjà publiées restent en place." valeur={r.enabled} disabled={occupe !== null} onChange={(v) => void analyseHebdo(v)} />
          <Bascule
            libelle="Publier sans validation"
            aide="Les sélections partent directement sur l'accueil. Désactivé par défaut : personne ne relit alors ce qui s'affiche en vitrine."
            valeur={r.autoPublish}
            disabled={occupe !== null}
            onChange={(v) => void autoPublication(v)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 pt-2.5">
          <Champ
            libelle="Conservation (semaines)"
            type="number"
            min={1}
            max={52}
            value={retention}
            disabled={occupe !== null}
            onChange={(e) => setRetention(e.target.value)}
            onBlur={() => validerNombre(retention, r.retentionWeeks, 1, 52, "retentionWeeks", setRetention)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aide="Passé ce délai, les sélections retirées que personne ne suit sont supprimées."
          />
          <Champ
            libelle="Position sur l'accueil"
            type="number"
            min={0}
            max={50}
            value={position}
            disabled={occupe !== null}
            onChange={(e) => setPosition(e.target.value)}
            onBlur={() => validerNombre(position, r.sectionPosition, 0, 50, "sectionPosition", setPosition)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aide="Rang de la section parmi celles de l'accueil, de 0 à 50."
          />
        </div>
      </div>

      <div className="mt-5 border-t border-filet pt-4">
        <h3 className="text-[13px] font-semibold">Sélections produites</h3>
        <p className="mt-0.5 text-[12px] text-texte-3">Chacune part d'une mesure différente. Une sélection éteinte n'est plus proposée aux analyses suivantes.</p>
        <div className="mt-2 grid grid-cols-1 gap-x-8 xl:grid-cols-2 [&>*]:border-b [&>*]:border-filet">
          {Object.keys(recettes).map((id) => (
            <Bascule
              key={id}
              libelle={libelleRecette(id)}
              aide={recettes[id]?.detail}
              valeur={!r.disabled.includes(id)}
              disabled={occupe !== null}
              onChange={(v) => basculer(id, libelleRecette(id), v)}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-filet pt-4">
        <h3 className="text-[13px] font-semibold">Modes d'écoute</h3>
        <p className="mt-0.5 text-[12px] text-texte-3">
          Chaque mode actif produit jusqu'à trois playlists (les plus écoutées, celles qui montent, les nouveautés) et sa propre section d'accueil, visible des auditeurs qui l'ont choisi. Un mode qui n'a pas assez de titres dans cet univers ne produit rien.
        </p>
        <div className="mt-2 grid grid-cols-1 gap-x-8 xl:grid-cols-2 [&>*]:border-b [&>*]:border-filet">
          {MODES.map((m) => (
            <Bascule key={m.id} libelle={m.libelle} aide={m.detail} valeur={!r.disabled.includes(m.id)} disabled={occupe !== null} onChange={(v) => basculer(m.id, m.libelle, v)} />
          ))}
        </div>
      </div>
    </Carte>
  );
}
