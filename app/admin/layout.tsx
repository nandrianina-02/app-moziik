"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Music, Disc3, ListMusic, MessageCircle, CalendarDays, Settings, Award, Home, UploadCloud, LifeBuoy, Inbox, Sparkles, Wand2, LineChart } from "lucide-react";

const links = [
  { href: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/admin/accueil", label: "Page d'accueil", icon: Home },
  { href: "/admin/membres", label: "Membres & artistes", icon: Users },
  { href: "/admin/musiques", label: "Musiques", icon: Music },
  { href: "/admin/import", label: "Import de musiques", icon: UploadCloud },
  { href: "/admin/albums", label: "Albums", icon: Disc3 },
  { href: "/admin/playlists", label: "Playlists", icon: ListMusic },
  { href: "/admin/analyses", label: "Analyses", icon: LineChart },
  { href: "/admin/selections", label: "Sélections auto", icon: Wand2 },
  { href: "/admin/commentaires", label: "Commentaires", icon: MessageCircle },
  { href: "/admin/messages", label: "Messages", icon: Inbox },
  { href: "/admin/evenements", label: "Évènements", icon: CalendarDays },
  { href: "/admin/badges", label: "Badges", icon: Award },
  { href: "/admin/aide", label: "Centre d'aide", icon: LifeBuoy },
  { href: "/admin/ia", label: "Assistance IA", icon: Sparkles },
  { href: "/admin/parametres", label: "Paramètres du site", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-display">Administration</h1>
        <p className="mt-1 text-sm text-ink-muted">Gérez, analysez et développez votre univers musical.</p>
      </div>

      <nav className="flex gap-2 mb-8 overflow-x-auto pb-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-accent bg-accent text-base"
                  : "border-border text-ink-muted hover:border-accent hover:text-ink"
              }`}
            >
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
