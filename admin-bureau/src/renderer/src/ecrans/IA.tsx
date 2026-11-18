import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Gauge, KeyRound, RefreshCw, Save, Sparkles, Users } from "lucide-react";
import { api } from "../api";
import { Bascule, Bouton, Carte, Champ, Chargement, EnTete, Erreur, Pastille, Table, Vide, formatNombre } from "../composants";
import { CourbeAire } from "../graphiques";
import { annoncer, confirmer } from "../interactions";
import clsx from "../clsx";

interface Reglages {
  enabled: boolean;
  disabled: string[];
  dailyCallCap: number;
}

interface Fonctionnalite {
  id: string;
  label: string;
  detail: string;
  niveau: "rapide" | "soigne";
  acces: string;
}

interface LigneUsage {
  feature: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  errors: number;
}

interface Reponse {
  cleConfiguree: boolean;
  reglages: Reglages;
  fonctionnalites: Fonctionnalite[];
  usage: { parJour: { day: string; calls: number }[]; parFonctionnalite: LigneUsage[]; aujourdhui: number };
}

const ACCES: Record<string, string> = { membre: "Membres", artiste: "Artistes", admin: "Administration", public: "Tout visiteur" };
const PLAFOND_MAX = 100000;

/**
 * L'assistance par IA : interrupteur général, plafond d'appels quotidien,
 * une bascule par fonctionnalité, et la consommation des trente derniers
 * jours. Chaque changement part aussitôt au site : il n'y a pas de
 * brouillon, comme sur la page web d'administration.
 */
