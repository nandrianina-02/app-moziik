"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Award, BadgeCheck, Star } from "lucide-react";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { FormField } from "@/components/ui/FormField";
import { useToast } from "@/context/ToastProvider";

type Badge = { _id: string; key: string; label: string; description: string; icon: string; category: string };
type UserOption = { _id: string; name: string; email: string };

const categoryIcon = { member: Star, artist: BadgeCheck, achievement: Award } as const;

export default function AdminBadgesPage() {
  const pushToast = useToast();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"member" | "artist" | "achievement">("member");

  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  async function loadBadges() {
    try {
      const res = await fetch("/api/badges");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBadges(data.badges);
    } catch {
      pushToast("error", "Impossible de charger les badges.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBadges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createBadge(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/badges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, label, description, icon: "award", category }),
    });
    if (!res.ok) {
      const data = await res.json();
      pushToast("error", data.error ?? "Échec de la création.");
      return;
    }
    pushToast("success", "Badge créé.");
    setKey("");
    setLabel("");
    setDescription("");
    setShowCreate(false);
    loadBadges();
  }

  async function searchUsers(value: string) {
    setSearch(value);
    if (value.trim().length < 2) {
      setUsers([]);
      return;
    }
    const res = await fetch(`/api/admin/users?search=${encodeURIComponent(value)}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
  }

  async function assignBadge(userId: string) {
    if (!selectedBadge) return;
    const res = await fetch("/api/admin/badges/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, badgeKey: selectedBadge.key, badgeLabel: selectedBadge.label }),
    });
    if (!res.ok) {
      pushToast("error", "L'attribution a échoué.");
      return;
    }
    pushToast("success", "Badge attribué.");
  }

  if (loading) {
    return (
      <div className="py-10 grid place-items-center">
        <EqualizerLoader />
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm uppercase tracking-wide text-ink-muted">Catalogue</h2>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <Plus size={13} /> Nouveau badge
          </button>
        </div>

        {showCreate && (
          <form onSubmit={createBadge} className="rounded-xl2 border border-border bg-surface p-4 mb-4 space-y-3">
            <FormField label="Clé (identifiant unique)" required value={key} onChange={(e) => setKey(e.target.value)} placeholder="ex: top_listener" />
            <FormField label="Nom affiché" required value={label} onChange={(e) => setLabel(e.target.value)} />
            <FormField label="Description" required value={description} onChange={(e) => setDescription(e.target.value)} />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none"
            >
              <option value="member">Membre</option>
              <option value="artist">Artiste</option>
              <option value="achievement">Succès</option>
            </select>
            <button type="submit" className="w-full rounded-xl bg-accent py-2 text-sm font-medium text-base hover:bg-accent-hover">
              Créer
            </button>
          </form>
        )}

        <div className="space-y-2">
          {badges.map((badge) => {
            const Icon = categoryIcon[badge.category as keyof typeof categoryIcon] ?? Award;
            return (
              <button
                key={badge._id}
                onClick={() => setSelectedBadge(badge)}
                className={`w-full flex items-center gap-3 rounded-xl2 border px-4 py-3 text-left transition-colors ${
                  selectedBadge?._id === badge._id ? "border-accent bg-surface" : "border-border hover:border-accent"
                }`}
              >
                <Icon size={16} className="text-accent shrink-0" />
                <span>
                  <span className="block text-sm">{badge.label}</span>
                  <span className="block text-xs text-ink-muted">{badge.description}</span>
                </span>
              </button>
            );
          })}
          {badges.length === 0 && <p className="text-sm text-ink-muted">Aucun badge créé pour l&apos;instant.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-4">
          Attribuer {selectedBadge ? `« ${selectedBadge.label} »` : ""}
        </h2>

        {!selectedBadge && <p className="text-sm text-ink-muted">Sélectionne un badge à gauche.</p>}

        {selectedBadge && (
          <>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 mb-4">
              <Search size={14} className="text-ink-muted" />
              <input
                value={search}
                onChange={(e) => searchUsers(e.target.value)}
                placeholder="Rechercher un membre..."
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </label>

            <ul className="space-y-1">
              {users.map((user) => (
                <li key={user._id} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-surface">
                  <span className="text-sm truncate">{user.name}</span>
                  <button
                    onClick={() => assignBadge(user._id)}
                    className="text-xs text-accent hover:underline shrink-0"
                  >
                    Attribuer
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
