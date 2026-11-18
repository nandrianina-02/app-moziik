import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Disc3, ExternalLink, Link2, Music, RefreshCw, Search, Trash2 } from "lucide-react";
import { adresseSite, api } from "../api";
import { BarreCollante, Bouton, Chargement, EnTete, Erreur, Pagination, Pastille, Table, Vide, formatDate, formatNombre, usePages } from "../composants";
import { SelecteurVue, coteVignette, largeurCarte, nomTransition, useRaccourciVue, useVue } from "../vues";
import clsx from "../clsx";
import { BarreSelection, annoncer, classeChoisi, confirmer, copier, ouvrirMenu, useSelection } from "../interactions";
import { adresseImage } from "../session";

type TypeAlbum = "album" | "ep" | "single" | "podcast";

interface Album {
  _id: string;
  title: string;
  coverUrl?: string;
  type?: TypeAlbum;
  songs?: unknown[];
  releaseDate?: string;
  artist?: { stageName: string; verified?: boolean } | null;
}

const LIBELLES: Record<TypeAlbum, string> = { album: "Album", ep: "EP", single: "Single", podcast: "Podcast" };
// Un album enregistré avant l'arrivée du champ `type` est un album : même règle que le site.
const typeDe = (a: Album): TypeAlbum => (a.type && a.type in LIBELLES ? a.type : "album");

const TAILLE = 48;

/**
 * Les albums : le site les rend tous d'un coup (/api/albums, public), la
 * recherche, le filtre par type et la pagination se font donc ici. La
 * seule action d'administration est la suppression, pour les publications
 * indésirables.
 */
