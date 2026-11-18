import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Command, CornerDownLeft, FolderOpen, Megaphone, Mic2, Moon, Music, RefreshCw, Search, Settings, Sun, Users, type LucideIcon } from "lucide-react";
import { api } from "./api";
import { adresseImage } from "./session";
import clsx from "./clsx";

/*
 * La palette de commandes (Ctrl + K) : aller à une page, lancer une action,
 * retrouver un artiste ou un titre, au clavier. Les pages et actions se
 * filtrent sur place ; les artistes viennent du site dès deux lettres.
 */

export interface EntreePalette {
  id: string;
  groupe: "Pages" | "Actions" | "Rechercher" | "Artistes";
  libelle: string;
  detail?: string;
  icone?: LucideIcon;
  image?: string | null;
  motsCles?: string;
  executer: () => void;
}

interface Proprietes {
  ouverte: boolean;
  fermer: () => void;
  pages: { cle: string; libelle: string; icone: LucideIcon }[];
  aller: (page: string, recherche?: string) => void;
  theme: "sombre" | "clair";
  basculerTheme: () => void;
  rafraichir: () => void;
  choisirDossier: () => void;
}

/** Sans accents ni majuscules : « telev » trouve « Téléversements ». */
const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function Palette({ ouverte, fermer, pages, aller, theme, basculerTheme, rafraichir, choisirDossier }: Proprietes) {
  const [q, setQ] = useState("");
  const [actif, setActif] = useState(0);
  const [artistes, setArtistes] = useState<{ _id: string; stageName: string; coverUrl?: string | null; verified?: boolean }[]>([]);
  const champ = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouverte) return;
    setQ("");
    setActif(0);
    setArtistes([]);
    requestAnimationFrame(() => champ.current?.focus());
  }, [ouverte]);

  // Les artistes du site, après une courte pause de frappe.
  useEffect(() => {
    const terme = q.trim();
    if (!ouverte || terme.length < 2) return setArtistes([]);
    const t = setTimeout(() => {
      api<{ artists: { _id: string; stageName: string; coverUrl?: string | null; verified?: boolean }[] }>(`/api/artists?search=${encodeURIComponent(terme)}`)
        .then((r) => setArtistes((r.artists ?? []).slice(0, 6)))
        .catch(() => setArtistes([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, ouverte]);

  const entrees = useMemo<EntreePalette[]>(() => {
    const terme = q.trim();
    const n = normaliser(terme);
    const correspond = (e: EntreePalette) => !n || normaliser(`${e.libelle} ${e.motsCles ?? ""}`).includes(n);
    const fixes: EntreePalette[] = [
      ...pages.map((p) => ({ id: `page-${p.cle}`, groupe: "Pages" as const, libelle: p.libelle, icone: p.icone, executer: () => aller(p.cle) })),
      { id: "a-dossier", groupe: "Actions", libelle: "Téléverser un dossier de musique", icone: FolderOpen, motsCles: "importer upload envoyer", executer: choisirDossier },
      { id: "a-annonce", groupe: "Actions", libelle: "Nouvelle annonce", icone: Megaphone, motsCles: "notification push message", executer: () => aller("annonces") },
      { id: "a-theme", groupe: "Actions", libelle: theme === "sombre" ? "Passer au thème clair" : "Passer au thème sombre", icone: theme === "sombre" ? Sun : Moon, motsCles: "apparence couleur", executer: basculerTheme },
      { id: "a-actualiser", groupe: "Actions", libelle: "Actualiser les compteurs", icone: RefreshCw, motsCles: "rafraichir recharger", executer: rafraichir },
      { id: "a-maj", groupe: "Actions", libelle: "Vérifier les mises à jour", icone: Settings, motsCles: "version installer", executer: () => aller("reglages") },
    ];
    const resultats = fixes.filter(correspond);
    if (terme) {
      resultats.push(
        { id: "r-titres", groupe: "Rechercher", libelle: `« ${terme} » dans les musiques`, icone: Music, executer: () => aller("catalogue", terme) },
        { id: "r-artistes", groupe: "Rechercher", libelle: `« ${terme} » dans les artistes`, icone: Mic2, executer: () => aller("artistes", terme) },
        { id: "r-comptes", groupe: "Rechercher", libelle: `« ${terme} » dans les utilisateurs`, icone: Users, executer: () => aller("comptes", terme) },
      );
    }
    for (const a of artistes) {
      resultats.push({ id: `art-${a._id}`, groupe: "Artistes", libelle: a.stageName, detail: a.verified ? "vérifié" : undefined, image: a.coverUrl, executer: () => aller("artistes", a.stageName) });
    }
    return resultats;
  }, [q, pages, artistes, theme, aller, basculerTheme, rafraichir, choisirDossier]);

  useEffect(() => setActif(0), [q]);
  useEffect(() => {
    liste.current?.querySelector(`[data-palette="${actif}"]`)?.scrollIntoView({ block: "nearest" });
  }, [actif]);

  if (!ouverte) return null;

  const executer = (e: EntreePalette) => {
    fermer();
    e.executer();
  };

  let rang = -1;
  const groupes = ["Pages", "Actions", "Rechercher", "Artistes"] as const;

  return (
    <div className="animate-paraitre fixed inset-0 z-50 flex items-start justify-center bg-black/45 px-6 pt-[12vh]" onMouseDown={fermer}>
      <div className="animate-monter w-full max-w-[620px] overflow-hidden rounded-2xl border border-filet bg-surface shadow-2xl shadow-black/40" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-filet px-4">
          <Search size={18} className="shrink-0 text-texte-3" />
          <input
            ref={champ}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") return fermer();
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const total = entrees.length;
                if (total) setActif((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + total) % total);
              } else if (e.key === "Enter" && entrees[actif]) {
                e.preventDefault();
                executer(entrees[actif]);
              }
            }}
            placeholder="Aller à une page, lancer une action, chercher un artiste…"
            className="h-14 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-texte-3"
          />
          <kbd className="rounded-md border border-filet px-1.5 py-0.5 text-[11px] text-texte-3">Échap</kbd>
        </div>
        <div ref={liste} className="max-h-[52vh] overflow-y-auto py-2">
          {entrees.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-texte-3">Rien ne correspond.</p>}
          {groupes.map((g) => {
            const duGroupe = entrees.filter((e) => e.groupe === g);
            if (duGroupe.length === 0) return null;
            return (
              <div key={g} className="mb-1">
                <div className="px-5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-texte-3 uppercase">{g}</div>
                {duGroupe.map((e) => {
                  rang = entrees.indexOf(e);
                  const i = rang;
                  const Icone = e.icone;
                  return (
                    <button
                      key={e.id}
                      data-palette={i}
                      onMouseMove={() => setActif(i)}
                      onClick={() => executer(e)}
                      className={clsx("flex w-full items-center gap-3 px-5 py-2 text-left text-[13.5px]", actif === i && "bg-surface-2")}
                    >
                      {e.image !== undefined ? (
                        e.image ? (
                          <img src={adresseImage(e.image) ?? undefined} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-texte-3">
                            <Mic2 size={14} />
                          </span>
                        )
                      ) : (
                        <span className={clsx("grid h-7 w-7 shrink-0 place-items-center rounded-lg", actif === i ? "bg-accent text-sur-accent" : "bg-surface-2 text-texte-2")}>
                          {Icone ? <Icone size={15} /> : <ArrowRight size={15} />}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate">{e.libelle}</span>
                      {e.detail && <span className="text-[11.5px] text-texte-3">{e.detail}</span>}
                      {actif === i && <CornerDownLeft size={14} className="shrink-0 text-texte-3" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-filet px-5 py-2 text-[11.5px] text-texte-3">
          <span className="inline-flex items-center gap-1">
            <Command size={12} /> Ctrl + K pour rouvrir
          </span>
          <span>↑ ↓ pour choisir, Entrée pour valider</span>
        </div>
      </div>
    </div>
  );
}
