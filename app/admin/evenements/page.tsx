"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarRange,
  Check,
  Download,
  Eye,
  Pencil,
  Plus,
  Radio,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { StatCard } from "@/components/admin/StatCard";
import { DonutChart } from "@/components/admin/DonutChart";
import { Pagination } from "@/components/admin/Pagination";
import { IconActionButton, IconActionLink } from "@/components/admin/IconActionButton";
import { AdminPanelSkeleton } from "@/components/admin/AdminSkeleton";
import { useToast } from "@/context/ToastProvider";
import { useFuseauHoraire } from "@/context/SiteConfigProvider";
import { formatCompactNumber } from "@/lib/formatNumber";
import { readApiError } from "@/lib/readApiError";
import { EVENT_CATEGORIES, libelleCategorie } from "@/lib/evenements";
import { heure, jourLong } from "@/components/events/eventPresentation";
import type { EventItem } from "@/components/events/types";

type AdminEvent = EventItem & {
  status: "pending" | "published" | "rejected";
  visibility?: "public" | "unlisted";
  organizer?: { name?: string };
};

type Stats = {
  total: number;
  upcoming: number;
  live: number;
  past: number;
  participants: number;
  nouveauxCeMois: number;
  pending: number;
  published: number;
  rejected: number;
  categories: { categorie: string | null; n: number }[];
};

const PERIODES = [
  { value: "", label: "Tous" },
  { value: "upcoming", label: "À venir" },
  { value: "live", label: "En cours" },
  { value: "past", label: "Passés" },
];

const STATUTS = [
  { value: "", label: "Tous les statuts" },
  { value: "pending", label: "En attente" },
  { value: "published", label: "Publiés" },
  { value: "rejected", label: "Rejetés" },
];

const ETIQUETTE_STATUT: Record<AdminEvent["status"], { label: string; classe: string }> = {
  pending: { label: "En attente", classe: "bg-warning/10 text-warning" },
  published: { label: "Publié", classe: "bg-verified/10 text-verified" },
  rejected: { label: "Rejeté", classe: "bg-danger/10 text-danger" },
};

const CHAMP =
  "rounded-xl border border-border bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent";

