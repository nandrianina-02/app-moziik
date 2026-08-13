"use client";

import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen grid place-items-center bg-base text-ink px-6">
        <div className="text-center max-w-sm">
          <AlertTriangle size={32} className="text-accent mx-auto mb-4" />
          <h1 className="font-display text-xl mb-2">Un problème est survenu</h1>
          <p className="text-sm text-ink-muted mb-6">
            L&apos;application a rencontré une erreur inattendue. Réessaie,
            ou reviens un peu plus tard si le problème persiste.
          </p>
          <button
            onClick={reset}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-base hover:bg-accent-hover"
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
