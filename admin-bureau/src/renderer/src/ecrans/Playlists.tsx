import { useEffect, useState } from "react";
import { ExternalLink, Globe, Link2, ListMusic, Lock, Mail, RefreshCw, Search, Trash2 } from "lucide-react";
import { adresseSite, api } from "../api";
import { Avatar, BarreCollante, Bouton, Chargement, EnTete, Erreur, Pastille, Table, Vide, formatDate, formatNombre } from "../composants";
import { SelecteurVue, coteVignette, largeurCarte, nomTransition, useRaccourciVue, useVue } from "../vues";
import clsx from "../clsx";
import { BarreSelection, annoncer, classeChoisi, confirmer, copier, ouvrirMenu, useSelection } from "../interactions";
import { adresseImage } from "../session";

interface Playlist {
  _id: string;
  title: string;
  isPublic?: boolean;
  songs?: unknown[];
  coverUrl?: string;
  createdAt?: string;
  owner?: { name?: string; email?: string } | null;
}

/** Le plafond de la route : au-delà, la liste est tronquée et il faut chercher. */
const PLAFOND = 100;

/**
 * Toutes les playlists, publiques comme privées (/api/admin/playlists).
 * La recherche porte sur le titre et se fait côté site ; la route rend au
 * plus cent playlists, les plus récentes d'abord.
 */
