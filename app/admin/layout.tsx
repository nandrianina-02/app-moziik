"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Music,
  Disc3,
  ListMusic,
  MessageCircle,
  CalendarDays,
  Settings,
  Award,
  Home,
  UploadCloud,
  LifeBuoy,
  Inbox,
  Sparkles,
  Wand2,
  LineChart,
} from "lucide-react";
import { AdminHeaderSlot } from "@/components/admin/AdminChrome";

/**
 * Une entrée de navigation porte aussi l'en-tête de sa page : titre et
 * sous-titre vivent ici, pas dans chaque écran. C'est ce qui garantit que
 * toutes les pages d'administration se présentent de la même façon — avant,
 * certaines avaient leur propre titre, d'autres aucun.
 */
const links = [
  {
    href: "/admin",
    label: "Vue d'ensemble",
    icon: LayoutDashboard,
    titre: "Vue d'ensemble",
    description: "L'activité de la plateforme en un coup d'œil.",
  },
  {
    href: "/admin/accueil",
    label: "Page d'accueil",
    icon: Home,
    titre: "Page d'accueil",
    description: "Composez les sections vues par les visiteurs.",
  },
  {
    href: "/admin/membres",
    label: "Membres & artistes",
    icon: Users,
    titre: "Membres & artistes",
    description: "Comptes, rôles, vérifications et suspensions.",
  },
  {
    href: "/admin/musiques",
    label: "Musiques",
    icon: Music,
    titre: "Musiques",
    description: "Le catalogue publié, planifié et en brouillon.",
  },
  {
    href: "/admin/import",
    label: "Import de musiques",
    icon: UploadCloud,
    titre: "Import de musiques",
    description: "Publiez plusieurs morceaux en une seule fois.",
  },
  {
    href: "/admin/albums",
    label: "Albums",
    icon: Disc3,
    titre: "Albums",
    description: "Les disques du catalogue et leurs titres.",
  },
  {
    href: "/admin/playlists",
    label: "Playlists",
    icon: ListMusic,
    titre: "Playlists",
    description: "Les sélections publiques et éditoriales.",
  },
  {
    href: "/admin/analyses",
    label: "Analyses",
    icon: LineChart,
    titre: "Analyses",
    description: "Rapports hebdomadaires et points d'attention.",
  },
  {
    href: "/admin/selections",
    label: "Sélections auto",
    icon: Wand2,
    titre: "Sélections automatiques",
    description: "Les playlists proposées chaque semaine, à valider.",
  },
  {
    href: "/admin/commentaires",
    label: "Commentaires",
    icon: MessageCircle,
    titre: "Commentaires",
    description: "Ce que les auditeurs écrivent sous les morceaux.",
  },
  {
    href: "/admin/messages",
    label: "Messages",
    icon: Inbox,
    titre: "Messages",
    description: "Les discussions ouvertes depuis la page de contact.",
  },
  {
    href: "/admin/evenements",
    label: "Évènements",
    icon: CalendarDays,
    titre: "Évènements",
    description: "Concerts et sorties annoncés sur la plateforme.",
  },
  {
    href: "/admin/badges",
    label: "Badges",
    icon: Award,
    titre: "Badges",
    description: "Distinctions attribuées aux membres et aux artistes.",
  },
  {
    href: "/admin/aide",
    label: "Centre d'aide",
    icon: LifeBuoy,
    titre: "Centre d'aide",
    description: "Les articles publiés sur la page d'aide publique.",
  },
  {
    href: "/admin/ia",
    label: "Assistance IA",
    icon: Sparkles,
    titre: "Assistance IA",
    description: "Fonctionnalités assistées, plafond et consommation.",
  },
  {
    href: "/admin/parametres",
    label: "Paramètres du site",
    icon: Settings,
    titre: "Paramètres du site",
    description: "Gérez les réglages globaux de votre plateforme.",
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // La plus longue route qui correspond : /admin/accueil doit gagner sur
  // /admin, qui préfixe tout le reste.
  const page =
    [...links]
      .sort((a, b) => b.href.length - a.href.length)
      .find((l) => (l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href))) ?? links[0];

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10">
      <nav className="-mx-4 mb-7 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
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

      {/* En-tête commun : titre, sous-titre, et le réceptacle où chaque page
          vient déposer son action principale. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-display sm:text-3xl">{page.titre}</h1>
          <p className="mt-1 text-sm text-ink-muted">{page.description}</p>
        </div>
        <AdminHeaderSlot />
      </div>

      {children}
    </div>
  );
}