export default function AdminEventsPage() {
  const pushToast = useToast();
  const fuseau = useFuseauHoraire();

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [chargement, setChargement] = useState(true);

  const [recherche, setRecherche] = useState("");
  const [rechercheAppliquee, setRechercheAppliquee] = useState("");
  const [periode, setPeriode] = useState("");
  const [statut, setStatut] = useState("");
  const [categorie, setCategorie] = useState("");
  const [lieu, setLieu] = useState("");
  const [lieuApplique, setLieuApplique] = useState("");
  const [page, setPage] = useState(1);
  const [taille, setTaille] = useState(10);
  const [exportEnCours, setExportEnCours] = useState(false);

  // La saisie ne déclenche pas une requête par frappe : elle est appliquée
  // 350 ms après la dernière touche.
  useEffect(() => {
    const minuteur = setTimeout(() => setRechercheAppliquee(recherche.trim()), 350);
    return () => clearTimeout(minuteur);
  }, [recherche]);

  useEffect(() => {
    const minuteur = setTimeout(() => setLieuApplique(lieu.trim()), 350);
    return () => clearTimeout(minuteur);
  }, [lieu]);

  const parametres = useCallback(
    (pageDemandee: number, tailleDemandee: number) => {
      const params = new URLSearchParams();
      if (rechercheAppliquee) params.set("q", rechercheAppliquee);
      if (periode) params.set("periode", periode);
      if (statut) params.set("status", statut);
      if (categorie) params.set("category", categorie);
      if (lieuApplique) params.set("lieu", lieuApplique);
      params.set("page", String(pageDemandee));
      params.set("limit", String(tailleDemandee));
      return params.toString();
    },
    [rechercheAppliquee, periode, statut, categorie, lieuApplique]
  );

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const res = await fetch(`/api/admin/events?${parametres(page, taille)}`);
      if (!res.ok) throw new Error(await readApiError(res, "Chargement impossible."));
      const data = await res.json();
      setEvents(data.events);
      setStats(data.stats);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Impossible de charger les évènements.");
    } finally {
      setChargement(false);
    }
  }, [parametres, page, taille, pushToast]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Changer de filtre remet à la première page : rester en page sept d'un
  // résultat qui n'en compte plus que deux afficherait une table vide.
  useEffect(() => {
    setPage(1);
  }, [rechercheAppliquee, periode, statut, categorie, lieuApplique, taille]);

  /**
   * Export : la liste est redemandée sans pagination plutôt que d'exporter
   * la page affichée — un fichier de dix lignes sur cent trente ne servirait
   * à rien. Les filtres en cours, eux, sont conservés.
   */
  async function exporter() {
    setExportEnCours(true);
    try {
      const res = await fetch(`/api/admin/events?${parametres(1, 100)}`);
      if (!res.ok) throw new Error(await readApiError(res, "L'export a échoué."));
      const data = await res.json();

      const lignes = [
        ["Titre", "Catégorie", "Date", "Heure", "Salle", "Ville", "Organisateur", "Intéressés", "Statut"],
        ...(data.events as AdminEvent[]).map((e) => [
          e.title,
          e.category ? libelleCategorie(e.category) : "",
          jourLong(e.date, fuseau),
          heure(e.date, fuseau),
          e.location,
          e.city ?? "",
          e.organizer?.name || e.artist?.stageName || "",
          String(e.interestedCount ?? 0),
          ETIQUETTE_STATUT[e.status].label,
        ]),
      ];
      // Les guillemets internes sont doublés : un titre contenant une
      // virgule décalerait sinon toutes les colonnes suivantes.
      const csv = lignes.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = `moziik-evenements-${new Date().toISOString().slice(0, 10)}.csv`;
      lien.click();
      URL.revokeObjectURL(url);

      if (data.total > data.events.length) {
        pushToast(
          "success",
          `${data.events.length} lignes exportées sur ${data.total} — affinez les filtres pour le reste.`
        );
      }
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "L'export a échoué.");
    } finally {
      setExportEnCours(false);
    }
  }

  async function moderer(id: string, decision: "approve" | "reject") {
    try {
      const res = await fetch(`/api/admin/events/${id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "L'action a échoué."));
      pushToast("success", decision === "approve" ? "Évènement publié." : "Évènement rejeté.");
      charger();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "L'action a échoué.");
    }
  }

  async function supprimer(id: string) {
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readApiError(res, "La suppression a échoué."));
      pushToast("success", "Évènement supprimé.");
      charger();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "La suppression a échoué.");
    }
  }

  const segments = useMemo(
    () =>
      (stats?.categories ?? [])
        .filter((c) => c.n > 0)
        .map((c) => ({ label: libelleCategorie(c.categorie), count: c.n })),
    [stats]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href="/evenements/nouveau"
          className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
        >
          <Plus size={16} /> Créer un évènement
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          icon={CalendarRange}
          label="Total évènements"
          value={stats ? formatCompactNumber(stats.total) : "—"}
          bg="bg-accent/10"
          hint={stats ? `${stats.nouveauxCeMois} créés ce mois` : undefined}
        />
        <StatCard
          icon={CalendarClock}
          label="À venir"
          value={stats?.upcoming ?? "—"}
          color="text-tint-sky"
          bg="bg-tint-sky/10"
          hint="Programmés"
        />
        <StatCard
          icon={Radio}
          label="En cours"
          value={stats?.live ?? "—"}
          color="text-verified"
          bg="bg-verified/10"
          hint="En direct maintenant"
        />
        <StatCard
          icon={CalendarCheck2}
          label="Passés"
          value={stats?.past ?? "—"}
          color="text-ink-muted"
          bg="bg-ink-muted/10"
          hint="Terminés"
        />
        <StatCard
          icon={Users}
          label="Participants"
          value={stats ? formatCompactNumber(stats.participants) : "—"}
          color="text-tint-rose"
          bg="bg-tint-rose/10"
          hint="Membres intéressés"
        />
      </div>

      <div className="rounded-xl2 border border-border bg-surface">
        <div className="flex flex-wrap gap-1 border-b border-border px-4">
          {PERIODES.map((onglet) => (
            <button
              key={onglet.value}
              type="button"
              onClick={() => setPeriode(onglet.value)}
              aria-current={periode === onglet.value}
              className={`border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                periode === onglet.value
                  ? "border-accent text-accent"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {onglet.label}
              {stats && (
                <span className="ml-1.5 text-xs text-ink-muted">
                  {onglet.value === "" ? stats.total : onglet.value === "upcoming" ? stats.upcoming : onglet.value === "live" ? stats.live : stats.past}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-b border-border p-4">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un évènement, un lieu..."
              aria-label="Rechercher un évènement"
              className={`${CHAMP} w-full pl-9`}
            />
          </div>

          <select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            aria-label="Filtrer par catégorie"
            className={CHAMP}
          >
            <option value="">Toutes catégories</option>
            {EVENT_CATEGORIES.map((valeur) => (
              <option key={valeur} value={valeur}>
                {libelleCategorie(valeur)}
              </option>
            ))}
          </select>

          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value)}
            aria-label="Filtrer par statut"
            className={CHAMP}
          >
            {STATUTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
            placeholder="Lieu ou ville"
            aria-label="Filtrer par lieu"
            className={`${CHAMP} w-32`}
          />

          {stats && stats.pending > 0 && (
            <button
              type="button"
              onClick={() => setStatut("pending")}
              className="rounded-full bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning transition-colors hover:bg-warning/20"
            >
              {stats.pending} en attente de validation
            </button>
          )}

          <button
            type="button"
            onClick={exporter}
            disabled={exportEnCours || events.length === 0}
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            <Download size={14} /> {exportEnCours ? "Export..." : "Exporter"}
          </button>
        </div>

        {chargement && (
          <div className="p-4">
            <AdminPanelSkeleton height="h-96" />
          </div>
        )}

        {!chargement && events.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-ink-muted">
            Aucun évènement ne correspond à ces filtres.
          </p>
        )}

        {!chargement && events.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted">
                  <th className="px-4 py-3 font-medium">Évènement</th>
                  <th className="px-4 py-3 font-medium">Catégorie</th>
                  <th className="px-4 py-3 font-medium">Date et heure</th>
                  <th className="px-4 py-3 font-medium">Lieu</th>
                  <th className="px-4 py-3 font-medium">Organisateur</th>
                  <th className="px-4 py-3 text-right font-medium">Intéressés</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {events.map((event) => {
                  const etiquette = ETIQUETTE_STATUT[event.status];
                  return (
                    <tr key={event._id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <SafeImage
                            src={event.coverUrl}
                            alt=""
                            width={44}
                            height={44}
                            className="h-11 w-11 shrink-0 rounded-lg object-cover"
                          />
                          <div className="min-w-0">
                            <Link
                              href={`/evenements/${event._id}`}
                              className="block max-w-[220px] truncate font-medium transition-colors hover:text-accent"
                            >
                              {event.title}
                            </Link>
                            <p className="max-w-[220px] truncate text-xs text-ink-muted">
                              {event.description}
                            </p>
                            {event.visibility === "unlisted" && (
                              <p className="text-[11px] text-ink-muted">Non répertorié</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {event.category ? (
                          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
                            {libelleCategorie(event.category)}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-muted">—</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-xs">
                        {jourLong(event.date, fuseau)}
                        <span className="block text-ink-muted">{heure(event.date, fuseau)}</span>
                      </td>

                      <td className="px-4 py-3 text-xs">
                        <span className="block max-w-[160px] truncate">
                          {[event.city, event.country].filter(Boolean).join(", ") || "—"}
                        </span>
                        <span className="block max-w-[160px] truncate text-ink-muted">{event.location}</span>
                      </td>

                      <td className="px-4 py-3 text-xs">
                        <span className="block max-w-[140px] truncate">
                          {event.organizer?.name || event.artist?.stageName || "—"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right text-xs tabular-nums">
                        {formatCompactNumber(event.interestedCount ?? 0)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${etiquette.classe}`}
                        >
                          {etiquette.label}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {event.status === "pending" && (
                            <>
                              <IconActionButton
                                icon={Check}
                                label="Approuver"
                                tone="success"
                                onClick={() => moderer(event._id, "approve")}
                              />
                              <IconActionButton
                                icon={X}
                                label="Rejeter"
                                tone="danger"
                                onClick={() => moderer(event._id, "reject")}
                              />
                            </>
                          )}
                          <IconActionLink icon={Eye} label="Voir la fiche" href={`/evenements/${event._id}`} />
                          <IconActionLink
                            icon={Pencil}
                            label="Modifier"
                            href={`/evenements/${event._id}/modifier`}
                          />
                          <IconActionButton
                            icon={Trash2}
                            label="Supprimer"
                            onClick={() => supprimer(event._id)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
          <p className="text-xs text-ink-muted">
            {total === 0
              ? "Aucun évènement"
              : `Affichage de ${(page - 1) * taille + 1} à ${Math.min(page * taille, total)} sur ${total} évènements`}
          </p>

          <div className="flex items-center gap-3">
            <Pagination page={page} pages={pages} onChange={setPage} />
            <select
              value={taille}
              onChange={(e) => setTaille(Number(e.target.value))}
              aria-label="Résultats par page"
              className={CHAMP}
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {segments.length > 0 && (
        <section className="rounded-xl2 border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold">Répartition par catégorie</h2>
          <DonutChart segments={segments} />
        </section>
      )}
    </div>
  );
}
