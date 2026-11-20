import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarPlus,
  CheckCircle2,
  CircleAlert,
  Headphones,
  Megaphone,
  Mic2,
  Music,
  Settings,
  TrendingDown,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api, adresseSite, ErreurApi } from "../api";
import { useSession, adresseImage } from "../session";
import { Avatar, Bouton, Carte, Champ, Dialogue, Erreur, Pastille, TEINTES, formatCompact, formatNombre, formatRelatif } from "../composants";
import { Anneau, CourbeAire, MiniCourbe } from "../graphiques";
import { Egaliseur, useCoquille, type Page } from "../App";
import { useAuRetour } from "../page";
import clsx from "../clsx";

type Univers = "general" | "christian";
const UNIVERS: { cle: Univers; libelle: string }[] = [
  { cle: "general", libelle: "Général" },
  { cle: "christian", libelle: "Gospel" },
];

interface Ecoutes {
  days: number;
  total: number;
  trendPct: number | null;
  series: { date: string; plays: number }[];
}

interface Classement {
  ranking: { _id: string; rank: number; title: string; artistName?: string; coverUrl?: string; plays: number }[];
  totalPlays: number;
}

interface CompteRecent {
  _id: string;
  name: string;
  email: string;
  role: "member" | "artist" | "admin";
  avatarUrl?: string;
  createdAt: string;
}

/**
 * Le tableau de bord. Tous les chiffres viennent de l'API d'administration
 * du site ; quand une donnée manque (route absente d'un site plus ancien,
 * service injoignable), le panneau le dit au lieu d'afficher zéro.
 */
