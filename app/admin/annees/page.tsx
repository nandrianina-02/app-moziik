"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, CalendarClock, Disc3, Loader2, UserRound } from "lucide-react";
import { AdminCardsSkeleton } from "@/components/admin/AdminSkeleton";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";

type Titre = { _id: string; title: string; coverUrl?: string; genre?: string; releaseDate?: string; createdAt?: string };
type Groupe = { _id: string; album?: { title?: string }; artist?: { stageName?: string }; titres: Titre[]; ecoutes: number };

const ANNEE_MAX = new Date().getFullYear();

/**
 * Les années de sortie douteuses : des titres datés du jour de leur import,
 * ou classés Nostalgie avec une sortie récente. Les titres sont regroupés
 * par album, puisqu'une année se donne en général à un album entier ; on
 * peut décocher un titre qui n'a pas la même année que les autres.
 */
export default function AdminAnneesPage() {
  const pushToast = useToast();
  const [page, setPage] = useState(1);
  const [groupes, setGroupes] = useState<Groupe[] | null>(null);
  const [compte, setCompte] = useState(0);
  const [suite, setSuite] = useState(false);
  const [annees, setAnnees] = useState<Record<string, string>>({});
  const [exclus, setExclus] = useState<Set<string>>(new Set());
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/annees?page=${page}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGroupes(data.groupes);
      setCompte(data.compte);
      setSuite(data.suite);
      setExclus(new Set());
    } catch {
      pushToast("error", "Impossible de charger les années.");
      setGroupes([]);
    }
  }, [page, pushToast]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function envoyer(groupe: Groupe, corps: Record<string, unknown>, message: string) {
    const ids = groupe.titres.map((t) => t._id).filter((id) => !exclus.has(id));
    if (ids.length === 0) return;
    setEnCours(groupe._id);
    try {
      const res = await fetch("/api/admin/annees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, ...corps }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Échec.");
      const { modifies } = await res.json();
      pushToast("success", `${modifies} ${message}`);
      await charger();
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Échec.");
    } finally {
      setEnCours(null);
    }
  }

  const basculer = (id: string) =>
    setExclus((avant) => {
      const apres = new Set(avant);
      if (apres.has(id)) apres.delete(id);
      else apres.add(id);
      return apres;
    });

  return (
    <div className="space-y-5">
      <p className="text-xs text-ink-muted animate-fade-in-up">
        <span className="tabular-nums text-ink">{compte}</span> titre{compte > 1 ? "s" : ""} à l&apos;année douteuse. L&apos;année
        sert la suite automatique, la Nostalgie et les Nouveautés : saisissez-la pour l&apos;album entier, ou confirmez
        qu&apos;elle est juste.
      </p>

      {groupes === null ? (
        <AdminCardsSkeleton count={4} cols={1} />
      ) : groupes.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Toutes les années sont confirmées.</p>
      ) : (
        <ul className="space-y-4 stagger">
          {groupes.map((g) => {
            const saisie = annees[g._id] ?? "";
            const annee = Number(saisie);
            const valide = Number.isInteger(annee) && annee >= 1950 && annee <= ANNEE_MAX;
            const nombre = g.titres.filter((t) => !exclus.has(t._id)).length;
            return (
              <li key={g._id} className="rounded-lg border border-border animate-fade-in-up">
                <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
                  {g.album ? <Disc3 size={16} className="text-accent" /> : <UserRound size={16} className="text-accent" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{g.album?.title ?? `Titres de ${g.artist?.stageName ?? "l'artiste"}`}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {g.artist?.stageName ?? "Artiste supprimé"} · {g.titres.length} titre{g.titres.length > 1 ? "s" : ""} ·{" "}
                      {g.ecoutes} écoute{g.ecoutes > 1 ? "s" : ""}
                    </p>
                  </div>
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (valide) envoyer(g, { annee }, `titre${nombre > 1 ? "s" : ""} daté${nombre > 1 ? "s" : ""} de ${annee}.`);
                    }}
                  >
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1950}
                      max={ANNEE_MAX}
                      placeholder="Année"
                      value={saisie}
                      onChange={(e) => setAnnees((a) => ({ ...a, [g._id]: e.target.value }))}
                      aria-label="Année de sortie"
                      className="w-24 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs tabular-nums text-ink"
                    />
                    <button
                      type="submit"
                      disabled={!valide || nombre === 0 || enCours !== null}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                    >
                      <CalendarClock size={13} />
                      Appliquer à {nombre}
                    </button>
                    <button
                      type="button"
                      disabled={nombre === 0 || enCours !== null}
                      onClick={() => envoyer(g, { confirmer: true }, `année${nombre > 1 ? "s" : ""} confirmée${nombre > 1 ? "s" : ""}.`)}
                      title="L'année actuelle est juste"
                      aria-label="L'année actuelle est juste"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-50"
                    >
                      <CalendarCheck size={14} />
                    </button>
                    {enCours === g._id && <Loader2 size={14} className="animate-spin text-ink-muted" />}
                  </form>
                </div>
                <ul className="divide-y divide-border">
                  {g.titres.map((t) => (
                    <li key={t._id} className="flex items-center gap-3 px-4 py-2">
                      <input
                        type="checkbox"
                        checked={!exclus.has(t._id)}
                        onChange={() => basculer(t._id)}
                        aria-label={`Inclure ${t.title}`}
                        className="h-4 w-4 accent-[rgb(var(--color-accent))]"
                      />
                      <SafeImage src={t.coverUrl} alt="" width={32} height={32} className="h-8 w-8 rounded object-cover" />
                      <p className="min-w-0 flex-1 truncate text-sm text-ink">{t.title}</p>
                      <span className="text-xs text-ink-muted">{t.genre}</span>
                      <span className="w-12 text-right text-xs tabular-nums text-ink-muted" title="Année actuelle">
                        {t.releaseDate ? new Date(t.releaseDate).getFullYear() : "–"}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      {groupes && (page > 1 || suite) && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-40"
          >
            Précédents
          </button>
          <span className="text-xs text-ink-muted">Page {page}</span>
          <button
            type="button"
            disabled={!suite}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-40"
          >
            Suivants
          </button>
        </div>
      )}
    </div>
  );
}