export function Albums() {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [recherche, setRecherche] = useState("");
  const [type, setType] = useState<"" | TypeAlbum>("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [vue, changerVue] = useVue("albums", { mode: "grille", taille: "moyenne" });
  useRaccourciVue(vue, changerVue);

  useEffect(() => {
    setAlbums(null);
    setErreur(null);
    api<{ albums: Album[] }>("/api/albums")
      .then((r) => setAlbums(r.albums ?? []))
      .catch((e: Error) => setErreur(e.message));
  }, [version]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (albums ?? []).filter(
      (a) => (!type || typeDe(a) === type) && (!q || a.title.toLowerCase().includes(q) || (a.artist?.stageName ?? "").toLowerCase().includes(q)),
    );
  }, [albums, recherche, type]);
  const pages = usePages(visibles, TAILLE, `${type}|${recherche}`);

  const lienAlbum = (id: string) => `${adresseSite()}/album/${id}`;
  const voir = (id: string) => void window.bureau.ouvrirExterne(lienAlbum(id));
  // Double-clic ou Entrée : la page publique de l'album, faute de fiche à éditer ici.
  const sel = useSelection(
    pages.tranche.map((a) => a._id),
    voir,
  );

  async function copierLiens(ids: string[]) {
    if (await copier(ids.map(lienAlbum).join("\n"))) annoncer(ids.length > 1 ? `${ids.length} liens copiés` : "Lien copié");
  }

  async function supprimer(ids: string[]) {
    const cibles = (albums ?? []).filter((a) => ids.includes(a._id));
    if (cibles.length === 0) return;
    const quoi = cibles.length > 1 ? `ces ${cibles.length} albums` : `« ${cibles[0].title} »`;
    const ok = await confirmer({
      titre: `Supprimer ${quoi} ?`,
      message: `${cibles.length > 1 ? "Ils seront supprimés" : "Il sera supprimé"} pour tout le monde : la page de l'album disparaît du site et des bibliothèques. Cette action est définitive.`,
      confirmer: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    let faits = 0;
    for (const a of cibles) {
      try {
        await api(`/api/albums/${a._id}`, { methode: "DELETE" });
        setAlbums((liste) => (liste ?? []).filter((x) => x._id !== a._id));
        faits++;
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Suppression refusée.");
      }
    }
    if (faits > 0) annoncer(`${faits} album${faits > 1 ? "s" : ""} supprimé${faits > 1 ? "s" : ""}`);
  }

  function menuAlbum(e: React.MouseEvent, rang: number) {
    const ids = sel.surMenu(rang);
    const cibles = (albums ?? []).filter((a) => ids.includes(a._id));
    if (cibles.length === 0) return;
    if (cibles.length === 1) {
      const a = cibles[0];
      return ouvrirMenu(
        e,
        [
          { libelle: "Voir sur le site", icone: ExternalLink, raccourci: "Entrée", action: () => voir(a._id) },
          { libelle: "Copier le lien", icone: Link2, action: () => void copierLiens([a._id]) },
          "separateur",
          { libelle: "Supprimer l'album", icone: Trash2, danger: true, action: () => void supprimer([a._id]) },
        ],
        a.title,
      );
    }
    ouvrirMenu(
      e,
      [
        { libelle: `Copier les ${cibles.length} liens`, icone: Link2, action: () => void copierLiens(ids) },
        "separateur",
        { libelle: `Supprimer (${cibles.length})`, icone: Trash2, danger: true, action: () => void supprimer(ids) },
      ],
      `${cibles.length} albums sélectionnés`,
    );
  }

  const pagination = <Pagination page={pages.page} pages={pages.pages} total={pages.total} taille={pages.taille} onPage={pages.setPage} />;

  return (
    <>
      <EnTete
        titre="Albums"
        texte={albums ? `${formatNombre(visibles.length)} publication${visibles.length > 1 ? "s" : ""}${recherche.trim() ? ` pour « ${recherche.trim()} »` : ""}` : undefined}
        action={
          <Bouton variante="trait" onClick={() => setVersion((v) => v + 1)}>
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
          {([["", "Tous"], ["album", "Albums"], ["ep", "EP"], ["single", "Singles"], ["podcast", "Podcasts"]] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setType(v)}
              className={clsx("rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors", type === v ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte")}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <SelecteurVue vue={vue} onChange={changerVue} />
          {albums && pagination}
        </div>
      </BarreCollante>

      <Erreur message={erreur} />
      {!albums ? (
        !erreur && <Chargement />
      ) : visibles.length === 0 ? (
        <Vide texte="Aucun album ne correspond." />
      ) : vue.mode === "grille" ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${largeurCarte[vue.taille]}px, 1fr))` }}>
          {pages.tranche.map((a, rang) => (
            <button
              key={a._id}
              data-rang={rang}
              onClick={(e) => sel.surClic(e, rang)}
              onDoubleClick={(e) => sel.surDoubleClic(e, rang)}
              onContextMenu={(e) => menuAlbum(e, rang)}
              className={clsx("group rounded-2xl border border-filet bg-surface p-2.5 text-left transition-colors hover:border-texte-3/40", classeChoisi(sel.estChoisi(a._id), "carte"))}
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-2" style={nomTransition("c", a._id, rang)}>
                {a.coverUrl ? (
                  <img src={adresseImage(a.coverUrl) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-texte-3">
                    <Disc3 size={vue.taille === "petite" ? 22 : 30} />
                  </span>
                )}
                {typeDe(a) !== "album" && (
                  <span className="absolute top-2 left-2">
                    <Pastille texte={LIBELLES[typeDe(a)]} />
                  </span>
                )}
              </div>
              <div className="mt-2.5 px-0.5">
                <div className={clsx("truncate font-semibold", vue.taille === "petite" ? "text-[12.5px]" : "text-[13.5px]")}>{a.title}</div>
                <div className="flex items-center gap-1 truncate text-[12px] text-texte-3">
                  <span className="truncate">{a.artist?.stageName ?? "Artiste supprimé"}</span>
                  {a.artist?.verified && <BadgeCheck size={13} className="shrink-0 text-accent" />}
                </div>
                {vue.taille !== "petite" && (
                  <div className="mt-1 flex justify-between text-[11.5px] text-texte-3 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Music size={11} /> {formatNombre(a.songs?.length ?? 0)}
                    </span>
                    <span>{formatDate(a.releaseDate)}</span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Table
          densite={vue.taille}
          entetes={["", "Titre", "Artiste", { libelle: "Type", largeur: "100px" }, { libelle: "Titres", droite: true, largeur: "80px" }, { libelle: "Sortie", largeur: "120px" }]}
        >
          {pages.tranche.map((a, rang) => (
            <tr
              key={a._id}
              data-rang={rang}
              onClick={(e) => sel.surClic(e, rang)}
              onDoubleClick={(e) => sel.surDoubleClic(e, rang)}
              onContextMenu={(e) => menuAlbum(e, rang)}
              className={clsx("cursor-default", classeChoisi(sel.estChoisi(a._id), "ligne"))}
            >
              <td style={{ width: coteVignette[vue.taille] + 24 }}>
                <div className="overflow-hidden rounded-md bg-surface-2" style={{ width: coteVignette[vue.taille], height: coteVignette[vue.taille], ...nomTransition("c", a._id, rang) }}>
                  {a.coverUrl && <img src={adresseImage(a.coverUrl) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </div>
              </td>
              <td className="font-medium">{a.title}</td>
              <td className="text-texte-2">
                <span className="inline-flex items-center gap-1.5">
                  {a.artist?.stageName ?? "Artiste supprimé"}
                  {a.artist?.verified && <BadgeCheck size={14} className="text-accent" />}
                </span>
              </td>
              <td>
                <Pastille texte={LIBELLES[typeDe(a)]} ton={typeDe(a) === "album" ? "neutre" : "accent"} />
              </td>
              <td className="text-right text-texte-2 tabular-nums">{formatNombre(a.songs?.length ?? 0)}</td>
              <td className="text-texte-2 tabular-nums">{formatDate(a.releaseDate)}</td>
            </tr>
          ))}
        </Table>
      )}
      {albums && visibles.length > 0 && <div className="mt-4">{pagination}</div>}

      <BarreSelection nombre={sel.nombre} libelle={(n) => `${n} albums sélectionnés`} onVider={sel.vider}>
        <Bouton variante="trait" className="h-9" onClick={() => void copierLiens([...sel.choisis])}>
          <Link2 size={14} /> Copier les liens
        </Bouton>
        <Bouton variante="danger" className="h-9" onClick={() => void supprimer([...sel.choisis])}>
          <Trash2 size={14} /> Supprimer
        </Bouton>
      </BarreSelection>
    </>
  );
}
