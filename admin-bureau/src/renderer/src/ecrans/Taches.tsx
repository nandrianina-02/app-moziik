import { useEffect, useState, useSyncExternalStore } from "react";
import { AlarmClock, CheckCircle2, Clock, Play, RefreshCw, ShieldAlert, Timer, XCircle } from "lucide-react";
import { api } from "../api";
import { Barres, Bouton, Carte, Chargement, EnTete, Erreur, Pastille, Selection, Vide, formatNombre } from "../composants";
import { annoncer, confirmer } from "../interactions";
import clsx from "../clsx";

interface Tache {
  id: string;
  titre: string;
  resume: string;
  enjeu: string;
  horaire: string;
  rejouable: boolean;
  parUnivers?: boolean;
}

interface Resultat {
  tache: string;
  ok: boolean;
  statut: number;
  dureeMs: number;
  resultat: unknown;
  /** Heure de fin, pour situer le résultat quand on revient sur l'écran. */
  fini: number;
  /** Message d'échec de l'appel lui-même (réseau, droits), distinct d'un échec de la tâche. */
  erreurAppel?: string;
}

type Univers = "general" | "christian";

/*
 * Une tâche peut durer jusqu'à cinq minutes : on garde son état hors du
 * composant, au niveau du module. Quitter l'écran pendant l'exécution ne
 * perd ni l'indicateur ni le résultat, qui s'affichent au retour.
 */
const etat = {
  enCours: new Map<string, number>(),
  resultats: new Map<string, Resultat>(),
};
let version = 0;
const abonnes = new Set<() => void>();
const publier = () => {
  version++;
  abonnes.forEach((f) => f());
};
const sAbonner = (f: () => void) => {
  abonnes.add(f);
  return () => abonnes.delete(f);
};
const useEtatTaches = () => useSyncExternalStore(sAbonner, () => version);

async function executer(tache: Tache, univers?: Univers) {
  etat.enCours.set(tache.id, Date.now());
  publier();
  try {
    // Pas de délai imposé côté client : le serveur attend la fin réelle du
    // traitement, et l'interrompre ici laisserait croire à un échec alors
    // que la tâche continue de tourner.
    const r = await api<Omit<Resultat, "fini">>("/api/admin/crons", { methode: "POST", corps: univers ? { tache: tache.id, univers } : { tache: tache.id } });
    etat.resultats.set(tache.id, { ...r, fini: Date.now() });
    annoncer(r.ok ? `« ${tache.titre} » terminée` : `« ${tache.titre} » : statut ${r.statut}`);
  } catch (e) {
    const debut = etat.enCours.get(tache.id) ?? Date.now();
    etat.resultats.set(tache.id, {
      tache: tache.id,
      ok: false,
      statut: 0,
      dureeMs: Date.now() - debut,
      resultat: null,
      fini: Date.now(),
      erreurAppel: e instanceof Error ? e.message : "Lancement impossible.",
    });
  } finally {
    etat.enCours.delete(tache.id);
    publier();
  }
}

const formatDuree = (ms: number) => {
  const s = Math.round(ms / 1000);
  if (s < 1) return `${formatNombre(ms)} ms`;
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
};

const heure = (t: number) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * Les tâches planifiées, lancées à la main. Le catalogue vient du site
 * (/api/admin/crons) : l'écran ne sait rien d'elles, il affiche ce que le
 * serveur exécutera vraiment, avec le même traitement que la nuit.
 */
export function Taches() {
  const [taches, setTaches] = useState<Tache[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rechargement, setRechargement] = useState(0);
  useEtatTaches();

  useEffect(() => {
    setErreur(null);
    api<{ taches?: Tache[] }>("/api/admin/crons")
      .then((r) => setTaches(r.taches ?? []))
      .catch((e: Error) => setErreur(e.message));
  }, [rechargement]);

  const actives = etat.enCours.size;

  return (
    <>
      <EnTete
        titre="Tâches planifiées"
        texte={actives > 0 ? `${actives} tâche${actives > 1 ? "s" : ""} en cours. L'écran reste utilisable pendant l'exécution.` : "Relancer à la main un traitement de l'ordonnanceur, après un incident par exemple."}
        action={
          <Bouton variante="trait" onClick={() => setRechargement((v) => v + 1)}>
            <RefreshCw size={14} /> Actualiser
          </Bouton>
        }
      />
      <Erreur message={erreur} />
      {!taches && !erreur ? (
        <Chargement />
      ) : taches && taches.length === 0 ? (
        <Vide texte="Aucune tâche déclarée par le site." />
      ) : taches ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {taches.map((t, i) => (
            <CarteTache key={t.id} tache={t} className={i < 6 ? `decale-${i + 1}` : undefined} />
          ))}
        </div>
      ) : null}
    </>
  );
}

