"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Menu, User } from "lucide-react";
import { useSiteConfig } from "@/context/SiteConfigProvider";
import { useTheme } from "@/context/ThemeProvider";
import { MobileDrawer } from "@/components/layout/MobileDrawer";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";

export function MobileHeader() {
  const { data: session } = useSession();
  const siteConfig = useSiteConfig();
  // Le logo sombre ne remplace le principal que sur fond sombre, et
  // seulement si l'administration en a fourni un.
  const { theme } = useTheme();
  const logo = (theme === "dark" && siteConfig.logoDarkUrl) || siteConfig.logoUrl;

  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between border-b border-border bg-surface/95 backdrop-blur px-4 h-14 print:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-base hover:text-ink -ml-1.5"
        >
          <Menu size={20} />
        </button>

        <span className="flex items-center gap-1.5 min-w-0">
          {logo ? (
            <Image src={logo} alt="" width={20} height={20} className="h-5 w-5 shrink-0 object-contain" priority />
          ) : (
            <EqualizerLoader size="sm" />
          )}
          <span className="font-display text-base text-ink truncate">{siteConfig.siteName}</span>
        </span>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          {session?.user && <NotificationBell variant="mobile" />}
          <Link
            href="/compte"
            aria-label="Mon compte"
            className="grid h-9 w-9 place-items-center rounded-full overflow-hidden border border-border text-ink-muted hover:border-accent shrink-0"
          >
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <User size={16} />
            )}
          </Link>
        </div>
      </header>

      {drawerOpen && <MobileDrawer onClose={() => setDrawerOpen(false)} />}
    </>
  );
}
