import { Fragment, useEffect, useState, type MouseEvent } from "react";
import { BadgeCheck, Bot, ChevronDown, ChevronLeft, ChevronRight, Church, Hand, ListMusic, Mic2, Music, RefreshCw, ScanSearch, Search, Sparkles, Wand2 } from "lucide-react";
import { api } from "../api";
import { adresseImage } from "../session";
import { Avatar, Bouton, Chargement, EnTete, Erreur, Pastille, Selection, Table, Vide, formatNombre, BarreCollante } from "../composants";
import { annoncer, classeChoisi, confirmer, ouvrirMenu, useSelection } from "../interactions";
import clsx from "../clsx";

type IdUnivers = "general" | "christian";

interface LigneArtiste {
  _id: string;
  stageName: string;
  coverUrl: string;
  verified: boolean;
  genres: string[];
  univers: IdUnivers;
  source: "auto" | "admin";
  motif: string;
  titres: number;
  titresChretiens: number;
}

interface Reponse {
  page: number;
  total: number;
  hasMore: boolean;
  stats: { artistes: Record<IdUnivers, number>; titres: Record<IdUnivers, number> };
  iaDisponible: boolean;
  artistes: LigneArtiste[];
}

interface Titre {
  _id: string;
  title: string;
  coverUrl: string;
  genre: string;
  status: string;
  univers: IdUnivers;
  source: "artiste" | "auto" | "admin";
  detecte: IdUnivers;
}

const NOMS: Record<IdUnivers, string> = { general: "Général", christian: "Évangélique" };
const nomUnivers = (u: string) => NOMS[u as IdUnivers] ?? u;
const autre = (u: IdUnivers): IdUnivers => (u === "general" ? "christian" : "general");

type Filtre = "" | "general" | "christian" | "admin";
const FILTRES: [Filtre, string][] = [
  ["", "Tous"],
  ["general", "Général"],
  ["christian", "Évangélique"],
  ["admin", "Classés à la main"],
];

const SOURCES_TITRE: Record<Titre["source"], string> = { artiste: "Suit l'artiste", auto: "Détection", admin: "À la main" };
const STATUTS: Record<string, string> = { published: "publié", pending: "en attente", draft: "brouillon", rejected: "refusé", scheduled: "programmé" };

/**
 * Le partage du catalogue entre l'univers général et l'univers
 * évangélique. Un déplacement fait ici est une décision humaine : le site
 * la marque « admin » et aucune détection ne la réécrit ensuite.
 */
