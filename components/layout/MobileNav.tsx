"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Library, MessagesSquare, User } from "lucide-react";
import { useMessagesNonLus } from "@/context/MessagesProvider";

// Cinq entrées, pas six : au-delà, les libellés se chevauchent sur un
// écran de 360 px. Les évènements restent atteignables depuis l'accueil
// et le tiroir latéral ; les messages, eux, doivent porter une pastille,
// ce qu'un lien enfoui ne permet pas.
const links = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/recherche", label: "Recherche", icon: Search },
  { href: "/bibliotheque", label: "Ma zone", icon: Library },
  { href: "/messages", label: "Messages", icon: MessagesSquare },
  { href: "/compte", label: "Compte", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  const { nonLus } = useMessagesNonLus();

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
                <span className="relative">
                  <Icon size={20} />
                  {href === "/messages" && nonLus > 0 && (
                    <span className="absolute -right-2 -top-1 min-w-[16px] rounded-full bg-accent px-1 text-[9px] font-bold leading-4 text-base">
                      {nonLus > 99 ? "99+" : nonLus}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
