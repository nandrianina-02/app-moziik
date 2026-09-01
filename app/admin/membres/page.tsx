"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Minus,
  MoreVertical,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCog,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { AdminCard, AdminHeaderActions, AdminTabs } from "@/components/admin/AdminChrome";
import { AdminPanelSkeleton, AdminStatsSkeleton } from "@/components/admin/AdminSkeleton";
import { DonutChart } from "@/components/admin/DonutChart";
import { StatCard } from "@/components/admin/StatCard";
import { SafeImage } from "@/components/ui/SafeImage";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ContextMenuShell, MenuItem, MenuSeparator } from "@/components/ui/ContextMenuShell";
import { CreateUserModal } from "@/components/admin/CreateUserModal";
import { Pagination } from "@/components/admin/Pagination";
import { useToast } from "@/context/ToastProvider";
import { useFormatDate } from "@/context/SiteConfigProvider";
import { formatCompactNumber } from "@/lib/formatNumber";

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: "member" | "artist" | "admin";
  verifiedArtist: boolean;
  suspended: boolean;
  emailVerified: boolean;
  createdAt: string;
  artistId: string | null;
  eventPublishingAuthorized: boolean;
  songsCount: number;
  albumsCount: number;
};

type Stats = {
  total: number;
  members: number;
  artists: number;
  admins: number;
  newThisMonth: number;
  growth: { total: number; members: number; artists: number; new: number };
  statuses: { active: number; pending: number; suspended: number };
};

type EnAttente = { _id: string; name: string; email: string; avatarUrl?: string; createdAt: string };

const roleLabels: Record<AdminUser["role"], string> = {
  member: "Membre",
  artist: "Artiste",
  admin: "Admin",
};

const roleStyles: Record<AdminUser["role"], string> = {
  member: "bg-tint-blue/10 text-tint-blue",
  artist: "bg-accent/10 text-accent",
  admin: "bg-tint-violet/10 text-tint-violet",
};

const onglets = [
  { value: "" as const, label: "Tous", icon: UsersRound },
  { value: "member" as const, label: "Membres", icon: Users },
  { value: "artist" as const, label: "Artistes", icon: UserCog },
];

const TAILLES_PAGE = [10, 25, 50, 100];

/** L'état réel d'un compte, tel qu'il se lit dans les trois champs du modèle. */
function statutDe(user: AdminUser): { label: string; style: string } {
  if (user.suspended) return { label: "Suspendu", style: "bg-danger/10 text-danger" };
  if (!user.emailVerified) return { label: "En attente", style: "bg-warning/10 text-warning" };
  return { label: "Actif", style: "bg-verified/10 text-verified" };
}

