"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight } from "lucide-react";

export type DoublonTitre = {
  _id: string;
  title: string;
  status: "draft" | "scheduled" | "published" | "rejected" | string;
  releaseDate?: string;
  coverUrl?: string;
};

const LIBELLE_STATUT: Record<string, string> = {
  draft: "en brouillon",
  scheduled: "en publication programmée",
  published: "déjà publié",
  rejected: "refusé",
};

/**
 * Date de sortie affichable, ou rien.
 *
 * Une partie du catalogue vient d'un import ancien où `releaseDate` est
 * absente : Mongo la rend alors à l'époque Unix et l'avertissement
 * annonçait « déjà publié — 1 janvier 1970 ». Mieux vaut ne rien dire que
 * dire une date fausse.
 */
function dateCourte(valeur: string | undefined): string | null {
  if (!valeur) return null;
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1990) return null;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Avertissement de doublon, volontairement non bloquant.
 *
 * Un même titre peut légitimement être republié — nouvelle version,
 * remaster, réenregistrement. Refuser la publication punirait ces cas
 * réels pour se prémunir d'une étourderie. L'avertissement dit ce qui
 * existe déjà et laisse la décision à l'artiste ; le lien permet d'aller
 * vérifier avant de trancher.
 */
export function DuplicateWarning({ doublon }: { doublon: DoublonTitre | null }) {
  const statut = LIBELLE_STATUT[doublon?.status ?? ""] ?? "déjà au catalogue";
  const date = dateCourte(doublon?.releaseDate);

  return (
    <AnimatePresence initial={false}>
      {doublon && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          {/*
            Deux contraintes de mise en forme, toutes deux mesurées :

            `flex-wrap` avec une largeur de base sur le bloc de texte —
            sur un écran de 320 px, le lien « Voir » réduisait sinon le
            texte à une colonne de deux mots et la carte atteignait 308 px
            de haut. Passé le seuil, le lien descend seul sur une deuxième
            ligne.

            Et la teinte d'ambre posée sur `bg-base`, non sur le
            `bg-surface` de la carte de formulaire : sur surface, le
            composite éclaircit assez le fond pour faire tomber le texte
            secondaire à 4,47:1, sous le seuil de 4,5. Sur base il remonte
            à 5,96 — c'est exactement le contexte de la bannière
            hors-ligne, qui emploie la même teinte.
          */}
          <div className="-mt-1 rounded-xl bg-base">
            <div
              role="status"
              className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border border-warning/40 bg-warning/10 p-3"
            >
              {doublon.coverUrl ? (
                <Image
                  src={doublon.coverUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-warning/20 text-warning">
                  <AlertTriangle size={16} />
                </span>
              )}

              <div className="min-w-[9rem] flex-1">
                <p className="text-sm font-medium text-ink">
                  « {doublon.title} » existe déjà dans ce catalogue
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Ce titre est {statut}
                  {date ? ` — ${date}` : ""}. Vous pouvez publier quand même s&apos;il s&apos;agit d&apos;une
                  nouvelle version.
                </p>
              </div>

              <Link
                href={`/son/${doublon._id}/modifier`}
                target="_blank"
                className="ml-auto flex shrink-0 items-center gap-1 self-center rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
              >
                Voir <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
