import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  Globe2,
  Headphones,
  MapPin,
  LineChart,
  Monitor,
  RefreshCw,
  Repeat,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api";
import { Bouton, Carte, Chargement, EnTete, Erreur, Pastille, Vide, formatNombre } from "../composants";
import { MiniCourbe } from "../graphiques";
import { annoncer, confirmer } from "../interactions";
import clsx from "../clsx";

interface Audience {
  ecoutes?: number;
  auditeurs?: number;
  tauxCompletion?: number;
  parAuditeur?: number;
  partAnonyme?: number;
}
interface Mouvement {
  id: string;
  nom: string;
  ecoutes: number;
  ecoutesAvant: number;
  progression: number;
}
interface Rapport {
  fenetre?: { libelle?: string };
  audience?: Audience;
  audiencePrecedente?: Audience;
  comportement?: { parHeure?: number[]; parAppareil?: { appareil: string; ecoutes: number }[]; tauxAbandon?: number; auditeursDUnSeulTitre?: number };
  catalogue?: { titresPublies?: number; sortiesDeLaPeriode?: number; jamaisEcoutes?: number; artistes?: number; nouveauxMembres?: number };
  artistes?: { montent?: Mouvement[]; decrochent?: Mouvement[] };
  genres?: { genre: string; ecoutes: number; ecoutesAvant: number; progression: number }[];
  cohortes?: { semaine: string; arrivants: number; retours: (number | null)[]; suffisante: boolean }[];
  anomalies?: { type: string; constat: string; detail: string; intensite: number }[];
  prevision?: { historique?: number[]; estimation: number; bas: number; haut: number; penteHebdo: number } | null;
  titresQuiMontent?: { id: string; titre: string; artiste: string; trajectoire?: number[] }[];
}
interface Analyse {
  lecture: string;
  aRegarder?: string[];
  parIA: boolean;
}
interface Pays {
  days: number;
  total: number;
  countries: { code: string | null; plays: number; listeners: number; share: number }[];
}

// Les taux du rapport sont des fractions (0,42), pas des pourcentages.
const pourcent = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? `${Math.round(v * 100)} %` : "—");
const decimal = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—");

/** Variation relative entre deux périodes, ou null quand il n'y a rien à comparer. */
function variation(actuel: number | undefined, avant: number | undefined): number | null {
  if (typeof actuel !== "number" || typeof avant !== "number" || avant <= 0) return null;
  return Math.round(((actuel - avant) / avant) * 100);
}
/** Écart en points, pour les taux : « +12 % » d'un taux de 5 % ne dit rien d'utile. */
function ecartPoints(actuel: number | undefined, avant: number | undefined): number | null {
  if (typeof actuel !== "number" || typeof avant !== "number" || avant <= 0) return null;
  return Math.round((actuel - avant) * 100);
}

