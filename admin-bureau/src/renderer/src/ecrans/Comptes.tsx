import { useEffect, useState } from "react";
import { BadgeCheck, Ban, RefreshCw, RotateCcw, Search } from "lucide-react";
import { api } from "../api";
import { Avatar, Bouton, Chargement, EnTete, Erreur, Pagination, Pastille, Selection, Table, Vide, formatDate, formatNombre } from "../composants";
import clsx from "../clsx";

interface Compte {
  _id: string;
  name: string;
  email: string;
  role: "member" | "artist" | "admin";
  avatarUrl?: string;
  createdAt: string;
  suspended?: boolean;
  verifiedArtist?: boolean;
  premium?: { actif?: boolean; offert?: boolean } | null;
}

interface Reponse {
  users: Compte[];
  total: number;
  page: number;
  pages: number;
  stats?: { total: number; members: number; artists: number; admins: number; newThisMonth: number };
}

const ROLES: Record<Compte["role"], string> = { member: "Membre", artist: "Artiste", admin: "Admin" };
const TAILLE = 25;
type FiltreRole = "" | Compte["role"];

/**
 * Les comptes : rôle, suspension, badge d'artiste vérifié. La recherche, le
 * filtre et la pagination passent par le site (/api/admin/users) : ils
 * portent sur tous les comptes, pas seulement sur la page affichée.
 */
export function Comptes() {
  const [reponse, setReponse] = useState<Reponse | null>(null);
  const [page, setPage] = useState(1);
  const [saisie, setSaisie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [role, setRole] = useState<FiltreRole>("");
  const [version, setVersion] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setRecherche(saisie.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  useEffect(() => {
    setReponse(null);
    setErreur(null);
    const p = new URLSearchParams({ page: String(page), limit: String(TAILLE) });
    if (recherche) p.set("search", recherche);
    if (role) p.set("role", role);
    api<Reponse>(`/api/admin/users?${p}`)
      .then((r) => setReponse({ ...r, users: r.users ?? [] }))
      .catch((e: Error) => setErreur(e.message));
  }, [page, recherche, role, version]);

  async function modifier(id: string, corps: Partial<Pick<Compte, "role" | "suspended" | "verifiedArtist">>) {
    setEnCours(id);
    setErreur(null);
    try {
      await api(`/api/admin/users/${id}`, { methode: "PATCH", corps });
      setReponse((r) => (r ? { ...r, users: r.users.map((u) => (u._id === id ? { ...u, ...corps } : u)) } : r));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Modification refusée.");
    } finally {
      setEnCours(null);
    }
  }

  const pagination = reponse && <Pagination page={reponse.page} pages={reponse.pages} total={reponse.total} taille={TAILLE} onPage={setPage} />;

  return (
    <>
      <EnTete
        titre="Utilisateurs"
        texte={reponse?.stats ? `${formatNombre(reponse.stats.total)} comptes · ${formatNombre(reponse.stats.members)} membres · ${formatNombre(reponse.stats.artists)} artistes · ${formatNombre(reponse.stats.newThisMonth)} nouveaux ce mois` : undefined}
        action={
          <Bouton variante="trait" onClick={() => setVersion((v) => v + 1)}>
            <RefreshCw size={14} /> Actualiser
          </Bouton>
        }
      />
      <div className="animate-monter decale-1 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-80">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texte-3" />
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Nom ou e-mail"
            className="h-9 w-full rounded-lg border border-filet bg-surface pr-3 pl-9 text-[13px] outline-none placeholder:text-texte-3 focus:border-accent"
          />
        </div>
        <div className="flex rounded-lg border border-filet bg-surface p-0.5">
          {(
            [
              ["", "Tous"],
              ["member", "Membres"],
              ["artist", "Artistes"],
              ["admin", "Admins"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => {
                setRole(v);
                setPage(1);
              }}
              className={clsx("rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors", role === v ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte")}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="ml-auto">{pagination}</div>
      </div>
      <Erreur message={erreur} />
      {!reponse && !erreur ? (
        <Chargement />
      ) : reponse && reponse.users.length === 0 ? (
        <Vide texte="Aucun compte ne correspond." />
      ) : reponse ? (
        <>
          <Table entetes={["Nom", "E-mail", { libelle: "Rôle", largeur: "140px" }, { libelle: "Inscrit", largeur: "120px" }, { libelle: "Premium", largeur: "100px" }, { libelle: "Actions", largeur: "290px" }]}>
            {reponse.users.map((u) => (
              <tr key={u._id} className={u.suspended ? "opacity-60" : undefined}>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar nom={u.name} image={u.avatarUrl} taille={32} />
                    <span className="truncate font-semibold">{u.name}</span>
                    {u.verifiedArtist && <BadgeCheck size={15} className="shrink-0 text-accent" />}
                    {u.suspended && <Pastille texte="suspendu" ton="danger" />}
                  </div>
                </td>
                <td className="text-texte-2" data-selectionnable>
                  {u.email}
                </td>
                <td>
                  <Selection value={u.role} disabled={enCours === u._id} onChange={(e) => void modifier(u._id, { role: e.target.value as Compte["role"] })}>
                    {(Object.keys(ROLES) as Compte["role"][]).map((r) => (
                      <option key={r} value={r}>
                        {ROLES[r]}
                      </option>
                    ))}
                  </Selection>
                </td>
                <td className="text-texte-2 tabular-nums">{formatDate(u.createdAt)}</td>
                <td>{u.premium?.actif ? <Pastille texte={u.premium.offert ? "offert" : "actif"} ton="succes" /> : <span className="text-texte-3">—</span>}</td>
                <td>
                  <div className="flex justify-end gap-2">
                    {u.role === "artist" && (
                      <Bouton variante="trait" className="h-8" enCours={enCours === u._id} onClick={() => void modifier(u._id, { verifiedArtist: !u.verifiedArtist })}>
                        <BadgeCheck size={14} /> {u.verifiedArtist ? "Retirer le badge" : "Vérifier"}
                      </Bouton>
                    )}
                    <Bouton variante={u.suspended ? "trait" : "danger"} className="h-8" enCours={enCours === u._id} onClick={() => void modifier(u._id, { suspended: !u.suspended })}>
                      {u.suspended ? <RotateCcw size={14} /> : <Ban size={14} />} {u.suspended ? "Réactiver" : "Suspendre"}
                    </Bouton>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <div className="mt-4">{pagination}</div>
        </>
      ) : null}
    </>
  );
}
