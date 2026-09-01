"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  ExternalLink,
  Facebook,
  Link2,
  Lock,
  Mail,
  MessageCircle,
  Ticket,
  Twitter,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";
import { useSiteConfig, useFuseauHoraire } from "@/context/SiteConfigProvider";
import { formatPrix, jusquAu } from "@/components/events/eventPresentation";
import type { EventDetail } from "@/components/events/detail/types";

function CarteAside({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl2 border border-border bg-surface">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">{titre}</h2>
      <div className="p-4">{children}</div>
    </div>
  );
}

/**
 * Billetterie.
 *
 * Les catégories sont présentées à titre indicatif : Moziik ne vend pas de
 * place, il renvoie vers la billetterie de l'organisateur. Afficher un
 * sélecteur de quantité et un panier laisserait croire le contraire.
 */
export function CarteBillets({ event }: { event: EventDetail }) {
  const { currency } = useSiteConfig();
  const fuseau = useFuseauHoraire();
  const devise = currency ?? "EUR";
  const categories = event.tickets ?? [];

  const rienAMontrer = categories.length === 0 && typeof event.price !== "number" && !event.ticketUrl;
  if (rienAMontrer) return null;

  return (
    <CarteAside titre="Billets">
      {categories.length > 0 ? (
        <ul className="space-y-2.5">
          {categories.map((billet) => (
            <li
              key={billet.name}
              className={`rounded-xl border border-border p-3.5 ${billet.soldOut ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{billet.name}</span>
                    {billet.soldOut && (
                      <span className="rounded-full bg-ink-muted/10 px-2 py-0.5 text-[11px] text-ink-muted">
                        Complet
                      </span>
                    )}
                  </div>
                  {billet.description && (
                    <p className="mt-1 text-xs text-ink-muted">{billet.description}</p>
                  )}
                  {billet.availableUntil && (
                    <p className="mt-1 text-xs text-ink-muted">{jusquAu(billet.availableUntil, fuseau)}</p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">{formatPrix(billet.price, devise)}</p>
                  {typeof billet.originalPrice === "number" && billet.originalPrice > billet.price && (
                    <p className="text-xs text-ink-muted line-through">
                      {formatPrix(billet.originalPrice, devise)}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        typeof event.price === "number" && (
          <p className="rounded-xl border border-border p-3.5 text-sm font-medium">
            {event.price === 0 ? "Entrée libre" : formatPrix(event.price, devise)}
          </p>
        )
      )}

      {event.ticketUrl ? (
        <>
          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
          >
            <Ticket size={16} /> Choisir mes billets
          </a>
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
            <Lock size={11} /> Billetterie de l&apos;organisateur
          </p>
        </>
      ) : (
        <p className="mt-4 text-xs text-ink-muted">
          Aucune billetterie en ligne pour cet évènement.
        </p>
      )}
    </CarteAside>
  );
}

/**
 * L'organisateur : l'artiste quand il en porte un, la plateforme sinon.
 *
 * Les coordonnées affichées sont celles déjà renseignées par ailleurs
 * (profil artiste, paramètres du site) — rien n'est demandé deux fois.
 */
export function CarteOrganisateur({ event }: { event: EventDetail }) {
  const config = useSiteConfig();
  const artiste = event.artist;

  const nom = artiste?.stageName ?? config.siteName;
  const image = artiste?.coverUrl ?? config.logoUrl;
  const presentation =
    artiste?.bio?.slice(0, 160) ?? config.tagline ?? "Organisateur d'évènements musicaux.";
  const liens = artiste?.socialLinks ?? config.socialLinks ?? [];

  return (
    <CarteAside titre="Organisateur">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-base">
          <SafeImage src={image} alt={nom} width={48} height={48} className="h-full w-full object-cover" />
        </div>

        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="truncate">{nom}</span>
            {artiste?.verified && <BadgeCheck size={13} className="shrink-0 text-verified" />}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{presentation}</p>
        </div>
      </div>

      {artiste && (
        <Link
          href={`/artiste/${artiste._id}`}
          className="mt-4 flex w-full items-center justify-center rounded-xl border border-border py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
        >
          Voir le profil
        </Link>
      )}

      {(liens.length > 0 || config.supportEmail) && (
        <ul className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
          {!artiste && config.supportEmail && (
            <li>
              <a
                href={`mailto:${config.supportEmail}`}
                className="flex items-center justify-between gap-2 text-ink-muted transition-colors hover:text-accent"
              >
                <span className="flex items-center gap-2">
                  <Mail size={13} /> Email
                </span>
                <span className="truncate text-accent">{config.supportEmail}</span>
              </a>
            </li>
          )}

          {liens.slice(0, 4).map((lien) => (
            <li key={lien.url}>
              <a
                href={lien.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 text-ink-muted transition-colors hover:text-accent"
              >
                <span className="capitalize">{lien.platform}</span>
                <ExternalLink size={12} className="shrink-0 text-accent" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </CarteAside>
  );
}

/** Partage : trois réseaux courants, et le lien brut pour tout le reste. */
export function CartePartage({ event }: { event: EventDetail }) {
  const pushToast = useToast();
  const [copie, setCopie] = useState(false);

  // Construit au clic, pas au rendu : `window` n'existe pas au premier
  // rendu côté serveur, et l'URL ne change jamais entre les deux.
  function urlPartage(): string {
    return `${window.location.origin}/evenements/${event._id}`;
  }

  function ouvrir(gabarit: (url: string, titre: string) => string) {
    window.open(gabarit(encodeURIComponent(urlPartage()), encodeURIComponent(event.title)), "_blank", "noopener");
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(urlPartage());
      setCopie(true);
      pushToast("success", "Lien copié dans le presse-papiers.");
      setTimeout(() => setCopie(false), 2000);
    } catch {
      pushToast("error", "Impossible de copier le lien.");
    }
  }

  const boutons = [
    {
      label: "Facebook",
      icone: Facebook,
      action: () => ouvrir((url) => `https://www.facebook.com/sharer/sharer.php?u=${url}`),
    },
    {
      label: "X",
      icone: Twitter,
      action: () => ouvrir((url, titre) => `https://twitter.com/intent/tweet?url=${url}&text=${titre}`),
    },
    {
      label: "WhatsApp",
      icone: MessageCircle,
      action: () => ouvrir((url, titre) => `https://wa.me/?text=${titre}%20${url}`),
    },
    { label: copie ? "Copié" : "Copier le lien", icone: Link2, action: copier },
  ];

  return (
    <CarteAside titre="Partager l'évènement">
      <div className="grid grid-cols-4 gap-2">
        {boutons.map(({ label, icone: Icone, action }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-border py-3 text-[11px] text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            <Icone size={16} />
            <span className="w-full truncate px-1 text-center">{label}</span>
          </button>
        ))}
      </div>
    </CarteAside>
  );
}