export function Playlists() {
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [saisie, setSaisie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [vue, changerVue] = useVue("playlists", { mode: "liste", taille: "moyenne" });
  useRaccourciVue(vue, changerVue);

  // La recherche part au site après une courte pause de frappe, pas à chaque touche.
  useEffect(() => {
    const t = setTimeout(() => setRecherche(saisie.trim()), 300);
    return () => clearTimeout(t);
  }, [saisie]);

  useEffect(() => {
    setPlaylists(null);
    setErreur(null);
    api<{ playlists: Playlist[] }>(`/api/admin/playlists${recherche ? `?search=${encodeURIComponent(recherche)}` : ""}`)
      .then((r) => setPlaylists(r.playlists ?? []))
      .catch((e: Error) => setErreur(e.message));
  }, [recherche, version]);

  const liste = playlists ?? [];
  const lienPlaylist = (id: string) => `${adresseSite()}/playlist/${id}`;
  const voir = (id: string) => void window.bureau.ouvrirExterne(lienPlaylist(id));
  const sel = useSelection(
    liste.map((p) => p._id),
    voir,
  );

  async function copierLiens(ids: string[]) {
    if (await copier(ids.map(lienPlaylist).join("\n"))) annoncer(ids.length > 1 ? `${ids.length} liens copiés` : "Lien copié");
  }

  async function supprimer(ids: string[]) {
    const cibles = liste.filter((p) => ids.includes(p._id));
    if (cibles.length === 0) return;
    const quoi = cibles.length > 1 ? `ces ${cibles.length} playlists` : `« ${cibles[0].title} »`;
    const ok = await confirmer({
      titre: `Supprimer ${quoi} ?`,
      message: `${cibles.length > 1 ? "Elles disparaîtront" : "Elle disparaîtra"} pour tout le monde, propriétaire compris. Les titres restent au catalogue. Cette action est définitive.`,
      confirmer: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    let faits = 0;
    for (const p of cibles) {
      try {
        await api(`/api/playlists/${p._id}`, { methode: "DELETE" });
        setPlaylists((avant) => (avant ?? []).filter((x) => x._id !== p._id));
        faits++;
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Suppression refusée.");
      }
    }
    if (faits > 0) annoncer(`${faits} playlist${faits > 1 ? "s" : ""} supprimée${faits > 1 ? "s" : ""}`);
  }

  function menuPlaylist(e: React.MouseEvent, rang: number) {
    const ids = sel.surMenu(rang);
    const cibles = liste.filter((p) => ids.includes(p._id));
    if (cibles.length === 0) return;
    if (cibles.length === 1) {
      const p = cibles[0];
      return ouvrirMenu(
        e,
        [
          { libelle: "Voir sur le site", icone: ExternalLink, raccourci: "Entrée", action: () => voir(p._id) },
          { libelle: "Copier le lien", icone: Link2, action: () => void copierLiens([p._id]) },
          p.owner?.email && { libelle: "Copier l'e-mail du propriétaire", icone: Mail, action: () => void copier(p.owner?.email ?? "").then(() => annoncer("E-mail copié")) },
          "separateur",
          { libelle: "Supprimer la playlist", icone: Trash2, danger: true, action: () => void supprimer([p._id]) },
        ],
        p.title,
      );
    }
    ouvrirMenu(
      e,
      [
        { libelle: `Copier les ${cibles.length} liens`, icone: Link2, action: () => void copierLiens(ids) },
        "separateur",
        { libelle: `Supprimer (${cibles.length})`, icone: Trash2, danger: true, action: () => void supprimer(ids) },
      ],
      `${cibles.length} playlists sélectionnées`,
    );
  }

  const texte = playlists
    ? playlists.length >= PLAFOND
      ? `Les ${PLAFOND} plus récentes${recherche ? ` pour « ${recherche} »` : ""} : le site n'en rend pas davantage, affinez la recherche.`
      : `${formatNombre(playlists.length)} playlist${playlists.length > 1 ? "s" : ""}${recherche ? ` pour « ${recherche} »` : ""}`
    : undefined;

  const visibilite = (p: Playlist) => (p.isPublic ? <Pastille texte="publique" ton="succes" /> : <Pastille texte="privée" />);

  return (
    <>
      <EnTete
        titre="Playlists"
        texte={texte}
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
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Titre de la playlist"
            className="h-9 w-full rounded-lg border border-filet bg-surface pr-3 pl-9 text-[13px] outline-none placeholder:text-texte-3 focus:border-accent"
          />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <SelecteurVue vue={vue} onChange={changerVue} />
        </div>
      </BarreCollante>

      <Erreur message={erreur} />
      {!playlists ? (
        !erreur && <Chargement />
      ) : playlists.length === 0 ? (
        <Vide texte={recherche ? "Aucune playlist ne porte ce titre." : "Aucune playlist."} />
      ) : vue.mode === "grille" ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${largeurCarte[vue.taille]}px, 1fr))` }}>
          {playlists.map((p, rang) => (
            <button
              key={p._id}
              data-rang={rang}
              onClick={(e) => sel.surClic(e, rang)}
              onDoubleClick={(e) => sel.surDoubleClic(e, rang)}
              onContextMenu={(e) => menuPlaylist(e, rang)}
              className={clsx("group rounded-2xl border border-filet bg-surface p-2.5 text-left transition-colors hover:border-texte-3/40", classeChoisi(sel.estChoisi(p._id), "carte"))}
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-2" style={nomTransition("c", p._id, rang)}>
                {p.coverUrl ? (
                  <img src={adresseImage(p.coverUrl) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-texte-3">
                    <ListMusic size={vue.taille === "petite" ? 22 : 30} />
                  </span>
                )}
                <span className="absolute top-2 left-2 grid h-6 w-6 place-items-center rounded-md bg-black/55 text-white" title={p.isPublic ? "Publique" : "Privée"}>
                  {p.isPublic ? <Globe size={13} /> : <Lock size={13} />}
                </span>
              </div>
              <div className="mt-2.5 px-0.5">
                <div className={clsx("truncate font-semibold", vue.taille === "petite" ? "text-[12.5px]" : "text-[13.5px]")}>{p.title}</div>
                <div className="truncate text-[12px] text-texte-3">{p.owner?.name ?? "Compte supprimé"}</div>
                {vue.taille !== "petite" && (
                  <div className="mt-1 text-[11.5px] text-texte-3 tabular-nums">
                    {formatNombre(p.songs?.length ?? 0)} titre{(p.songs?.length ?? 0) > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Table
          densite={vue.taille}
          entetes={["", "Playlist", "Propriétaire", { libelle: "Titres", droite: true, largeur: "80px" }, { libelle: "Créée", largeur: "120px" }, { libelle: "Visibilité", largeur: "110px" }]}
        >
          {playlists.map((p, rang) => (
            <tr
              key={p._id}
              data-rang={rang}
              onClick={(e) => sel.surClic(e, rang)}
              onDoubleClick={(e) => sel.surDoubleClic(e, rang)}
              onContextMenu={(e) => menuPlaylist(e, rang)}
              className={clsx("cursor-default", classeChoisi(sel.estChoisi(p._id), "ligne"))}
            >
              <td style={{ width: coteVignette[vue.taille] + 24 }}>
                <div
                  className="grid place-items-center overflow-hidden rounded-md bg-surface-2 text-texte-3"
                  style={{ width: coteVignette[vue.taille], height: coteVignette[vue.taille], ...nomTransition("c", p._id, rang) }}
                >
                  {p.coverUrl ? <img src={adresseImage(p.coverUrl) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ListMusic size={Math.round(coteVignette[vue.taille] * 0.45)} />}
                </div>
              </td>
              <td className="font-medium">{p.title}</td>
              <td>
                {p.owner ? (
                  <span className="flex items-center gap-2.5">
                    {vue.taille !== "petite" && <Avatar nom={p.owner.name ?? p.owner.email ?? "?"} taille={26} />}
                    <span className="min-w-0">
                      <span className="block truncate">{p.owner.name ?? "—"}</span>
                      {vue.taille !== "petite" && (
                        <span className="block truncate text-[12px] text-texte-3" data-selectionnable>
                          {p.owner.email}
                        </span>
                      )}
                    </span>
                  </span>
                ) : (
                  <span className="text-texte-3">Compte supprimé</span>
                )}
              </td>
              <td className="text-right text-texte-2 tabular-nums">{formatNombre(p.songs?.length ?? 0)}</td>
              <td className="text-texte-2 tabular-nums">{formatDate(p.createdAt)}</td>
              <td>{visibilite(p)}</td>
            </tr>
          ))}
        </Table>
      )}

      <BarreSelection nombre={sel.nombre} libelle={(n) => `${n} playlists sélectionnées`} onVider={sel.vider}>
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
