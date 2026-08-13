import type { LucideIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import {
  Home,
  Search,
  Library,
  Radio,
  Trophy,
  CalendarDays,
  CreditCard,
  User,
  Mic2,
  Wallet,
  Shield,
} from "lucide-react";

export type NavLink = { href: string; label: string; icon: LucideIcon };

/** Navigation principale — identique pour tous les rôles. */
export const primaryLinks: NavLink[] = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/recherche", label: "Recherche", icon: Search },
  { href: "/bibliotheque", label: "Bibliothèque", icon: Library },
  { href: "/radio", label: "Radio", icon: Radio },
  { href: "/classements", label: "Classements", icon: Trophy },
  { href: "/evenements", label: "Évènements", icon: CalendarDays },
];

/** Compte / abonnement — regroupés séparément dans l'UI. */
export const accountLinks: NavLink[] = [
  { href: "/abonnement", label: "Premium", icon: CreditCard },
  { href: "/compte", label: "Compte", icon: User },
];

/**
 * Liens propres au rôle de la personne connectée (raccourcis espace
 * artiste / administration) — dérivés de session.user.role, jamais
 * inventés. Utilisé par le Sidebar desktop ET le drawer mobile pour
 * qu'ils restent toujours identiques.
 */
export function useRoleLinks(): NavLink[] {
  const { data: session } = useSession();

  const artistLinks: NavLink[] =
    session?.user?.role === "artist"
      ? [
          { href: "/artiste/gestion", label: "Mon espace artiste", icon: Mic2 },
          { href: "/artiste/revenus", label: "Mes revenus", icon: Wallet },
        ]
      : [];

  const adminLinks: NavLink[] =
    session?.user?.role === "admin" ? [{ href: "/admin", label: "Administration", icon: Shield }] : [];

  return [...artistLinks, ...adminLinks];
}

export function isLinkActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