const nomsPays = new Intl.DisplayNames(["fr"], { type: "region" });
const nomPays = (code: string | null) => {
  if (!code) return "Inconnu";
  try {
    return nomsPays.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};

const NOMS_APPAREILS: Record<string, string> = { web: "Navigateur", android: "Android", ios: "iOS", desktop: "Ordinateur", mobile: "Mobile", inconnu: "Non déclaré" };

/**
 * Le rapport d'exploitation de la semaine : chiffres recalculés par le site
 * à chaque ouverture (GET), lecture par IA à la demande seulement (POST),
 * parce qu'elle coûte un appel et compte contre le plafond du jour.
 */
export function Analyses() {
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lecture, setLecture] = useState(false);
  const [rechargement, setRechargement] = useState(0);

  useEffect(() => {
    setRapport(null);
    setErreur(null);
    api<{ rapport: Rapport; analyse: Analyse | null }>("/api/admin/insights")
      .then((r) => {
        setRapport(r.rapport ?? {});
        setAnalyse(r.analyse ?? null);
      })
      .catch((e: Error) => setErreur(e.message));
  }, [rechargement]);

  async function demanderLecture() {
    const ok = await confirmer({
      titre: analyse ? "Relire la semaine ?" : "Faire lire la semaine ?",
      message: "Le site recalcule le rapport et demande au modèle une lecture en quelques phrases. Cela coûte un appel d'IA, compté dans le plafond du jour. L'IA n'écrit aucun chiffre : ceux qui comptent restent ceux des panneaux.",
      confirmer: "Lancer la lecture",
    });
    if (!ok) return;
    setLecture(true);
    setErreur(null);
    try {
      // POST sans corps : `methode` explicite, sinon l'appel partirait en GET.
      const r = await api<{ rapport: Rapport; analyse: Analyse }>("/api/admin/insights", { methode: "POST" });
      setRapport(r.rapport ?? {});
      setAnalyse(r.analyse ?? null);
      annoncer(r.analyse?.parIA ? "Lecture ajoutée" : "L'IA n'était pas disponible");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "La lecture a échoué.");
    } finally {
      setLecture(false);
    }
  }

  const entete = (
    <EnTete
      titre="Analyses"
      texte={rapport?.fenetre?.libelle ? `Semaine ${rapport.fenetre.libelle}. Sept jours pleins, journée en cours exclue.` : "Le rapport d'exploitation de la semaine."}
      action={
        <>
          <Bouton variante="trait" onClick={() => setRechargement((v) => v + 1)} disabled={!rapport || lecture}>
            <RefreshCw size={14} /> Recalculer
          </Bouton>
          <Bouton onClick={() => void demanderLecture()} enCours={lecture} disabled={!rapport}>
            {!lecture && <Sparkles size={14} />} {analyse ? "Relire la semaine" : "Faire lire la semaine"}
          </Bouton>
        </>
      }
    />
  );

  if (!rapport) {
    return (
      <>
        {entete}
        <Erreur message={erreur} />
        {!erreur && <Chargement texte="Calcul du rapport" />}
        <PanneauPays className="mt-5" />
      </>
    );
  }

  const a = rapport.audience ?? {};
  const p = rapport.audiencePrecedente ?? {};
  const comp = rapport.comportement ?? {};
  const cat = rapport.catalogue ?? {};
  const anomalies = rapport.anomalies ?? [];
  const titres = rapport.titresQuiMontent ?? [];

  return (
    <>
      {entete}
      <Erreur message={erreur} />

      <div className="mb-5 grid grid-cols-2 gap-5 xl:grid-cols-4">
        <Tuile className="decale-1" icone={Headphones} libelle="Écoutes" valeur={formatNombre(a.ecoutes)} avant={formatNombre(p.ecoutes)} ecart={variation(a.ecoutes, p.ecoutes)} />
        <Tuile className="decale-2" icone={Users} libelle="Auditeurs identifiés" valeur={formatNombre(a.auditeurs)} avant={formatNombre(p.auditeurs)} ecart={variation(a.auditeurs, p.auditeurs)} />
        <Tuile className="decale-3" icone={Repeat} libelle="Écoutes menées au bout" valeur={pourcent(a.tauxCompletion)} avant={pourcent(p.tauxCompletion)} ecart={ecartPoints(a.tauxCompletion, p.tauxCompletion)} points />
        <Tuile className="decale-4" icone={UserRound} libelle="Écoutes par auditeur" valeur={decimal(a.parAuditeur)} avant={decimal(p.parAuditeur)} ecart={variation(a.parAuditeur, p.parAuditeur)} />
      </div>

      <div className="grid grid-cols-12 gap-5">
        <Carte
          titre={
            <span className="inline-flex items-center gap-2">
              <Sparkles size={15} className="text-accent" /> Lecture de la semaine
              {analyse?.parIA && <Pastille texte="IA" ton="accent" />}
            </span>
          }
          className="animate-monter decale-2 col-span-12 xl:col-span-7"
        >
          {analyse ? (
            <>
              <p className="text-[13.5px] leading-relaxed" data-selectionnable>
                {analyse.lecture}
              </p>
              {(analyse.aRegarder ?? []).length > 0 && (
                <>
                  <h3 className="mt-4 text-[11px] font-semibold tracking-wide text-texte-3 uppercase">À regarder</h3>
                  <ul className="mt-2 space-y-1.5">
                    {(analyse.aRegarder ?? []).map((point) => (
                      <li key={point} className="flex gap-2 text-[13px] text-texte-2" data-selectionnable>
                        <ArrowRight size={14} className="mt-0.5 shrink-0 text-accent" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-4 border-t border-filet pt-3 text-[12px] text-texte-3">
                {analyse.parIA ? "Rédigée par l'IA à partir des mesures de cette page. Elle n'écrit aucun chiffre." : "L'IA n'était pas disponible lors de la dernière demande : les mesures restent complètes."}
              </p>
            </>
          ) : (
            <p className="py-6 text-[13px] text-texte-3">Pas encore de lecture pour cette semaine. « Faire lire la semaine » en demande une, au prix d'un appel d'IA.</p>
          )}
        </Carte>

        <Carte titre="Semaine à venir" className="animate-monter decale-3 col-span-12 xl:col-span-5">
          {rapport.prevision ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-titre text-[28px] leading-none font-semibold tabular-nums">{formatNombre(Math.round(rapport.prevision.estimation))}</span>
                <span className="text-[13px] text-texte-3">écoutes estimées</span>
              </div>
              <p className="mt-1.5 text-[13px] text-texte-2 tabular-nums">
                Fourchette : {formatNombre(Math.round(rapport.prevision.bas))} à {formatNombre(Math.round(rapport.prevision.haut))}
              </p>
              {(rapport.prevision.historique ?? []).length > 1 && (
                <div className="mt-4">
                  <MiniCourbe valeurs={[...(rapport.prevision.historique ?? []), rapport.prevision.estimation]} couleur="var(--accent)" hauteur={56} />
                </div>
              )}
              <p className="mt-3 text-[12px] text-texte-3">
                Prolongement des {formatNombre(rapport.prevision.historique?.length)} dernières semaines
                {rapport.prevision.penteHebdo > 0 ? ", orienté à la hausse" : rapport.prevision.penteHebdo < 0 ? ", orienté à la baisse" : ", à plat"}. Une sortie, une panne ou une campagne
                le rendent caduc.
              </p>
            </>
          ) : (
            <p className="py-6 text-[13px] text-texte-3">Pas assez d'historique : il faut au moins quatre semaines pleines pour dégager une tendance.</p>
          )}
        </Carte>

        {anomalies.length > 0 && (
          <Carte
            titre={
              <span className="inline-flex items-center gap-2">
                <AlertTriangle size={15} className="text-attention" /> {anomalies.length} point{anomalies.length > 1 ? "s" : ""} d'attention
              </span>
            }
            className="animate-monter decale-3 col-span-12"
          >
            <ul className="divide-y divide-filet">
              {anomalies.map((x) => (
                <li key={x.constat} className="flex items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{x.constat}</div>
                    <div className="mt-0.5 text-[12px] text-texte-3">{x.detail}</div>
                  </div>
                  <IntensiteAnomalie type={x.type} intensite={x.intensite} />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-texte-3">Des constats, pas des verdicts : rien n'a été masqué ni suspendu.</p>
          </Carte>
        )}

        <Carte titre="Écoutes par heure (UTC)" className="animate-monter decale-4 col-span-12 xl:col-span-8">
          <Heures valeurs={comp.parHeure ?? []} />
          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-filet pt-4 text-[13px]">
            <Chiffre libelle="Coupées avant le quart" valeur={pourcent(comp.tauxAbandon)} />
            <Chiffre libelle="Auditeurs d'un seul titre" valeur={formatNombre(comp.auditeursDUnSeulTitre)} />
            <Chiffre libelle="Écoutes sans compte" valeur={pourcent(a.partAnonyme)} />
          </div>
        </Carte>

        <Carte titre="Appareils" className="animate-monter decale-4 col-span-12 xl:col-span-4">
          <Repartition lignes={(comp.parAppareil ?? []).map((x) => ({ cle: x.appareil, libelle: NOMS_APPAREILS[x.appareil?.toLowerCase()] ?? x.appareil, valeur: x.ecoutes }))} icone={Monitor} vide="Aucune écoute sur la période." />
        </Carte>

        <Carte titre="Catalogue" className="animate-monter decale-5 col-span-12 xl:col-span-4">
          <dl className="divide-y divide-filet text-[13px]">
            {(
              [
                ["Titres publiés", cat.titresPublies],
                ["Sortis cette semaine", cat.sortiesDeLaPeriode],
                ["Jamais écoutés", cat.jamaisEcoutes],
                ["Artistes", cat.artistes],
                ["Nouveaux membres", cat.nouveauxMembres],
              ] as const
            ).map(([l, v]) => (
              <div key={l} className="flex items-center justify-between py-2">
                <dt className="text-texte-2">{l}</dt>
                <dd className="font-semibold tabular-nums">{formatNombre(v)}</dd>
              </div>
            ))}
          </dl>
        </Carte>

        <Carte titre="Artistes en progression" className="animate-monter decale-5 col-span-12 md:col-span-6 xl:col-span-4">
          <ListeMouvements lignes={rapport.artistes?.montent ?? []} />
        </Carte>
        <Carte titre="Artistes en recul" className="animate-monter decale-5 col-span-12 md:col-span-6 xl:col-span-4">
          <ListeMouvements lignes={rapport.artistes?.decrochent ?? []} />
        </Carte>

        <Carte titre="Genres" className="animate-monter decale-6 col-span-12 xl:col-span-5">
          {(rapport.genres ?? []).length === 0 ? (
            <Vide texte="Aucune écoute sur la période." />
          ) : (
            <table className="w-full text-[13px]">
              <thead className="text-[11px] tracking-wide text-texte-3 uppercase">
                <tr>
                  <th className="pb-2 text-left font-semibold">Genre</th>
                  <th className="pb-2 text-right font-semibold">Avant</th>
                  <th className="pb-2 text-right font-semibold">Semaine</th>
                  <th className="pb-2 text-right font-semibold">Mouvement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-filet">
                {(rapport.genres ?? []).map((g) => (
                  <tr key={g.genre}>
                    <td className="py-2 pr-3 font-medium">{g.genre}</td>
                    <td className="py-2 text-right text-texte-3 tabular-nums">{formatNombre(g.ecoutesAvant)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{formatNombre(g.ecoutes)}</td>
                    <td className="py-2 text-right">
                      <Progression ratio={g.progression} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[12px] text-texte-3">Mouvement lissé : passer de 1 à 6 écoutes n'affiche pas +500 %.</p>
        </Carte>

        <Carte titre="Rétention par cohortes" className="animate-monter decale-6 col-span-12 xl:col-span-7">
          {(rapport.cohortes ?? []).length === 0 ? (
            <Vide texte="Pas encore de cohorte mesurable." />
          ) : (
            <table className="w-full text-[13px]">
              <thead className="text-[11px] tracking-wide text-texte-3 uppercase">
                <tr>
                  <th className="pb-2 text-left font-semibold">Arrivés la semaine du</th>
                  <th className="pb-2 text-right font-semibold">Nombre</th>
                  <th className="pb-2 text-right font-semibold">+1 sem.</th>
                  <th className="pb-2 text-right font-semibold">+2 sem.</th>
                  <th className="pb-2 text-right font-semibold">+3 sem.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-filet">
                {(rapport.cohortes ?? []).map((c) => (
                  <tr key={c.semaine}>
                    <td className="py-2 pr-3">{c.semaine}</td>
                    <td className="py-2 text-right text-texte-2 tabular-nums">{formatNombre(c.arrivants)}</td>
                    {[0, 1, 2].map((i) => {
                      const r = c.retours?.[i];
                      return (
                        <td key={i} className="py-2 text-right tabular-nums">
                          {r === null || r === undefined ? (
                            <span className="text-[12px] text-texte-3">à venir</span>
                          ) : !c.suffisante ? (
                            <span className="text-[12px] text-texte-3">trop peu</span>
                          ) : (
                            <span className="inline-block min-w-12 rounded-md px-1.5 py-0.5 font-semibold" style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(Math.min(1, r) * 45)}%, transparent)` }}>
                              {pourcent(r)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[12px] text-texte-3">Part des nouveaux auditeurs qui reviennent les semaines suivantes. « Trop peu » : moins de cinq personnes, un pourcentage n'y voudrait rien dire.</p>
        </Carte>

        {titres.length > 0 && (
          <Carte titre="Titres en progression continue" className="animate-monter decale-6 col-span-12">
            <p className="-mt-1 mb-3 text-[12px] text-texte-3">L'écoute monte trois semaines de suite. Une trajectoire, pas une promesse.</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {titres.map((t) => (
                <div key={t.id} className="rounded-xl border border-filet px-3.5 py-3">
                  <div className="truncate text-[13px] font-semibold">{t.titre}</div>
                  <div className="truncate text-[12px] text-texte-3">{t.artiste}</div>
                  <div className="mt-2">
                    <MiniCourbe valeurs={t.trajectoire ?? []} couleur="var(--succes)" hauteur={36} />
                  </div>
                  <div className="mt-1 text-[11.5px] text-texte-3 tabular-nums">{(t.trajectoire ?? []).map((n) => formatNombre(n)).join("  ›  ")}</div>
                </div>
              ))}
            </div>
          </Carte>
        )}
      </div>

      <PanneauPays className="mt-5" />
    </>
  );
}

function Tuile({ icone: Icone, libelle, valeur, avant, ecart, points, className }: { icone: LucideIcon; libelle: string; valeur: string; avant: string; ecart: number | null; points?: boolean; className?: string }) {
  return (
    <div className={clsx("animate-monter rounded-2xl border border-filet bg-surface p-5", className)}>
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/12 text-accent">
          <Icone size={19} />
        </span>
        {ecart !== null && (
          <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums", ecart >= 0 ? "bg-succes/12 text-succes" : "bg-danger/12 text-danger")} title="Par rapport à la semaine précédente">
            {ecart >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {ecart > 0 ? "+" : ""}
            {ecart.toLocaleString("fr-FR")} {points ? "pts" : "%"}
          </span>
        )}
      </div>
      <div className="mt-4 font-titre text-[26px] leading-none font-semibold tabular-nums">{valeur}</div>
      <div className="mt-1.5 text-[13px] text-texte-2">{libelle}</div>
      <div className="mt-0.5 text-[12px] text-texte-3 tabular-nums">Semaine précédente : {avant}</div>
    </div>
  );
}

function Chiffre({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div>
      <div className="font-titre text-[18px] font-semibold tabular-nums">{valeur}</div>
      <div className="mt-0.5 text-[12px] text-texte-3">{libelle}</div>
    </div>
  );
}

/** Les vingt-quatre tranches horaires en colonnes, avec la valeur au survol. */
function Heures({ valeurs }: { valeurs: number[] }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const serie = Array.from({ length: 24 }, (_, i) => valeurs[i] ?? 0);
  const max = Math.max(1, ...serie);
  const total = serie.reduce((s, v) => s + v, 0);
  if (total === 0) return <Vide texte="Aucune écoute sur la période." />;
  return (
    <div>
      <div className="mb-2 h-5 text-[12px] text-texte-2 tabular-nums">
        {survol !== null ? (
          <>
            <span className="font-semibold text-texte">
              {String(survol).padStart(2, "0")} h – {String((survol + 1) % 24).padStart(2, "0")} h
            </span>{" "}
            : {formatNombre(serie[survol])} écoutes ({Math.round((serie[survol] / total) * 100)} %)
          </>
        ) : (
          <span className="text-texte-3">Survolez une colonne pour le détail.</span>
        )}
      </div>
      <div className="flex h-40 items-end gap-[3px] border-b border-filet" onMouseLeave={() => setSurvol(null)}>
        {serie.map((v, i) => (
          <div key={i} className="flex h-full flex-1 items-end" onMouseEnter={() => setSurvol(i)}>
            <div
              className={clsx("w-full rounded-t-[3px] transition-colors", survol === i ? "bg-accent" : "bg-accent/55")}
              style={{ height: `${Math.max(v > 0 ? 2 : 0, (v / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex text-[11px] text-texte-3 tabular-nums">
        {serie.map((_, i) => (
          <span key={i} className="flex-1 text-center">
            {i % 3 === 0 ? `${i} h` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Une liste de parts en barres horizontales : plus lisible qu'un anneau au-delà de quatre parts. */
function Repartition({ lignes, icone: Icone, vide }: { lignes: { cle: string; libelle: string; valeur: number }[]; icone: LucideIcon; vide: string }) {
  const total = lignes.reduce((s, l) => s + (l.valeur ?? 0), 0);
  if (total === 0) return <Vide texte={vide} />;
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  return (
    <ul className="space-y-3">
      {[...lignes]
        .sort((a, b) => b.valeur - a.valeur)
        .map((l) => (
          <li key={l.cle}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span className="inline-flex items-center gap-2 text-texte-2">
                <Icone size={13} className="text-texte-3" /> {l.libelle}
              </span>
              <span className="tabular-nums">
                <span className="font-semibold">{formatNombre(l.valeur)}</span>
                <span className="ml-2 text-[12px] text-texte-3">{Math.round((l.valeur / total) * 100)} %</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-2">
              <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(l.valeur / max) * 100}%` }} />
            </div>
          </li>
        ))}
    </ul>
  );
}

/** La progression du rapport est un ratio lissé (1,3 = +30 %). */
function Progression({ ratio }: { ratio: number }) {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) return <span className="text-texte-3">—</span>;
  const pct = Math.round((ratio - 1) * 100);
  if (pct === 0) return <span className="text-[12px] text-texte-3">stable</span>;
  return (
    <span className={clsx("inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums", pct > 0 ? "text-succes" : "text-danger")}>
      {pct > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {pct > 0 ? "+" : ""}
      {pct} %
    </span>
  );
}

function ListeMouvements({ lignes }: { lignes: Mouvement[] }) {
  if (lignes.length === 0) return <p className="py-4 text-[13px] text-texte-3">Rien de net cette semaine : il faut un socle d'écoutes suffisant pour qu'un mouvement compte.</p>;
  return (
    <ul className="divide-y divide-filet">
      {lignes.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
          <span className="min-w-0 truncate font-medium">{m.nom}</span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="text-[12px] text-texte-3 tabular-nums">
              {formatNombre(m.ecoutesAvant)} › {formatNombre(m.ecoutes)}
            </span>
            <Progression ratio={m.progression} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Le ton d'une anomalie. L'intensité n'a pas la même échelle selon le
 * type : un écart en sigmas pour une journée, une part d'écoutes (0 à 1)
 * pour un titre porté par un seul auditeur.
 */
function IntensiteAnomalie({ type, intensite }: { type: string; intensite: number }) {
  const forte = type === "titre_mono_auditeur" ? intensite >= 0.95 : intensite >= 5;
  const texte = type === "titre_mono_auditeur" ? `${Math.round(intensite * 100)} % d'un auditeur` : `écart ${decimal(intensite)}`;
  return <Pastille texte={texte} ton={forte ? "danger" : "attention"} />;
}

const PERIODES = [7, 30, 90] as const;

/** Les écoutes par pays : indépendantes du rapport, avec leur propre période. */
function PanneauPays({ className }: { className?: string }) {
  const [jours, setJours] = useState<(typeof PERIODES)[number]>(7);
  const [pays, setPays] = useState<Pays | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setPays(null);
    setErreur(null);
    api<Pays>(`/api/admin/stats/countries?days=${jours}`)
      .then((r) => setPays({ ...r, countries: r.countries ?? [] }))
      .catch((e: Error) => setErreur(e.message));
  }, [jours]);

  const maxPart = Math.max(1, ...(pays?.countries.map((c) => c.share) ?? [1]));
  const selecteur: ReactNode = (
    <div className="flex rounded-lg border border-filet bg-surface p-0.5">
      {PERIODES.map((p) => (
        <button
          key={p}
          onClick={() => setJours(p)}
          className={clsx("rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors", jours === p ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte")}
        >
          {p} jours
        </button>
      ))}
    </div>
  );

  return (
    <Carte
      titre={
        <span className="inline-flex items-center gap-2">
          <Globe2 size={15} className="text-accent" /> Écoutes par pays
        </span>
      }
      action={selecteur}
      className={clsx("animate-monter decale-6", className)}
    >
      <Erreur message={erreur} />
      {!pays && !erreur ? (
        <div className="h-[220px] animate-pulse rounded-xl bg-surface-2/60" />
      ) : pays && pays.countries.length === 0 ? (
        <Vide texte="Aucune écoute sur la période." />
      ) : pays ? (
        <>
          <div className="mb-3 flex items-center gap-4 text-[12.5px] text-texte-2">
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange size={13} /> {formatNombre(pays.days)} jours
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Headphones size={13} /> {formatNombre(pays.total)} écoutes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={13} /> {formatNombre(pays.countries.filter((c) => c.code).length)} pays
            </span>
          </div>
          <table className="w-full text-[13px]">
            <thead className="text-[11px] tracking-wide text-texte-3 uppercase">
              <tr>
                <th className="pb-2 text-left font-semibold">Pays</th>
                <th className="w-[40%] pb-2 text-left font-semibold">Part</th>
                <th className="pb-2 text-right font-semibold">Écoutes</th>
                <th className="pb-2 text-right font-semibold">Auditeurs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-filet">
              {pays.countries.map((c) => (
                <tr key={c.code ?? "inconnu"}>
                  <td className="py-2 pr-3">
                    <span className="mr-2 inline-block w-7 rounded bg-surface-2 py-0.5 text-center text-[10.5px] font-bold text-texte-2">{c.code ?? "?"}</span>
                    <span className={c.code ? "font-medium" : "text-texte-3"}>{nomPays(c.code)}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 flex-1 rounded-full bg-surface-2">
                        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(c.share / maxPart) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right text-[12px] text-texte-2 tabular-nums">{c.share.toLocaleString("fr-FR")} %</span>
                    </div>
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">{formatNombre(c.plays)}</td>
                  <td className="py-2 text-right text-texte-2 tabular-nums">{formatNombre(c.listeners)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-texte-3">
            <LineChart size={12} /> Auditeurs : comptes connectés distincts. Les écoutes anonymes comptent dans le total.
          </p>
        </>
      ) : null}
    </Carte>
  );
}
