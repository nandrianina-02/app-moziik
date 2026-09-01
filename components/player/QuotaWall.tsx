"use client";

import Link from "next/link";
import { Headphones, X } from "lucide-react";
import { usePlayer } from "@/context/PlayerProvider";
import { useSiteConfig } from "@/context/SiteConfigProvider";
import { MESSAGE_QUOTA_ANONYME } from "@/lib/acces";

/**
 * Ce qu'on montre quand un visiteur a épuisé son écoute du jour.
 *
 * Une invitation, pas un reproche : le catalogue reste consultable, seule
 * la lecture s'arrête. Le message dit ce qui débloque la suite — un
 * compte, gratuit — plutôt que ce qui vient d'être refusé.
 */
export function QuotaWall() {
  const { quotaEpuise, ignorerQuota } = usePlayer();
  const { siteName } = useSiteConfig();

  if (!quotaEpuise) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Limite d'écoute atteinte"
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-xl2 border border-border bg-surface p-6 text-center shadow-2xl">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
          <Headphones size={22} />
        </span>

        <h2 className="text-lg font-semibold">La suite demande un compte</h2>
        <p className="mt-2 text-sm text-ink-muted">{MESSAGE_QUOTA_ANONYME}</p>

        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/inscription"
            className="rounded-xl bg-accent py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
          >
            Créer un compte gratuit
          </Link>
          <Link
            href="/connexion"
            className="rounded-xl border border-border py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
          >
            J&apos;ai déjà un compte
          </Link>
        </div>

        <p className="mt-4 text-xs text-ink-muted">
          Un compte {siteName} donne aussi les favoris, les playlists et l&apos;historique.
        </p>
      </div>

      <button
        type="button"
        onClick={ignorerQuota}
        aria-label="Fermer"
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X size={18} />
      </button>
    </div>
  );
}