export default function AdminMembersPage() {
  const pushToast = useToast();
  const formatDate = useFormatDate();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [enAttente, setEnAttente] = useState<EnAttente[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"" | AdminUser["role"]>("");
  const [statut, setStatut] = useState("");
  const [verifie, setVerifie] = useState("");
  const [page, setPage] = useState(1);
  const [taille, setTaille] = useState(10);

  const [selection, setSelection] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ user: AdminUser; x: number; y: number } | null>(null);
  const [suppression, setSuppression] = useState<AdminUser | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [creation, setCreation] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);

  // Une réponse arrivée après un changement de filtre écraserait l'affichage
  // par des lignes qu'on ne demande plus : seule la dernière requête compte.
  const requeteRef = useRef(0);

  const parametres = useCallback(
    (pageDemandee: number, tailleDemandee: number) => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (role) params.set("role", role);
      if (statut) params.set("status", statut);
      if (verifie) params.set("verified", verifie);
      params.set("page", String(pageDemandee));
      params.set("limit", String(tailleDemandee));
      return params;
    },
    [search, role, statut, verifie]
  );

  const charger = useCallback(async () => {
    const jeton = ++requeteRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?${parametres(page, taille)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (jeton !== requeteRef.current) return;
      setUsers(data.users);
      setStats(data.stats);
      setEnAttente(data.pending ?? []);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      if (jeton === requeteRef.current) pushToast("error", "Impossible de charger les utilisateurs.");
    } finally {
      if (jeton === requeteRef.current) setLoading(false);
    }
  }, [parametres, page, taille, pushToast]);

  // La recherche attend une pause de frappe ; les autres filtres, non.
  useEffect(() => {
    const delai = setTimeout(charger, search ? 300 : 0);
    return () => clearTimeout(delai);
  }, [charger, search]);

  // Changer de filtre remet à la première page : rester en page sept d'un
  // résultat qui n'en compte plus que deux afficherait une liste vide.
  useEffect(() => {
    setPage(1);
    setSelection([]);
  }, [search, role, statut, verifie, taille]);

  async function majUtilisateur(id: string, updates: Record<string, unknown>, message = "Utilisateur mis à jour.") {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      pushToast("error", "La mise à jour a échoué.");
      return false;
    }
    pushToast("success", message);
    charger();
    return true;
  }

  async function majArtiste(artistId: string, updates: { eventPublishingAuthorized?: boolean }) {
    const res = await fetch(`/api/admin/artists/${artistId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      pushToast("error", "La mise à jour a échoué.");
      return;
    }
    pushToast("success", "Artiste mis à jour.");
    charger();
  }

  async function supprimer() {
    if (!suppression) return;
    setEnCours(true);
    const res = await fetch(`/api/admin/users/${suppression._id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      pushToast("error", "La suppression a échoué.");
      return;
    }
    pushToast("success", "Compte supprimé.");
    setSuppression(null);
    charger();
  }

  /** Action de masse : la même requête, répétée sur la sélection. */
  async function actionGroupee(updates: Record<string, unknown>, message: string) {
    if (selection.length === 0) return;
    setEnCours(true);
    const resultats = await Promise.all(
      selection.map((id) =>
        fetch(`/api/admin/users/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }).then((r) => r.ok)
      )
    );
    setEnCours(false);
    const echecs = resultats.filter((ok) => !ok).length;
    if (echecs > 0) pushToast("error", `${echecs} compte(s) n'ont pas pu être mis à jour.`);
    else pushToast("success", message);
    setSelection([]);
    charger();
  }

  /**
   * Export : on redemande la liste sans pagination plutôt que d'exporter la
   * page affichée — un fichier qui ne contiendrait que dix lignes sur douze
   * mille ne servirait à rien.
   */
  async function exporter() {
    setExportEnCours(true);
    try {
      const res = await fetch(`/api/admin/users?${parametres(1, 200)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const lignes = [
        ["Nom", "Email", "Rôle", "Statut", "Vérifié", "Morceaux", "Albums", "Inscrit le"],
        ...(data.users as AdminUser[]).map((u) => [
          u.name,
          u.email,
          roleLabels[u.role],
          statutDe(u).label,
          u.verifiedArtist ? "oui" : "non",
          String(u.songsCount),
          String(u.albumsCount),
          formatDate(u.createdAt),
        ]),
      ];
      // Les guillemets internes sont doublés : un nom contenant une virgule
      // décalerait sinon toutes les colonnes suivantes.
      const csv = lignes.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = `moziik-utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`;
      lien.click();
      URL.revokeObjectURL(url);
      if (data.total > data.users.length) {
        pushToast("success", `${data.users.length} lignes exportées sur ${data.total} — affinez les filtres pour le reste.`);
      }
    } catch {
      pushToast("error", "L'export a échoué.");
    } finally {
      setExportEnCours(false);
    }
  }

  const toutSelectionne = users.length > 0 && selection.length === users.length;
  const segments = useMemo(
    () =>
      stats
        ? [
            { label: "Membres", count: stats.members },
            { label: "Artistes", count: stats.artists },
            { label: "Admins", count: stats.admins },
          ]
        : [],
    [stats]
  );

  return (
    <div className="space-y-6">
      <AdminHeaderActions>
        <button
          type="button"
          onClick={() => setCreation(true)}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover"
        >
          <Plus size={16} /> Ajouter un utilisateur
        </button>
      </AdminHeaderActions>

      <AdminTabs tabs={onglets} value={role} onChange={setRole} />

      {/* Compteurs */}
      {!stats ? (
        <AdminStatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total utilisateurs"
            value={formatCompactNumber(stats.total)}
            icon={UsersRound}
            color="text-tint-violet"
            bg="bg-tint-violet/10"
            hint={<Tendance valeur={stats.growth.total} suffixe="ce mois" />}
          />
          <StatCard
            label="Membres"
            value={formatCompactNumber(stats.members)}
            icon={Users}
            color="text-tint-emerald"
            bg="bg-tint-emerald/10"
            hint={<Tendance valeur={stats.growth.members} suffixe="ce mois" />}
          />
          <StatCard
            label="Artistes"
            value={formatCompactNumber(stats.artists)}
            icon={UserCog}
            color="text-accent"
            bg="bg-accent/10"
            hint={<Tendance valeur={stats.growth.artists} suffixe="ce mois" />}
          />
          <StatCard
            label="Nouveaux ce mois"
            value={formatCompactNumber(stats.newThisMonth)}
            icon={UserPlus}
            color="text-tint-sky"
            bg="bg-tint-sky/10"
            hint={<Tendance valeur={stats.growth.new} suffixe="vs mois dernier" />}
          />
        </div>
      )}

      {/* Barre de filtres */}
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5">
          <Search size={15} className="shrink-0 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un membre, artiste, email..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>

        <Filtre value={role} onChange={(v) => setRole(v as typeof role)} aria="Filtrer par rôle">
          <option value="">Rôle</option>
          <option value="member">Membres</option>
          <option value="artist">Artistes</option>
          <option value="admin">Admins</option>
        </Filtre>

        <Filtre value={statut} onChange={setStatut} aria="Filtrer par statut">
          <option value="">Statut</option>
          <option value="active">Actifs</option>
          <option value="pending">En attente</option>
          <option value="suspended">Suspendus</option>
        </Filtre>

        <Filtre value={verifie} onChange={setVerifie} aria="Filtrer par vérification">
          <option value="">Vérifié</option>
          <option value="yes">Vérifiés</option>
          <option value="no">Non vérifiés</option>
        </Filtre>

        <button
          type="button"
          onClick={exporter}
          disabled={exportEnCours}
          aria-label="Exporter en CSV"
          title="Exporter en CSV"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {exportEnCours ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        </button>
      </div>

      {/* Actions de masse */}
      {selection.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3">
          <span className="text-sm font-medium text-ink">
            {selection.length} sélectionné{selection.length > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            disabled={enCours}
            onClick={() => actionGroupee({ suspended: true }, "Comptes suspendus.")}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-60"
          >
            Suspendre
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={() => actionGroupee({ suspended: false }, "Comptes réactivés.")}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-verified hover:text-verified disabled:opacity-60"
          >
            Réactiver
          </button>
          <button
            type="button"
            onClick={() => setSelection([])}
            className="ml-auto text-xs font-medium text-ink-muted hover:text-ink"
          >
            Tout désélectionner
          </button>
        </div>
      )}

      {/* Tableau */}
      {loading && users.length === 0 ? (
        <AdminPanelSkeleton height="h-96" />
      ) : (
        <div className="overflow-hidden rounded-xl2 border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-ink-muted">
                  <th scope="col" className="w-10 py-3 pl-4">
                    <input
                      type="checkbox"
                      checked={toutSelectionne}
                      onChange={(e) => setSelection(e.target.checked ? users.map((u) => u._id) : [])}
                      aria-label="Tout sélectionner"
                      className="h-4 w-4 accent-accent"
                    />
                  </th>
                  <th scope="col" className="py-3 pr-3">Utilisateur</th>
                  <th scope="col" className="py-3 pr-3">Rôle</th>
                  <th scope="col" className="py-3 pr-3">Statut</th>
                  <th scope="col" className="py-3 pr-3">Vérifié</th>
                  <th scope="col" className="py-3 pr-3">Morceaux</th>
                  <th scope="col" className="py-3 pr-3">Albums</th>
                  <th scope="col" className="py-3 pr-3">Inscrit le</th>
                  <th scope="col" className="w-16 py-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const statutUser = statutDe(user);
                  return (
                    <tr key={user._id} className="border-b border-border transition-colors last:border-0 hover:bg-base/60">
                      <td className="py-2.5 pl-4">
                        <input
                          type="checkbox"
                          checked={selection.includes(user._id)}
                          onChange={(e) =>
                            setSelection((prev) =>
                              e.target.checked ? [...prev, user._id] : prev.filter((id) => id !== user._id)
                            )
                          }
                          aria-label={`Sélectionner ${user.name}`}
                          className="h-4 w-4 accent-accent"
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <SafeImage
                            src={user.avatarUrl}
                            alt=""
                            width={36}
                            height={36}
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{user.name}</p>
                            <p className="truncate text-xs text-ink-muted">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${roleStyles[user.role]}`}>
                          {roleLabels[user.role]}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statutUser.style}`}>
                          {statutUser.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {user.verifiedArtist ? (
                          <BadgeCheck size={17} className="text-verified" aria-label="Vérifié" />
                        ) : (
                          <Minus size={15} className="text-ink-muted" aria-label="Non vérifié" />
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-ink-muted">{user.role === "artist" ? user.songsCount : "—"}</td>
                      <td className="py-2.5 pr-3 text-ink-muted">{user.role === "artist" ? user.albumsCount : "—"}</td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-ink-muted">{formatDate(user.createdAt)}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenu({ user, x: rect.right, y: rect.bottom + 4 });
                            }}
                            aria-label={`Actions pour ${user.name}`}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink"
                          >
                            <MoreVertical size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && users.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-ink-muted">
              Aucun utilisateur ne correspond à ces critères.
            </p>
          )}

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="text-xs text-ink-muted">
              {total === 0
                ? "Aucun résultat"
                : `Affichage de ${(page - 1) * taille + 1} à ${Math.min(page * taille, total)} sur ${total} utilisateurs`}
            </p>
            <div className="flex items-center gap-2">
              <Pagination page={page} pages={pages} onChange={setPage} />
              <select
                value={taille}
                onChange={(e) => setTaille(Number(e.target.value))}
                aria-label="Résultats par page"
                className="rounded-xl border border-border bg-base px-3 py-1.5 text-xs outline-none focus:border-accent"
              >
                {TAILLES_PAGE.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Synthèse */}
      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard title="Répartition par rôle">
          {stats ? <DonutChart segments={segments} /> : <AdminPanelSkeleton height="h-40" />}
        </AdminCard>

        <AdminCard title="Statut des utilisateurs">
          {stats && (
            <div className="space-y-3">
              <Barre label="Actifs" valeur={stats.statuses.active} total={stats.total} couleur="bg-verified" />
              <Barre label="En attente" valeur={stats.statuses.pending} total={stats.total} couleur="bg-warning" />
              <Barre label="Suspendus" valeur={stats.statuses.suspended} total={stats.total} couleur="bg-danger" />
              <p className="pt-1 text-xs text-ink-muted">
                « En attente » désigne les comptes dont l&apos;adresse email n&apos;est pas encore confirmée.
              </p>
            </div>
          )}
        </AdminCard>

        <AdminCard title="Actions rapides">
          <div className="flex flex-col">
            <ActionRapide
              icon={UserPlus}
              label="Ajouter un membre"
              aide="Créer un compte membre"
              onClick={() => setCreation(true)}
            />
            <ActionRapide
              icon={UserCog}
              label="Voir les artistes à vérifier"
              aide={`${enAttente.length} en attente`}
              onClick={() => {
                setRole("artist");
                setVerifie("no");
              }}
            />
            <ActionRapide
              icon={ShieldOff}
              label="Comptes suspendus"
              aide={`${stats?.statuses.suspended ?? 0} compte(s)`}
              onClick={() => {
                setRole("");
                setStatut("suspended");
              }}
            />
          </div>
        </AdminCard>
      </div>

      {/* File des vérifications */}
      <AdminCard
        title={`Demandes de vérification${enAttente.length ? ` · ${enAttente.length}` : ""}`}
        description="Les comptes artistes qui n'ont pas encore reçu le badge vérifié."
      >
        {enAttente.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun artiste en attente de vérification.</p>
        ) : (
          <ul className="divide-y divide-border">
            {enAttente.map((artiste) => (
              <li key={artiste._id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <SafeImage
                  src={artiste.avatarUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{artiste.name}</p>
                  <p className="truncate text-xs text-ink-muted">{artiste.email}</p>
                </div>
                <span className="text-xs text-ink-muted">{formatDate(artiste.createdAt)}</span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => majUtilisateur(artiste._id, { verifiedArtist: true }, "Artiste vérifié.")}
                    className="rounded-lg border border-verified px-3 py-1.5 text-xs font-medium text-verified transition-colors hover:bg-verified/10"
                  >
                    Vérifier
                  </button>
                  <button
                    type="button"
                    onClick={() => majUtilisateur(artiste._id, { role: "member" }, "Compte repassé en membre.")}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-danger hover:text-danger"
                  >
                    Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      {/* Menu d'une ligne */}
      {menu && (
        <ContextMenuShell anchor={{ x: menu.x, y: menu.y }} onClose={() => setMenu(null)} width={230}>
          {menu.user.role !== "artist" && (
            <MenuItem
              icon={UserCog}
              label="Promouvoir en artiste"
              onClick={() => {
                majUtilisateur(menu.user._id, { role: "artist" }, "Compte promu artiste.");
                setMenu(null);
              }}
            />
          )}
          {menu.user.role === "artist" && (
            <>
              <MenuItem
                icon={BadgeCheck}
                label={menu.user.verifiedArtist ? "Retirer la vérification" : "Vérifier l'artiste"}
                onClick={() => {
                  majUtilisateur(menu.user._id, { verifiedArtist: !menu.user.verifiedArtist });
                  setMenu(null);
                }}
              />
              {menu.user.artistId && (
                <MenuItem
                  icon={CalendarClock}
                  label={
                    menu.user.eventPublishingAuthorized ? "Retirer les évènements" : "Autoriser les évènements"
                  }
                  onClick={() => {
                    majArtiste(menu.user.artistId as string, {
                      eventPublishingAuthorized: !menu.user.eventPublishingAuthorized,
                    });
                    setMenu(null);
                  }}
                />
              )}
              <MenuItem
                icon={Users}
                label="Rétrograder en membre"
                onClick={() => {
                  majUtilisateur(menu.user._id, { role: "member" }, "Compte repassé en membre.");
                  setMenu(null);
                }}
              />
            </>
          )}
          <MenuSeparator />
          <MenuItem
            icon={menu.user.suspended ? ShieldCheck : ShieldOff}
            label={menu.user.suspended ? "Réactiver le compte" : "Suspendre le compte"}
            onClick={() => {
              majUtilisateur(
                menu.user._id,
                { suspended: !menu.user.suspended },
                menu.user.suspended ? "Compte réactivé." : "Compte suspendu."
              );
              setMenu(null);
            }}
          />
          <MenuItem
            icon={Trash2}
            label="Supprimer le compte"
            danger
            onClick={() => {
              setSuppression(menu.user);
              setMenu(null);
            }}
          />
        </ContextMenuShell>
      )}

      {suppression && (
        <ConfirmDialog
          title={`Supprimer le compte de ${suppression.name} ?`}
          description={
            suppression.role === "artist"
              ? "Cette action est irréversible et emporte le profil artiste avec ses morceaux, albums et évènements."
              : "Cette action est irréversible : le compte et ses données seront définitivement supprimés."
          }
          confirmLabel="Supprimer"
          busy={enCours}
          onConfirm={supprimer}
          onCancel={() => setSuppression(null)}
        />
      )}

      {creation && (
        <CreateUserModal
          onClose={() => setCreation(false)}
          onCreated={() => {
            setCreation(false);
            charger();
          }}
        />
      )}
    </div>
  );
}

function Tendance({ valeur, suffixe }: { valeur: number; suffixe: string }) {
  if (valeur === 0) return <span className="text-ink-muted">stable {suffixe}</span>;
  const positif = valeur > 0;
  const Icone = positif ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-1 ${positif ? "text-verified" : "text-danger"}`}>
      <Icone size={12} />
      {positif ? "+" : ""}
      {valeur} % {suffixe}
    </span>
  );
}

function Filtre({
  value,
  onChange,
  aria,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  aria: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={aria}
      className="shrink-0 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
    >
      {children}
    </select>
  );
}

function Barre({ label, valeur, total, couleur }: { label: string; valeur: number; total: number; couleur: string }) {
  const part = total > 0 ? Math.round((valeur / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-ink-muted">{label}</span>
        <span className="font-medium text-ink">
          {formatCompactNumber(valeur)} <span className="text-ink-muted">({part} %)</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${couleur}`} style={{ width: `${part}%` }} />
      </div>
    </div>
  );
}

function ActionRapide({
  icon: Icon,
  label,
  aide,
  onClick,
}: {
  icon: typeof UserPlus;
  label: string;
  aide: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 border-b border-border py-3 text-left transition-colors last:border-0 hover:text-accent"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-ink-muted">{aide}</span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-ink-muted" />
    </button>
  );
}

/** Pagination compacte : bornes, voisins de la page courante, et ellipses. */
