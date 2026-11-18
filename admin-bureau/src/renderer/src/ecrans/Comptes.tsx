import { useEffect, useState } from "react";
import { BadgeCheck, BadgeX, Ban, Check, Mail, RefreshCw, RotateCcw, Search, Shield, User, Mic2 } from "lucide-react";
import { api } from "../api";
import { Avatar, Bouton, Chargement, EnTete, Erreur, Pagination, Pastille, Selection, Table, Vide, formatDate, formatNombre , BarreCollante } from "../composants";
import { SelecteurVue, coteVignette, largeurCarte, nomTransition, useRaccourciVue, useVue } from "../vues";
import clsx from "../clsx";
import { BarreSelection, annoncer, classeChoisi, copier, ouvrirMenu, useSelection } from "../interactions";

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

  const [vue, changerVue] = useVue("comptes", { mode: "liste", taille: "moyenne" });
  useRaccourciVue(vue, changerVue);

  // Clic : sélectionner ; clic droit : actions. Un compte n'a pas de fiche ici : pas de double-clic.
  const comptes = reponse?.users ?? [];
  const sel = useSelection(comptes.map((u) => u._id));

  /** Une même modification sur plusieurs comptes, après confirmation. */
  async function enLot(ids: string[], corps: Partial<Pick<Compte, "role" | "suspended" | "verifiedArtist">>, question: string) {
    const cibles = comptes.filter((u) => ids.includes(u._id));
    if (cibles.length > 1 && !window.confirm(question.replace("{n}", String(cibles.length)))) return;
    for (const u of cibles) await modifier(u._id, corps);
    annoncer(cibles.length > 1 ? `${cibles.length} comptes modifiés` : "Compte modifié");
  }

  function menuCompte(e: React.MouseEvent, rang: number) {
    const ids = sel.surMenu(rang);
    const cibles = comptes.filter((u) => ids.includes(u._id));
    if (cibles.length === 0) return;
    if (cibles.length === 1) {
      const u = cibles[0];
      const role = (r: Compte["role"], icone: typeof User) => ({
        libelle: u.role === r ? `${ROLES[r]} (actuel)` : `Passer ${ROLES[r].toLowerCase()}`,
        icone: u.role === r ? Check : icone,
        desactive: u.role === r,
        action: () => void enLot([u._id], { role: r }, ""),
      });
      return ouvrirMenu(
        e,
        [
          role("member", User),
          role("artist", Mic2),
          role("admin", Shield),
          "separateur",
          u.role === "artist" &&
            (u.verifiedArtist
              ? { libelle: "Retirer le badge", icone: BadgeX, action: () => void enLot([u._id], { verifiedArtist: false }, "") }
              : { libelle: "Vérifier l'artiste", icone: BadgeCheck, action: () => void enLot([u._id], { verifiedArtist: true }, "") }),
          u.suspended
            ? { libelle: "Réactiver", icone: RotateCcw, action: () => void enLot([u._id], { suspended: false }, "") }
            : { libelle: "Suspendre", icone: Ban, danger: true, action: () => window.confirm(`Suspendre le compte de ${u.name} ?`) && void enLot([u._id], { suspended: true }, "") },
          "separateur",
          { libelle: "Copier l'e-mail", icone: Mail, action: () => void copier(u.email).then(() => annoncer("E-mail copié")) },
        ],
        u.name,
      );
    }
    ouvrirMenu(
      e,
      [
        { libelle: `Suspendre (${cibles.length})`, icone: Ban, danger: true, action: () => void enLot(ids, { suspended: true }, "Suspendre {n} comptes ? Ils ne pourront plus se connecter.") },
        { libelle: `Réactiver (${cibles.length})`, icone: RotateCcw, action: () => void enLot(ids, { suspended: false }, "Réactiver {n} comptes ?") },
        "separateur",
        { libelle: `Copier les ${cibles.length} e-mails`, icone: Mail, action: () => void copier(cibles.map((u) => u.email).join("\n")).then(() => annoncer("E-mails copiés")) },
      ],
      `${cibles.length} comptes sélectionnés`,
    );
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
      <BarreCollante className="animate-monter decale-1">
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
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <SelecteurVue vue={vue} onChange={changerVue} />
          {pagination}
        </div>
      </BarreCollante>
      <Erreur message={erreur} />
      {!reponse && !erreur ? (
        <Chargement />
      ) : reponse && reponse.users.length === 0 ? (
        <Vide texte="Aucun compte ne correspond." />
      ) : reponse ? (
        <>
          {vue.mode === "grille" ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${largeurCarte[vue.taille] + 60}px, 1fr))` }}>
              {reponse.users.map((u, rang) => (
                <div
                  key={u._id}
                  onClick={(e) => sel.surClic(e, rang)}
                  onContextMenu={(e) => menuCompte(e, rang)}
                  className={clsx("flex min-w-0 flex-col overflow-hidden rounded-2xl border border-filet bg-surface p-4", u.suspended && "opacity-60", classeChoisi(sel.estChoisi(u._id), "carte"))}
                >
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 rounded-full" style={nomTransition("c", u._id, rang)}>
                      <Avatar nom={u.name} image={u.avatarUrl} taille={vue.taille === "grande" ? 56 : vue.taille === "moyenne" ? 44 : 34} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold">
                          {u.name}
                        </span>
                        {u.verifiedArtist && <BadgeCheck size={14} className="shrink-0 text-accent" />}
                      </div>
                      <div className="truncate text-[12px] text-texte-3" data-selectionnable>
                        {u.email}
                      </div>
                    </div>
                  </div>
                  {vue.taille !== "petite" && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-texte-3">
                      <span>Inscrit le {formatDate(u.createdAt)}</span>
                      {u.premium?.actif && <Pastille texte={u.premium.offert ? "premium offert" : "premium"} ton="succes" />}
                      {u.suspended && <Pastille texte="suspendu" ton="danger" />}
                    </div>
                  )}
                  {/* Dans une carte, tout prend la largeur et passe à la ligne : côte à côte, les deux boutons débordaient. */}
                  <div className="mt-auto space-y-2 pt-3">
                    <ChoixRole compte={u} enCours={enCours === u._id} modifier={modifier} className="w-full" />
                    <Actions compte={u} enCours={enCours === u._id} modifier={modifier} className="flex flex-wrap gap-2 [&>button]:min-w-0 [&>button]:flex-1 [&>button]:justify-center" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table densite={vue.taille} entetes={["Nom", "E-mail", { libelle: "Rôle", largeur: "140px" }, { libelle: "Inscrit", largeur: "120px" }, { libelle: "Premium", largeur: "100px" }, { libelle: "Actions", largeur: "290px" }]}>
              {reponse.users.map((u, rang) => (
                <tr
                  key={u._id}
                  onClick={(e) => sel.surClic(e, rang)}
                  onContextMenu={(e) => menuCompte(e, rang)}
                  className={clsx(u.suspended && "opacity-60", classeChoisi(sel.estChoisi(u._id), "ligne"))}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="shrink-0 rounded-full" style={nomTransition("c", u._id, rang)}>
                        <Avatar nom={u.name} image={u.avatarUrl} taille={coteVignette[vue.taille] - 6} />
                      </span>
                      <span className="truncate font-semibold">
                        {u.name}
                      </span>
                      {u.verifiedArtist && <BadgeCheck size={15} className="shrink-0 text-accent" />}
                      {u.suspended && <Pastille texte="suspendu" ton="danger" />}
                    </div>
                  </td>
                  <td className="text-texte-2" data-selectionnable>
                    {u.email}
                  </td>
                  <td>
                    <ChoixRole compte={u} enCours={enCours === u._id} modifier={modifier} />
                  </td>
                  <td className="text-texte-2 tabular-nums">{formatDate(u.createdAt)}</td>
                  <td>{u.premium?.actif ? <Pastille texte={u.premium.offert ? "offert" : "actif"} ton="succes" /> : <span className="text-texte-3">—</span>}</td>
                  <td>
                    <div className="flex justify-end">
                      <Actions compte={u} enCours={enCours === u._id} modifier={modifier} />
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
          <div className="mt-4">{pagination}</div>
          <BarreSelection nombre={sel.nombre} libelle={(n) => `${n} comptes sélectionnés`} onVider={sel.vider}>
            <Bouton variante="danger" className="h-9" onClick={() => void enLot([...sel.choisis], { suspended: true }, "Suspendre {n} comptes ? Ils ne pourront plus se connecter.")}>
              <Ban size={14} /> Suspendre
            </Bouton>
            <Bouton variante="trait" className="h-9" onClick={() => void enLot([...sel.choisis], { suspended: false }, "Réactiver {n} comptes ?")}>
              <RotateCcw size={14} /> Réactiver
            </Bouton>
            <Bouton variante="trait" className="h-9" onClick={() => void copier(comptes.filter((u) => sel.choisis.has(u._id)).map((u) => u.email).join("\n")).then(() => annoncer("E-mails copiés"))}>
              <Mail size={14} /> Copier les e-mails
            </Bouton>
          </BarreSelection>
        </>
      ) : null}
    </>
  );
}

type Modifier = (id: string, corps: Partial<Pick<Compte, "role" | "suspended" | "verifiedArtist">>) => Promise<void>;

function ChoixRole({ compte, enCours, modifier, className = "w-32" }: { compte: Compte; enCours: boolean; modifier: Modifier; className?: string }) {
  return (
    <Selection value={compte.role} disabled={enCours} onChange={(e) => void modifier(compte._id, { role: e.target.value as Compte["role"] })} className={className}>
      {(Object.keys(ROLES) as Compte["role"][]).map((r) => (
        <option key={r} value={r}>
          {ROLES[r]}
        </option>
      ))}
    </Selection>
  );
}

function Actions({ compte, enCours, modifier, className = "flex gap-2" }: { compte: Compte; enCours: boolean; modifier: Modifier; className?: string }) {
  return (
    <div className={className}>
      {compte.role === "artist" && (
        <Bouton variante="trait" className="h-8" enCours={enCours} onClick={() => void modifier(compte._id, { verifiedArtist: !compte.verifiedArtist })}>
          <BadgeCheck size={14} /> {compte.verifiedArtist ? "Retirer le badge" : "Vérifier"}
        </Bouton>
      )}
      <Bouton variante={compte.suspended ? "trait" : "danger"} className="h-8" enCours={enCours} onClick={() => void modifier(compte._id, { suspended: !compte.suspended })}>
        {compte.suspended ? <RotateCcw size={14} /> : <Ban size={14} />} {compte.suspended ? "Réactiver" : "Suspendre"}
      </Bouton>
    </div>
  );
}
