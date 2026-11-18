import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckSquare, Eye, EyeOff, ExternalLink, FilePlus2, LifeBuoy, Link2, PackagePlus, Pencil, RefreshCw, Search, Sparkles, Square, Trash2 } from "lucide-react";
import { api, adresseSite } from "../api";
import { Bascule, Bouton, Carte, Champ, Chargement, EnTete, Erreur, Pastille, Tiroir, Vide, ZoneTexte, formatDate, formatNombre, formatRelatif, BarreCollante } from "../composants";
import { annoncer, classeChoisi, confirmer, copier, ouvrirMenu, useSelection } from "../interactions";
import clsx from "../clsx";

interface Article {
  _id: string;
  title: string;
  slug: string;
  category: string;
  excerpt?: string;
  body: string;
  position?: number;
  published: boolean;
  views?: number;
  updatedAt?: string;
}

interface Brouillon {
  titre: string;
  resume: string;
  corps: string;
  aVerifier: string[];
}

/**
 * Copie de CATEGORIES_AIDE (lib/helpCenter.ts du site) : la liste
 * proposée avant qu'un seul article n'existe. À tenir alignée à la main,
 * le logiciel ne peut pas importer le code du site.
 */
const CATEGORIES_AIDE = ["Compte", "Abonnement & paiement", "Écoute & téléchargement", "Espace artiste", "Confidentialité & sécurité"];

type Filtre = "tous" | "publies" | "brouillons";

/**
 * Le centre d'aide public : les articles de /aide, brouillons compris.
 * Le slug est fixé à la création et ne suit plus le titre, parce qu'il
 * vit déjà dans des liens partagés.
 */
