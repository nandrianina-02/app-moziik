"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, ArrowLeft, Loader2, FileQuestion, MessageSquare } from "lucide-react";

type Article = {
  _id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  body: string;
  updatedAt: string;
};

type Voisin = { _id: string; title: string; slug: string; excerpt: string };

export default function ArticleAidePage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [voisins, setVoisins] = useState<Voisin[]>([]);
  const [etat, setEtat] = useState<"chargement" | "ok" | "introuvable">("chargement");

  useEffect(() => {
    let vivant = true;
    fetch(`/api/help/${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!vivant) return;
        setArticle(data.article);
        setVoisins(data.voisins ?? []);
        setEtat("ok");
      })
      .catch(() => vivant && setEtat("introuvable"));
    return () => {
      vivant = false;
    };
  }, [slug]);

  if (etat === "chargement") {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16 md:px-10">
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 size={15} className="animate-spin" /> Chargement…
        </p>
      </div>
    );
  }

  if (etat === "introuvable" || !article) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16 text-center md:px-10">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface text-ink-muted">
          <FileQuestion size={20} />
        </span>
        <p className="text-sm text-ink">Cet article n&apos;existe pas ou n&apos;est plus publié.</p>
        <Link href="/aide" className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
          <ArrowLeft size={14} /> Retour au centre d&apos;aide
        </Link>
      </div>
    );
  }

  const misAJour = new Date(article.updatedAt);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 md:px-10 md:py-10">
      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
        <Link href="/" className="hover:text-ink">
          Accueil
        </Link>
        <ChevronRight size={14} />
        <Link href="/aide" className="hover:text-ink">
          Centre d&apos;aide
        </Link>
        <ChevronRight size={14} />
        <span className="truncate text-ink">{article.title}</span>
      </nav>

      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-accent">{article.category}</p>
        <h1 className="mt-2 text-2xl font-display font-bold md:text-3xl">{article.title}</h1>
        {!Number.isNaN(misAJour.getTime()) && (
          <p className="mt-2 text-xs text-ink-muted">
            Mis à jour le {misAJour.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}

        {/*
          Le corps est du texte brut : chaque paragraphe est rendu dans son
          propre <p>, jamais via dangerouslySetInnerHTML. Un article rédigé
          en administration ne peut donc pas injecter de balise sur une page
          publique.
        */}
        <div className="mt-6 space-y-4">
          {article.body
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((paragraphe, i) => (
              <p key={i} className="whitespace-pre-line text-sm leading-relaxed text-ink">
                {paragraphe}
              </p>
            ))}
        </div>
      </motion.article>

      {voisins.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-muted">
            Dans la même catégorie
          </h2>
          <ul className="space-y-2">
            {voisins.map((v) => (
              <li key={v._id}>
                <Link
                  href={`/aide/${v.slug}`}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{v.title}</span>
                  <ChevronRight
                    size={15}
                    className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl2 border border-border bg-surface p-5">
        <div>
          <p className="text-sm font-medium text-ink">Cette réponse ne suffit pas ?</p>
          <p className="mt-0.5 text-xs text-ink-muted">Écrivez-nous, ou ouvrez une discussion avec le support.</p>
        </div>
        <Link
          href="/contact"
          className="flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
        >
          <MessageSquare size={15} /> Nous contacter
        </Link>
      </div>
    </div>
  );
}
