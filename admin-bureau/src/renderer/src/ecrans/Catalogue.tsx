import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, FolderOpen, Link2, Music, RefreshCw, Search, X } from "lucide-react";
import { adresseSite, api } from "../api";
import { Bouton, Champ, Chargement, EnTete, Erreur, Pagination, Pastille, Selection, Table, Vide, formatDate, formatDuree, formatNombre, usePages , BarreCollante } from "../composants";
import { SelecteurVue, coteVignette, largeurCarte, nomTransition, useRaccourciVue, useVue } from "../vues";
import clsx from "../clsx";
import { BarreSelection, annoncer, classeChoisi, confirmer, copier, ouvrirMenu, useSelection } from "../interactions";
import { adresseImage } from "../session";

interface Titre {
  _id: string;
  title: string;
  artist?: { _id: string; stageName: string; verified?: boolean } | null;
  featuring?: { artist?: { _id: string; stageName: string } | null }[];
  genre: string;
  status: "draft" | "scheduled" | "published" | "rejected";
  releaseDate?: string;
  duration: number;
  playsCount?: number;
  coverUrl?: string;
  explicit?: boolean;
  createdAt?: string;
}

const STATUTS: Record<Titre["status"], { libelle: string; ton: "neutre" | "succes" | "attention" | "danger" }> = {
  published: { libelle: "Publié", ton: "succes" },
  scheduled: { libelle: "Programmé", ton: "attention" },
  draft: { libelle: "En attente", ton: "attention" },
  rejected: { libelle: "Refusé", ton: "danger" },
};

/**
 * Le catalogue : tous les titres, filtrés par état, cherchés par titre ou
 * artiste, et corrigés en place (titre, genre, date, explicite). Les
 * titres en attente se valident ou se refusent d'ici.
 */
