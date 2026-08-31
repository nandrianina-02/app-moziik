"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Wand2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Play,
  Search,
  Users,
  Sparkles,
  History,
  Settings2,
} from "lucide-react";
import { AdminPanelSkeleton } from "@/components/admin/AdminSkeleton";
import { Switch } from "@/components/ui/Switch";
import { FormField } from "@/components/ui/FormField";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";
import { RECETTES_INFO, IDS_RECETTES } from "@/lib/curation/labels";
import { AdminTabs } from "@/components/admin/AdminChrome";
import { UNIVERS, UNIVERS_INFO, type Univers } from "@/lib/univers";

/**
 * Les sélections de la semaine, avant qu'elles n'atteignent l'accueil.
 *
 * Cet écran existe pour une raison : ce que l'analyse propose est juste
 * au sens des chiffres, pas nécessairement au sens éditorial. Un titre
 * peut être le plus écouté de la semaine et n'avoir rien à faire en
 * vitrine. La page rend donc visible ce qui n'est pas encore publié, dit
 * d'où vient chaque sélection, et laisse tout reprendre — sans quoi
 * « valider » ne serait qu'un bouton de plus.
 *
 * Les titres restent modifiables tant que l'analyse attend : après
 * publication, une playlist se modifie depuis sa propre page, comme
 * n'importe quelle autre.
 */

type Titre = { _id: string; title: string; coverUrl: string; duration: number; artiste: string };

type PlaylistProposee = {
  _id: string;
  title: string;
  description: string;
  coverUrl: string;
  isPublic: boolean;
  followers: number;
  kind: string;
  recette: string;
  statut: "brouillon" | "publiee" | "archivee";
  motif: string;
  rang: number;
  songs: Titre[];
};

type Analyse = {
  _id: string;
  fenetre: string;
  statut: "en_cours" | "a_valider" | "publiee" | "annulee" | "echouee";
  declencheur: "cron" | "admin";
  stats: { ecoutes: number; auditeurs: number; recherches: number; nouveautes: number; titresConsideres: number };
  titreSection: string;
  resume: string;
  redigeParIA: boolean;
  publieeLe: string | null;
  playlists: PlaylistProposee[];
};

type LigneHistorique = {
  _id: string;
  fenetre: string;
  statut: string;
  declencheur: string;
  publieeLe: string | null;
  erreur: string | null;
  createdAt: string;
};

type Reglages = {
  enabled: boolean;
  autoPublish: boolean;
  retentionWeeks: number;
  disabled: string[];
  sectionPosition: number;
};

type Donnees = { reglages: Reglages | null; courante: Analyse | null; historique: LigneHistorique[] };

const nombre = (v: number) => new Intl.NumberFormat("fr-FR").format(v);
const pluriel = (v: number) => (v > 1 ? "s" : "");

const LIBELLE_STATUT: Record<string, string> = {
  en_cours: "Analyse en cours",
  a_valider: "En attente de validation",
  publiee: "Publiée sur l'accueil",
  annulee: "Écartée",
  echouee: "Sans résultat",
};

/** Durée totale d'une sélection, en minutes. */
function duree(titres: Titre[]) {
  const secondes = titres.reduce((s, t) => s + (t.duration || 0), 0);
  return Math.round(secondes / 60);
}

