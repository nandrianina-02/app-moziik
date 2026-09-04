"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, CheckCircle2, MessageSquare, PenLine } from "lucide-react";
import { AdminPanelSkeleton } from "@/components/admin/AdminSkeleton";

/**
 * Sur quoi l'assistant passe la main.
 *
 * L'écran répond à une seule question : quel article écrire ensuite. Il
 * ne montre donc pas les fils escaladés pour eux-mêmes — l'équipe les
 * traite déjà dans « Messages » — mais les mots qui reviennent dans les
 * questions auxquelles l'assistant n'a pas su répondre, et lesquels
 * n'apparaissent dans aucun article.
 *
 * Un mot non couvert et fréquent est un article manquant. Un mot couvert
 * et pourtant escaladé signale autre chose : un article mal titré, trop
 * court, ou une question qui devait de toute façon revenir à un humain.
 * L'écran distingue les deux, il ne tranche pas.
 */

type Escalade = {
  _id: string;
  membre: string;
  email: string;
  statut: string;
  dernierMessageLe: string | null;
  questions: string[];
};

type Mot = { mot: string; occurrences: number; couvert: boolean };

type Donnees = {
  escalades: Escalade[];
  mots: Mot[];
  resume: { fils: number; escalades: number; articles: number; taux: number };
};

export default function EscaladesPage() {
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/support/escalades")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDonnees)
      .catch(() => setErreur("Impossible de charger les escalades."));
  }, []);

  if (erreur) return <p className="text-sm text-danger">{erreur}</p>;
  if (!donnees) return <AdminPanelSkeleton height="h-96" />;

  const aEcrire = donnees.mots.filter((m) => !m.couvert);
  const couverts = donnees.mots.filter((m) => m.couvert);

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Chiffre valeur={donnees.resume.fils} libelle="Fils de support" />
        <Chiffre valeur={donnees.resume.escalades} libelle="Passés à l'équipe" />
        <Chiffre valeur={`${donnees.resume.taux} %`} libelle="Taux d'escalade" accent />
        <Chiffre valeur={donnees.resume.articles} libelle="Articles publiés" />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Mots sans article</h2>
        <p className="mb-3 text-xs text-ink-muted">
          Ces mots reviennent dans les questions escaladées et n&apos;apparaissent dans aucun
          article publié — synonymes compris. Chacun est un article à écrire.
        </p>

        {aEcrire.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-border px-3 py-3 text-sm text-ink-muted">
            <CheckCircle2 size={15} className="text-verified" />
            Tous les mots des escalades sont déjà traités quelque part. Les escalades restantes
            demandent une décision, pas une information.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {aEcrire.map((m) => (
              <li
                key={m.mot}
                className="flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs"
              >
                <AlertCircle size={12} className="text-warning" />
                <span className="font-medium">{m.mot}</span>
                <span className="tabular-nums text-ink-muted">×{m.occurrences}</span>
              </li>
            ))}
          </ul>
        )}

        {aEcrire.length > 0 && (
          <Link
            href="/admin/aide"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-base transition-colors hover:bg-accent-hover"
          >
            <PenLine size={14} /> Écrire un article
          </Link>
        )}
      </section>

      {couverts.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">Mots déjà traités, escaladés quand même</h2>
          <p className="mb-3 text-xs text-ink-muted">
            Un article en parle, et l&apos;assistant a tout de même passé la main. Souvent le
            signe d&apos;un article trop court, mal titré — ou d&apos;une question qui appelait
            de toute façon une décision.
          </p>
          <ul className="flex flex-wrap gap-2">
            {couverts.map((m) => (
              <li
                key={m.mot}
                className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-ink-muted"
              >
                {m.mot}
                <span className="tabular-nums">×{m.occurrences}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Les questions, telles qu&apos;elles ont été posées
        </h2>

        {donnees.escalades.length === 0 ? (
          <p className="rounded-xl border border-border px-3 py-8 text-center text-sm text-ink-muted">
            Aucune escalade pour le moment.
          </p>
        ) : (
          <ul className="space-y-3">
            {donnees.escalades.map((e) => (
              <li key={e._id} className="rounded-xl border border-border p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {e.membre}
                    {e.email && <span className="ml-2 text-xs text-ink-muted">{e.email}</span>}
                  </p>
                  <span className="flex items-center gap-3 text-xs text-ink-muted">
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        e.statut === "open" ? "bg-warning/15 text-warning" : "bg-border/50"
                      }`}
                    >
                      {e.statut === "open" ? "Ouvert" : "Clos"}
                    </span>
                    {e.dernierMessageLe &&
                      new Date(e.dernierMessageLe).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                  </span>
                </div>

                <ul className="space-y-1.5">
                  {e.questions.map((q, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink-muted">
                      <MessageSquare size={13} className="mt-1 shrink-0 opacity-60" />
                      <span className="selectionnable">{q}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/admin/messages"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:underline"
                >
                  Ouvrir la discussion <ArrowUpRight size={12} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Chiffre({
  valeur,
  libelle,
  accent,
}: {
  valeur: string | number;
  libelle: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className={`text-xl font-semibold tabular-nums ${accent ? "text-accent" : ""}`}>{valeur}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{libelle}</p>
    </div>
  );
}
