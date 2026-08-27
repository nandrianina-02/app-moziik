"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Search, LifeBuoy, FileQuestion, Loader2, X, MessageSquare } from "lucide-react";

type ArticleListe = {
  _id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  views: number;
};

/**
 * Centre d'aide.
 *
 * La recherche interroge le serveur plutôt que de filtrer une liste déjà
 * chargée : le corps des articles n'est pas envoyé au navigateur — seuls
 * les résumés le sont — et c'est pourtant dans le corps que se trouve la
 * réponse qu'on cherche.
 */
export default function AidePage() {
  const [articles, setArticles] = useState<ArticleListe[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const premierChargement = useRef(true);

  const charger = useCallback(async (q: string, cat: string | null, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (cat) params.set("category", cat);
    const res = await fetch(`/api/help?${params}`, { signal });
    if (!res.ok) throw new Error();
    return (await res.json()) as { articles: ArticleListe[]; categories: string[] };
  }, []);

  useEffect(() => {
    const controleur = new AbortController();
    // Temps mort à la frappe, sauf au tout premier rendu où il n'y aurait
    // rien à attendre : la page resterait vide une demi-seconde de trop.
    const delai = premierChargement.current ? 0 : 300;
    premierChargement.current = false;
    setChargement(true);
    const minuteur = setTimeout(() => {
      charger(recherche.trim(), categorie, controleur.signal)
        .then((data) => {
          setArticles(data.articles);
          // La liste des catégories ne dépend pas du filtre courant : la
          // recalculer sur un résultat filtré ferait disparaître les
          // autres onglets dès la première recherche.
          if (!recherche.trim() && !categorie) setCategories(data.categories);
          setChargement(false);
        })
        .catch((err) => {
          if (err?.name !== "AbortError") setChargement(false);
        });
    }, delai);
    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, [recherche, categorie, charger]);

  const parCategorie = useMemo(() => {
    const groupes = new Map<string, ArticleListe[]>();
    for (const a of articles) {
      if (!groupes.has(a.category)) groupes.set(a.category, []);
      groupes.get(a.category)!.push(a);
    }
    return [...groupes.entries()];
  }, [articles]);

  const enRecherche = recherche.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 md:px-10 md:py-10">
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-ink-muted">
        <Link href="/" className="hover:text-ink">
          Accueil
        </Link>
        <ChevronRight size={14} />
        <span className="text-ink">Centre d&apos;aide</span>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-7"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl2 bg-accent/10 text-accent">
            <LifeBuoy size={20} />
          </span>
          <div>
            <h1 className="text-2xl font-display font-bold md:text-3xl">Centre d&apos;aide</h1>
            <p className="mt-1 text-sm text-ink-muted">Trouvez une réponse en quelques secondes.</p>
          </div>
        </div>

        <div className="relative mt-6">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une question…"
            aria-label="Rechercher dans le centre d'aide"
            className="w-full rounded-xl2 border border-border bg-surface py-3 pl-11 pr-11 text-sm outline-none focus:border-accent"
          />
          {enRecherche && (
            <button
              type="button"
              onClick={() => setRecherche("")}
              aria-label="Effacer la recherche"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-muted transition-colors hover:text-ink"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {categories.length > 0 && !enRecherche && (
          <div className="mt-4 flex flex-wrap gap-2">
            <BoutonCategorie actif={categorie === null} onClick={() => setCategorie(null)}>
              Tout
            </BoutonCategorie>
            {categories.map((c) => (
              <BoutonCategorie key={c} actif={categorie === c} onClick={() => setCategorie(c)}>
                {c}
              </BoutonCategorie>
            ))}
          </div>
        )}
      </motion.div>

      {chargement ? (
        <p className="flex items-center gap-2 py-12 text-sm text-ink-muted">
          <Loader2 size={15} className="animate-spin" /> Chargement…
        </p>
      ) : articles.length === 0 ? (
        <VideAide enRecherche={enRecherche} terme={recherche.trim()} />
      ) : (
        <div className="space-y-8">
          {parCategorie.map(([nom, liste]) => (
            <section key={nom}>
              {!enRecherche && (
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-muted">{nom}</h2>
              )}
              <ul className="space-y-2">
                {liste.map((article) => (
                  <li key={article._id}>
                    <Link
                      href={`/aide/${article.slug}`}
                      className="group flex items-start gap-3 rounded-xl2 border border-border bg-surface p-4 transition-colors hover:border-accent"
                    >
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-base text-ink-muted transition-colors group-hover:text-accent">
                        <FileQuestion size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{article.title}</span>
                        {article.excerpt && (
                          <span className="mt-0.5 block text-xs text-ink-muted">{article.excerpt}</span>
                        )}
                        {enRecherche && (
                          <span className="mt-1 block text-[11px] text-ink-muted">{article.category}</span>
                        )}
                      </span>
                      <ChevronRight
                        size={16}
                        className="mt-1 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl2 border border-border bg-surface p-5">
        <div>
          <p className="text-sm font-medium text-ink">Vous n&apos;avez pas trouvé ?</p>
          <p className="mt-0.5 text-xs text-ink-muted">Notre équipe répond directement depuis la page de contact.</p>
        </div>
        <Link
          href="/contact"
          className="flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
        >
          <MessageSquare size={15} /> Nous écrire
        </Link>
      </div>
    </div>
  );
}

function BoutonCategorie({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
        actif ? "border-accent bg-accent/10 text-accent" : "border-border text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function VideAide({ enRecherche, terme }: { enRecherche: boolean; terme: string }) {
  return (
    <div className="rounded-xl2 border border-border bg-surface px-6 py-12 text-center">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-base text-ink-muted">
        <FileQuestion size={20} />
      </span>
      {enRecherche ? (
        <>
          <p className="text-sm text-ink">Aucun article ne correspond à « {terme} ».</p>
          <p className="mt-1 text-xs text-ink-muted">
            Essayez un autre mot, ou écrivez-nous : on vous répond directement.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-ink">Le centre d&apos;aide est encore vide.</p>
          <p className="mt-1 text-xs text-ink-muted">
            Les articles seront publiés prochainement. En attendant, la page de contact reste ouverte.
          </p>
        </>
      )}
    </div>
  );
}
