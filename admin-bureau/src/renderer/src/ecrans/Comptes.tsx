import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { api } from "../api";
import { Bouton, Chargement, EnTete, Erreur, Pastille, Selection, Table, Vide, formatDate, formatNombre } from "../composants";

interface Compte {
  _id: string;
  name: string;
  email: string;
  role: "member" | "artist" | "admin";
  createdAt: string;
  suspended?: boolean;
  verifiedArtist?: boolean;
  lastLoginAt?: string;
  artist?: { _id: string; stageName?: string } | null;
  subscription?: { plan?: string; status?: string } | null;
}

interface Reponse {
  users: Compte[];
  total: number;
  page: number;
  pages: number;
  stats?: { total: number; members: number; artists: number; admins: number; newThisMonth: number };
}

const ROLES: Record<Compte["role"], string> = { member: "Membre", artist: "Artiste", admin: "Admin" };
const TAILLE = 50;

/**
 * Les comptes : rôle, suspension, badge d'artiste vérifié. La liste est
 * paginée par le site ; la recherche se fait sur la page chargée.
 */
export function Comptes() {
  const [reponse, setReponse] = useState<Reponse | null>(null);
  const [page, setPage] = useState(1);
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = () => {
    setReponse(null);
    api<Reponse>(`/api/admin/users?page=${page}&limit=${TAILLE}`)
      .then(setReponse)
      .catch((e) => setErreur(e.message));
  };
  useEffect(charger, [page]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const liste = reponse?.users ?? [];
    return q ? liste.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : liste;
  }, [reponse, recherche]);

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

  return (
    <>
      <EnTete
        titre="Comptes"
        texte={reponse?.stats ? `${formatNombre(reponse.stats.total)} comptes · ${formatNombre(reponse.stats.artists)} artistes · ${formatNombre(reponse.stats.newThisMonth)} nouveaux ce mois` : undefined}
        action={
          <Bouton variante="trait" onClick={charger}>
            <RefreshCw size={14} /> Actualiser
          </Bouton>
        }
      />
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative w-72">
          <Search size={14} className="pointer-events-none absolute top-2.5 left-2.5 text-texte-3" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom ou e-mail (page affichée)"
            className="h-8 w-full rounded-md border border-filet bg-surface pr-2.5 pl-8 text-[13px] outline-none placeholder:text-texte-3 focus:border-accent"
          />
        </div>
        {reponse && reponse.pages > 1 && (
          <div className="flex items-center gap-2 text-[13px] text-texte-2">
            <Bouton variante="discret" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Précédente
            </Bouton>
            Page {reponse.page} / {reponse.pages}
            <Bouton variante="discret" disabled={page >= reponse.pages} onClick={() => setPage((p) => p + 1)}>
              Suivante
            </Bouton>
          </div>
        )}
      </div>
      <Erreur message={erreur} />
      {!reponse ? (
        <Chargement />
      ) : visibles.length === 0 ? (
        <Vide texte="Aucun compte." />
      ) : (
        <Table entetes={["Nom", "E-mail", { libelle: "Rôle", largeur: "130px" }, { libelle: "Inscrit", largeur: "110px" }, { libelle: "Abonnement", largeur: "110px" }, { libelle: "État", largeur: "200px" }]}>
          {visibles.map((u) => (
            <tr key={u._id} className={u.suspended ? "opacity-60" : undefined}>
              <td className="px-3 py-1.5 font-medium">
                {u.name}
                {u.verifiedArtist && <Pastille texte="vérifié" ton="succes" />}
              </td>
              <td className="px-3 py-1.5 text-texte-2" data-selectionnable>
                {u.email}
              </td>
              <td className="px-3 py-1.5">
                <Selection value={u.role} disabled={enCours === u._id} onChange={(e) => void modifier(u._id, { role: e.target.value as Compte["role"] })}>
                  {(Object.keys(ROLES) as Compte["role"][]).map((r) => (
                    <option key={r} value={r}>
                      {ROLES[r]}
                    </option>
                  ))}
                </Selection>
              </td>
              <td className="px-3 py-1.5 text-texte-2 tabular-nums">{formatDate(u.createdAt)}</td>
              <td className="px-3 py-1.5 text-texte-2">{u.subscription?.status === "active" ? (u.subscription.plan ?? "Premium") : "—"}</td>
              <td className="px-3 py-1.5">
                <div className="flex gap-2">
                  {u.role === "artist" && (
                    <Bouton variante="trait" enCours={enCours === u._id} onClick={() => void modifier(u._id, { verifiedArtist: !u.verifiedArtist })}>
                      {u.verifiedArtist ? "Retirer le badge" : "Vérifier"}
                    </Bouton>
                  )}
                  <Bouton variante={u.suspended ? "trait" : "danger"} enCours={enCours === u._id} onClick={() => void modifier(u._id, { suspended: !u.suspended })}>
                    {u.suspended ? "Réactiver" : "Suspendre"}
                  </Bouton>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
