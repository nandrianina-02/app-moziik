"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Sparkles,
  Loader2,
  Search,
} from "lucide-react";
import { AdminCardsSkeleton } from "@/components/admin/AdminSkeleton";
import { FormField } from "@/components/ui/FormField";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { useIADisponible } from "@/context/SiteConfigProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastProvider";
import { CATEGORIES_AIDE } from "@/lib/helpCenter";
import { readApiError } from "@/lib/readApiError";

type Article = {
  _id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  body: string;
  position: number;
  published: boolean;
  views: number;
  updatedAt: string;
};

type Brouillon = { title: string; category: string; excerpt: string; body: string; published: boolean };

const BROUILLON_VIDE: Brouillon = {
  title: "",
  category: CATEGORIES_AIDE[0],
  excerpt: "",
  body: "",
  published: true,
};

export default function AdminAidePage() {
  const pushToast = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [installation, setInstallation] = useState(false);

  const [edition, setEdition] = useState<{ article: Article | null; brouillon: Brouillon } | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [aSupprimer, setASupprimer] = useState<Article | null>(null);
  const iaAide = useIADisponible("aide");
  const [notesIA, setNotesIA] = useState("");
  const [redaction, setRedaction] = useState(false);
  const [aVerifier, setAVerifier] = useState<string[]>([]);

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/help");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setArticles(data.articles);
    } catch {
      pushToast("error", "Impossible de charger les articles.");
    } finally {
      setChargement(false);
    }
  }, [pushToast]);

  useEffect(() => {
    charger();
  }, [charger]);

  /** Catégories déjà utilisées, plus celles proposées par défaut. */
  const categories = useMemo(() => {
    const vues = new Set([...CATEGORIES_AIDE, ...articles.map((a) => a.category)]);
    return [...vues].sort((a, b) => a.localeCompare(b, "fr"));
  }, [articles]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) =>
      [a.title, a.category, a.excerpt].some((champ) => champ.toLowerCase().includes(q))
    );
  }, [articles, recherche]);

  const parCategorie = useMemo(() => {
    const groupes = new Map<string, Article[]>();
    for (const a of filtres) {
      if (!groupes.has(a.category)) groupes.set(a.category, []);
      groupes.get(a.category)!.push(a);
    }
    return [...groupes.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [filtres]);

  async function installerContenuDepart() {
    setInstallation(true);
    try {
      const res = await fetch("/api/admin/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "installer-contenu-depart" }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "L'installation a échoué."));
      const data = await res.json();
      pushToast(
        "success",
        data.crees.length > 0
          ? `${data.crees.length} article(s) créé(s).`
          : "Tous les articles de départ sont déjà présents."
      );
      await charger();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "L'installation a échoué.");
    } finally {
      setInstallation(false);
    }
  }

  async function enregistrer() {
    if (!edition) return;
    const { article, brouillon } = edition;
    setEnregistrement(true);
    try {
      const res = await fetch(article ? `/api/admin/help/${article._id}` : "/api/admin/help", {
        method: article ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brouillon),
      });
      if (!res.ok) throw new Error(await readApiError(res, "L'enregistrement a échoué."));
      pushToast("success", article ? "Article mis à jour." : "Article publié.");
      setEdition(null);
      await charger();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "L'enregistrement a échoué.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function basculerPublication(article: Article) {
    // Optimiste : l'interruption visuelle d'un aller-retour serveur pour un
    // simple interrupteur coûte plus qu'elle n'apporte. En cas d'échec on
    // recharge, ce qui rétablit l'état réel.
    setArticles((prev) =>
      prev.map((a) => (a._id === article._id ? { ...a, published: !a.published } : a))
    );
    try {
      const res = await fetch(`/api/admin/help/${article._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !article.published }),
      });
      if (!res.ok) throw new Error();
    } catch {
      pushToast("error", "Le changement n'a pas été enregistré.");
      charger();
    }
  }

  /**
   * Remplit le formulaire avec un brouillon.
   *
   * Le titre est exigé avant l'appel : c'est la question à laquelle
   * l'article répond, et sans elle il n'y a rien à rédiger. Ce qui manque
   * revient marqué « [À COMPLÉTER] » dans le texte et listé sous le
   * formulaire, plutôt que comblé par une formule plausible.
   */
  async function redigerAvecIA() {
    if (!edition) return;
    const titre = edition.brouillon.title.trim();
    if (titre.length < 3) {
      pushToast("error", "Indiquez d'abord le titre de l'article.");
      return;
    }
    setRedaction(true);
    setAVerifier([]);
    try {
      const res = await fetch("/api/admin/help/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titre,
          category: edition.brouillon.category,
          notes: notesIA,
          body: edition.brouillon.body,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "La rédaction a échoué."));
      const { brouillon } = await res.json();
      setEdition((prev) =>
        prev
          ? {
              ...prev,
              brouillon: {
                ...prev.brouillon,
                title: brouillon.titre || prev.brouillon.title,
                excerpt: brouillon.resume || prev.brouillon.excerpt,
                body: brouillon.corps,
              },
            }
          : prev
      );
      setAVerifier(brouillon.aVerifier ?? []);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "La rédaction a échoué.");
    } finally {
      setRedaction(false);
    }
  }

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      const res = await fetch(`/api/admin/help/${aSupprimer._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      pushToast("success", "Article supprimé.");
      setASupprimer(null);
      await charger();
    } catch {
      pushToast("error", "La suppression a échoué.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-bold">Centre d&apos;aide</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Articles publiés sur{" "}
            <Link href="/aide" target="_blank" className="text-accent hover:underline">
              /aide
            </Link>
            . Les visiteurs y accèdent depuis la page de contact.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {articles.length === 0 && !chargement && (
            <button
              type="button"
              onClick={installerContenuDepart}
              disabled={installation}
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
            >
              {installation ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              Installer les articles de départ
            </button>
          )}
          <button
            type="button"
            onClick={() => setEdition({ article: null, brouillon: { ...BROUILLON_VIDE } })}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
          >
            <Plus size={15} /> Nouvel article
          </button>
        </div>
      </div>

      {articles.length > 0 && (
        <div className="relative max-w-md">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Filtrer les articles…"
            aria-label="Filtrer les articles"
            className="w-full rounded-xl border border-border bg-base py-2.5 pl-10 pr-4 text-sm outline-none focus:border-accent"
          />
        </div>
      )}

      {chargement ? (
        <AdminCardsSkeleton count={4} cols={1} />
      ) : articles.length === 0 ? (
        <div className="rounded-xl2 border border-border bg-surface px-6 py-12 text-center">
          <p className="text-sm text-ink">Aucun article pour l&apos;instant.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">
            « Installer les articles de départ » crée une douzaine de réponses courantes — compte, paiement,
            téléchargement, espace artiste — que vous pourrez ensuite réécrire librement.
          </p>
        </div>
      ) : filtres.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">Aucun article ne correspond à ce filtre.</p>
      ) : (
        <div className="space-y-6">
          {parCategorie.map(([categorie, liste]) => (
            <section key={categorie}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">{categorie}</h2>
              <ul className="space-y-2">
                {liste.map((article) => (
                  <li
                    key={article._id}
                    className="flex flex-wrap items-center gap-3 rounded-xl2 border border-border bg-surface p-4"
                  >
                    <div className="min-w-[12rem] flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                        {article.title}
                        {!article.published && (
                          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
                            Brouillon
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {article.excerpt || "—"}
                        <span className="ml-2 whitespace-nowrap">
                          · {article.views} consultation{article.views > 1 ? "s" : ""}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <BoutonIcone
                        libelle={article.published ? "Dépublier" : "Publier"}
                        onClick={() => basculerPublication(article)}
                      >
                        {article.published ? <Eye size={15} /> : <EyeOff size={15} />}
                      </BoutonIcone>
                      <Link
                        href={`/aide/${article.slug}`}
                        target="_blank"
                        aria-label="Voir l'article sur le site"
                        title="Voir l'article sur le site"
                        className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink"
                      >
                        <ExternalLink size={15} />
                      </Link>
                      <BoutonIcone
                        libelle="Modifier"
                        onClick={() =>
                          setEdition({
                            article,
                            brouillon: {
                              title: article.title,
                              category: article.category,
                              excerpt: article.excerpt,
                              body: article.body,
                              published: article.published,
                            },
                          })
                        }
                      >
                        <Pencil size={15} />
                      </BoutonIcone>
                      <BoutonIcone libelle="Supprimer" danger onClick={() => setASupprimer(article)}>
                        <Trash2 size={15} />
                      </BoutonIcone>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {edition && (
        <ModalSheet
          titre={edition.article ? "Modifier l'article" : "Nouvel article"}
          sousTitre={edition.article ? `/aide/${edition.article.slug}` : undefined}
          largeur="sm:max-w-2xl"
          onClose={() => setEdition(null)}
          pied={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEdition(null)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
              >
                Annuler
              </button>
              <button
                type="submit"
                form="formulaire-article"
                disabled={enregistrement}
                className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {enregistrement && <Loader2 size={15} className="animate-spin" />}
                {edition.article ? "Enregistrer" : "Publier"}
              </button>
            </div>
          }
        >
          <form
            id="formulaire-article"
            onSubmit={(e) => {
              e.preventDefault();
              enregistrer();
            }}
            className="space-y-4"
          >
            <FormField
              label="Titre *"
              value={edition.brouillon.title}
              onChange={(e) =>
                setEdition({ ...edition, brouillon: { ...edition.brouillon, title: e.target.value } })
              }
              placeholder="Ex : Télécharger une musique"
              required
            />

            <label className="block">
              <span className="mb-1.5 block text-sm text-ink-muted">Catégorie *</span>
              <input
                list="categories-aide"
                value={edition.brouillon.category}
                onChange={(e) =>
                  setEdition({ ...edition, brouillon: { ...edition.brouillon, category: e.target.value } })
                }
                required
                className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
              />
              <datalist id="categories-aide">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <FormField
              label="Résumé"
              value={edition.brouillon.excerpt}
              onChange={(e) =>
                setEdition({ ...edition, brouillon: { ...edition.brouillon, excerpt: e.target.value } })
              }
              placeholder="Laissé vide, il est déduit des premières lignes."
            />

            {iaAide && (
              <div className="rounded-xl2 border border-border bg-base p-3.5">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Sparkles size={14} className="text-accent" /> Rédiger avec l&apos;IA
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Le brouillon s&apos;appuie sur vos notes et sur les articles déjà publiés. Ce qu&apos;il ignore
                  revient marqué « [À COMPLÉTER] » : rien n&apos;est inventé à la place d&apos;un tarif ou
                  d&apos;un délai.
                </p>
                <textarea
                  value={notesIA}
                  onChange={(e) => setNotesIA(e.target.value)}
                  rows={2}
                  maxLength={4000}
                  aria-label="Notes pour la rédaction"
                  placeholder="Ce que l'article doit dire, en vrac : étapes, conditions, exceptions…"
                  className="mt-2.5 w-full resize-y rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={redigerAvecIA}
                  disabled={redaction}
                  className="mt-2 flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  {redaction ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {redaction ? "Rédaction…" : "Rédiger le contenu"}
                </button>

                {aVerifier.length > 0 && (
                  <div className="mt-3 rounded-xl border border-warning/40 bg-surface p-3">
                    <p className="text-xs font-medium text-ink">À vérifier avant de publier</p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-ink-muted">
                      {aVerifier.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm text-ink-muted">Contenu *</span>
              <textarea
                value={edition.brouillon.body}
                onChange={(e) =>
                  setEdition({ ...edition, brouillon: { ...edition.brouillon, body: e.target.value } })
                }
                rows={12}
                required
                placeholder="Texte simple. Une ligne vide sépare deux paragraphes."
                className="w-full resize-y rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
              />
              <span className="mt-1 block text-xs text-ink-muted">
                Texte brut uniquement : les balises HTML ne sont pas interprétées, elles s&apos;afficheraient
                telles quelles.
              </span>
            </label>

            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={edition.brouillon.published}
                onChange={(e) =>
                  setEdition({ ...edition, brouillon: { ...edition.brouillon, published: e.target.checked } })
                }
                className="h-4 w-4 accent-[rgb(var(--color-accent))]"
              />
              Visible par les visiteurs
            </label>
          </form>
        </ModalSheet>
      )}

      {aSupprimer && (
        <ConfirmDialog
          title="Supprimer cet article ?"
          description={`« ${aSupprimer.title} » sera définitivement retiré du centre d'aide. Les liens qui pointaient vers lui afficheront une page introuvable.`}
          confirmLabel="Supprimer"
          onConfirm={supprimer}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}

function BoutonIcone({
  libelle,
  danger,
  onClick,
  children,
}: {
  libelle: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={libelle}
      title={libelle}
      className={`grid h-9 w-9 place-items-center rounded-lg transition-colors hover:bg-base ${
        danger ? "text-ink-muted hover:text-accent" : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