export default function AdminSelectionsPage() {
  const pushToast = useToast();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [retentionSaisie, setRetentionSaisie] = useState("");
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    action: () => Promise<void>;
  } | null>(null);
  const [deplie, setDeplie] = useState<string | null>(null);
  // Une analyse par univers : les deux portent sur des catalogues
  // disjoints et se valident séparément, l'écran en montre une à la fois.
  const [univers, setUnivers] = useState<Univers>("general");

  const charger = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/curation?univers=${univers}`);
      if (!res.ok) throw new Error(await readApiError(res, "Chargement impossible."));
      const data: Donnees = await res.json();
      setDonnees(data);
      if (data.reglages) {
        setReglages(data.reglages);
        setRetentionSaisie(String(data.reglages.retentionWeeks));
      }
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Chargement impossible.");
    }
  }, [pushToast, univers]);

  useEffect(() => {
    charger();
  }, [charger]);

  /* --- réglages : chaque changement part seul, comme dans /admin/ia --- */

  async function enregistrerReglage(champ: string, correctif: Record<string, unknown>) {
    setOccupe(champ);
    try {
      const res = await fetch("/api/admin/curation/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(correctif),
      });
      if (!res.ok) throw new Error(await readApiError(res, "L'enregistrement a échoué."));
      const { reglages: majs } = await res.json();
      setReglages(majs);
      setRetentionSaisie(String(majs.retentionWeeks));
      pushToast("success", "Réglage enregistré.");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "L'enregistrement a échoué.");
      charger();
    } finally {
      setOccupe(null);
    }
  }

  /* --- gestes sur l'analyse ------------------------------------------- */

  async function agir(action: string, runId?: string, succes?: string) {
    setOccupe(action);
    try {
      const res = await fetch("/api/admin/curation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, runId }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "L'opération a échoué."));
      const data = await res.json();
      // « Analyser » couvre les deux univers d'un seul geste : le message
      // additionne ce que chacun a produit plutôt que de n'en montrer qu'un.
      const proposees: number =
        action === "analyser"
          ? ((data.analyses ?? []) as { playlists: number }[]).reduce((n, a) => n + a.playlists, 0)
          : 0;
      pushToast(
        "success",
        succes ??
          (action === "analyser"
            ? `${proposees} sélection${pluriel(proposees)} proposée${pluriel(proposees)} sur les deux univers.`
            : "C'est fait.")
      );
      await charger();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "L'opération a échoué.");
    } finally {
      setOccupe(null);
    }
  }

  /* --- retouches d'une proposition ------------------------------------ */

  /** L'appel seul, sans rechargement : un déplacement en enchaîne deux. */
  async function patcher(id: string, correctif: Record<string, unknown>) {
    const res = await fetch(`/api/admin/curation/playlist/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(correctif),
    });
    if (!res.ok) throw new Error(await readApiError(res, "La modification a échoué."));
  }

  async function retoucher(id: string, correctif: Record<string, unknown>) {
    try {
      await patcher(id, correctif);
      await charger();
      pushToast("success", "Modification enregistrée.");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "La modification a échoué.");
      // L'écran doit revenir à ce que le serveur a réellement retenu.
      charger();
    }
  }

  /**
   * Échange le rang de deux propositions voisines.
   *
   * Les deux appels partent ensemble mais l'écran ne se recharge qu'une
   * fois : deux rechargements concurrents se doubleraient, et le second
   * pourrait afficher l'état d'avant le premier.
   */
  async function deplacer(playlists: PlaylistProposee[], index: number, sens: -1 | 1) {
    const cible = index + sens;
    if (cible < 0 || cible >= playlists.length) return;
    setOccupe(`rang-${playlists[index]._id}`);
    try {
      await Promise.all([
        patcher(playlists[index]._id, { rang: playlists[cible].rang }),
        patcher(playlists[cible]._id, { rang: playlists[index].rang }),
      ]);
      await charger();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Le déplacement a échoué.");
      charger();
    } finally {
      setOccupe(null);
    }
  }

  if (!donnees) {
    return (
      <div className="space-y-4">
        <AdminPanelSkeleton height="h-32" />
        <AdminPanelSkeleton height="h-24" />
        <AdminPanelSkeleton height="h-96" />
      </div>
    );
  }

  const { courante, historique } = donnees;
  const enAttente = courante?.statut === "a_valider";
  const retenues = courante?.playlists.filter((p) => p.statut !== "archivee") ?? [];

  return (
    <div className="space-y-6">
      {/* L'univers d'abord : tout ce qui suit en dépend, y compris les
          chiffres de la semaine. */}
      <AdminTabs
        tabs={UNIVERS.map((u) => ({ value: u, label: UNIVERS_INFO[u].label }))}
        value={univers}
        onChange={setUnivers}
      />

      {/* ------------------------------------------------- présentation ---- */}
      <section className="rounded-xl2 border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h2 className="flex items-center gap-2 font-display text-lg text-ink">
              <Wand2 size={18} className="text-accent" /> Sélections de la semaine
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Chaque semaine, une analyse des écoutes, des recherches et des sorties compose des playlists et
              les propose ici. Rien n&apos;apparaît sur l&apos;accueil tant que vous n&apos;avez pas validé.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              // Relancer écarte la proposition en attente : elle porte sur
              // les mêmes données, mais les retouches déjà faites dessus
              // seraient perdues sans prévenir.
              enAttente
                ? setConfirmation({
                    title: "Remplacer la proposition en attente ?",
                    description:
                      "Les sélections actuellement proposées, ainsi que les retouches que vous y avez faites, seront remplacées par celles de la nouvelle analyse.",
                    confirmLabel: "Relancer",
                    action: () => agir("analyser"),
                  })
                : agir("analyser")
            }
            disabled={occupe !== null || reglages?.enabled === false}
            className="flex shrink-0 items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-base transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {occupe === "analyser" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Lancer une analyse
          </button>
        </div>
        {reglages?.enabled === false && (
          <p className="mt-3 flex items-center gap-2 text-sm text-warning">
            <AlertTriangle size={15} /> La curation est désactivée dans les réglages ci-dessous.
          </p>
        )}
      </section>

      {/* ---------------------------------------------- analyse courante ---- */}
      {!courante && (
        <section className="rounded-xl2 border border-border bg-surface p-8 text-center">
          <p className="text-sm text-ink-muted">
            Aucune analyse pour l&apos;instant. Lancez-en une, ou attendez le passage hebdomadaire.
          </p>
        </section>
      )}

      {courante && (
        <section className="rounded-xl2 border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    courante.statut === "publiee"
                      ? "bg-success/15 text-success"
                      : courante.statut === "a_valider"
                        ? "bg-accent/15 text-accent"
                        : "bg-surface-2 text-ink-muted"
                  }`}
                >
                  {LIBELLE_STATUT[courante.statut] ?? courante.statut}
                </span>
                <span className="text-xs text-ink-muted">
                  Semaine {courante.fenetre} · {courante.declencheur === "cron" ? "automatique" : "lancée à la main"}
                </span>
              </div>
              <h3 className="mt-2 font-display text-lg text-ink">{courante.titreSection || "Sans titre"}</h3>
            </div>

            {enAttente && (
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setConfirmation({
                      title: "Écarter cette analyse ?",
                      description:
                        "Les propositions seront supprimées et rien ne sera publié. Une nouvelle analyse pourra être lancée ensuite.",
                      confirmLabel: "Écarter",
                      action: () => agir("annuler", courante._id, "Analyse écartée."),
                    })
                  }
                  disabled={occupe !== null}
                  className="rounded-full border border-border px-4 py-2 text-sm text-ink-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
                >
                  Écarter
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmation({
                      title: `Publier ${retenues.length} sélection${pluriel(retenues.length)} ?`,
                      description:
                        "Elles deviendront visibles sur l'accueil et dans les playlists publiques. Les sélections de la semaine précédente en seront retirées.",
                      confirmLabel: "Publier",
                      action: () => agir("publier", courante._id, "Sélections publiées sur l'accueil."),
                    })
                  }
                  disabled={occupe !== null || retenues.length === 0}
                  className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-base transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {occupe === "publier" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  Publier
                </button>
              </div>
            )}

            {courante.statut === "publiee" && (
              <button
                type="button"
                onClick={() =>
                  setConfirmation({
                    title: "Retirer ces sélections de l'accueil ?",
                    description:
                      "La section sera masquée. Les playlists que des membres ont ajoutées à leur bibliothèque leur resteront accessibles.",
                    confirmLabel: "Retirer",
                    action: () => agir("retirer", courante._id, "Sélections retirées de l'accueil."),
                  })
                }
                disabled={occupe !== null}
                className="shrink-0 rounded-full border border-border px-4 py-2 text-sm text-ink-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
              >
                Retirer de l&apos;accueil
              </button>
            )}
          </div>

          {/* ---- ce que la semaine dit ---- */}
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Écoutes", valeur: courante.stats.ecoutes, icone: Play },
              { label: "Auditeurs", valeur: courante.stats.auditeurs, icone: Users },
              { label: "Recherches", valeur: courante.stats.recherches, icone: Search },
              { label: "Sorties", valeur: courante.stats.nouveautes, icone: Sparkles },
            ].map(({ label, valeur, icone: Icone }) => (
              <div key={label} className="rounded-xl border border-border bg-base p-3">
                <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <Icone size={13} /> {label}
                </dt>
                <dd className="mt-1 font-display text-xl text-ink">{nombre(valeur)}</dd>
              </div>
            ))}
          </dl>

          {courante.resume && (
            <div className="mt-4 rounded-xl border border-border bg-base p-4">
              <p className="text-sm leading-relaxed text-ink">{courante.resume}</p>
              <p className="mt-2 text-xs text-ink-muted">
                {courante.redigeParIA
                  ? "Synthèse et titres rédigés par l'IA. Relisez avant de publier."
                  : "Titres de repli : l'IA n'était pas disponible au moment de l'analyse."}
              </p>
            </div>
          )}

          {courante.statut === "echouee" && (
            <p className="mt-4 flex items-start gap-2 text-sm text-warning">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              Aucune sélection n&apos;atteint son minimum de titres sur cette période.
            </p>
          )}
        </section>
      )}

      {/* -------------------------------------------------- propositions ---- */}
      {courante && courante.playlists.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm uppercase tracking-wide text-ink-muted">
            {courante.playlists.length} sélection{pluriel(courante.playlists.length)}
          </h3>

          {courante.playlists.map((p, index) => {
            const ecartee = p.statut === "archivee";
            const ouvert = deplie === p._id;
            return (
              <article
                key={p._id}
                className={`rounded-xl2 border bg-surface p-4 transition-opacity ${
                  ecartee ? "border-border opacity-60" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-base">
                    <SafeImage src={p.coverUrl} alt="" width={64} height={64} className="h-full w-full object-cover" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-muted">
                        {p.recette}
                      </span>
                      {ecartee && (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-muted">
                          écartée
                        </span>
                      )}
                      {p.isPublic && (
                        <Link
                          href={`/playlist/${p._id}`}
                          className="text-[11px] text-accent underline-offset-2 hover:underline"
                        >
                          voir la playlist
                        </Link>
                      )}
                    </div>

                    {enAttente && !ecartee ? (
                      <input
                        defaultValue={p.title}
                        aria-label={`Titre de la sélection « ${p.recette} »`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== p.title) retoucher(p._id, { title: v });
                        }}
                        className="mt-1.5 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-base text-ink outline-none transition-colors hover:border-border focus:border-accent"
                      />
                    ) : (
                      <h4 className="mt-1.5 px-2 font-display text-base text-ink">{p.title}</h4>
                    )}

                    {enAttente && !ecartee ? (
                      <textarea
                        defaultValue={p.description}
                        rows={2}
                        aria-label={`Description de la sélection « ${p.recette} »`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== p.description) retoucher(p._id, { description: v });
                        }}
                        className="mt-1 w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-ink-muted outline-none transition-colors hover:border-border focus:border-accent"
                      />
                    ) : (
                      <p className="mt-1 px-2 text-sm text-ink-muted">{p.description}</p>
                    )}

                    <p className="mt-2 px-2 text-xs text-ink-muted">
                      {p.songs.length} titre{pluriel(p.songs.length)} · {duree(p.songs)} min ·{" "}
                      <span className="italic">{p.motif}</span>
                    </p>
                  </div>

                  {/* ---- gestes ---- */}
                  {enAttente && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => deplacer(courante.playlists, index, -1)}
                        disabled={index === 0 || occupe !== null}
                        aria-label={`Monter « ${p.title} »`}
                        className="rounded-lg border border-border p-1.5 text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-30"
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deplacer(courante.playlists, index, 1)}
                        disabled={index === courante.playlists.length - 1 || occupe !== null}
                        aria-label={`Descendre « ${p.title} »`}
                        className="rounded-lg border border-border p-1.5 text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-30"
                      >
                        <ChevronDown size={15} />
                      </button>
                      <Switch
                        checked={!ecartee}
                        disabled={occupe !== null}
                        label={`Inclure « ${p.title} » dans la publication`}
                        onChange={(v) => retoucher(p._id, { inclure: v })}
                      />
                    </div>
                  )}
                </div>

                {/* ---- les titres ---- */}
                <button
                  type="button"
                  onClick={() => setDeplie(ouvert ? null : p._id)}
                  aria-expanded={ouvert}
                  className="mt-3 text-xs text-accent underline-offset-2 hover:underline"
                >
                  {ouvert ? "Masquer les titres" : `Voir les ${p.songs.length} titres`}
                </button>

                {ouvert && (
                  <ol className="mt-3 space-y-1">
                    {p.songs.map((s, rang) => (
                      <li
                        key={s._id}
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-base"
                      >
                        <span className="w-5 shrink-0 text-right text-xs text-ink-muted">{rang + 1}</span>
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-base">
                          <SafeImage src={s.coverUrl} alt="" width={32} height={32} className="h-full w-full object-cover" />
                        </div>
                        <span className="min-w-0 flex-1 truncate text-ink">{s.title}</span>
                        <span className="hidden min-w-0 flex-1 truncate text-ink-muted sm:block">{s.artiste}</span>
                        {enAttente && !ecartee && (
                          <button
                            type="button"
                            onClick={() => retoucher(p._id, { retirerTitre: s._id })}
                            aria-label={`Retirer « ${s.title} » de la sélection`}
                            className="shrink-0 rounded p-1 text-ink-muted transition-colors hover:text-danger"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </article>
            );
          })}
        </section>
      )}

      {/* ------------------------------------------------------ réglages ---- */}
      {reglages && (
        <section className="rounded-xl2 border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 text-sm uppercase tracking-wide text-ink-muted">
            <Settings2 size={15} /> Réglages
          </h2>

          <div className="mt-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-ink">Analyse hebdomadaire</p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  Coupe le passage automatique. Les sélections déjà publiées restent en place.
                </p>
              </div>
              <Switch
                checked={reglages.enabled}
                disabled={occupe !== null}
                label="Activer l'analyse hebdomadaire"
                onChange={(v) => enregistrerReglage("enabled", { enabled: v })}
              />
            </div>

            <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
              <div className="min-w-0">
                <p className="text-sm text-ink">Publier sans validation</p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  Les sélections partent directement sur l&apos;accueil, sans passer par cet écran. Désactivé par
                  défaut : personne ne relit alors ce qui s&apos;affiche en vitrine.
                </p>
              </div>
              <Switch
                checked={reglages.autoPublish}
                disabled={occupe !== null}
                label="Publier sans validation humaine"
                onChange={(v) => enregistrerReglage("autoPublish", { autoPublish: v })}
              />
            </div>

            <div className="border-t border-border pt-4 sm:max-w-xs">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = Number(retentionSaisie);
                  if (Number.isInteger(v) && v >= 1) enregistrerReglage("retentionWeeks", { retentionWeeks: v });
                }}
              >
                <FormField
                  label="Conserver les anciennes sélections (semaines)"
                  type="number"
                  min={1}
                  max={52}
                  step={1}
                  value={retentionSaisie}
                  onChange={(e) => setRetentionSaisie(e.target.value)}
                  onBlur={() => {
                    const v = Number(retentionSaisie);
                    if (Number.isInteger(v) && v >= 1 && v !== reglages.retentionWeeks) {
                      enregistrerReglage("retentionWeeks", { retentionWeeks: v });
                    }
                  }}
                  disabled={occupe !== null}
                />
                <button type="submit" className="sr-only">
                  Enregistrer la durée de conservation
                </button>
              </form>
              <p className="mt-1.5 text-xs text-ink-muted">
                Passé ce délai, les sélections retirées de l&apos;accueil que personne n&apos;a ajoutées à sa
                bibliothèque sont supprimées. Celles qu&apos;un membre suit sont conservées.
              </p>
            </div>

            {/* ---- recettes ---- */}
            <div className="border-t border-border pt-4">
              <p className="text-sm text-ink">Sélections produites</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                Chacune se compose à partir d&apos;une mesure différente. Une sélection éteinte n&apos;est plus
                proposée aux analyses suivantes.
              </p>
              <ul className="mt-3 space-y-2">
                {IDS_RECETTES.map((id) => {
                  const eteinte = reglages.disabled.includes(id);
                  return (
                    <li
                      key={id}
                      className="flex items-start justify-between gap-4 rounded-xl border border-border bg-base p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-ink">{RECETTES_INFO[id].libelle}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">{RECETTES_INFO[id].detail}</p>
                      </div>
                      <Switch
                        checked={!eteinte}
                        disabled={occupe !== null}
                        label={`Produire « ${RECETTES_INFO[id].libelle} »`}
                        onChange={(v) =>
                          enregistrerReglage("disabled", {
                            disabled: v
                              ? reglages.disabled.filter((d) => d !== id)
                              : [...reglages.disabled, id],
                          })
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------- historique ---- */}
      {historique.length > 0 && (
        <section className="rounded-xl2 border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 text-sm uppercase tracking-wide text-ink-muted">
            <History size={15} /> Analyses précédentes
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {historique.map((h) => (
              <li key={h._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="text-ink">Semaine {h.fenetre}</span>
                <span className="flex items-center gap-2 text-xs text-ink-muted">
                  {h.declencheur === "cron" ? "automatique" : "à la main"}
                  <span className="rounded-full bg-surface-2 px-2 py-0.5">
                    {LIBELLE_STATUT[h.statut] ?? h.statut}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {confirmation && (
        <ConfirmDialog
          title={confirmation.title}
          description={confirmation.description}
          confirmLabel={confirmation.confirmLabel}
          danger={confirmation.confirmLabel !== "Publier"}
          busy={occupe !== null}
          onConfirm={async () => {
            const action = confirmation.action;
            setConfirmation(null);
            await action();
          }}
          onCancel={() => setConfirmation(null)}
        />
      )}
    </div>
  );
}