export function Aide() {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [auDepart, setAuDepart] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [edite, setEdite] = useState<Article | "nouveau" | null>(null);
  const [installation, setInstallation] = useState(false);
  const [iaAide, setIaAide] = useState(false);

  const charger = useCallback(() => {
    setErreur(null);
    return api<{ articles: Article[]; disponibleAuDepart: number }>("/api/admin/help")
      .then((r) => {
        setArticles(r.articles ?? []);
        setAuDepart(r.disponibleAuDepart ?? 0);
      })
      .catch((e: Error) => setErreur(e.message));
  }, []);

  useEffect(() => {
    void charger();
    // Le bouton de rédaction n'apparaît que si la fonction est active sur le
    // site : sinon il répondrait par une erreur à chaque clic.
    api<{ aiFeatures?: string[] }>("/api/site-config")
      .then((c) => setIaAide((c.aiFeatures ?? []).includes("aide")))
      .catch(() => setIaAide(false));
  }, [charger]);

  const categories = useMemo(() => [...new Set([...CATEGORIES_AIDE, ...(articles ?? []).map((a) => a.category).filter(Boolean)])], [articles]);

  // Les groupes suivent l'ordre des catégories proposées, puis les autres ;
  // à l'intérieur, la position choisie, comme sur le site.
  const groupes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const visibles = (articles ?? []).filter((a) => {
      if (filtre === "publies" && !a.published) return false;
      if (filtre === "brouillons" && a.published) return false;
      if (!q) return true;
      return [a.title, a.excerpt ?? "", a.body, a.category].some((t) => t.toLowerCase().includes(q));
    });
    return categories
      .map((c) => ({ categorie: c, articles: visibles.filter((a) => a.category === c).sort((x, y) => (x.position ?? 0) - (y.position ?? 0) || x.title.localeCompare(y.title, "fr")) }))
      .filter((g) => g.articles.length > 0);
  }, [articles, categories, recherche, filtre]);

  const plats = useMemo(() => groupes.flatMap((g) => g.articles), [groupes]);
  const sel = useSelection(
    plats.map((a) => a._id),
    (id) => {
      const a = plats.find((x) => x._id === id);
      if (a) setEdite(a);
    },
  );

  const lienArticle = (a: Article) => `${adresseSite()}/aide/${a.slug}`;

  async function installerDepart() {
    const ok = await confirmer({
      titre: "Installer le contenu de départ ?",
      message: `${auDepart} articles rédigés à l'avance sont créés et publiés aussitôt sur le centre d'aide. Vous pourrez ensuite les réécrire ou les supprimer.`,
      confirmer: "Installer",
    });
    if (!ok) return;
    setInstallation(true);
    try {
      const r = await api<{ crees: string[]; ignores: number }>("/api/admin/help", { corps: { action: "installer-contenu-depart" } });
      annoncer(`${r.crees.length} article${r.crees.length > 1 ? "s" : ""} installé${r.crees.length > 1 ? "s" : ""}`);
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Installation refusée.");
    } finally {
      setInstallation(false);
    }
  }

  async function basculerPublication(a: Article) {
    const publier = !a.published;
    const ok = await confirmer(
      publier
        ? { titre: `Publier « ${a.title} » ?`, message: "L'article devient visible de tous sur le centre d'aide.", confirmer: "Publier" }
        : { titre: `Dépublier « ${a.title} » ?`, message: "L'article disparaît du centre d'aide ; les liens déjà partagés ne mèneront plus nulle part.", confirmer: "Dépublier", danger: true },
    );
    if (!ok) return;
    try {
      const { article } = await api<{ article: Article }>(`/api/admin/help/${a._id}`, { methode: "PATCH", corps: { published: publier } });
      setArticles((l) => l?.map((x) => (x._id === a._id ? { ...x, ...article } : x)) ?? l);
      annoncer(publier ? "Article publié" : "Article dépublié");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Modification refusée.");
    }
  }

  async function supprimer(a: Article) {
    const ok = await confirmer({
      titre: `Supprimer « ${a.title} » ?`,
      message: "L'article est supprimé définitivement, avec son compteur de vues.",
      confirmer: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/help/${a._id}`, { methode: "DELETE" });
      setArticles((l) => l?.filter((x) => x._id !== a._id) ?? l);
      annoncer("Article supprimé");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Suppression refusée.");
    }
  }

  function menuArticle(e: React.MouseEvent, rang: number) {
    sel.surMenu(rang);
    const a = plats[rang];
    if (!a) return;
    ouvrirMenu(
      e,
      [
        { libelle: "Modifier", icone: Pencil, raccourci: "Entrée", action: () => setEdite(a) },
        a.published
          ? { libelle: "Dépublier", icone: EyeOff, action: () => void basculerPublication(a) }
          : { libelle: "Publier", icone: Eye, action: () => void basculerPublication(a) },
        "separateur",
        { libelle: "Voir sur le site", icone: ExternalLink, desactive: !a.published, action: () => void window.bureau.ouvrirExterne(lienArticle(a)) },
        { libelle: "Copier le lien", icone: Link2, action: () => void copier(lienArticle(a)).then(() => annoncer("Lien copié")) },
        "separateur",
        { libelle: "Supprimer", icone: Trash2, danger: true, action: () => void supprimer(a) },
      ],
      a.title,
    );
  }

  const total = articles?.length ?? 0;
  const publies = articles?.filter((a) => a.published).length ?? 0;
  let rang = -1;

  return (
    <>
      <EnTete
        titre="Centre d'aide"
        texte={articles ? `${formatNombre(total)} article${total > 1 ? "s" : ""}, dont ${formatNombre(publies)} publié${publies > 1 ? "s" : ""}` : undefined}
        action={
          <>
            <Bouton variante="trait" onClick={() => void charger()}>
              <RefreshCw size={14} /> Actualiser
            </Bouton>
            <Bouton onClick={() => setEdite("nouveau")}>
              <FilePlus2 size={14} /> Nouvel article
            </Bouton>
          </>
        }
      />

      <BarreCollante className="animate-monter decale-1">
        <div className="relative w-80">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texte-3" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Titre, résumé ou contenu"
            className="h-9 w-full rounded-lg border border-filet bg-surface pr-3 pl-9 text-[13px] outline-none placeholder:text-texte-3 focus:border-accent"
          />
        </div>
        <div className="flex rounded-lg border border-filet bg-surface p-0.5">
          {(
            [
              ["tous", "Tous"],
              ["publies", "Publiés"],
              ["brouillons", "Brouillons"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFiltre(v)}
              className={clsx("rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors", filtre === v ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte")}
            >
              {l}
            </button>
          ))}
        </div>
        {articles && (recherche || filtre !== "tous") && (
          <span className="ml-auto text-[12.5px] text-texte-3 tabular-nums">
            {formatNombre(plats.length)} résultat{plats.length > 1 ? "s" : ""}
          </span>
        )}
      </BarreCollante>

      <Erreur message={erreur} />

      {!articles && !erreur ? (
        <Chargement />
      ) : articles && articles.length === 0 ? (
        <Carte className="animate-monter decale-2">
          <div className="flex items-start gap-4">
            <LifeBuoy size={22} className="mt-0.5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <h2 className="font-titre text-[15px] font-semibold">Le centre d'aide est vide</h2>
              <p className="mt-1 text-[13px] text-texte-2">
                Rédigez un premier article, ou installez le contenu de départ : {auDepart} articles sur le compte, l'abonnement, l'écoute et l'espace artiste, à reprendre ensuite à votre façon.
              </p>
              <div className="mt-4 flex gap-2">
                {auDepart > 0 && (
                  <Bouton enCours={installation} onClick={() => void installerDepart()}>
                    <PackagePlus size={14} /> Installer le contenu de départ
                  </Bouton>
                )}
                <Bouton variante="trait" onClick={() => setEdite("nouveau")}>
                  <FilePlus2 size={14} /> Nouvel article
                </Bouton>
              </div>
            </div>
          </div>
        </Carte>
      ) : groupes.length === 0 ? (
        <Vide texte="Aucun article ne correspond." />
      ) : (
        <div className="space-y-5">
          {groupes.map((g, i) => (
            <Carte
              key={g.categorie}
              titre={g.categorie}
              action={<span className="text-[12px] text-texte-3 tabular-nums">{g.articles.length}</span>}
              className={clsx("animate-monter", `decale-${Math.min(i + 2, 6)}`)}
              corps="px-2 pt-2 pb-2"
            >
              <ul className="divide-y divide-filet">
                {g.articles.map((a) => {
                  rang += 1;
                  const r = rang;
                  return (
                    <li
                      key={a._id}
                      data-rang={r}
                      onClick={(e) => sel.surClic(e, r)}
                      onDoubleClick={(e) => sel.surDoubleClic(e, r)}
                      onContextMenu={(e) => menuArticle(e, r)}
                      className={clsx("flex cursor-default items-start gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-surface-2/60", classeChoisi(sel.estChoisi(a._id), "ligne"))}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center">
                          <span className="truncate text-[13.5px] font-semibold">{a.title}</span>
                          {a.published ? <Pastille texte="publié" ton="succes" /> : <Pastille texte="brouillon" />}
                        </div>
                        {a.excerpt && <p className="mt-0.5 line-clamp-2 text-[13px] text-texte-2">{a.excerpt}</p>}
                        <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-texte-3">
                          <span className="tabular-nums">
                            {formatNombre(a.views ?? 0)} vue{(a.views ?? 0) > 1 ? "s" : ""}
                          </span>
                          {a.updatedAt && <span title={formatDate(a.updatedAt)}>modifié {formatRelatif(a.updatedAt)}</span>}
                          <span className="truncate">/aide/{a.slug}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => void basculerPublication(a)}
                          title={a.published ? "Dépublier" : "Publier"}
                          className={clsx("grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-2", a.published ? "text-succes" : "text-texte-3 hover:text-texte")}
                        >
                          {a.published ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                        <button onClick={() => setEdite(a)} title="Modifier" className="grid h-8 w-8 place-items-center rounded-lg text-texte-3 hover:bg-surface-2 hover:text-texte">
                          <Pencil size={15} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Carte>
          ))}
        </div>
      )}

      {edite && (
        <EditeurArticle
          article={edite === "nouveau" ? null : edite}
          categories={categories}
          iaDisponible={iaAide}
          onFermer={() => setEdite(null)}
          onEnregistre={(a, nouveau) => {
            setArticles((l) => (nouveau ? [...(l ?? []), a] : (l ?? []).map((x) => (x._id === a._id ? { ...x, ...a } : x))));
            setEdite(a);
          }}
        />
      )}
    </>
  );
}

interface Formulaire {
  title: string;
  category: string;
  excerpt: string;
  body: string;
  position: string;
  published: boolean;
}

const versFormulaire = (a: Article | null, categorie: string): Formulaire => ({
  title: a?.title ?? "",
  category: a?.category ?? categorie,
  excerpt: a?.excerpt ?? "",
  body: a?.body ?? "",
  position: a?.position !== undefined ? String(a.position) : "",
  published: a?.published ?? false,
});

function EditeurArticle({
  article,
  categories,
  iaDisponible,
  onFermer,
  onEnregistre,
}: {
  article: Article | null;
  categories: string[];
  iaDisponible: boolean;
  onFermer: () => void;
  onEnregistre: (a: Article, nouveau: boolean) => void;
}) {
  const [depart, setDepart] = useState(() => versFormulaire(article, categories[0] ?? ""));
  const [f, setF] = useState(depart);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [notes, setNotes] = useState("");
  const [redaction, setRedaction] = useState(false);
  const [aVerifier, setAVerifier] = useState<{ texte: string; fait: boolean }[]>([]);

  const maj = (p: Partial<Formulaire>) => setF((x) => ({ ...x, ...p }));
  const modifie = JSON.stringify(f) !== JSON.stringify(depart);

  async function fermer() {
    if (modifie) {
      const ok = await confirmer({ titre: "Abandonner les modifications ?", message: "Ce qui a été saisi depuis le dernier enregistrement sera perdu.", confirmer: "Abandonner", danger: true });
      if (!ok) return;
    }
    onFermer();
  }

  function verifier(): string | null {
    if (f.title.trim().length < 3) return "Le titre doit compter au moins 3 caractères.";
    if (!f.category.trim()) return "Choisissez une catégorie.";
    if (f.body.trim().length < 10) return "Le contenu doit compter au moins 10 caractères.";
    if (f.position.trim() !== "") {
      const p = Number(f.position);
      if (!Number.isInteger(p) || p < 0 || p > 999) return "La position est un nombre entier entre 0 et 999.";
    }
    return null;
  }

  async function enregistrer() {
    const probleme = verifier();
    if (probleme) return setErreur(probleme);
    // Seul ce qui sera visible du public mérite une confirmation : un
    // brouillon s'enregistre sans détour.
    if (f.published) {
      const ok = await confirmer({
        titre: article ? "Mettre à jour l'article publié ?" : "Publier ce nouvel article ?",
        message: article ? "Les modifications seront visibles tout de suite sur le centre d'aide." : "L'article sera visible de tous sur le centre d'aide dès l'enregistrement.",
        confirmer: article ? "Mettre à jour" : "Publier",
      });
      if (!ok) return;
    }
    setEnCours(true);
    setErreur(null);
    const position = f.position.trim() === "" ? undefined : Number(f.position);
    try {
      if (!article) {
        const { article: cree } = await api<{ article: Article }>("/api/admin/help", {
          corps: { title: f.title.trim(), category: f.category.trim(), excerpt: f.excerpt.trim() || undefined, body: f.body.trim(), position, published: f.published },
        });
        const neuf = versFormulaire(cree, f.category);
        setDepart(neuf);
        setF(neuf);
        onEnregistre(cree, true);
        annoncer("Article créé");
      } else {
        // Seuls les champs changés partent : la route ne touche qu'à ce qu'on lui envoie.
        const corps: Record<string, unknown> = {};
        if (f.title.trim() !== depart.title) corps.title = f.title.trim();
        if (f.category.trim() !== depart.category) corps.category = f.category.trim();
        if (f.excerpt.trim() !== depart.excerpt) corps.excerpt = f.excerpt.trim();
        if (f.body.trim() !== depart.body) corps.body = f.body.trim();
        if (f.position !== depart.position && position !== undefined) corps.position = position;
        if (f.published !== depart.published) corps.published = f.published;
        if (Object.keys(corps).length === 0) return;
        const { article: maj } = await api<{ article: Article }>(`/api/admin/help/${article._id}`, { methode: "PATCH", corps });
        const neuf = versFormulaire(maj, f.category);
        setDepart(neuf);
        setF(neuf);
        onEnregistre(maj, false);
        annoncer("Article enregistré");
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement refusé.");
    } finally {
      setEnCours(false);
    }
  }

  async function rediger() {
    if (f.title.trim().length < 3) return setErreur("Indiquez d'abord le titre de l'article.");
    if (f.body.trim()) {
      const ok = await confirmer({
        titre: "Remplacer le texte par un brouillon ?",
        message: "Le texte déjà saisi est transmis comme point de départ, puis remplacé dans le formulaire par la proposition. Rien n'est enregistré tant que vous ne validez pas.",
        confirmer: "Rédiger",
      });
      if (!ok) return;
    }
    setRedaction(true);
    setErreur(null);
    try {
      const { brouillon } = await api<{ brouillon: Brouillon }>("/api/admin/help/draft", {
        corps: { title: f.title.trim(), category: f.category.trim(), notes: notes.slice(0, 4000), body: f.body.trim() ? f.body.slice(0, 6000) : undefined },
      });
      maj({
        title: brouillon.titre?.trim() || f.title,
        excerpt: brouillon.resume?.slice(0, 300) ?? f.excerpt,
        body: brouillon.corps ?? f.body,
      });
      setAVerifier((brouillon.aVerifier ?? []).map((texte) => ({ texte, fait: false })));
      annoncer("Brouillon proposé : relisez avant d'enregistrer");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Rédaction impossible.");
    } finally {
      setRedaction(false);
    }
  }

  const restants = aVerifier.filter((v) => !v.fait).length;

  return (
    <Tiroir
      titre={article ? article.title : "Nouvel article"}
      sousTitre={article ? `/aide/${article.slug} · l'adresse ne change pas avec le titre` : "L'adresse sera tirée du titre à la création."}
      onFermer={() => void fermer()}
      largeur={640}
      pied={
        <>
          {modifie && <span className="animate-paraitre mr-auto self-center text-[12.5px] text-attention">Modifications non enregistrées</span>}
          {article?.published && (
            <Bouton variante="trait" onClick={() => void window.bureau.ouvrirExterne(`${adresseSite()}/aide/${article.slug}`)}>
              <ExternalLink size={14} /> Voir sur le site
            </Bouton>
          )}
          <Bouton enCours={enCours} disabled={!modifie || redaction} onClick={() => void enregistrer()}>
            {article ? "Enregistrer" : "Créer l'article"}
          </Bouton>
        </>
      }
    >
      <div className="space-y-4">
        <Erreur message={erreur} />
        <Champ libelle="Titre" maxLength={160} value={f.title} onChange={(e) => maj({ title: e.target.value })} placeholder="Ex. Changer mon adresse email" />
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-texte-2">Catégorie</span>
            <input
              list="categories-aide"
              maxLength={60}
              value={f.category}
              onChange={(e) => maj({ category: e.target.value })}
              className="h-9 w-full rounded-lg border border-filet bg-surface-2 px-3 text-[13px] text-texte outline-none placeholder:text-texte-3 focus:border-accent"
              placeholder="Choisir ou saisir"
            />
            <datalist id="categories-aide">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <Champ libelle="Position" type="number" min={0} max={999} value={f.position} onChange={(e) => maj({ position: e.target.value })} placeholder="auto" />
        </div>
        <ZoneTexte
          libelle="Résumé (facultatif)"
          maxLength={300}
          value={f.excerpt}
          onChange={(e) => maj({ excerpt: e.target.value })}
          className="[&_textarea]:min-h-[64px]"
          placeholder="Laissé vide, la première phrase du contenu sert de résumé."
        />
        <div>
          <ZoneTexte
            libelle="Contenu"
            maxLength={20000}
            value={f.body}
            onChange={(e) => maj({ body: e.target.value })}
            className="[&_textarea]:min-h-[340px]"
            placeholder="Le texte de l'article. Une ligne vide sépare les paragraphes."
          />
          <div className="mt-1 text-right text-[12px] text-texte-3 tabular-nums">{formatNombre(f.body.length)} / 20 000</div>
        </div>
        <div className="rounded-xl border border-filet px-4">
          <Bascule libelle="Publié" aide="Visible de tous sur le centre d'aide. Un brouillon reste ici." valeur={f.published} onChange={(v) => maj({ published: v })} />
        </div>

        {iaDisponible && (
          <section className="rounded-xl border border-filet p-4">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold">
              <Sparkles size={15} className="text-accent" /> Brouillon rédigé par l'IA
            </h3>
            <p className="mt-1 text-[12px] text-texte-3">
              À partir du titre, de la catégorie et de vos notes. Le texte remplit le formulaire sans rien enregistrer ; ce que l'IA ne sait pas est marqué [À COMPLÉTER].
            </p>
            <ZoneTexte
              className="mt-3 [&_textarea]:min-h-[80px]"
              maxLength={4000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ce que l'article doit dire : étapes, limites, délais, cas particuliers."
            />
            <div className="mt-3 flex justify-end">
              <Bouton variante="trait" enCours={redaction} disabled={enCours} onClick={() => void rediger()}>
                <Sparkles size={14} /> Rédiger un brouillon
              </Bouton>
            </div>
            {aVerifier.length > 0 && (
              <div className="animate-paraitre mt-4 border-t border-filet pt-3">
                <div className="mb-2 text-[12px] font-semibold text-texte-2">
                  À vérifier avant de publier {restants > 0 ? <span className="text-attention">({restants} restant{restants > 1 ? "s" : ""})</span> : <span className="text-succes">(tout est vu)</span>}
                </div>
                <ul className="space-y-1">
                  {aVerifier.map((v, i) => (
                    <li key={i}>
                      <button
                        onClick={() => setAVerifier((l) => l.map((x, j) => (j === i ? { ...x, fait: !x.fait } : x)))}
                        className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-[13px] hover:bg-surface-2"
                      >
                        {v.fait ? <CheckSquare size={15} className="mt-0.5 shrink-0 text-succes" /> : <Square size={15} className="mt-0.5 shrink-0 text-texte-3" />}
                        <span className={clsx(v.fait && "text-texte-3 line-through")}>{v.texte}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </Tiroir>
  );
}
