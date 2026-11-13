import { useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import { adresseSite, api } from "../api";
import { Bouton, Champ, Chargement, EnTete, Erreur, Pastille, Selection, Table, Vide, formatDate, formatDuree } from "../composants";
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
export function Catalogue() {
  const [titres, setTitres] = useState<Titre[] | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [statut, setStatut] = useState<"" | Titre["status"]>("");
  const [recherche, setRecherche] = useState("");
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

  return (
    <>
      <EnTete
        titre="Catalogue"
        texte={titres ? `${visibles.length} titre${visibles.length > 1 ? "s" : ""}` : undefined}
        action={
          <Bouton variante="trait" onClick={charger}>
            <RefreshCw size={14} /> Actualiser
          </Bouton>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative w-72">
          <Search size={14} className="pointer-events-none absolute top-2.5 left-2.5 text-texte-3" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Titre ou artiste"
            className="h-8 w-full rounded-md border border-filet bg-surface pr-2.5 pl-8 text-[13px] outline-none placeholder:text-texte-3 focus:border-accent"
          />
        </div>
        <div className="flex gap-1">
          {([["", "Tous"], ["published", "Publiés"], ["draft", "En attente"], ["scheduled", "Programmés"], ["rejected", "Refusés"]] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setStatut(v)}
              className={`h-8 rounded-md px-3 text-[13px] ${statut === v ? "bg-surface-2 font-medium" : "text-texte-2 hover:bg-surface-2"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <Erreur message={erreur} />
      {!titres ? (
        <Chargement />
      ) : visibles.length === 0 ? (
        <Vide texte="Aucun titre." />
      ) : (
        <Table entetes={["", "Titre", "Artiste", "Genre", { libelle: "Sortie", largeur: "110px" }, { libelle: "Durée", droite: true, largeur: "70px" }, { libelle: "Écoutes", droite: true, largeur: "80px" }, { libelle: "État", largeur: "100px" }]}>
          {visibles.map((t) => (
            <tr key={t._id} onClick={() => setOuvert(t)} className="cursor-pointer hover:bg-surface-2">
              <td className="w-10 px-2 py-1.5">
                {t.coverUrl ? <img src={adresseImage(t.coverUrl) ?? undefined} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-surface-2" />}
              </td>
              <td className="px-3 py-1.5 font-medium">
                {t.title}
                {t.explicit && <Pastille texte="explicite" />}
              </td>
              <td className="px-3 py-1.5 text-texte-2">
                {t.artist?.stageName ?? "—"}
                {t.featuring && t.featuring.length > 0 && <span className="text-texte-3"> ft. {t.featuring.map((f) => f.artist?.stageName).filter(Boolean).join(", ")}</span>}
              </td>
              <td className="px-3 py-1.5 text-texte-2">{t.genre}</td>
              <td className="px-3 py-1.5 text-texte-2 tabular-nums">{formatDate(t.releaseDate)}</td>
              <td className="px-3 py-1.5 text-right text-texte-2 tabular-nums">{formatDuree(t.duration)}</td>
              <td className="px-3 py-1.5 text-right text-texte-2 tabular-nums">{t.playsCount ?? 0}</td>
              <td className="px-3 py-1.5">
                <Pastille texte={STATUTS[t.status]?.libelle ?? t.status} ton={STATUTS[t.status]?.ton ?? "neutre"} />
              </td>
            </tr>
          ))}
        </Table>
      )}
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
  const moderer = (decision: "approve" | "reject") =>
    executer(decision, async () => {
      await api(`/api/admin/songs/${titre._id}/moderate`, { corps: { decision } });
      return { status: decision === "approve" ? ("published" as const) : ("rejected" as const) };
    });

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
