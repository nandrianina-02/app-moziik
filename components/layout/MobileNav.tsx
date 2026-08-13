"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Library, CalendarDays, User } from "lucide-react";

const links = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/recherche", label: "Recherche", icon: Search },
  { href: "/bibliotheque", label: "Ma zone", icon: Library },
  { href: "/evenements", label: "Évènements", icon: CalendarDays },
  { href: "/compte", label: "Compte", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface/95 backdrop-blur print:hidden">
      <ul className="flex justify-between px-2 py-2">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 px-3 py-1 text-[11px] transition-colors ${
                  isActive ? "text-accent" : "text-ink-muted hover:text-accent"
                }`}
              >
                <Icon size={20} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