function CarteTache({ tache, className }: { tache: Tache; className?: string }) {
  const [univers, setUnivers] = useState<"" | Univers>("");
  const debut = etat.enCours.get(tache.id);
  const resultat = etat.resultats.get(tache.id);
  const enCours = debut !== undefined;

  // Le chronomètre ne tourne que pendant l'exécution : une seconde suffit,
  // c'est une indication de patience, pas une mesure.
  const [, setTic] = useState(0);
  useEffect(() => {
    if (!enCours) return;
    const t = setInterval(() => setTic((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [enCours]);

  async function lancer() {
    const portee = tache.parUnivers ? (univers === "general" ? " pour l'univers Général" : univers === "christian" ? " pour l'univers Évangélique" : " pour les deux univers") : "";
    const ok = await confirmer({
      titre: `Lancer « ${tache.titre} » ?`,
      message: (
        <>
          <p>
            {tache.resume}
            {portee && ` Portée : ${portee.trim()}.`}
          </p>
          <p className="mt-2">Le traitement est exactement celui de l'ordonnanceur. Il peut durer plusieurs minutes ; l'écran reste utilisable en attendant.</p>
          {!tache.rejouable && <p className="mt-2 text-attention">Cette tâche n'est pas faite pour être relancée deux fois de suite : une seconde exécution rapprochée sera refusée.</p>}
        </>
      ),
      confirmer: "Lancer",
      danger: !tache.rejouable,
    });
    if (!ok) return;
    await executer(tache, tache.parUnivers && univers ? univers : undefined);
  }

  return (
    <Carte className={clsx("animate-monter", className)} corps="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-titre text-[15px] font-semibold">{tache.titre}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-texte-2">{tache.resume}</p>
        </div>
        {tache.rejouable ? <Pastille texte="Rejouable" ton="succes" /> : <Pastille texte="Une fois à la fois" ton="attention" />}
      </div>

      <dl className="mt-4 space-y-2 border-t border-filet pt-3 text-[12.5px]">
        <div className="flex gap-2.5">
          <dt className="mt-0.5 text-texte-3" title="Horaire attendu chez l'ordonnanceur">
            <AlarmClock size={14} />
          </dt>
          <dd className="text-texte-2">{tache.horaire}</dd>
        </div>
        <div className="flex gap-2.5">
          <dt className="mt-0.5 text-texte-3" title="Si elle ne tourne pas">
            <ShieldAlert size={14} />
          </dt>
          <dd className="text-texte-2">{tache.enjeu}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        {tache.parUnivers && (
          <Selection libelle="Univers" className="w-56" value={univers} disabled={enCours} onChange={(e) => setUnivers(e.target.value as "" | Univers)}>
            <option value="">Les deux univers</option>
            <option value="general">Général</option>
            <option value="christian">Évangélique</option>
          </Selection>
        )}
        <Bouton onClick={() => void lancer()} disabled={enCours}>
          <Play size={14} /> Lancer
        </Bouton>
        {enCours && (
          <span className="animate-paraitre inline-flex h-9 items-center gap-2.5 text-[12.5px] text-texte-2 tabular-nums">
            <Barres taille={14} /> En cours depuis {formatDuree(Date.now() - debut)}
          </span>
        )}
      </div>

      {resultat && !enCours && <DernierResultat r={resultat} />}
    </Carte>
  );
}

function DernierResultat({ r }: { r: Resultat }) {
  const texte = r.erreurAppel ?? (r.resultat === null || r.resultat === undefined ? "Aucun contenu renvoyé." : JSON.stringify(r.resultat, null, 2));
  return (
    <div className="animate-paraitre mt-4 rounded-xl border border-filet bg-surface-2/50">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-filet px-3.5 py-2 text-[12.5px]">
        <span className={clsx("inline-flex items-center gap-1.5 font-semibold", r.ok ? "text-succes" : "text-danger")}>
          {r.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {r.ok ? "Réussie" : r.erreurAppel ? "Appel impossible" : "Échec"}
        </span>
        {r.statut > 0 && <span className="text-texte-3 tabular-nums">Statut {r.statut}</span>}
        <span className="inline-flex items-center gap-1 text-texte-3 tabular-nums">
          <Timer size={13} /> {formatDuree(r.dureeMs)}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-texte-3 tabular-nums">
          <Clock size={13} /> {heure(r.fini)}
        </span>
      </div>
      <pre data-selectionnable className="max-h-64 overflow-auto px-3.5 py-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-texte-2">
        {texte}
      </pre>
    </div>
  );
}