export function TableauDeBord() {
  const { etat } = useSession();
  const { aller, stats, erreurStats, rafraichir } = useCoquille();
  // La page reste montée quand on la quitte : au retour, les compteurs se relisent sans bruit.
  useAuRetour(rafraichir);
  const [ecoutes30, setEcoutes30] = useState<Ecoutes | null | "absent">(null);
  const [creerArtiste, setCreerArtiste] = useState(false);
  const prenom = etat.phase === "connecte" ? etat.utilisateur.name.trim().split(/\s+/)[0] : "";

  useEffect(() => {
    api<Ecoutes>("/api/admin/stats/ecoutes?days=30")
      .then((r) => setEcoutes30({ ...r, total: r.total ?? 0, trendPct: r.trendPct ?? null, series: r.series ?? [] }))
      .catch((e) => {
        // Site pas encore mis à jour : on retombe sur le total par pays,
        // qui existe depuis plus longtemps, sans courbe.
        if (e instanceof ErreurApi && e.statut === 404)
          api<{ total: number }>("/api/admin/stats/countries?days=30")
            .then((c) => setEcoutes30({ days: 30, total: c.total, trendPct: null, series: [] }))
            .catch(() => setEcoutes30("absent"));
        else setEcoutes30("absent");
      });
  }, []);

  const e30 = ecoutes30 && ecoutes30 !== "absent" ? ecoutes30 : null;

  return (
    <div className="space-y-6">
      <section className="animate-monter relative overflow-hidden rounded-2xl border border-filet bg-surface">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_100%_0%,color-mix(in_srgb,var(--accent)_22%,transparent),transparent_60%)]" />
        <div className="relative flex items-center justify-between gap-8 px-8 py-7">
          <div className="max-w-[560px]">
            <h1 className="font-titre text-[28px] font-semibold tracking-tight">Bonjour, {prenom} !</h1>
            <p className="mt-1.5 text-[14px] text-texte-2">Bienvenue sur votre espace d'administration Moziik.</p>
            <div className="mt-5 flex gap-2.5">
              <Bouton onClick={() => aller("statistiques")} className="h-10 px-4">
                <BarChart3 size={16} /> Voir les statistiques détaillées
              </Bouton>
              <Bouton variante="trait" onClick={() => aller("import")} className="h-10 px-4">
                <Upload size={16} /> Téléverser
              </Bouton>
            </div>
          </div>
          <div className="hidden items-end gap-8 lg:flex">
            <div className="text-right">
              <div className="text-[12px] text-texte-3">Écoutes ces 30 derniers jours</div>
              <div className="font-titre text-[34px] leading-tight font-semibold tabular-nums">{e30 ? formatNombre(e30.total) : "—"}</div>
            </div>
            <Egaliseur className="h-24" />
          </div>
        </div>
      </section>

      <Erreur message={erreurStats} />

      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        <CarteChiffre
          className="decale-1"
          icone={Music}
          teinte={TEINTES[0]}
          libelle="Musiques publiées"
          valeur={stats?.publishedSongs}
          tendance={stats?.trends?.songs}
          contexte="ce mois"
          serie={stats?.sparklines?.songs}
          onClick={() => aller("catalogue")}
        />
        <CarteChiffre
          className="decale-2"
          icone={Users}
          teinte={TEINTES[1]}
          libelle="Membres inscrits"
          valeur={stats?.members}
          tendance={stats?.trends?.members}
          contexte="ce mois"
          serie={stats?.sparklines?.members}
          onClick={() => aller("comptes")}
        />
        <CarteChiffre
          className="decale-3"
          icone={Headphones}
          teinte={TEINTES[2]}
          libelle="Écoutes sur 30 jours"
          valeur={e30?.total}
          tendance={e30?.trendPct ?? undefined}
          contexte="vs 30 j avant"
          serie={e30?.series?.slice(-14).map((p) => p.plays)}
          absent={ecoutes30 === "absent"}
          onClick={() => aller("statistiques")}
        />
        <CarteChiffre
          className="decale-4"
          icone={Mic2}
          teinte={TEINTES[3]}
          libelle="Artistes"
          valeur={stats?.artists}
          tendance={stats?.trends?.artists}
          contexte="ce mois"
          serie={stats?.sparklines?.artists}
          onClick={() => aller("artistes")}
        />
      </div>

      <div className="grid grid-cols-12 gap-5">
        <EvolutionEcoutes className="col-span-12 xl:col-span-8" />
        <TopMusiques className="col-span-12 xl:col-span-4" aller={aller} />

        <Carte titre="Gestion rapide" className="animate-monter decale-2 col-span-12 lg:col-span-6 xl:col-span-4">
          <div className="grid grid-cols-2 gap-3">
            <TuileAction icone={Upload} teinte={TEINTES[0]} libelle="Téléverser des musiques" onClick={() => aller("import")} />
            <TuileAction icone={UserPlus} teinte={TEINTES[1]} libelle="Ajouter un artiste" onClick={() => setCreerArtiste(true)} />
            <TuileAction icone={Megaphone} teinte={TEINTES[4]} libelle="Créer une annonce" onClick={() => aller("annonces")} />
            <TuileAction icone={Settings} teinte={TEINTES[3]} libelle="Gérer les paramètres" onClick={() => aller("reglages")} />
          </div>
        </Carte>
        <RepartitionGenres className="col-span-12 lg:col-span-6 xl:col-span-4" />
        <UtilisateursRecents className="col-span-12 lg:col-span-6 xl:col-span-4" aller={aller} />

        <ActiviteRecente className="col-span-12 lg:col-span-6 xl:col-span-8" activite={stats?.recentActivity} />
        <Services className="col-span-12 xl:col-span-4" />
      </div>

      {creerArtiste && <DialogueArtiste onFermer={() => setCreerArtiste(false)} />}
    </div>
  );
}

