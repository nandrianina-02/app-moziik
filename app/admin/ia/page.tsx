"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, AlertTriangle, KeyRound, Gauge, Loader2 } from "lucide-react";
import { AdminPanelSkeleton } from "@/components/admin/AdminSkeleton";
import { Switch } from "@/components/ui/Switch";
import { FormField } from "@/components/ui/FormField";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";

type Fonctionnalite = {
  id: string;
  label: string;
  detail: string;
  niveau: "rapide" | "soigne";
  acces: "membre" | "artiste" | "admin" | "public";
};

type LigneUsage = { feature: string; calls: number; inputTokens: number; outputTokens: number; errors: number };

type Donnees = {
  cleConfiguree: boolean;
  reglages: { enabled: boolean; disabled: string[]; dailyCallCap: number };
  fonctionnalites: Fonctionnalite[];
  usage: { parJour: { day: string; calls: number }[]; parFonctionnalite: LigneUsage[]; aujourdhui: number };
};

/** Chiffres exacts, separateurs francais : en administration on compare des
 *  compteurs, et « 1,2 K appels » ne se rapproche d'aucun plafond. */
const nombre = (v: number) => new Intl.NumberFormat("fr-FR").format(v);
/** Accord au pluriel, a partir de deux. */
const pluriel = (v: number) => (v > 1 ? "s" : "");

const LIBELLE_NIVEAU = { rapide: "Rapide", soigne: "Soigné" } as const;
const LIBELLE_ACCES = {
  public: "Tout le monde",
  membre: "Membres",
  artiste: "Artistes",
  admin: "Administration",
} as const;