export function IA() {
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [plafond, setPlafond] = useState("");
  const [enregistrement, setEnregistrement] = useState<string | null>(null);
  const [rechargement, setRechargement] = useState(0);

  useEffect(() => {
    setErreur(null);
    api<Reponse>("/api/admin/ai")
      .then((r) => {
        const propre: Reponse = {
          cleConfiguree: Boolean(r.cleConfiguree),
          reglages: { enabled: r.reglages?.enabled !== false, disabled: r.reglages?.disabled ?? [], dailyCallCap: r.reglages?.dailyCallCap ?? 0 },
          fonctionnalites: r.fonctionnalites ?? [],
          usage: { parJour: r.usage?.parJour ?? [], parFonctionnalite: r.usage?.parFonctionnalite ?? [], aujourdhui: r.usage?.aujourdhui ?? 0 },
        };
        setDonnees(propre);
        setPlafond(String(propre.reglages.dailyCallCap));
      })
      .catch((e: Error) => setErreur(e.message));
  }, [rechargement]);

  /** Envoie un changement et reprend les réglages tels que le site les a enregistrés. */
  async function enregistrer(cle: string, corps: Partial<Reglages>, message: string) {
    setEnregistrement(cle);
    setErreur(null);
    try {
      const { reglages } = await api<{ reglages: Reglages }>("/api/admin/ai", { methode: "PATCH", corps });
      setDonnees((d) => (d ? { ...d, reglages: { enabled: reglages.enabled !== false, disabled: reglages.disabled ?? [], dailyCallCap: reglages.dailyCallCap ?? 0 } } : d));
      if (corps.dailyCallCap !== undefined) setPlafond(String(reglages.dailyCallCap ?? corps.dailyCallCap));
      annoncer(message);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement refusé.");
    } finally {
      setEnregistrement(null);
    }
  }

  async function basculerGeneral(v: boolean) {
    if (!v) {
      const ok = await confirmer({
        titre: "Éteindre toute l'assistance par IA ?",
        message: "Plus aucune fonctionnalité n'appellera le modèle, sur le site comme dans l'application : les boutons qui en dépendent disparaissent pour tout le monde jusqu'à ce que vous la rallumiez.",
        confirmer: "Tout éteindre",
        danger: true,
      });
      if (!ok) return;
    }
    await enregistrer("general", { enabled: v }, v ? "Assistance par IA rallumée" : "Assistance par IA éteinte");
  }

  async function enregistrerPlafond() {
    if (!donnees) return;
    const n = Number(plafond.trim());
    if (!Number.isInteger(n) || n < 0 || n > PLAFOND_MAX) {
      setErreur(`Le plafond doit être un nombre entier entre 0 et ${formatNombre(PLAFOND_MAX)}.`);
      return;
    }
    const ok = await confirmer({
      titre: "Changer le plafond quotidien ?",
      message:
        n === 0
          ? "Avec 0, aucun plafond ne s'applique : la dépense n'est plus bornée que par les limites propres à chaque fonctionnalité."
          : `Au-delà de ${formatNombre(n)} appels dans la journée (UTC), toutes les fonctionnalités s'arrêtent jusqu'au lendemain. Aujourd'hui : ${formatNombre(donnees.usage.aujourdhui)} appels.`,
      confirmer: "Enregistrer",
    });
    if (!ok) return;
    await enregistrer("plafond", { dailyCallCap: n }, "Plafond enregistré");
  }

  async function basculerFonction(f: Fonctionnalite, active: boolean) {
    if (!donnees) return;
    // Confirmé dans les deux sens : éteindre retire la fonction à tout le
    // monde, allumer engage des appels facturés.
    const ok = await confirmer({
      titre: active ? `Allumer « ${f.label} » ?` : `Éteindre « ${f.label} » ?`,
      message: active ? "La fonction redevient disponible et ses appels comptent dans le plafond quotidien." : "La fonction disparaît pour tous ceux qui s'en servent, jusqu'à ce qu'elle soit rallumée.",
      confirmer: active ? "Allumer" : "Éteindre",
      danger: !active,
    });
    if (!ok) return;
    const eteintes = new Set(donnees.reglages.disabled);
    if (active) eteintes.delete(f.id);
    else eteintes.add(f.id);
    // Le site attend la liste complète des fonctionnalités éteintes, pas un delta.
    await enregistrer(f.id, { disabled: [...eteintes] }, `${f.label} : ${active ? "allumée" : "éteinte"}`);
  }

  // Le site ne rend que les jours où l'IA a servi : on complète les trente
  // jours par des zéros, sinon la courbe relierait deux pics par-dessus
  // une semaine creuse.
  const serie = useMemo(() => {
    const parJour = new Map((donnees?.usage.parJour ?? []).map((p) => [p.day.slice(0, 10), p.calls]));
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10);
      return { date, plays: parJour.get(date) ?? 0 };
    });
  }, [donnees]);

  const libelles = useMemo(() => new Map((donnees?.fonctionnalites ?? []).map((f) => [f.id, f.label])), [donnees]);

  if (!donnees) {
    return (
      <>
        <EnTete titre="Assistance par IA" />
        <Erreur message={erreur} />
        {!erreur && <Chargement />}
      </>
    );
  }

  const { reglages, usage, fonctionnalites } = donnees;
  const cap = reglages.dailyCallCap;
  const part = cap > 0 ? Math.min(1, usage.aujourdhui / cap) : 0;
  const total30 = serie.reduce((s, p) => s + p.plays, 0);

  return (
    <>
      <EnTete
        titre="Assistance par IA"
        texte="Ce que le modèle a le droit de faire, et ce qu'il a coûté sur trente jours."
        action={
          <Bouton variante="trait" onClick={() => setRechargement((v) => v + 1)}>
            <RefreshCw size={14} /> Actualiser
          </Bouton>
        }
      />
      <Erreur message={erreur} />

      {!donnees.cleConfiguree && (
        <div className="animate-monter mb-5 flex items-start gap-3 rounded-2xl border border-attention/40 bg-attention/10 px-4 py-3 text-[13px]">
          <KeyRound size={17} className="mt-0.5 shrink-0 text-attention" />
          <div>
            <div className="font-semibold text-attention">Aucune clé d'API n'est configurée sur le serveur.</div>
            <div className="mt-0.5 text-texte-2">Les réglages ci-dessous s'enregistrent, mais aucune fonctionnalité ne répondra tant que la clé manque dans l'environnement du site.</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        <Carte titre="Réglages généraux" className="animate-monter decale-1 col-span-12 xl:col-span-5">
          <Bascule
            libelle="Assistance par IA"
            aide={reglages.enabled ? "Allumée : chaque fonctionnalité suit sa propre bascule." : "Éteinte : aucune fonctionnalité n'appelle le modèle."}
            valeur={reglages.enabled}
            disabled={enregistrement !== null}
            onChange={(v) => void basculerGeneral(v)}
          />
          <div className="mt-3 border-t border-filet pt-4">
            <div className="flex items-end gap-2">
              <Champ
                libelle="Plafond d'appels par jour"
                aide="0 : pas de plafond. Compté en journée UTC, erreurs comprises."
                className="flex-1"
                type="number"
                min={0}
                max={PLAFOND_MAX}
                step={1}
                value={plafond}
                onChange={(e) => setPlafond(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void enregistrerPlafond()}
              />
              <Bouton className="mb-[22px]" onClick={() => void enregistrerPlafond()} enCours={enregistrement === "plafond"} disabled={plafond.trim() === String(cap)}>
                <Save size={14} /> Enregistrer
              </Bouton>
            </div>
          </div>
          <div className="mt-4 border-t border-filet pt-4">
            <div className="flex items-center justify-between text-[13px]">
              <span className="inline-flex items-center gap-2 text-texte-2">
                <Gauge size={15} /> Aujourd'hui
              </span>
              <span className="font-titre text-[18px] font-semibold tabular-nums">
                {formatNombre(usage.aujourdhui)}
                <span className="text-[13px] font-normal text-texte-3"> / {cap > 0 ? formatNombre(cap) : "sans plafond"}</span>
              </span>
            </div>
            {cap > 0 && (
              <div className="mt-2.5 h-1.5 rounded-full bg-surface-2">
                <div className={clsx("h-1.5 rounded-full transition-[width] duration-300", part >= 1 ? "bg-danger" : part >= 0.8 ? "bg-attention" : "bg-accent")} style={{ width: `${part * 100}%` }} />
              </div>
            )}
            {cap > 0 && part >= 1 && <p className="mt-2 text-[12px] text-danger">Plafond atteint : toutes les fonctionnalités sont suspendues jusqu'à minuit UTC.</p>}
          </div>
        </Carte>

        <Carte
          titre="Appels par jour"
          action={<span className="text-[12px] text-texte-3 tabular-nums">{formatNombre(total30)} sur 30 jours</span>}
          className="animate-monter decale-2 col-span-12 xl:col-span-7"
        >
          <CourbeAire serie={serie} hauteur={250} unite="appels" />
        </Carte>

        <Carte titre="Fonctionnalités" className="animate-monter decale-3 col-span-12" corps="px-5 pt-2 pb-3">
          {fonctionnalites.length === 0 ? (
            <Vide texte="Le site ne déclare aucune fonctionnalité." />
          ) : (
            <ul className="divide-y divide-filet">
              {fonctionnalites.map((f) => {
                const active = !reglages.disabled.includes(f.id);
                return (
                  <li key={f.id} className={clsx("py-1.5", !reglages.enabled && "opacity-60")}>
                    <Bascule libelle={f.label} aide={f.detail} valeur={active} disabled={enregistrement !== null} onChange={(v) => void basculerFonction(f, v)} />
                    <div className="-mt-1 mb-1.5 flex items-center gap-3 text-[11.5px] text-texte-3">
                      <span className="-ml-1.5">{f.niveau === "soigne" ? <Pastille texte="Modèle soigné" ton="accent" /> : <Pastille texte="Modèle rapide" />}</span>
                      <span className="inline-flex items-center gap-1">
                        <Users size={12} /> {ACCES[f.acces] ?? f.acces}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!reglages.enabled && (
            <p className="mt-2 flex items-center gap-2 text-[12px] text-attention">
              <AlertTriangle size={13} /> L'interrupteur général est éteint : ces bascules sont conservées mais sans effet.
            </p>
          )}
        </Carte>

        <div className="animate-monter decale-4 col-span-12">
          <h2 className="mb-3 flex items-center gap-2 font-titre text-[15px] font-semibold">
            <Sparkles size={15} className="text-accent" /> Consommation par fonctionnalité, 30 jours
          </h2>
          {usage.parFonctionnalite.length === 0 ? (
            <div className="rounded-2xl border border-filet bg-surface">
              <Vide texte="Aucun appel sur la période." />
            </div>
          ) : (
            <Table
              entetes={[
                "Fonctionnalité",
                { libelle: "Appels", droite: true, largeur: "110px" },
                { libelle: "Jetons entrée", droite: true, largeur: "140px" },
                { libelle: "Jetons sortie", droite: true, largeur: "140px" },
                { libelle: "Erreurs", droite: true, largeur: "110px" },
              ]}
            >
              {usage.parFonctionnalite.map((l) => (
                <tr key={l.feature}>
                  <td className="font-medium">
                    {libelles.get(l.feature) ?? l.feature}
                    {!libelles.has(l.feature) && <Pastille texte="retirée" />}
                  </td>
                  <td className="text-right font-semibold tabular-nums">{formatNombre(l.calls)}</td>
                  <td className="text-right text-texte-2 tabular-nums">{formatNombre(l.inputTokens)}</td>
                  <td className="text-right text-texte-2 tabular-nums">{formatNombre(l.outputTokens)}</td>
                  <td className={clsx("text-right tabular-nums", l.errors > 0 ? "font-semibold text-danger" : "text-texte-3")}>{formatNombre(l.errors)}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
