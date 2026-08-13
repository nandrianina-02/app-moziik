"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, FileText, LogOut, User } from "lucide-react";
import { useSiteConfig } from "@/context/SiteConfigProvider";
import { primaryLinks, accountLinks, useRoleLinks, isLinkActive, type NavLink } from "@/components/layout/navLinks";

export function MobileDrawer({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const siteConfig = useSiteConfig();
  const pathname = usePathname();
  const roleLinks = useRoleLinks();

  function renderLink(link: NavLink) {
    const isActive = isLinkActive(pathname, link.href);
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onClose}
        className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
          isActive ? "bg-accent/10 font-medium text-accent" : "text-ink-muted hover:bg-base hover:text-ink"
        }`}
      >
        {isActive && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />}
        <link.icon size={18} />
        {link.label}
      </Link>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 md:hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-border bg-surface"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <span className="font-display text-lg">{siteConfig.siteName}</span>
            <button onClick={onClose} aria-label="Fermer le menu" className="text-ink-muted hover:text-ink">
              <X size={20} />
            </button>
          </div>

          {session?.user && (
            <Link
              href="/compte"
              onClick={onClose}
              className="flex items-center gap-3 border-b border-border px-5 py-4 transition-colors hover:bg-base"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-border">
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User size={16} className="text-ink-muted" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{session.user.name}</span>
                <span className="block truncate text-xs text-ink-muted">{session.user.email}</span>
              </span>
            </Link>
          )}

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="flex flex-col gap-1">{primaryLinks.map(renderLink)}</div>

            <div className="my-3 h-px bg-border" />
            <div className="flex flex-col gap-1">{accountLinks.map(renderLink)}</div>

            {roleLinks.length > 0 && (
              <>
                <div className="my-3 h-px bg-border" />
                <div className="flex flex-col gap-1">{roleLinks.map(renderLink)}</div>
              </>
            )}

            <div className="my-3 h-px bg-border" />

            <div className="flex flex-col gap-1">
              <Link
                href="/contact"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-muted hover:bg-base hover:text-ink"
              >
                <Mail size={18} />
                Contact
              </Link>
              <Link
                href="/mentions-legales"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-muted hover:bg-base hover:text-ink"
              >
                <FileText size={18} />
                Mentions légales
              </Link>
            </div>
          </nav>

          {session?.user && (
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center gap-3 border-t border-border px-6 py-4 text-sm text-accent transition-colors hover:bg-accent/5"
            >
              <LogOut size={18} />
              Se déconnecter
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
