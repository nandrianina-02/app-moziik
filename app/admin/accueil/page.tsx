"use client";

import { Fragment, useEffect, useState } from "react";
import {
  GripVertical,
  Pin,
  Trash2,
  Settings2,
  Eye,
  Save,
  Plus,
  Pencil,
  TrendingUp,
  TrendingDown,
  ListChecks,
} from "lucide-react";
import { AdminStatsSkeleton, AdminPanelSkeleton } from "@/components/admin/AdminSkeleton";
import { FormField } from "@/components/ui/FormField";
import { SafeImage } from "@/components/ui/SafeImage";
import { StatCard } from "@/components/admin/StatCard";
import { Toggle } from "@/components/admin/Toggle";
import { IconActionButton } from "@/components/admin/IconActionButton";
import { HubCardsManager } from "@/components/admin/HubCardsManager";
import { PinnedContentManager } from "@/components/admin/PinnedContentManager";
import { useToast } from "@/context/ToastProvider";
import {
  SECTION_PAGES,
  SECTION_PAGE_LABEL,
  SECTION_PAGE_PREVIEW,
  type SectionPage,
} from "@/lib/sectionPages";

type SectionFilters = { publicOnly: boolean; verifiedOnly: boolean; premiumOnly: boolean };

type Section = {
  _id: string;
  key: string;
  slug?: string;
  title: string;
  enabled: boolean;
  position: number;
  mode: "auto" | "manual";
  limit: number;
  filters: SectionFilters;
};

type Settings = {
  _id: string;
  heroMode: "auto" | "manual";
  recommendationMode: "auto" | "manual";
  theme: "dark" | "light" | "system";
  updatedAt: string;
};

type Pinned = {
  _id: string;
  contentType: "song" | "album" | "artist" | "playlist" | "event" | "custom";
  contentId: string;
  section: string;
  priority: number;
  startDate?: string;
  endDate?: string;
  title: string;
  coverUrl?: string;
};

type Stats = {
  sectionsTotal: number;
  sectionsActive: number;
  pinnedTotal: number;
  pinnedActive: number;
  totalViews: number;
  viewsTrendPct: number | null;
  engagementRatePct: number | null;
};

const contentTypes: Pinned["contentType"][] = ["song", "album", "artist", "playlist", "event"];

// Miroir de `manualCapableKeys` dans lib/homeContentEngine.ts : sections
// dont le mode manuel s'appuie sur du contenu épinglé identifiable.
const manualCapableKeys = [
  "new_releases",
  "top_tracks",
  "recommendations",
  "playlists",
  "albums",
  "trending_artists",
  "events",
  "custom",
];

const sortLabel: Record<string, string> = {
  hero: "Priorité",
  for_you: "Manuel (cartes)",
  recently_played: "Historique personnel",
  new_releases: "Date décroissante",
  top_tracks: "Score",
  albums: "Score",
  trending_artists: "Score",
  recommendations: "Pertinence",
  playlists: "Popularité",
  genres: "Popularité",
  events: "Date croissante",
  radio: "—",
  premium: "Manuel",
  activity: "Date décroissante",
  custom: "Manuel",
};

const typeBadgeColor: Record<string, string> = {
  hero: "bg-tint-violet/15 text-tint-violet",
  for_you: "bg-tint-cyan/15 text-tint-cyan",
  recently_played: "bg-tint-lime/15 text-tint-lime",
  new_releases: "bg-tint-sky/15 text-tint-sky",
  top_tracks: "bg-tint-teal/15 text-tint-teal",
  albums: "bg-tint-orange/15 text-tint-orange",
  trending_artists: "bg-tint-pink/15 text-tint-pink",
  recommendations: "bg-tint-indigo/15 text-tint-indigo",
  playlists: "bg-tint-emerald/15 text-tint-emerald",
  genres: "bg-tint-fuchsia/15 text-tint-fuchsia",
  events: "bg-tint-amber/15 text-tint-amber",
  radio: "bg-tint-rose/15 text-tint-rose",
  premium: "bg-tint-orange/15 text-tint-orange",
  activity: "bg-tint-blue/15 text-tint-blue",
  custom: "bg-tint-slate/15 text-tint-slate",
};

const contentLabel: Record<Pinned["contentType"], string> = {
  song: "Titre",
  album: "Album",
  artist: "Artiste",
  playlist: "Playlist",
  event: "Évènement",
  custom: "Bannière personnalisée",
};

function formatNumber(n: number) {
  return n.toLocaleString("fr-FR");
}

