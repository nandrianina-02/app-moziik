"use client";

import { useEffect, useState } from "react";
import { Search, BadgeCheck, ShieldOff, ShieldCheck, CalendarClock } from "lucide-react";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { useToast } from "@/context/ToastProvider";

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  role: "member" | "artist" | "admin";
  verifiedArtist: boolean;
  suspended: boolean;
  artistId: string | null;
  eventPublishingAuthorized: boolean;
};

const roleLabels: Record<AdminUser["role"], string> = {
  member: "Membre",
  artist: "Artiste",
  admin: "Admin",
};

export default function AdminMembersPage() {
  const pushToast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsers(data.users);
    } catch {
      pushToast("error", "Impossible de charger les utilisateurs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  async function updateUser(id: string, updates: Partial<AdminUser>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      pushToast("error", "La mise à jour a échoué.");
      return;
    }
    pushToast("success", "Utilisateur mis à jour.");
    load();
  }

  async function updateArtist(artistId: string, updates: { eventPublishingAuthorized?: boolean }) {
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
    load();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 flex-1">
          <Search size={16} className="text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un nom ou un email..."
            className="bg-transparent text-sm outline-none flex-1"
          />
        </label>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl border border-border bg-surface px-3.5 py-2 text-sm outline-none"
        >
          <option value="">Tous les rôles</option>
          <option value="member">Membres</option>
          <option value="artist">Artistes</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {loading && (
        <div className="py-10 grid place-items-center">
          <EqualizerLoader />
        </div>
      )}

      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user._id}
            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl2 border border-border bg-surface px-4 py-3.5"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate flex items-center gap-1.5">
                {user.name}
                {user.verifiedArtist && <BadgeCheck size={14} className="text-verified" />}
                {user.suspended && <span className="text-accent text-xs">(suspendu)</span>}
              </p>
              <p className="text-xs text-ink-muted truncate">{user.email}</p>
            </div>

            <select
              value={user.role}
              onChange={(e) => updateUser(user._id, { role: e.target.value as AdminUser["role"] })}
              className="rounded-xl border border-border bg-base px-3 py-1.5 text-xs outline-none"
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {user.role === "artist" && (
              <button
                onClick={() => updateUser(user._id, { verifiedArtist: !user.verifiedArtist })}
                className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-ink-muted hover:border-verified hover:text-verified"
              >
                <BadgeCheck size={13} />
                {user.verifiedArtist ? "Retirer vérif." : "Vérifier"}
              </button>
            )}

            {user.role === "artist" && user.artistId && (
              <button
                onClick={() => updateArtist(user.artistId as string, { eventPublishingAuthorized: !user.eventPublishingAuthorized })}
                className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${
                  user.eventPublishingAuthorized
                    ? "border-verified text-verified hover:bg-verified/10"
                    : "border-border text-ink-muted hover:border-accent hover:text-accent"
                }`}
              >
                <CalendarClock size={13} />
                {user.eventPublishingAuthorized ? "Évènements autorisés" : "Autoriser évènements"}
              </button>
            )}

            <button
              onClick={() => updateUser(user._id, { suspended: !user.suspended })}
              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${
                user.suspended
                  ? "border-verified text-verified hover:bg-verified/10"
                  : "border-border text-ink-muted hover:border-accent hover:text-accent"
              }`}
            >
              {user.suspended ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
              {user.suspended ? "Réactiver" : "Suspendre"}
            </button>
          </div>
        ))}

        {!loading && users.length === 0 && (
          <p className="text-sm text-ink-muted">Aucun utilisateur ne correspond à ces critères.</p>
        )}
      </div>
    </div>
  );
}
