import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, BadgeCheck, Disc3, Headphones, Mic2, Minus, Music, Sparkles, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { api } from "../api";
import { adresseImage } from "../session";
import { Chargement, EnTete, Erreur, Table, Vide, formatNombre } from "../composants";
import clsx from "../clsx";

type Type = "songs" | "artists" | "albums";
type Periode = "day" | "week" | "month" | "year" | "all";
type Univers = "general" | "christian";

interface Ligne {
  _id: string;
  rank: number;
  evolution: number | null;
  plays: number;
  title?: string;
  stageName?: string;
  artistName?: string;
  coverUrl?: string;
  verified?: boolean;
}

interface Reponse {
  ranking: Ligne[];
  totalPlays: number;
  trendPct: number | null;
}

const TYPES: { cle: Type; libelle: string; icone: LucideIcon }[] = [
  { cle: "songs", libelle: "Titres", icone: Music },
  { cle: "artists", libelle: "Artistes", icone: Mic2 },
  { cle: "albums", libelle: "Albums", icone: Disc3 },
];

const PERIODES: { cle: Periode; libelle: string }[] = [
  { cle: "day", libelle: "24 h" },
  { cle: "week", libelle: "7 jours" },
  { cle: "month", libelle: "30 jours" },
  { cle: "year", libelle: "12 mois" },
  { cle: "all", libelle: "Depuis le début" },
];

/**
 * Les classements du site, tels que le public les voit (/api/charts) :
 * écoutes complètes seulement, par univers. L'évolution compare au rang
 * de la fenêtre précédente de même durée.
 */
export function Classements() {
  const [type, setType] = useState<Type>("songs");
  const [periode, setPeriode] = useState<Periode>("week");
  const [univers, setUnivers] = useState<Univers>("general");
  const [reponse, setReponse] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setReponse(null);
    setErreur(null);
    api<Reponse>(`/api/charts?type=${type}&period=${periode}&univers=${univers}`)
      .then((r) => setReponse({ ...r, ranking: r.ranking ?? [], trendPct: r.trendPct ?? null }))
      .catch((e: Error) => setErreur(e.message));
  }, [type, periode, univers]);

  return (
    <>
      <EnTete titre="Classements" texte="Les écoutes complètes, comme les classements publics du site." />

      <div className="animate-monter decale-1 mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.cle}
              onClick={() => setType(t.cle)}
              className={clsx(
                "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold transition-colors",
                type === t.cle ? "bg-accent text-sur-accent" : "border border-filet bg-surface text-texte-2 hover:text-texte",
              )}
            >
              <t.icone size={15} /> {t.libelle}
            </button>
          ))}
        </div>
        <span className="h-6 w-px bg-filet" />
        <div className="flex rounded-lg border border-filet bg-surface p-0.5">
          {PERIODES.map((p) => (
            <button
              key={p.cle}
              onClick={() => setPeriode(p.cle)}
              className={clsx("rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors", periode === p.cle ? "bg-surface-2 text-texte" : "text-texte-3 hover:text-texte")}
            >
              {p.libelle}
            </button>
          ))}
        </div>
        <div className="ml-auto flex rounded-lg border border-filet bg-surface p-0.5">
          {(["general", "christian"] as Univers[]).map((u) => (
            <button
              key={u}
              onClick={() => setUnivers(u)}
              className={clsx("rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors", univers === u ? "bg-surface-2 text-texte" : "text-texte-3 hover:text-texte")}
            >
              {u === "general" ? "Général" : "Gospel"}
            </button>
          ))}
        </div>
      </div>

      <Erreur message={erreur} />
      {!reponse && !erreur ? (
        <Chargement />
      ) : reponse ? (
        <>
          <div className="mb-5 grid grid-cols-3 gap-5">
            <Resume icone={Headphones} libelle="Écoutes complètes sur la période" valeur={formatNombre(reponse.totalPlays)} />
            <Resume
              icone={reponse.trendPct !== null && reponse.trendPct < 0 ? TrendingDown : TrendingUp}
              libelle="Par rapport à la période précédente"
              valeur={reponse.trendPct === null ? "—" : `${reponse.trendPct > 0 ? "+" : ""}${reponse.trendPct.toLocaleString("fr-FR")} %`}
              ton={reponse.trendPct === null ? undefined : reponse.trendPct >= 0 ? "succes" : "danger"}
            />
            <Resume icone={Sparkles} libelle="En tête" valeur={reponse.ranking[0] ? (reponse.ranking[0].title ?? reponse.ranking[0].stageName ?? "—") : "—"} />
          </div>
          {reponse.ranking.length === 0 ? (
            <Vide texte="Aucune écoute complète sur cette période." />
          ) : (
            <Table entetes={[{ libelle: "Rang", largeur: "80px" }, { libelle: "Évolution", largeur: "110px" }, type === "artists" ? "Artiste" : type === "albums" ? "Album" : "Titre", { libelle: "Écoutes", droite: true, largeur: "140px" }]}>
              {reponse.ranking.map((l) => (
                <tr key={l._id}>
                  <td className={clsx("font-titre text-[16px] font-semibold tabular-nums", l.rank <= 3 ? "text-accent" : "text-texte-3")}>{l.rank}</td>
                  <td>
                    <Evolution valeur={l.evolution} />
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      {l.coverUrl ? (
                        <img src={adresseImage(l.coverUrl) ?? undefined} alt="" className={clsx("h-10 w-10 object-cover", type === "artists" ? "rounded-full" : "rounded-lg")} />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2 text-texte-3">
                          <Music size={15} />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate font-semibold">
                          {l.title ?? l.stageName}
                          {l.verified && <BadgeCheck size={14} className="text-accent" />}
                        </div>
                        {l.artistName && <div className="truncate text-[12px] text-texte-3">{l.artistName}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="text-right font-semibold tabular-nums">{formatNombre(l.plays)}</td>
                </tr>
              ))}
            </Table>
          )}
        </>
      ) : null}
    </>
  );
}

function Resume({ icone: Icone, libelle, valeur, ton }: { icone: LucideIcon; libelle: string; valeur: string; ton?: "succes" | "danger" }) {
  return (
    <div className="animate-monter decale-2 flex items-center gap-4 rounded-2xl border border-filet bg-surface p-5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent">
        <Icone size={20} />
      </span>
      <div className="min-w-0">
        <div className="text-[12px] text-texte-3">{libelle}</div>
        <div className={clsx("truncate font-titre text-[20px] font-semibold tabular-nums", ton === "succes" && "text-succes", ton === "danger" && "text-danger")}>{valeur}</div>
      </div>
    </div>
  );
}

function Evolution({ valeur }: { valeur: number | null }) {
  if (valeur === null)
    return <span className="rounded-md bg-teinte-1/15 px-1.5 py-0.5 text-[11px] font-semibold text-teinte-1">Entrée</span>;
  if (valeur === 0)
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-texte-3">
        <Minus size={13} /> stable
      </span>
    );
  return (
    <span className={clsx("inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums", valeur > 0 ? "text-succes" : "text-danger")}>
      {valeur > 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
      {Math.abs(valeur)}
    </span>
  );
}