function CarteChiffre({
  icone: Icone,
  teinte,
  libelle,
  valeur,
  tendance,
  contexte,
  serie,
  absent,
  onClick,
  className,
}: {
  icone: LucideIcon;
  teinte: string;
  libelle: string;
  valeur?: number;
  tendance?: number;
  contexte: string;
  serie?: number[];
  absent?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const couleur = `var(--${teinte})`;
  return (
    <button onClick={onClick} className={clsx("animate-monter group rounded-2xl border border-filet bg-surface p-5 text-left transition-colors hover:border-texte-3/40", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${couleur} 16%, transparent)`, color: couleur }}>
          <Icone size={21} />
        </span>
        {typeof tendance === "number" && (
          <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums", tendance >= 0 ? "bg-succes/12 text-succes" : "bg-danger/12 text-danger")}>
            {tendance >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {tendance > 0 ? "+" : ""}
            {tendance.toLocaleString("fr-FR")} %
          </span>
        )}
      </div>
      <div className="mt-4 font-titre text-[28px] leading-none font-semibold tracking-tight tabular-nums">
        {typeof valeur === "number" ? formatCompact(valeur) : absent ? "—" : <span className="inline-block h-7 w-20 animate-pulse rounded-md bg-surface-2" />}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="text-texte-2">{libelle}</span>
        {typeof tendance === "number" && <span className="text-[11.5px] text-texte-3">{contexte}</span>}
      </div>
      <div className="mt-3">{serie && serie.length > 1 ? <MiniCourbe valeurs={serie} couleur={couleur} /> : <div className="h-10" />}</div>
    </button>
  );
}

function SelecteurSegments<T extends string | number>({ valeur, options, onChange }: { valeur: T; options: { cle: T; libelle: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg border border-filet bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.cle}
          onClick={() => onChange(o.cle)}
          className={clsx("rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors", valeur === o.cle ? "bg-surface text-texte shadow-sm" : "text-texte-3 hover:text-texte")}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

function EvolutionEcoutes({ className }: { className?: string }) {
  const [jours, setJours] = useState(30);
  const [donnees, setDonnees] = useState<Ecoutes | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDonnees(null);
    setMessage(null);
    api<Ecoutes>(`/api/admin/stats/ecoutes?days=${jours}`)
      // Une réponse incomplète (site plus ancien) ne doit pas faire tomber le tableau de bord.
      .then((r) => setDonnees({ ...r, total: r.total ?? 0, trendPct: r.trendPct ?? null, series: r.series ?? [] }))
      .catch((e) =>
        setMessage(e instanceof ErreurApi && e.statut === 404 ? "La courbe jour par jour arrive avec la prochaine mise à jour du site." : e instanceof Error ? e.message : "Données indisponibles."),
      );
  }, [jours]);

  const moyenne = donnees && donnees.series.length ? Math.round(donnees.total / donnees.series.length) : null;
  const record = donnees?.series.reduce((m, p) => (p.plays > m.plays ? p : m), donnees.series[0]);

  return (
    <Carte
      className={clsx("animate-monter decale-1", className)}
      titre="Évolution des écoutes"
      action={
        <SelecteurSegments
          valeur={jours}
          onChange={setJours}
          options={[
            { cle: 7, libelle: "7 jours" },
            { cle: 30, libelle: "30 jours" },
            { cle: 90, libelle: "90 jours" },
          ]}
        />
      }
    >
      <div className="mb-4 flex gap-8">
        <Indicateur libelle="Total" valeur={donnees ? formatNombre(donnees.total) : "—"} />
        <Indicateur libelle="Moyenne par jour" valeur={moyenne !== null ? formatNombre(moyenne) : "—"} />
        <Indicateur libelle="Meilleur jour" valeur={record && record.plays > 0 ? formatNombre(record.plays) : "—"} />
        {donnees?.trendPct !== null && donnees?.trendPct !== undefined && (
          <Indicateur libelle={`vs ${jours} jours précédents`} valeur={`${donnees.trendPct > 0 ? "+" : ""}${donnees.trendPct.toLocaleString("fr-FR")} %`} ton={donnees.trendPct >= 0 ? "succes" : "danger"} />
        )}
      </div>
      {message ? (
        <div className="grid h-[260px] place-items-center rounded-xl border border-dashed border-filet text-[13px] text-texte-3">{message}</div>
      ) : donnees ? (
        <CourbeAire serie={donnees.series} />
      ) : (
        <div className="h-[260px] animate-pulse rounded-xl bg-surface-2/60" />
      )}
    </Carte>
  );
}

function Indicateur({ libelle, valeur, ton }: { libelle: string; valeur: string; ton?: "succes" | "danger" }) {
  return (
    <div>
      <div className="text-[12px] text-texte-3">{libelle}</div>
      <div className={clsx("font-titre text-[18px] font-semibold tabular-nums", ton === "succes" && "text-succes", ton === "danger" && "text-danger")}>{valeur}</div>
    </div>
  );
}

function TopMusiques({ className, aller }: { className?: string; aller: (p: Page) => void }) {
  const [univers, setUnivers] = useState<Univers>("general");
  const [donnees, setDonnees] = useState<Classement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setDonnees(null);
    setErreur(null);
    api<Classement>(`/api/charts?type=songs&period=month&univers=${univers}`)
      .then((r) => setDonnees({ ...r, ranking: r.ranking ?? [] }))
      .catch((e: Error) => setErreur(e.message));
  }, [univers]);

  const top = donnees?.ranking?.slice(0, 5) ?? [];
  const max = Math.max(1, ...top.map((t) => t.plays));

  return (
    <Carte
      className={clsx("animate-monter decale-2", className)}
      titre="Top 5 des musiques"
      action={
        <button onClick={() => aller("classements")} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline">
          Voir tout <ArrowRight size={13} />
        </button>
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] text-texte-3">Écoutes complètes, 30 derniers jours</span>
        <SelecteurSegments valeur={univers} onChange={setUnivers} options={UNIVERS} />
      </div>
      <Erreur message={erreur} />
      {!donnees && !erreur ? (
        <ListeSquelette lignes={5} />
      ) : top.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-texte-3">Aucune écoute complète sur la période.</p>
      ) : (
        <ol className="space-y-1">
          {top.map((t, i) => (
            <li key={t._id} className={clsx("animate-paraitre flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2", `decale-${i + 1}`)}>
              <span className={clsx("w-5 text-center font-titre text-[14px] font-semibold tabular-nums", i === 0 ? "text-accent" : "text-texte-3")}>{t.rank}</span>
              {t.coverUrl ? <img src={adresseImage(t.coverUrl) ?? undefined} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-surface-2 text-texte-3"><Music size={16} /></span>}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{t.title}</div>
                <div className="truncate text-[12px] text-texte-3">{t.artistName ?? "Artiste inconnu"}</div>
                <div className="mt-1.5 h-1 rounded-full bg-surface-2">
                  <div className="h-1 rounded-full bg-accent" style={{ width: `${(t.plays / max) * 100}%` }} />
                </div>
              </div>
              <span className="text-[12px] font-semibold text-texte-2 tabular-nums">{formatCompact(t.plays)}</span>
            </li>
          ))}
        </ol>
      )}
    </Carte>
  );
}

function TuileAction({ icone: Icone, teinte, libelle, onClick }: { icone: LucideIcon; teinte: string; libelle: string; onClick: () => void }) {
  const couleur = `var(--${teinte})`;
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-4 rounded-xl border border-filet p-4 text-left transition-colors hover:border-transparent"
      style={{ background: `color-mix(in srgb, ${couleur} 9%, transparent)` }}
    >
      <span className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${couleur} 20%, transparent)`, color: couleur }}>
        <Icone size={19} />
      </span>
      <span className="flex w-full items-end justify-between gap-2 text-[13px] leading-snug font-semibold">
        {libelle}
        <ArrowRight size={14} className="shrink-0 text-texte-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function RepartitionGenres({ className }: { className?: string }) {
  const [univers, setUnivers] = useState<Univers>("general");
  const [genres, setGenres] = useState<{ genre: string; count: number }[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setGenres(null);
    setErreur(null);
    api<{ genres: { genre: string; count: number }[] }>(`/api/genres?univers=${univers}`)
      .then((r) => setGenres(r.genres ?? []))
      .catch((e: Error) => setErreur(e.message));
  }, [univers]);

  // Cinq genres nommés, le reste regroupé : au-delà, les teintes ne se
  // distinguent plus et l'anneau devient illisible.
  const tries = [...(genres ?? [])].sort((a, b) => b.count - a.count);
  const parts = tries.slice(0, 5).map((g, i) => ({ libelle: g.genre, valeur: g.count, couleur: `var(--${TEINTES[i]})` }));
  const reste = tries.slice(5).reduce((s, g) => s + g.count, 0);
  if (reste > 0) parts.push({ libelle: "Autres genres", valeur: reste, couleur: "var(--texte-3)" });
  const total = parts.reduce((s, p) => s + p.valeur, 0);

  return (
    <Carte className={clsx("animate-monter decale-3", className)} titre="Répartition par genre" action={<SelecteurSegments valeur={univers} onChange={setUnivers} options={UNIVERS} />}>
      <Erreur message={erreur} />
      {!genres && !erreur ? (
        <div className="mx-auto h-[172px] w-[172px] animate-pulse rounded-full bg-surface-2/60" />
      ) : total === 0 ? (
        <p className="py-8 text-center text-[13px] text-texte-3">Aucun titre classé par genre.</p>
      ) : (
        <div className="flex items-center gap-6">
          <Anneau parts={parts} legendeCentre="titres publiés" />
          <ul className="min-w-0 flex-1 space-y-2.5">
            {parts.map((p) => (
              <li key={p.libelle} className="flex items-center gap-2.5 text-[12.5px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.couleur }} />
                <span className="min-w-0 flex-1 truncate text-texte-2">{p.libelle}</span>
                <span className="font-semibold tabular-nums">{Math.round((p.valeur / total) * 100)} %</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Carte>
  );
}

const ROLES: Record<CompteRecent["role"], { libelle: string; ton: "neutre" | "accent" | "succes" }> = {
  member: { libelle: "Membre", ton: "neutre" },
  artist: { libelle: "Artiste", ton: "accent" },
  admin: { libelle: "Admin", ton: "succes" },
};

function UtilisateursRecents({ className, aller }: { className?: string; aller: (p: Page) => void }) {
  const [comptes, setComptes] = useState<CompteRecent[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    api<{ users: CompteRecent[] }>("/api/admin/users?page=1&limit=5")
      .then((r) => setComptes(r.users ?? []))
      .catch((e: Error) => setErreur(e.message));
  }, []);

  return (
    <Carte
      className={clsx("animate-monter decale-4", className)}
      titre="Utilisateurs récents"
      action={
        <button onClick={() => aller("comptes")} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline">
          Voir tout <ArrowRight size={13} />
        </button>
      }
    >
      <Erreur message={erreur} />
      {!comptes && !erreur ? (
        <ListeSquelette lignes={5} />
      ) : (
        <ul className="space-y-1">
          {(comptes ?? []).map((u) => (
            <li key={u._id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
              <Avatar nom={u.name} image={u.avatarUrl} taille={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{u.name}</div>
                <div className="truncate text-[12px] text-texte-3">{formatRelatif(u.createdAt)}</div>
              </div>
              <Pastille texte={(ROLES[u.role] ?? ROLES.member).libelle} ton={(ROLES[u.role] ?? ROLES.member).ton} />
            </li>
          ))}
        </ul>
      )}
    </Carte>
  );
}

const ICONES_ACTIVITE: Record<string, { icone: LucideIcon; teinte: string }> = {
  member: { icone: UserPlus, teinte: TEINTES[1] },
  artist: { icone: Mic2, teinte: TEINTES[3] },
  song: { icone: Music, teinte: TEINTES[0] },
  event: { icone: CalendarPlus, teinte: TEINTES[4] },
};

function ActiviteRecente({ className, activite }: { className?: string; activite?: { type: string; message: string; at: string }[] }) {
  return (
    <Carte className={clsx("animate-monter decale-5", className)} titre="Activité récente">
      {!activite ? (
        <ListeSquelette lignes={4} />
      ) : activite.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-texte-3">Aucune activité récente.</p>
      ) : (
        <ol className="relative">
          {activite.map((a, i) => {
            const { icone: Icone, teinte } = ICONES_ACTIVITE[a.type] ?? ICONES_ACTIVITE.song;
            const couleur = `var(--${teinte})`;
            return (
              <li key={i} className="relative flex gap-4 pb-4 last:pb-0">
                {i < activite.length - 1 && <span className="absolute top-10 bottom-0 left-[17px] w-px bg-filet" />}
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${couleur} 16%, transparent)`, color: couleur }}>
                  <Icone size={16} />
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="text-[13px]">{a.message}</div>
                  <div className="mt-0.5 text-[12px] text-texte-3">{formatRelatif(a.at)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Carte>
  );
}

type EtatService = "ok" | "lent" | "panne";

function Services({ className }: { className?: string }) {
  const { taches } = useCoquille();
  const [services, setServices] = useState<{ nom: string; etat: EtatService; detail: string }[] | null>(null);
  useEffect(() => {
    void mesurerServices().then(setServices);
  }, []);
  const enAttente = taches.filter((t) => t.nombre > 0);

  return (
    <Carte className={clsx("animate-monter decale-6", className)} titre="État de la plateforme">
      <ul className="space-y-1">
        {(services ?? [{ nom: "Mesure en cours", etat: "ok" as const, detail: "…" }]).map((s) => (
          <li key={s.nom} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-[13px]">
            <span className="flex items-center gap-2.5">
              {!services ? (
                <span className="h-4 w-4 animate-pulse rounded-full bg-surface-2" />
              ) : s.etat === "ok" ? (
                <CheckCircle2 size={16} className="text-succes" />
              ) : (
                <CircleAlert size={16} className={s.etat === "lent" ? "text-attention" : "text-danger"} />
              )}
              {s.nom}
            </span>
            <span className="text-[12px] text-texte-3 tabular-nums">{s.detail}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-filet pt-3">
        <div className="mb-1.5 px-2 text-[12px] font-semibold text-texte-3">À traiter</div>
        {enAttente.length === 0 ? (
          <p className="px-2 text-[13px] text-texte-2">Rien en attente.</p>
        ) : (
          <ul>
            {enAttente.map((t) => (
              <li key={t.libelle}>
                <button onClick={t.ouvrir} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-surface-2">
                  {t.libelle}
                  <span className="font-semibold text-accent tabular-nums">{formatNombre(t.nombre)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Carte>
  );
}

function ListeSquelette({ lignes }: { lignes: number }) {
  return (
    <ul className="space-y-2">
      {Array.from({ length: lignes }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-2 py-1.5">
          <span className="h-10 w-10 animate-pulse rounded-lg bg-surface-2" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-3 w-2/3 animate-pulse rounded bg-surface-2" />
            <span className="block h-2.5 w-1/3 animate-pulse rounded bg-surface-2" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Ajout d'un artiste sans compte : même route que l'import, adresse interne @moziik.app. */
function DialogueArtiste({ onFermer }: { onFermer: () => void }) {
  const [nom, setNom] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [cree, setCree] = useState<string | null>(null);

  async function creer() {
    const n = nom.trim();
    if (n.length < 2) return;
    setEnCours(true);
    setErreur(null);
    try {
      const slug = n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const { artist } = await api<{ artist: { _id: string; stageName: string } }>("/api/admin/users", {
        corps: { name: n, email: `${slug}-${Date.now().toString(36)}@moziik.app`, role: "artist" },
      });
      setCree(artist.stageName);
      setNom("");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Dialogue titre="Ajouter un artiste" onFermer={onFermer}>
      <p className="mb-4 text-[13px] text-texte-2">Le profil est créé sans mot de passe, avec une adresse interne. L'artiste pourra le revendiquer plus tard depuis le site.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void creer();
        }}
        className="space-y-4"
      >
        <Champ libelle="Nom de scène" autoFocus value={nom} onChange={(e) => setNom(e.target.value)} />
        <Erreur message={erreur} />
        {cree && (
          <p className="animate-paraitre flex items-center gap-2 rounded-lg bg-succes/10 px-3 py-2 text-[13px] text-succes">
            <CheckCircle2 size={15} /> « {cree} » a été créé.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Bouton variante="discret" onClick={onFermer}>
            Fermer
          </Bouton>
          <Bouton type="submit" enCours={enCours} disabled={nom.trim().length < 2}>
            <UserPlus size={15} /> Créer l'artiste
          </Bouton>
        </div>
      </form>
    </Dialogue>
  );
}

/** Chaque service, mesuré d'ici : le temps de réponse dit s'il va bien. */
async function mesurerServices() {
  const site = adresseSite();
  const mesure = async (nom: string, url: string, lent = 2500): Promise<{ nom: string; etat: EtatService; detail: string }> => {
    const debut = performance.now();
    try {
      const r = await fetch(url, { cache: "no-store" });
      const ms = Math.round(performance.now() - debut);
      if (!r.ok) return { nom, etat: "panne", detail: `réponse ${r.status}` };
      return { nom, etat: ms > lent ? "lent" : "ok", detail: `${ms} ms` };
    } catch {
      return { nom, etat: "panne", detail: "injoignable" };
    }
  };
  return Promise.all([
    mesure("Site et base de données", `${site}/api/site-config`),
    mesure("Lecture audio", "https://karaks-lecture.dodisoa-nandrianina.workers.dev/sante", 1500),
    mesure("Envoi de fichiers", `${site}/api/fichiers/envoi`),
  ]);
}
