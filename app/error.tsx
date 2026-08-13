"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ici, on pourra brancher un service de suivi d'erreurs (Sentry, etc.)
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] grid place-items-center px-6">
      <div className="text-center max-w-sm">
        <AlertTriangle size={28} className="text-accent mx-auto mb-4" />
        <h2 className="font-display text-lg mb-2">Cette page a rencontré une erreur</h2>
        <p className="text-sm text-ink-muted mb-6">
          Rien n&apos;est perdu — tu peux réessayer ou revenir à l&apos;accueil.
        </p>
        <button
          onClick={reset}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-base hover:bg-accent-hover"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