export default function AdminIaPage() {
  const pushToast = useToast();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [plafondSaisi, setPlafondSaisi] = useState("");
  const [enregistrement, setEnregistrement] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai");
      if (!res.ok) throw new Error();
      const data: Donnees = await res.json();
      setDonnees(data);
      setPlafondSaisi(String(data.reglages.dailyCallCap));
    } catch {
      pushToast("error", "Impossible de charger les réglages de l'IA.");
    }
  }, [pushToast]);

  useEffect(() => {
    charger();
  }, [charger]);

  /**
   * Chaque réglage part seul, dès le clic.
   *
   * Un bouton « Enregistrer » global obligerait à se souvenir de cliquer
   * après avoir coupé une fonctionnalité — or on ne coupe une IA qui
   * dérape ou qui coûte que dans l'urgence, et un interrupteur qui n'a pas
   * pris effet est alors pire qu'inutile.
   */
  async function enregistrer(champ: string, correctif: Record<string, unknown>) {
    setEnregistrement(champ);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(correctif),
      });
      if (!res.ok) throw new Error(await readApiError(res, "L'enregistrement a échoué."));
      const { reglages } = await res.json();
      setDonnees((prev) => (prev ? { ...prev, reglages } : prev));
      setPlafondSaisi(String(reglages.dailyCallCap));
      // La liste publiée par /api/site-config change : les pages ouvertes
      // ailleurs doivent cesser (ou se remettre) de proposer l'assistance.
      window.dispatchEvent(new Event("moziik-site-config-change"));
      pushToast("success", "Réglage enregistré.");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "L'enregistrement a échoué.");
      // La case cochée doit revenir à ce que le serveur a réellement retenu.
      charger();
    } finally {
      setEnregistrement(null);
    }
  }

  const usageParId = useMemo(() => {
    const carte = new Map<string, LigneUsage>();
    for (const l of donnees?.usage.parFonctionnalite ?? []) carte.set(l.feature, l);
    return carte;
  }, [donnees]);

  const total = useMemo(() => {
    const lignes = donnees?.usage.parFonctionnalite ?? [];
    return {
      appels: lignes.reduce((s, l) => s + l.calls, 0),
      jetons: lignes.reduce((s, l) => s + l.inputTokens + l.outputTokens, 0),
      erreurs: lignes.reduce((s, l) => s + l.errors, 0),
    };
  }, [donnees]);

  if (!donnees) {
    return (
      <div className="space-y-4">
        <AdminPanelSkeleton height="h-32" />
        <AdminPanelSkeleton height="h-24" />
        <AdminPanelSkeleton height="h-96" />
      </div>
    );
  }

  const { reglages, fonctionnalites, usage, cleConfiguree } = donnees;
  const plafondAtteint = reglages.dailyCallCap > 0 && usage.aujourdhui >= reglages.dailyCallCap;

  return (
    <div className="space-y-6">
      {!cleConfiguree && (
        <div className="flex items-start gap-3 rounded-xl2 border border-warning/40 bg-base p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium text-ink">Aucune clé d&apos;API n&apos;est configurée.</p>
            <p className="mt-1 text-ink-muted">
              Renseignez <code className="rounded bg-surface px-1.5 py-0.5 text-xs">ANTHROPIC_API_KEY</code> dans
              l&apos;environnement du serveur, puis redémarrez-le. Tant qu&apos;elle manque, aucune assistance
              n&apos;est proposée nulle part sur le site — rien n&apos;est cassé pour autant, chaque page garde son
              fonctionnement sans IA.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ interrupteur ---- */}
      <section className="rounded-xl2 border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-lg text-ink">
              <Sparkles size={18} className="text-accent" /> Assistance par IA
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Coupe toutes les assistances d&apos;un seul geste, sans toucher à la clé. Les pages concernées
              retrouvent alors leur fonctionnement sans IA.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {enregistrement === "enabled" && <Loader2 size={14} className="animate-spin text-ink-muted" />}
            <Switch
              checked={reglages.enabled}
              disabled={enregistrement !== null}
              label="Activer l'assistance par IA"
              onChange={(v) => enregistrer("enabled", { enabled: v })}
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ plafond ---- */}
      <section className="rounded-xl2 border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 text-sm uppercase tracking-wide text-ink-muted">
          <Gauge size={15} /> Plafond journalier
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,15rem)_1fr] sm:items-end">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const valeur = Number(plafondSaisi);
              if (!Number.isInteger(valeur) || valeur < 0) {
                pushToast("error", "Indiquez un nombre entier positif.");
                return;
              }
              enregistrer("dailyCallCap", { dailyCallCap: valeur });
            }}
          >
            <FormField
              label="Appels autorisés par jour"
              type="number"
              min={0}
              step={1}
              value={plafondSaisi}
              onChange={(e) => setPlafondSaisi(e.target.value)}
              onBlur={() => {
                const valeur = Number(plafondSaisi);
                if (Number.isInteger(valeur) && valeur >= 0 && valeur !== reglages.dailyCallCap) {
                  enregistrer("dailyCallCap", { dailyCallCap: valeur });
                }
              }}
              disabled={enregistrement !== null}
            />
            <button type="submit" className="sr-only">
              Enregistrer le plafond
            </button>
          </form>
          <div className="text-sm">
            <p className="text-ink">
              <strong className="font-display text-xl">{nombre(usage.aujourdhui)}</strong>{" "}
              <span className="text-ink-muted">
                appel{usage.aujourdhui > 1 ? "s" : ""} aujourd&apos;hui
                {reglages.dailyCallCap > 0 ? ` sur ${nombre(reglages.dailyCallCap)}` : " (sans plafond)"}
              </span>
            </p>
            <p className="mt-1 text-ink-muted">
              {plafondAtteint
                ? "Le plafond est atteint : toute assistance est suspendue jusqu'à minuit UTC."
                : "Le compteur repart à zéro à minuit UTC, soit 03 h 00 à Antananarivo."}
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------- fonctionnalités ---- */}
      <section className="rounded-xl2 border border-border bg-surface p-5">
        <h2 className="text-sm uppercase tracking-wide text-ink-muted">Fonctionnalités</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Consommation des trente derniers jours. Éteindre une ligne ne désactive qu&apos;elle.
        </p>

        <ul className="mt-4 divide-y divide-border">
          {fonctionnalites.map((f) => {
            const eteinte = reglages.disabled.includes(f.id);
            const u = usageParId.get(f.id);
            return (
              <li key={f.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0">
                <div className="min-w-[12rem] flex-1">
                  <p className={`text-sm font-medium ${eteinte ? "text-ink-muted" : "text-ink"}`}>{f.label}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{f.detail}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                    <span className="rounded-full border border-border px-2 py-0.5">{LIBELLE_NIVEAU[f.niveau]}</span>
                    <span className="rounded-full border border-border px-2 py-0.5">{LIBELLE_ACCES[f.acces]}</span>
                  </p>
                </div>

                <div className="min-w-[9rem] text-xs text-ink-muted">
                  {u ? (
                    <>
                      <p className="text-ink">
                        {nombre(u.calls)} appel{pluriel(u.calls)}
                      </p>
                      <p className="mt-0.5">{nombre(u.inputTokens + u.outputTokens)} jetons</p>
                      {u.errors > 0 && <p className="mt-0.5 text-accent">{nombre(u.errors)} en erreur</p>}
                    </>
                  ) : (
                    <p>Jamais appelée</p>
                  )}
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {enregistrement === f.id && <Loader2 size={14} className="animate-spin text-ink-muted" />}
                  <Switch
                    checked={!eteinte}
                    disabled={enregistrement !== null}
                    label={`Activer : ${f.label}`}
                    onChange={(actif) =>
                      enregistrer(f.id, {
                        disabled: actif
                          ? reglages.disabled.filter((id) => id !== f.id)
                          : [...reglages.disabled, f.id],
                      })
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* -------------------------------------------------------- total ---- */}
      <section className="rounded-xl2 border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 text-sm uppercase tracking-wide text-ink-muted">
          <KeyRound size={15} /> Trente derniers jours
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Chiffre valeur={nombre(total.appels)} libelle={`appel${pluriel(total.appels)}`} />
          <Chiffre valeur={nombre(total.jetons)} libelle={`jeton${pluriel(total.jetons)}`} />
          <Chiffre valeur={nombre(total.erreurs)} libelle="en erreur" />
          <Chiffre
            valeur={String(usage.parJour.length)}
            libelle={`jour${pluriel(usage.parJour.length)} d'activité`}
          />
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          Aucun contenu envoyé à l&apos;IA n&apos;est conservé : ces chiffres ne sont que des compteurs. Les jetons
          se lisent chez votre fournisseur pour connaître le montant exact facturé.
        </p>
      </section>
    </div>
  );
}

function Chiffre({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div className="rounded-xl border border-border bg-base p-3">
      <p className="font-display text-2xl text-ink">{valeur}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{libelle}</p>
    </div>
  );
}
