"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { oublierCompte } from "@/lib/offlineApi";
import { ChevronDown, User, CreditCard, Settings, LogOut, Shield, Mic2 } from "lucide-react";
import { SearchBar } from "@/components/search/SearchBar";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useEscapeClose } from "@/hooks/useEscapeClose";

/**
 * Barre supérieure de la maquette : recherche centrée, notifications,
 * puis le compte connecté. Réservée au bureau — sur mobile, MobileHeader
 * remplit déjà ce rôle dans un format adapté.
 *
 * Placée dans la colonne de contenu (à droite de la sidebar) et non en
 * `fixed` sur toute la largeur : elle ne doit jamais recouvrir le menu
 * latéral, et `sticky` suffit à la garder visible au défilement sans
 * sortir l'élément du flux.
 */
export function DesktopHeader() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [premium, setPremium] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEscapeClose(() => setMenuOpen(false), menuOpen);

  useEffect(() => {
    if (status !== "authenticated") {
      setPremium(false);
      return;
    }
    fetch("/api/me/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setPremium(!!data.hasPremium))
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  function submitSearch(terme: string) {
    const propre = terme.trim();
    if (propre) router.push(`/recherche?q=${encodeURIComponent(propre)}`);
  }

  const role = session?.user?.role;
  const sousTitre = premium ? "Premium" : role === "admin" ? "Administrateur" : role === "artist" ? "Artiste" : "Membre";

  return (
    <header className="sticky top-0 z-20 hidden shrink-0 items-center gap-4 border-b border-border bg-base/85 px-6 py-3 backdrop-blur md:flex md:px-10 print:hidden">
      {/* Même composant que la page de recherche : les suggestions
          instantanées doivent être disponibles depuis n'importe quel écran,
          pas seulement une fois arrivé sur /recherche. */}
      <div className="mx-auto w-full max-w-xl">
        <SearchBar
          valeur={query}
          onChange={setQuery}
          onValider={submitSearch}
          variante="barre"
          placeholder="Rechercher un titre, un artiste, un album..."
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <NotificationBell variant="desktop" />

        {status === "authenticated" ? (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2.5 rounded-full border border-border py-1 pl-1 pr-2.5 transition-colors hover:border-accent"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-surface text-ink-muted">
                {session.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User size={15} />
                )}
              </span>
              <span className="hidden min-w-0 text-left lg:block">
                <span className="block max-w-[140px] truncate text-sm font-medium leading-tight">
                  {session.user?.name ?? "Mon compte"}
                </span>
                <span className={`block text-[11px] leading-tight ${premium ? "text-accent" : "text-ink-muted"}`}>
                  {sousTitre}
                </span>
              </span>
              <ChevronDown size={15} className={`shrink-0 text-ink-muted transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+8px)] w-56 overflow-hidden rounded-xl2 border border-border bg-surface py-1.5 shadow-2xl"
              >
                <MenuLink href="/compte" icon={User} label="Mon compte" onClick={() => setMenuOpen(false)} />
                <MenuLink href="/abonnement" icon={CreditCard} label="Abonnement" onClick={() => setMenuOpen(false)} />
                {(role === "artist" || role === "admin") && (
                  <MenuLink href="/artiste/gestion" icon={Mic2} label="Espace artiste" onClick={() => setMenuOpen(false)} />
                )}
                {role === "admin" && (
                  <MenuLink href="/admin" icon={Shield} label="Administration" onClick={() => setMenuOpen(false)} />
                )}
                <MenuLink href="/compte" icon={Settings} label="Paramètres" onClick={() => setMenuOpen(false)} />
                <div className="my-1.5 h-px bg-border" />
                <button
                  onClick={async () => {
                    await oublierCompte();
                    signOut({ callbackUrl: "/" });
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-accent transition-colors hover:bg-base"
                >
                  <LogOut size={15} /> Se déconnecter
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/connexion"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
          >
            Se connecter
          </Link>
        )}
      </div>
    </header>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: typeof User;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-base"
    >
      <Icon size={15} className="text-ink-muted" />
      {label}
    </Link>
  );
}
