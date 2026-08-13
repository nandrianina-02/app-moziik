import Link from "next/link";
import { PartyPopper } from "lucide-react";

export default function SubscriptionSuccessPage() {
  return (
    <div className="min-h-[70vh] grid place-items-center px-6">
      <div className="text-center max-w-sm">
        <PartyPopper size={32} className="text-accent mx-auto mb-4" />
        <h1 className="font-display text-xl mb-2">Merci pour ton abonnement !</h1>
        <p className="text-sm text-ink-muted mb-6">
          Ton compte premium est activé. Le webhook Stripe confirme le
          paiement en tâche de fond ; ça peut prendre quelques secondes.
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
