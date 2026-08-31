"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Crown, RotateCcw, Save } from "lucide-react";
import { ThemeEditor } from "@/components/theme/ThemeEditor";
import { useTheme } from "@/context/ThemeProvider";
import { useToast } from "@/context/ToastProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ThemePreference } from "@/lib/theme";

/**
 * Personnalisation du thème, côté auditeur.
 *
 * L'aperçu n'est pas une vignette : chaque changement repeint le site
 * entier, immédiatement. Rien n'est enregistré tant qu'on n'a pas cliqué
 * « Enregistrer » — quitter la page rend son thème réel au compte.
 */
export default function AppearancePage() {
  const { status } = useSession();
  const pushToast = useToast();
  const {
    themePersonnel,
    themeSite,
    peutPersonnaliser,
    previsualiser,
    rafraichir,
    setMode,
  } = useTheme();

  const [brouillon, setBrouillon] = useState<ThemePreference | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  // Le brouillon part du thème en vigueur pour ce compte : son thème
  // personnel s'il en a un, sinon celui du site.
  useEffect(() => {
    setBrouillon((actuel) => actuel ?? { ...(themePersonnel ?? themeSite) });
  }, [themePersonnel, themeSite]);

  // L'aperçu ne survit pas à la page : sans ce nettoyage, un thème
  // abandonné en cours de route repeindrait le site jusqu'au rechargement.
  useEffect(() => {
    return () => previsualiser(null);
  }, [previsualiser]);

  function modifier(theme: ThemePreference) {
    setBrouillon(theme);
    if (peutPersonnaliser) previsualiser(theme);
  }

  async function enregistrer() {
    if (!brouillon) return;
    setEnregistrement(true);
    try {
      const res = await fetch("/api/me/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brouillon),
      });
      if (!res.ok) throw new Error();
      previsualiser(null);
      // Le mode enregistré devient celui de cet appareil : sans cela, le
      // site reviendrait au mode local dès la sortie de l'aperçu, et le
      // réglage qu'on vient de valider aurait l'air de ne pas avoir pris.
      setMode(brouillon.mode);
      rafraichir();
      pushToast("success", "Thème enregistré.");
    } catch {
      pushToast("error", "Échec de l'enregistrement du thème.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function reinitialiser() {
    setEnregistrement(true);
    try {
      const res = await fetch("/api/me/theme", { method: "DELETE" });
      if (!res.ok) throw new Error();
      previsualiser(null);
      setBrouillon({ ...themeSite });
      setMode(themeSite.mode);
      rafraichir();
      pushToast("success", "Thème du site rétabli.");
    } catch {
      pushToast("error", "Échec de la réinitialisation.");
    } finally {
      setEnregistrement(false);
    }
  }

  if (status === "loading" || !brouillon) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
        <Skeleton className="h-8 w-56 rounded-xl" />
        <Skeleton className="mt-6 h-64 w-full rounded-xl2" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
        <p className="text-sm text-ink-muted">
          Connecte-toi pour personnaliser l&apos;apparence de Moziik.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
      <Link
        href="/compte"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} /> Mon compte
      </Link>

      <h1 className="text-2xl font-display sm:text-3xl">Apparence</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {peutPersonnaliser
          ? "Choisis un thème ou compose le tien. L'aperçu s'applique tout de suite ; rien n'est gardé tant que tu n'as pas enregistré."
          : "Moziik suit le thème choisi par l'équipe. La personnalisation des couleurs est réservée aux comptes Premium."}
      </p>

      {!peutPersonnaliser && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl2 border border-accent/30 bg-accent/[0.06] p-5">
          <p className="flex items-center gap-2 text-sm text-ink">
            <Crown size={16} className="shrink-0 text-accent" />
            Passe en Premium pour composer tes propres couleurs.
          </p>
          <Link
            href="/abonnement"
            className="shrink-0 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover"
          >
            Découvrir Premium
          </Link>
        </div>
      )}

      <div className="mt-6 rounded-xl2 border border-border bg-surface p-5">
        {/* Un compte gratuit voit le thème du site, sans pouvoir y toucher —
            l'interrupteur sombre/clair de l'en-tête, lui, reste à tout le
            monde : c'est un réglage de confort, pas une personnalisation. */}
        <ThemeEditor value={brouillon} onChange={modifier} disabled={!peutPersonnaliser} />
      </div>

      {peutPersonnaliser && (
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button
            onClick={enregistrer}
            disabled={enregistrement}
            className="flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Save size={16} /> Enregistrer
          </button>
          <button
            onClick={() => {
              const reel = themePersonnel ?? themeSite;
              setBrouillon({ ...reel });
              previsualiser(null);
            }}
            disabled={enregistrement}
            className="rounded-2xl border border-border px-4 py-3 text-sm font-medium text-ink transition-colors hover:border-ink-muted disabled:opacity-60"
          >
            Annuler les changements
          </button>
          {themePersonnel && (
            <button
              onClick={reinitialiser}
              disabled={enregistrement}
              className="ml-auto flex items-center gap-1.5 rounded-2xl border border-border px-4 py-3 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
            >
              <RotateCcw size={15} /> Revenir au thème du site
            </button>
          )}
        </div>
      )}
    </div>
  );
}
