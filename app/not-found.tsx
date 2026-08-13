import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] grid place-items-center px-6">
      <div className="text-center max-w-sm">
        <SearchX size={28} className="text-ink-muted mx-auto mb-4" />
        <h2 className="font-display text-lg mb-2">Page introuvable</h2>
        <p className="text-sm text-ink-muted mb-6">
          Ce morceau n&apos;est pas dans notre catalogue. Vérifie le lien ou
          reviens à l&apos;accueil.
        </p>
        <Link
          href="/"
          className="inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-base hover:bg-accent-hover"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