export function Univers() {
  const [reponse, setReponse] = useState<Reponse | null>(null);
  const [page, setPage] = useState(1);
  const [saisie, setSaisie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [detection, setDetection] = useState<"simple" | "ia" | null>(null);
  const [deplie, setDeplie] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const artistes = reponse?.artistes ?? [];
  const sel = useSelection(
    artistes.map((a) => a._id),
    (id) => setDeplie((d) => (d === id ? null : id)),
  );

  // La recherche part au site après une courte pause de frappe, pas à chaque touche.
  useEffect(() => {
    const t = setTimeout(() => {
      setRecherche(saisie.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  useEffect(() => {
    setErreur(null);
    const p = new URLSearchParams({ page: String(page) });
    if (recherche) p.set("q", recherche);
    if (filtre === "admin") p.set("source", "admin");
    else if (filtre) p.set("univers", filtre);
    let actif = true;
    api<Reponse>(`/api/admin/univers?${p}`)
      .then((r) => {
        if (!actif) return;
        setReponse({
          ...r,
          artistes: r.artistes ?? [],
          stats: { artistes: r.stats?.artistes ?? { general: 0, christian: 0 }, titres: r.stats?.titres ?? { general: 0, christian: 0 } },
        });
      })
      .catch((e: Error) => actif && setErreur(e.message));
    // Une réponse lente ne doit pas écraser celle d'une recherche plus récente.
    return () => {
      actif = false;
    };
  }, [page, recherche, filtre, version]);

  async function deplacerArtiste(a: LigneArtiste, vers: IdUnivers) {
    if (a.univers === vers && a.source === "admin") return;
    const ok = await confirmer({
      titre: `Passer « ${a.stageName} » en ${NOMS[vers]} ?`,
      message: (
        <>
          <p>
            Ses {formatNombre(a.titres)} titres et tous ses albums le suivent dans l'univers {NOMS[vers]}, sauf les titres déjà déplacés à la main, qui restent où ils sont.
          </p>
          <p className="mt-2">La décision est marquée « à la main » : aucune détection ne la reviendra plus.</p>
        </>
      ),
      confirmer: `Passer en ${NOMS[vers]}`,
    });
    if (!ok) return;
    setEnCours(a._id);
    setErreur(null);
    try {
      const r = await api<{ univers: IdUnivers; titresDeplaces: number; message: string }>("/api/admin/univers", { methode: "PATCH", corps: { type: "artist", id: a._id, univers: vers } });
      annoncer(r.message || `${a.stageName} : ${NOMS[vers]}`);
      setVersion((v) => v + 1);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Déplacement refusé.");
    } finally {
      setEnCours(null);
    }
  }

  async function detecter(avecIA: boolean) {
    const ok = await confirmer({
      titre: avecIA ? "Reclasser le catalogue avec l'IA ?" : "Reclasser tout le catalogue ?",
      message: (
        <>
          <p>La détection repasse sur tous les artistes et tous les titres. Elle peut en déplacer beaucoup d'un univers à l'autre.</p>
          <p className="mt-2">Les classements décidés à la main ne sont pas touchés.{avecIA ? " Les cas douteux sont soumis au modèle : cela consomme des appels d'IA." : ""}</p>
          <p className="mt-2">L'opération peut prendre plusieurs minutes.</p>
        </>
      ),
      confirmer: "Reclasser",
      danger: true,
    });
    if (!ok) return;
    setDetection(avecIA ? "ia" : "simple");
    setErreur(null);
    try {
      const r = await api<{ message?: string }>("/api/admin/univers", { methode: "POST", corps: { avecIA } });
      annoncer(r.message ?? "Catalogue reclassé");
      setDeplie(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "La détection a échoué.");
    } finally {
      setDetection(null);
    }
  }

  function menu(e: MouseEvent, rang: number) {
    sel.surMenu(rang);
    const a = artistes[rang];
    if (!a) return;
    ouvrirMenu(
      e,
      [
        { libelle: deplie === a._id ? "Replier les titres" : "Afficher les titres", icone: ListMusic, raccourci: "Entrée", action: () => setDeplie((d) => (d === a._id ? null : a._id)) },
        "separateur",
        { libelle: "Passer en Général", icone: Mic2, desactive: a.univers === "general" && a.source === "admin", action: () => void deplacerArtiste(a, "general") },
        { libelle: "Passer en Évangélique", icone: Church, desactive: a.univers === "christian" && a.source === "admin", action: () => void deplacerArtiste(a, "christian") },
      ],
      a.stageName,
    );
  }

  const changerFiltre = (f: Filtre) => {
    setFiltre(f);
    setPage(1);
    setDeplie(null);
  };

  const stats = reponse?.stats;

  return (
    <>
      <EnTete
        titre="Univers"
        texte="Ranger artistes et titres dans l'univers général ou évangélique."
        action={
          <>
            <Bouton variante="trait" onClick={() => setVersion((v) => v + 1)} disabled={detection !== null}>
              <RefreshCw size={14} /> Actualiser
            </Bouton>
            <Bouton variante="trait" onClick={() => void detecter(false)} enCours={detection === "simple"} disabled={detection !== null}>
              {detection !== "simple" && <ScanSearch size={14} />} Détecter
            </Bouton>
            {reponse?.iaDisponible && (
              <Bouton onClick={() => void detecter(true)} enCours={detection === "ia"} disabled={detection !== null}>
                {detection !== "ia" && <Sparkles size={14} />} Détecter avec l'IA
              </Bouton>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-5 xl:grid-cols-4">
        <Tuile className="decale-1" icone={Mic2} libelle="Artistes, Général" valeur={stats ? formatNombre(stats.artistes.general) : null} />
        <Tuile className="decale-2" icone={Church} libelle="Artistes, Évangélique" valeur={stats ? formatNombre(stats.artistes.christian) : null} />
        <Tuile className="decale-3" icone={Music} libelle="Titres publiés, Général" valeur={stats ? formatNombre(stats.titres.general) : null} />
        <Tuile className="decale-4" icone={Music} libelle="Titres publiés, Évangélique" valeur={stats ? formatNombre(stats.titres.christian) : null} />
      </div>

      {detection && (
        <div className="animate-paraitre mb-4 flex items-center gap-3 rounded-2xl border border-filet bg-surface px-4 py-3 text-[13px] text-texte-2">
          <Wand2 size={16} className="text-accent" />
          Reclassement du catalogue{detection === "ia" ? " avec l'IA" : ""} en cours. Cela peut prendre plusieurs minutes ; vous pouvez continuer à consulter la liste.
        </div>
      )}

      <BarreCollante className="animate-monter decale-1">
        <div className="relative w-72">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texte-3" />
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Nom de scène"
            className="h-9 w-full rounded-lg border border-filet bg-surface pr-3 pl-9 text-[13px] outline-none placeholder:text-texte-3 focus:border-accent"
          />
        </div>
        <div className="flex rounded-lg border border-filet bg-surface p-0.5">
          {FILTRES.map(([v, l]) => (
            <button
              key={v}
              onClick={() => changerFiltre(v)}
              className={clsx("rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors", filtre === v ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte")}
            >
              {l}
            </button>
          ))}
        </div>
        {reponse && <Navigation page={reponse.page} total={reponse.total} plus={reponse.hasMore} onPage={setPage} className="ml-auto" />}
      </BarreCollante>

      <Erreur message={erreur} />
      {!reponse && !erreur ? (
        <Chargement />
      ) : reponse && artistes.length === 0 ? (
        <Vide texte="Aucun artiste ne correspond." />
      ) : reponse ? (
        <Table entetes={[{ libelle: "", largeur: "44px" }, "Artiste", { libelle: "Univers", largeur: "140px" }, "Classement", { libelle: "Titres", droite: true, largeur: "150px" }]}>
          {artistes.map((a, rang) => {
            const ouvert = deplie === a._id;
            return (
              <Fragment key={a._id}>
                <tr
                  data-rang={rang}
                  onClick={(e) => sel.surClic(e, rang)}
                  onDoubleClick={(e) => sel.surDoubleClic(e, rang)}
                  onContextMenu={(e) => menu(e, rang)}
                  className={clsx("cursor-default", enCours === a._id && "opacity-60", classeChoisi(sel.estChoisi(a._id), "ligne"))}
                >
                  <td>
                    <button
                      onClick={() => setDeplie(ouvert ? null : a._id)}
                      title={ouvert ? "Replier les titres" : "Afficher les titres"}
                      className="grid h-7 w-7 place-items-center rounded-md text-texte-3 hover:bg-surface-2 hover:text-texte"
                    >
                      <ChevronDown size={15} className={clsx("transition-transform duration-150", !ouvert && "-rotate-90")} />
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar nom={a.stageName || "?"} image={a.coverUrl || null} taille={34} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <span className="truncate">{a.stageName}</span>
                          {a.verified && <BadgeCheck size={14} className="shrink-0 text-accent" />}
                        </div>
                        {a.genres.length > 0 && <div className="truncate text-[12px] text-texte-3">{a.genres.join(", ")}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="-ml-1.5">
                      <Pastille texte={nomUnivers(a.univers)} ton={a.univers === "christian" ? "accent" : "neutre"} />
                    </span>
                  </td>
                  <td>
                    <div className="inline-flex items-center gap-1.5 text-[12.5px] text-texte-2">
                      {a.source === "admin" ? <Hand size={13} /> : <Bot size={13} />}
                      {a.source === "admin" ? "À la main" : "Détection"}
                    </div>
                    {a.motif && (
                      <div className="max-w-[420px] truncate text-[12px] text-texte-3" title={a.motif} data-selectionnable>
                        {a.motif}
                      </div>
                    )}
                  </td>
                  <td className="text-right tabular-nums">
                    <div className="font-semibold">{formatNombre(a.titres)}</div>
                    {a.titresChretiens > 0 && a.titresChretiens < a.titres && <div className="text-[12px] text-texte-3">dont {formatNombre(a.titresChretiens)} évangéliques</div>}
                  </td>
                </tr>
                {ouvert && (
                  <tr className="hover:!bg-transparent">
                    <td colSpan={5} className="!px-0 !py-0">
                      <TitresArtiste artiste={a} onDeplacerArtiste={(vers) => void deplacerArtiste(a, vers)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </Table>
      ) : null}

      {reponse && artistes.length > 0 && <Navigation page={reponse.page} total={reponse.total} plus={reponse.hasMore} onPage={setPage} className="mt-6 justify-end" />}
    </>
  );
}

/** Les titres d'un artiste, chargés au dépliage : c'est le seul endroit où un titre se déplace seul. */
function TitresArtiste({ artiste, onDeplacerArtiste }: { artiste: LigneArtiste; onDeplacerArtiste: (vers: IdUnivers) => void }) {
  const [titres, setTitres] = useState<Titre[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  useEffect(() => {
    api<{ titres?: Titre[] }>(`/api/admin/univers?artist=${encodeURIComponent(artiste._id)}`)
      .then((r) => setTitres(r.titres ?? []))
      .catch((e: Error) => setErreur(e.message));
  }, [artiste._id]);

  async function deplacer(t: Titre, vers: IdUnivers) {
    if (vers === t.univers) return;
    const ok = await confirmer({
      titre: `Passer « ${t.title} » en ${NOMS[vers]} ?`,
      message: "Ce titre seul change d'univers. Il ne suivra plus son artiste : un déplacement ultérieur de l'artiste le laissera où il est.",
      confirmer: `Passer en ${NOMS[vers]}`,
    });
    if (!ok) return;
    setEnCours(t._id);
    setErreur(null);
    try {
      const r = await api<{ univers: IdUnivers; message: string }>("/api/admin/univers", { methode: "PATCH", corps: { type: "song", id: t._id, univers: vers } });
      setTitres((liste) => (liste ? liste.map((x) => (x._id === t._id ? { ...x, univers: r.univers ?? vers, source: "admin" } : x)) : liste));
      annoncer(r.message || `${t.title} : ${NOMS[vers]}`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Déplacement refusé.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="animate-paraitre border-t border-filet bg-surface-2/40 px-4 py-3 pl-[60px]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold tracking-wide text-texte-3 uppercase">Titres de {artiste.stageName}</span>
        <Bouton variante="discret" className="h-8" onClick={() => onDeplacerArtiste(autre(artiste.univers))}>
          {artiste.univers === "general" ? <Church size={14} /> : <Mic2 size={14} />} Passer l'artiste en {NOMS[autre(artiste.univers)]}
        </Bouton>
      </div>
      <Erreur message={erreur} />
      {!titres && !erreur ? (
        <Chargement texte="Chargement des titres" />
      ) : titres && titres.length === 0 ? (
        <p className="py-4 text-[13px] text-texte-3">Aucun titre.</p>
      ) : titres ? (
        <ul className="divide-y divide-filet">
          {titres.map((t) => (
            <li key={t._id} className={clsx("flex items-center gap-3 py-2", enCours === t._id && "opacity-60")}>
              <Pochette url={t.coverUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 truncate text-[13px] font-medium">
                  <span className="truncate">{t.title}</span>
                  {t.status !== "published" && <Pastille texte={STATUTS[t.status] ?? t.status} />}
                </div>
                <div className="flex items-center gap-2 truncate text-[12px] text-texte-3">
                  {t.genre && <span>{t.genre}</span>}
                  <span className="inline-flex items-center gap-1">
                    {t.source === "admin" ? <Hand size={11} /> : t.source === "auto" ? <Bot size={11} /> : <Mic2 size={11} />}
                    {SOURCES_TITRE[t.source] ?? t.source}
                  </span>
                  {t.detecte && t.detecte !== t.univers && <span className="text-attention">La détection le verrait en {nomUnivers(t.detecte)}</span>}
                </div>
              </div>
              <Selection className="w-40 shrink-0" value={t.univers} disabled={enCours !== null} onChange={(e) => void deplacer(t, e.target.value as IdUnivers)} aria-label={`Univers de ${t.title}`}>
                <option value="general">Général</option>
                <option value="christian">Évangélique</option>
              </Selection>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Pochette({ url }: { url: string }) {
  const src = adresseImage(url);
  return src ? (
    <img src={src} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
  ) : (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface-2 text-texte-3">
      <Music size={15} />
    </span>
  );
}

/** Précédente / suivante : le site ne rend que `hasMore`, pas un nombre de pages fiable à afficher en numéros. */
function Navigation({ page, total, plus, onPage, className }: { page: number; total: number; plus: boolean; onPage: (p: number) => void; className?: string }) {
  const pages = Math.max(1, Math.ceil(total / 25));
  return (
    <div className={clsx("flex items-center gap-3 text-[12.5px]", className)}>
      <span className="text-texte-3 tabular-nums">
        Page {formatNombre(page)} sur {formatNombre(pages)} · {formatNombre(total)} artiste{total > 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="grid h-8 w-8 place-items-center rounded-lg border border-filet bg-surface text-texte-2 hover:text-texte disabled:opacity-40"
          title="Page précédente"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={!plus}
          className="grid h-8 w-8 place-items-center rounded-lg border border-filet bg-surface text-texte-2 hover:text-texte disabled:opacity-40"
          title="Page suivante"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

function Tuile({ icone: Icone, libelle, valeur, className }: { icone: typeof Music; libelle: string; valeur: string | null; className?: string }) {
  return (
    <div className={clsx("animate-monter rounded-2xl border border-filet bg-surface p-5", className)}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/12 text-accent">
        <Icone size={19} />
      </span>
      <div className="mt-4 font-titre text-[26px] leading-none font-semibold tabular-nums">{valeur ?? <span className="inline-block h-7 w-20 animate-pulse rounded-md bg-surface-2" />}</div>
      <div className="mt-1.5 text-[13px] text-texte-2">{libelle}</div>
    </div>
  );
}
