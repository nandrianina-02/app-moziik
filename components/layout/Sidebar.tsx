"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronsLeft, Mail, FileText } from "lucide-react";
import { useSiteConfig } from "@/context/SiteConfigProvider";
import { useSidebar } from "@/context/SidebarProvider";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Tooltip } from "@/components/layout/Tooltip";
import { primaryLinks, accountLinks, useRoleLinks, isLinkActive, type NavLink } from "@/components/layout/navLinks";

export function Sidebar() {
  const siteConfig = useSiteConfig();
  const pathname = usePathname();
  const roleLinks = useRoleLinks();
  // État partagé (voir context/SidebarProvider.tsx) : le mini-lecteur en
  // a besoin pour se caler exactement sur la largeur de la sidebar.
  const { collapsed, toggleCollapsed } = useSidebar();

  function renderLink(link: NavLink) {
    const isActive = isLinkActive(pathname, link.href);
    return (
      <Tooltip key={link.href} label={link.label} show={collapsed}>
        <Link
          href={link.href}
          className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
            collapsed ? "justify-center px-0" : ""
          } ${
            isActive
              ? "bg-accent/10 font-medium text-accent"
              : "text-ink-muted hover:bg-surface hover:text-ink"
          }`}
        >
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
          )}
          <link.icon size={18} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
          <span
            className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            }`}
          >
            {link.label}
          </span>
        </Link>
      </Tooltip>
    );
  }

  return (
    <aside
      // `overflow-y-auto` : avec beaucoup de liens (artiste + admin), la
      // navigation dépassait la hauteur d'écran et le pied de sidebar
      // devenait inatteignable. Le pb-6 suffit désormais : le lecteur ne
      // chevauche plus la sidebar (il est décalé de sa largeur), l'ancien
      // pb-28 ne réservait donc plus que du vide.
      className={`sticky top-0 print:hidden hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-border pb-6 pt-6 transition-all duration-300 ease-out md:flex ${
        collapsed ? "md:w-20 md:px-2" : "md:w-64 md:px-4"
      }`}
    >
      <div className={`mb-8 flex items-center px-2 ${collapsed ? "flex-col gap-3" : "justify-between"}`}>
        <div className={`flex min-w-0 items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
          {siteConfig.logoUrl ? (
            <Image src={siteConfig.logoUrl} alt="" width={24} height={24} className="h-6 w-6 shrink-0 object-contain" priority />
          ) : (
            <EqualizerLoader size="sm" />
          )}
          {!collapsed && (
            <span className="truncate font-display text-lg tracking-tight">{siteConfig.siteName}</span>
          )}
        </div>
        {!collapsed && (
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <NotificationBell variant="desktop" />
          </div>
        )}
        {collapsed && (
          <div className="flex flex-col items-center gap-1">
            <ThemeToggle />
            <NotificationBell variant="desktop" />
          </div>
        )}
      </div>

      <nav className="flex flex-col gap-1">{primaryLinks.map(renderLink)}</nav>

      <div className={`my-4 h-px bg-border ${collapsed ? "mx-1" : ""}`} />
      <nav className="flex flex-col gap-1">{accountLinks.map(renderLink)}</nav>

      {roleLinks.length > 0 && (
        <>
          <div className={`my-4 h-px bg-border ${collapsed ? "mx-1" : ""}`} />
          <nav className="flex flex-col gap-1">{roleLinks.map(renderLink)}</nav>
        </>
      )}

      {/* Bouton de repli / dépli — toujours accessible, même replié. */}
      <button
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
        className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-ink-muted transition-colors hover:bg-surface hover:text-ink ${
          collapsed ? "justify-center px-0" : ""
        }`}
      >
        <ChevronsLeft size={16} className={`shrink-0 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
        {!collapsed && "Replier"}
      </button>

      <div className={`mt-auto flex flex-col gap-1 pt-6 text-xs text-ink-muted ${collapsed ? "items-center px-0" : "px-3"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            <Tooltip label="Contact" show>
              <Link href="/contact" className="hover:text-ink">
                <Mail size={15} />
              </Link>
            </Tooltip>
            <Tooltip label="Mentions légales" show>
              <Link href="/mentions-legales" className="hover:text-ink">
                <FileText size={15} />
              </Link>
            </Tooltip>
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              <Link href="/contact" className="hover:text-ink">Contact</Link>
              <Link href="/mentions-legales" className="hover:text-ink">Mentions légales</Link>
            </div>
            <p>© {new Date().getFullYear()} {siteConfig.siteName}</p>
          </>
        )}
      </div>
    </aside>
  );
}