export function Catalogue({ rechercheInitiale = "", statutInitial = "" }: { rechercheInitiale?: string; statutInitial?: "" | "draft" }) {
  const [titres, setTitres] = useState<Titre[] | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [statut, setStatut] = useState<"" | Titre["status"]>(statutInitial);
  const [recherche, setRecherche] = useState(rechercheInitiale);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<Titre | null>(null);

  const charger = () => {
    setTitres(null);
    api<{ songs: Titre[] }>(`/api/admin/songs${statut ? `?status=${statut}` : ""}`)
      .then((r) => setTitres(r.songs))
      .catch((e) => setErreur(e.message));
  };
  useEffect(charger, [statut]);
  useEffect(() => {
    api<{ genres?: string[] }>("/api/site-config").then((c) => setGenres(c.genres ?? [])).catch(() => undefined);
  }, []);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return titres ?? [];
    return (titres ?? []).filter((t) => t.title.toLowerCase().includes(q) || t.artist?.stageName.toLowerCase().includes(q));
  }, [titres, recherche]);
  // Le site rend tout le catalogue d'un coup ; l'afficher en entier ferait
  // une table de plusieurs milliers de lignes.
  const pages = usePages(visibles, 50, `${statut}|${recherche}`);
  const [vue, changerVue] = useVue("catalogue", { mode: "liste", taille: "moyenne" });
  useRaccourciVue(vue, changerVue);

  // Clic : sélectionner ; double-clic ou Entrée : ouvrir la fiche ; clic droit : actions.
  const sel = useSelection(
    pages.tranche.map((t) => t._id),
    (id) => setOuvert((titres ?? []).find((t) => t._id === id) ?? null),
  );
  const lienTitre = (id: string) => `${adresseSite()}/son/${id}`;
  const enAttente = (t: Titre) => t.status === "draft" || t.status === "rejected";

  /** Valider ou refuser des titres : la même décision que la modération du site. */
  async function moderer(ids: string[], decision: "approve" | "reject") {
    const cibles = (titres ?? []).filter((t) => ids.includes(t._id) && (decision === "reject" ? t.status !== "rejected" : enAttente(t)));
    if (cibles.length === 0) return;
    const quoi = cibles.length > 1 ? `ces ${cibles.length} titres` : `« ${cibles[0].title} »`;
    const ok = await confirmer(
      decision === "reject"
        ? { titre: `Refuser ${quoi} ?`, message: "Ils ne seront plus visibles du public. L'artiste voit le refus dans son espace.", confirmer: "Refuser", danger: true }
        : { titre: `Valider ${quoi} ?`, message: "Ils seront publiés aussitôt, ou à leur date de sortie si elle est à venir.", confirmer: "Valider et publier" },
    );
    if (!ok) return;
    let faits = 0;
    for (const t of cibles) {
      try {
        await api(`/api/admin/songs/${t._id}/moderate`, { corps: { decision } });
        const statut: Titre["status"] = decision === "reject" ? "rejected" : t.releaseDate && new Date(t.releaseDate) > new Date() ? "scheduled" : "published";
        setTitres((liste) => (liste ?? []).map((x) => (x._id === t._id ? { ...x, status: statut } : x)));
        faits++;
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Décision refusée.");
      }
    }
    annoncer(`${faits} titre${faits > 1 ? "s" : ""} ${decision === "approve" ? "validé" : "refusé"}${faits > 1 ? "s" : ""}`);
  }

  async function copierLiens(ids: string[]) {
    if (await copier(ids.map(lienTitre).join("\n"))) annoncer(ids.length > 1 ? `${ids.length} liens copiés` : "Lien copié");
  }

  function menuTitre(e: React.MouseEvent, rang: number) {
    const ids = sel.surMenu(rang);
    const cibles = (titres ?? []).filter((t) => ids.includes(t._id));
    if (cibles.length === 0) return;
    const enAttenteSel = cibles.filter(enAttente).length;
    if (cibles.length === 1) {
      const t = cibles[0];
      return ouvrirMenu(
        e,
        [
          { libelle: "Ouvrir la fiche", icone: FolderOpen, raccourci: "Entrée", action: () => setOuvert(t) },
          { libelle: "Écouter sur le site", icone: ExternalLink, action: () => void window.bureau.ouvrirExterne(lienTitre(t._id)) },
          "separateur",
          enAttente(t) && { libelle: "Valider", icone: Check, action: () => void moderer([t._id], "approve") },
          t.status !== "rejected" && { libelle: "Refuser", icone: X, danger: true, action: () => void moderer([t._id], "reject") },
          "separateur",
          { libelle: "Copier le lien", icone: Link2, action: () => void copierLiens([t._id]) },
          { libelle: "Copier le titre", icone: Copy, action: () => void copier(`${t.artist?.stageName ?? ""} - ${t.title}`).then(() => annoncer("Titre copié")) },
        ],
        t.title,
      );
    }
    ouvrirMenu(
      e,
      [
        enAttenteSel > 0 && { libelle: `Valider (${enAttenteSel})`, icone: Check, action: () => void moderer(ids, "approve") },
        { libelle: `Refuser (${cibles.length})`, icone: X, danger: true, action: () => void moderer(ids, "reject") },
        "separateur",
        { libelle: `Copier les ${cibles.length} liens`, icone: Link2, action: () => void copierLiens(ids) },
      ],
      `${cibles.length} titres sélectionnés`,
    );
  }
  const pagination = <Pagination page={pages.page} pages={pages.pages} total={pages.total} taille={pages.taille} onPage={pages.setPage} />;

  return (
    <>
      <EnTete
        titre="Musiques"
        texte={titres ? `${visibles.length} titre${visibles.length > 1 ? "s" : ""}${recherche.trim() ? ` pour « ${recherche.trim()} »` : ""}` : undefined}
        action={
          <Bouton variante="trait" onClick={charger}>
            <RefreshCw size={14} /> Actualiser
          </Bouton>
        }
      />
      <BarreCollante className="animate-monter decale-1">
        <div className="relative w-80">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texte-3" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Titre ou artiste"
            className="h-9 w-full rounded-lg border border-filet bg-surface pr-3 pl-9 text-[13px] outline-none placeholder:text-texte-3 focus:border-accent"
          />
        </div>
        <div className="flex rounded-lg border border-filet bg-surface p-0.5">
          {([["", "Tous"], ["published", "Publiés"], ["draft", "En attente"], ["scheduled", "Programmés"], ["rejected", "Refusés"]] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setStatut(v)}
              className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors ${statut === v ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <SelecteurVue vue={vue} onChange={changerVue} />
          {titres && pagination}
        </div>
      </BarreCollante>
      <Erreur message={erreur} />
      {!titres ? (
        <Chargement />
      ) : visibles.length === 0 ? (
        <Vide texte="Aucun titre." />
      ) : (
        <div>
          {vue.mode === "grille" ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${largeurCarte[vue.taille]}px, 1fr))` }}>
              {pages.tranche.map((t, rang) => (
                <button
                  key={t._id}
                  data-rang={rang}
                  onClick={(e) => sel.surClic(e, rang)}
                  onDoubleClick={(e) => sel.surDoubleClic(e, rang)}
                  onContextMenu={(e) => menuTitre(e, rang)}
                  className={clsx("group rounded-2xl border border-filet bg-surface p-2.5 text-left transition-colors hover:border-texte-3/40", classeChoisi(sel.estChoisi(t._id), "carte"))}
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-2" style={nomTransition("c", t._id, rang)}>
                    {t.coverUrl ? (
                      <img src={adresseImage(t.coverUrl) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-texte-3">
                        <Music size={vue.taille === "petite" ? 22 : 30} />
                      </span>
                    )}
                    {t.status !== "published" && (
                      <span className="absolute top-2 left-2">
                        <Pastille texte={STATUTS[t.status]?.libelle ?? t.status} ton={STATUTS[t.status]?.ton ?? "neutre"} />
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 px-0.5">
                    <div className={clsx("truncate font-semibold", vue.taille === "petite" ? "text-[12.5px]" : "text-[13.5px]")}>
                      {t.title}
                    </div>
                    <div className="truncate text-[12px] text-texte-3">{t.artist?.stageName ?? "—"}</div>
                    {vue.taille !== "petite" && (
                      <div className="mt-1 flex justify-between text-[11.5px] text-texte-3 tabular-nums">
                        <span>{t.genre}</span>
                        <span>{formatNombre(t.playsCount ?? 0)} écoutes</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <Table densite={vue.taille} entetes={["", "Titre", "Artiste", "Genre", { libelle: "Sortie", largeur: "110px" }, { libelle: "Durée", droite: true, largeur: "70px" }, { libelle: "Écoutes", droite: true, largeur: "80px" }, { libelle: "État", largeur: "110px" }]}>
              {pages.tranche.map((t, rang) => (
                <tr
                  key={t._id}
                  data-rang={rang}
                  onClick={(e) => sel.surClic(e, rang)}
                  onDoubleClick={(e) => sel.surDoubleClic(e, rang)}
                  onContextMenu={(e) => menuTitre(e, rang)}
                  className={clsx("cursor-default", classeChoisi(sel.estChoisi(t._id), "ligne"))}
                >
                  <td style={{ width: coteVignette[vue.taille] + 24 }}>
                    <div className="overflow-hidden rounded-md bg-surface-2" style={{ width: coteVignette[vue.taille], height: coteVignette[vue.taille], ...nomTransition("c", t._id, rang) }}>
                      {t.coverUrl && <img src={adresseImage(t.coverUrl) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    </div>
                  </td>
                  <td className="font-medium">
                    <span>{t.title}</span>
                    {t.explicit && <Pastille texte="explicite" />}
                  </td>
                  <td className="text-texte-2">
                    {t.artist?.stageName ?? "—"}
                    {t.featuring && t.featuring.length > 0 && <span className="text-texte-3"> ft. {t.featuring.map((f) => f.artist?.stageName).filter(Boolean).join(", ")}</span>}
                  </td>
                  <td className="text-texte-2">{t.genre}</td>
                  <td className="text-texte-2 tabular-nums">{formatDate(t.releaseDate)}</td>
                  <td className="text-right text-texte-2 tabular-nums">{formatDuree(t.duration)}</td>
                  <td className="text-right text-texte-2 tabular-nums">{formatNombre(t.playsCount ?? 0)}</td>
                  <td>
                    <Pastille texte={STATUTS[t.status]?.libelle ?? t.status} ton={STATUTS[t.status]?.ton ?? "neutre"} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      )}
      {titres && visibles.length > 0 && <div className="mt-4">{pagination}</div>}
      <BarreSelection nombre={sel.nombre} libelle={(n) => `${n} titres sélectionnés`} onVider={sel.vider}>
        {[...sel.choisis].some((id) => enAttente((titres ?? []).find((t) => t._id === id) ?? ({} as Titre))) && (
          <Bouton className="h-9" onClick={() => void moderer([...sel.choisis], "approve")}>
            <Check size={14} /> Valider
          </Bouton>
        )}
        <Bouton variante="danger" className="h-9" onClick={() => void moderer([...sel.choisis], "reject")}>
          <X size={14} /> Refuser
        </Bouton>
        <Bouton variante="trait" className="h-9" onClick={() => void copierLiens([...sel.choisis])}>
          <Link2 size={14} /> Copier les liens
        </Bouton>
      </BarreSelection>
      {ouvert && (
        <FicheTitre
          titre={ouvert}
          genres={genres}
          onFermer={() => setOuvert(null)}
          onModifie={(maj) => {
            setTitres((liste) => (liste ?? []).map((t) => (t._id === maj._id ? { ...t, ...maj } : t)));
            setOuvert(null);
          }}
        />
      )}
    </>
  );
}

function FicheTitre({ titre, genres, onFermer, onModifie }: { titre: Titre; genres: string[]; onFermer: () => void; onModifie: (t: Partial<Titre> & { _id: string }) => void }) {
  const [title, setTitle] = useState(titre.title);
  const [genre, setGenre] = useState(titre.genre);
  const [sortie, setSortie] = useState(titre.releaseDate ? titre.releaseDate.slice(0, 10) : "");
  const [explicit, setExplicit] = useState(Boolean(titre.explicit));
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function executer(cle: string, action: () => Promise<Partial<Titre>>) {
    setEnCours(cle);
    setErreur(null);
    try {
      const maj = await action();
      onModifie({ _id: titre._id, ...maj });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'action a échoué.");
    } finally {
      setEnCours(null);
    }
  }

  const enregistrer = () =>
    executer("enregistrer", async () => {
      const corps = { title, genre, explicit, ...(sortie ? { releaseDate: new Date(`${sortie}T00:00:00+03:00`).toISOString() } : {}) };
      await api(`/api/songs/${titre._id}`, { methode: "PATCH", corps });
      return { title, genre, explicit, releaseDate: corps.releaseDate ?? titre.releaseDate };
    });
  const moderer = async (decision: "approve" | "reject") => {
    const ok = await confirmer(
      decision === "reject"
        ? { titre: `Refuser « ${titre.title} » ?`, message: "Le titre ne sera plus visible du public.", confirmer: "Refuser", danger: true }
        : { titre: `Valider « ${titre.title} » ?`, message: "Il sera publié aussitôt, ou à sa date de sortie si elle est à venir.", confirmer: "Valider et publier" },
    );
    if (!ok) return;
    return executer(decision, async () => {
      await api(`/api/admin/songs/${titre._id}/moderate`, { corps: { decision } });
      return { status: decision === "approve" ? ("published" as const) : ("rejected" as const) };
    });
  };

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={onFermer}>
      <aside className="animate-monter h-full w-[420px] overflow-auto border-l border-filet bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start gap-3">
          {titre.coverUrl && <img src={adresseImage(titre.coverUrl) ?? undefined} alt="" className="h-16 w-16 rounded-md object-cover" />}
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold">{titre.title}</div>
            <div className="text-[13px] text-texte-2">{titre.artist?.stageName}</div>
            <button onClick={() => void window.bureau.ouvrirExterne(`${adresseSite()}/son/${titre._id}`)} className="mt-1 inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
              Voir sur le site <ExternalLink size={12} />
            </button>
          </div>
        </div>
        <div className="space-y-3">
          <Champ libelle="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Selection libelle="Genre" value={genre} onChange={(e) => setGenre(e.target.value)}>
            {!genres.includes(genre) && <option value={genre}>{genre}</option>}
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Selection>
          <Champ libelle="Date de sortie" type="date" value={sortie} onChange={(e) => setSortie(e.target.value)} aide="Sert aux Nouveautés, à la Nostalgie et aux suites automatiques." />
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} className="accent-[var(--accent)]" /> Contenu explicite
          </label>
          <Erreur message={erreur} />
          <div className="flex flex-wrap gap-2 pt-1">
            <Bouton enCours={enCours === "enregistrer"} onClick={enregistrer}>
              Enregistrer
            </Bouton>
            {titre.status !== "published" && (
              <Bouton variante="trait" enCours={enCours === "approve"} onClick={() => moderer("approve")}>
                Publier
              </Bouton>
            )}
            {titre.status !== "rejected" && (
              <Bouton variante="danger" enCours={enCours === "reject"} onClick={() => moderer("reject")}>
                Refuser
              </Bouton>
            )}
            <Bouton variante="discret" onClick={onFermer}>
              Fermer
            </Bouton>
          </div>
        </div>
      </aside>
    </div>
  );
}