function formatDateRange(start?: string, end?: string) {
  const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (start && end) return `${fmt(start)} - ${fmt(end)}`;
  if (start) return `Depuis le ${fmt(start)}`;
  if (end) return `Jusqu'au ${fmt(end)}`;
  return "Sans limite de date";
}

export default function AdminHomepagePage() {
  const pushToast = useToast();
  // Groupe de pages en cours d'édition. L'accueil reste l'onglet d'entrée :
  // c'est la page la plus configurée, et la seule dont les statistiques de
  // fréquentation sont mesurées.
  const [page, setPage] = useState<SectionPage>("home");
  const [sections, setSections] = useState<Section[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pinned, setPinned] = useState<Pinned[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showHubCardsManager, setShowHubCardsManager] = useState(false);
  const [contentManagerTarget, setContentManagerTarget] = useState<{ slug: string; title: string } | null>(null);
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionLimit, setNewSectionLimit] = useState(8);
  const [creatingSection, setCreatingSection] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [homeRes, pinnedRes, statsRes] = await Promise.all([
        fetch(`/api/admin/homepage?page=${page}`),
        fetch("/api/admin/homepage/pinned"),
        fetch(`/api/admin/homepage/stats?page=${page}`),
      ]);
      if (!homeRes.ok || !pinnedRes.ok || !statsRes.ok) throw new Error();
      const homeData = await homeRes.json();
      const pinnedData = await pinnedRes.json();
      const statsData = await statsRes.json();
      setSections(homeData.sections);
      setSettings(homeData.settings);
      setPinned(pinnedData.pinned);
      setStats(statsData);
      setDirty(false);
    } catch {
      pushToast("error", "Impossible de charger la configuration de l'accueil.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function updateSectionLocal(id: string, updates: Partial<Section>) {
    setSections((prev) => prev.map((s) => (s._id === id ? { ...s, ...updates } : s)));
    setDirty(true);
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const current = [...sections];
    const fromIndex = current.findIndex((s) => s._id === dragId);
    const toIndex = current.findIndex((s) => s._id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    setSections(current);
    setDragId(null);
    setDirty(true);
  }

  /** Enregistre en une fois : l'ordre des sections, les champs modifiés de chaque section, et les réglages généraux. */
  async function saveAll() {
    setSaving(true);
    try {
      const order = sections.map((s, i) => ({ id: s._id, position: i }));
      await fetch(`/api/admin/homepage/sections?page=${page}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });

      await Promise.all(
        sections.map((s) =>
          fetch(`/api/admin/homepage/sections/${s._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: s.title,
              enabled: s.enabled,
              mode: s.mode,
              limit: s.limit,
              filters: s.filters,
            }),
          })
        )
      );

      if (settings) {
        await fetch("/api/admin/homepage", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            heroMode: settings.heroMode,
            recommendationMode: settings.recommendationMode,
            theme: settings.theme,
          }),
        });
      }

      pushToast("success", "Modifications enregistrées.");
      setDirty(false);
      load();
    } catch {
      pushToast("error", "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function createSection(e: React.FormEvent) {
    e.preventDefault();
    if (!newSectionTitle.trim()) {
      pushToast("error", "Le titre de la section est obligatoire.");
      return;
    }
    setCreatingSection(true);
    try {
      const res = await fetch("/api/admin/homepage/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSectionTitle.trim(), limit: newSectionLimit, page }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      pushToast("success", "Section créée. Ajoute-lui du contenu épinglé pour qu'elle s'affiche.");
      setNewSectionTitle("");
      setNewSectionLimit(8);
      setShowAddSection(false);
      load();
    } catch (err) {
      pushToast("error", err instanceof Error && err.message ? err.message : "Échec de la création.");
    } finally {
      setCreatingSection(false);
    }
  }

  async function deleteSection(id: string) {
    try {
      const res = await fetch(`/api/admin/homepage/sections/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setSections((prev) => prev.filter((s) => s._id !== id));
      pushToast("success", "Section supprimée.");
    } catch (err) {
      pushToast("error", err instanceof Error && err.message ? err.message : "Échec de la suppression.");
    }
  }

  async function removePinned(id: string) {
    try {
      const res = await fetch(`/api/admin/homepage/pinned/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setPinned((prev) => prev.filter((p) => p._id !== id));
      setStats((prev) => (prev ? { ...prev, pinnedTotal: prev.pinnedTotal - 1 } : prev));
      pushToast("success", "Retiré des contenus épinglés.");
    } catch {
      pushToast("error", "Échec de la suppression.");
    }
  }

  if (loading || !settings || !stats) {
    return (
      <div className="space-y-6">
        <AdminStatsSkeleton count={4} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <AdminPanelSkeleton height="h-96" />
          <div className="space-y-6">
            <AdminPanelSkeleton height="h-56" />
            <AdminPanelSkeleton height="h-64" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg">Gestion des sections</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Configurez les contenus affichés sur {SECTION_PAGE_LABEL[page].toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Les pages détail dépendent d'un contenu précis : aucune URL
              fixe à ouvrir, donc pas de bouton de prévisualisation. */}
          {SECTION_PAGE_PREVIEW[page] && (
            <a
              href={SECTION_PAGE_PREVIEW[page] as string}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-accent"
            >
              <Eye size={16} /> Prévisualiser
            </a>
          )}
          <button
            onClick={saveAll}
            disabled={saving || !dirty}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-base hover:bg-accent-hover disabled:opacity-60"
          >
            <Save size={16} /> {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      </div>

      {/* Chaque groupe rassemble des pages jumelles : configurer
          « Radio & Classements » alimente les deux d'un coup. */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {SECTION_PAGES.map((value) => (
          <button
            key={value}
            onClick={() => {
              if (dirty && !confirm("Des modifications ne sont pas enregistrées. Changer de page les abandonnera.")) return;
              setPage(value);
            }}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              page === value ? "border-accent bg-accent text-base" : "border-border text-ink-muted hover:border-accent"
            }`}
          >
            {SECTION_PAGE_LABEL[value]}
          </button>
        ))}
      </div>

      {page !== "home" && (
        <p className="rounded-xl2 border border-dashed border-border px-4 py-3 text-xs text-ink-muted">
          Ces sections arrivent désactivées : rien ne change sur le site tant que vous n&apos;en activez pas une.
          Une fois active, elle s&apos;affiche sur toutes les pages du groupe.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ListChecks}
          bg="bg-tint-emerald/10"
          color="text-tint-emerald"
          label="Sections actives"
          value={`${stats.sectionsActive} / ${stats.sectionsTotal}`}
          hint="Sections affichées"
        />
        <StatCard
          icon={Pin}
          bg="bg-tint-orange/10"
          color="text-tint-orange"
          label="Contenus épinglés"
          value={String(stats.pinnedActive)}
          hint={`${stats.pinnedTotal} au total, actuellement en avant`}
        />
        <StatCard
          icon={TrendingUp}
          bg="bg-tint-sky/10"
          color="text-tint-sky"
          label="Taux d'engagement"
          value={stats.engagementRatePct !== null ? `${stats.engagementRatePct.toFixed(1)}%` : "—"}
          hint="Écoutes / vues (30 derniers jours)"
        />
        <StatCard
          icon={Eye}
          bg="bg-tint-violet/10"
          color="text-tint-violet"
          label="Vues de la page d'accueil"
          value={formatNumber(stats.totalViews)}
          hint={
            stats.viewsTrendPct !== null ? (
              <span className={`flex items-center gap-1 ${stats.viewsTrendPct >= 0 ? "text-tint-emerald" : "text-accent"}`}>
                {stats.viewsTrendPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {stats.viewsTrendPct >= 0 ? "+" : ""}
                {stats.viewsTrendPct.toFixed(1)}% vs mois dernier
              </span>
            ) : (
              "Pas encore de mois précédent"
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 rounded-xl2 border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">Sections — {SECTION_PAGE_LABEL[page]}</h2>
              <p className="text-xs text-ink-muted">Gérez l&apos;affichage, l&apos;ordre et les paramètres de chaque section</p>
            </div>
            <button
              onClick={() => setShowAddSection((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:border-accent"
            >
              <Plus size={14} /> Ajouter une section
            </button>
          </div>

          {showAddSection && (
            <form
              onSubmit={createSection}
              className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-border p-3"
            >
              <label className="flex-1 min-w-[180px] text-xs text-ink-muted space-y-1">
                Titre de la nouvelle section
                <input
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="ex: Sélection du mois"
                  className="w-full rounded-lg border border-border bg-base px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <label className="text-xs text-ink-muted space-y-1">
                Limite
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={newSectionLimit}
                  onChange={(e) => setNewSectionLimit(Number(e.target.value))}
                  className="w-20 rounded-lg border border-border bg-base px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <button
                type="submit"
                disabled={creatingSection}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-medium text-base hover:bg-accent-hover disabled:opacity-60"
              >
                {creatingSection ? "Création..." : "Créer"}
              </button>
              <p className="w-full text-[11px] text-ink-muted">
                Une section personnalisée est toujours en mode manuel : ajoutez-y du contenu épinglé une fois créée.
              </p>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted">
                  <th className="w-8 py-2"></th>
                  <th className="py-2 font-medium">Section</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Mode</th>
                  <th className="py-2 font-medium">Limite</th>
                  <th className="py-2 font-medium">Tri</th>
                  <th className="py-2 font-medium">Statut</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section, i) => (
                  <Fragment key={section._id}>
                    <tr
                      draggable={section.key !== "hero"}
                      onDragStart={() => section.key !== "hero" && setDragId(section._id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => section.key !== "hero" && handleDrop(section._id)}
                      className={`border-b border-border/60 transition-opacity ${section.enabled ? "" : "opacity-50"}`}
                    >
                      <td className="py-3 text-ink-muted">
                        {section.key === "hero" ? (
                          <span title="Toujours affichée en premier">
                            <Pin size={14} />
                          </span>
                        ) : (
                          <span className="cursor-grab">
                            <GripVertical size={16} />
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-ink">{section.title}</p>
                        <p className="text-xs text-ink-muted">{section.key === "hero" ? "Toujours en premier" : `Ordre ${i + 1}`}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeColor[section.key] ?? "bg-surface text-ink-muted"}`}>
                          {section.key}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        <span className={section.mode === "auto" ? "text-tint-sky" : "text-tint-orange"}>
                          {section.mode === "auto" ? "Automatique" : "Manuel"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-ink-muted">{section.limit}</td>
                      <td className="py-3 pr-4 text-xs text-ink-muted">{sortLabel[section.key] ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <Toggle
                          checked={section.enabled}
                          onChange={() => updateSectionLocal(section._id, { enabled: !section.enabled })}
                          label={`Activer ${section.title}`}
                        />
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {section.key === "for_you" ? (
                            <IconActionButton
                              icon={Settings2}
                              label="Gérer les cartes"
                              size={15}
                              onClick={() => setShowHubCardsManager(true)}
                            />
                          ) : section.key === "hero" ? (
                            <IconActionButton
                              icon={Settings2}
                              label="Gérer la bannière"
                              size={15}
                              onClick={() => setContentManagerTarget({ slug: "hero", title: "Bannière" })}
                            />
                          ) : (
                            <IconActionButton
                              icon={Pencil}
                              label="Modifier la section"
                              size={15}
                              onClick={() => setExpandedId(expandedId === section._id ? null : section._id)}
                            />
                          )}
                          {section.mode === "manual" && manualCapableKeys.includes(section.key) && (
                            <IconActionButton
                              icon={Pin}
                              label="Gérer le contenu"
                              size={15}
                              onClick={() =>
                                setContentManagerTarget({ slug: section.slug ?? section.key, title: section.title })
                              }
                            />
                          )}
                          {section.key === "custom" && (
                            <IconActionButton
                              icon={Trash2}
                              label="Supprimer la section"
                              size={15}
                              onClick={() => deleteSection(section._id)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === section._id && (
                      <tr className="border-b border-border/60 bg-base">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-4 text-xs">
                            <label className="flex items-center gap-1.5 text-ink-muted">
                              Titre
                              <input
                                value={section.title}
                                onChange={(e) => updateSectionLocal(section._id, { title: e.target.value })}
                                className="rounded-lg border border-border bg-surface px-2 py-1"
                              />
                            </label>
                            {section.key !== "custom" && (
                              <label className="flex items-center gap-1.5 text-ink-muted">
                                Mode
                                <select
                                  value={section.mode}
                                  onChange={(e) => updateSectionLocal(section._id, { mode: e.target.value as "auto" | "manual" })}
                                  className="rounded-lg border border-border bg-surface px-2 py-1"
                                >
                                  <option value="auto">Automatique</option>
                                  <option value="manual">Manuel (épinglé)</option>
                                </select>
                              </label>
                            )}
                            <label className="flex items-center gap-1.5 text-ink-muted">
                              Limite
                              <input
                                type="number"
                                min={1}
                                max={30}
                                value={section.limit}
                                onChange={(e) => updateSectionLocal(section._id, { limit: Number(e.target.value) })}
                                className="w-16 rounded-lg border border-border bg-surface px-2 py-1"
                              />
                            </label>
                            <label className="flex items-center gap-1.5 text-ink-muted">
                              <input
                                type="checkbox"
                                checked={section.filters.verifiedOnly}
                                onChange={(e) =>
                                  updateSectionLocal(section._id, { filters: { ...section.filters, verifiedOnly: e.target.checked } })
                                }
                              />
                              Artistes vérifiés uniquement
                            </label>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl2 border border-border bg-surface p-5">
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-medium">
              <Pin size={14} className="text-accent" /> Contenus épinglés
            </h2>
            <p className="mb-3 text-xs text-ink-muted">Gérer les contenus mis en avant</p>

            <div className="space-y-3">
              {pinned.slice(0, 5).map((p) => (
                <div key={p._id} className="flex items-center gap-3">
                  <SafeImage src={p.coverUrl} alt={p.title} width={44} height={44} className="shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-ink">{p.title}</p>
                      <span className="shrink-0 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                        Priorité {p.priority}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted">{contentLabel[p.contentType]}</p>
                    <p className="text-xs text-ink-muted">{formatDateRange(p.startDate, p.endDate)}</p>
                  </div>
                  <button onClick={() => removePinned(p._id)} className="shrink-0 text-ink-muted hover:text-accent" aria-label="Retirer">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {pinned.length === 0 && <p className="text-sm text-ink-muted">Aucun contenu épinglé pour l&apos;instant.</p>}
            </div>

            <p className="mt-4 text-xs text-ink-muted">
              Pour ajouter du contenu à une section, utilise l&apos;icône <Pin size={11} className="inline" /> sur sa
              ligne dans le tableau ci-contre.
            </p>
          </div>

          <div className="rounded-xl2 border border-border bg-surface p-5">
            <h2 className="mb-1 text-sm font-medium">Paramètres généraux</h2>
            <p className="mb-3 text-xs text-ink-muted">Paramètres globaux de la page d&apos;accueil</p>

            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-ink-muted">Mode Hero</dt>
                <dd>{settings.heroMode === "auto" ? "Automatique" : "Manuel"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-muted">Mode Recommandations</dt>
                <dd>{settings.recommendationMode === "auto" ? "Automatique" : "Désactivées"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-muted">Thème actuel</dt>
                <dd className="capitalize">{settings.theme === "dark" ? "Sombre" : settings.theme === "light" ? "Clair" : "Système"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-muted">Dernière mise à jour</dt>
                <dd>{new Date(settings.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}</dd>
              </div>
            </dl>

            <button
              onClick={() => setShowSettingsForm((v) => !v)}
              className="mt-4 w-full rounded-xl border border-border py-2 text-xs font-medium hover:border-accent"
            >
              {showSettingsForm ? "Masquer les paramètres" : "Configurer les paramètres"}
            </button>

            {showSettingsForm && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <label className="flex items-center justify-between text-sm">
                  Mode Hero
                  <select
                    value={settings.heroMode}
                    onChange={(e) => {
                      setSettings({ ...settings, heroMode: e.target.value as "auto" | "manual" });
                      setDirty(true);
                    }}
                    className="rounded-lg border border-border bg-base px-2 py-1.5 text-sm"
                  >
                    <option value="auto">Automatique</option>
                    <option value="manual">Manuel</option>
                  </select>
                </label>
                <label className="flex items-center justify-between text-sm">
                  Mode Recommandations
                  <select
                    value={settings.recommendationMode}
                    onChange={(e) => {
                      setSettings({ ...settings, recommendationMode: e.target.value as "auto" | "manual" });
                      setDirty(true);
                    }}
                    className="rounded-lg border border-border bg-base px-2 py-1.5 text-sm"
                  >
                    <option value="auto">Automatique</option>
                    <option value="manual">Désactivées</option>
                  </select>
                </label>
                <label className="flex items-center justify-between text-sm">
                  Thème
                  <select
                    value={settings.theme}
                    onChange={(e) => {
                      setSettings({ ...settings, theme: e.target.value as "dark" | "light" | "system" });
                      setDirty(true);
                    }}
                    className="rounded-lg border border-border bg-base px-2 py-1.5 text-sm"
                  >
                    <option value="system">Système</option>
                    <option value="light">Clair</option>
                    <option value="dark">Sombre</option>
                  </select>
                </label>
                <p className="text-xs text-ink-muted">Ces réglages seront enregistrés avec le bouton &quot;Enregistrer les modifications&quot; en haut de page.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showHubCardsManager && <HubCardsManager onClose={() => setShowHubCardsManager(false)} />}
      {contentManagerTarget && (
        <PinnedContentManager
          sectionSlug={contentManagerTarget.slug}
          sectionTitle={contentManagerTarget.title}
          helpText={
            contentManagerTarget.slug === "hero"
              ? "Fonctionne en mode Hero « Manuel » (réglable dans les paramètres généraux)."
              : undefined
          }
          onClose={() => setContentManagerTarget(null)}
        />
      )}
    </div>
  );
}
