import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Sora, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeProvider";
import { AuthProvider } from "@/context/AuthProvider";
import { ToastProvider } from "@/context/ToastProvider";
import { OnlineStatusProvider } from "@/context/OnlineStatusProvider";
import { PlayerProvider } from "@/context/PlayerProvider";
import { SiteConfigProvider } from "@/context/SiteConfigProvider";
import { SidebarProvider } from "@/context/SidebarProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainContent } from "@/components/layout/MainContent";
import { NotificationsProvider } from "@/context/NotificationsProvider";
import { NotificationsDrawer } from "@/components/notifications/NotificationsDrawer";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { MiniPlayerBar } from "@/components/player/MiniPlayerBar";
import { FullPlayerPage } from "@/components/player/FullPlayerPage";
import { FloatingInstallButton } from "@/components/ui/FloatingInstallButton";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { getSiteConfig } from "@/lib/siteConfig";
import { sizedIcon } from "@/lib/icons";

const display = Sora({ subsets: ["latin"], variable: "--font-display" });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  const favicon32 = (config.logoUrl && sizedIcon(config.logoUrl, 32)) || "/favicon-32.png";
  const favicon16 = (config.logoUrl && sizedIcon(config.logoUrl, 16)) || "/favicon-16.png";
  const appleIcon = (config.logoUrl && sizedIcon(config.logoUrl, 180)) || "/icon-mark.png";

  return {
    title: config.siteName,
    description: config.tagline,
    icons: {
      icon: [
        { url: favicon32, sizes: "32x32", type: "image/png" },
        { url: favicon16, sizes: "16x16", type: "image/png" },
      ],
      apple: appleIcon,
    },
      verification: {
      google: "bdr2XQKw3ix0tOhfnh5FPpdgy-22DAbaLPEZej7Bg14",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FF6B4A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        {/*
          Applique le thème stocké AVANT le premier paint, en bloquant
          (`beforeInteractive`) — sans ça, ThemeProvider ne lit
          localStorage que dans un useEffect (après hydratation), donc un
          visiteur en thème clair voyait un flash sombre à chaque
          chargement de page. Next.js injecte les scripts
          `beforeInteractive` dans le <head> quel que soit leur
          emplacement dans l'arbre JSX.
        */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            try {
              var theme = localStorage.getItem('moziik-theme');
              if (theme === 'light') document.documentElement.classList.add('light');
            } catch (e) {}
          `}
        </Script>
        <SiteConfigProvider>
          <AuthProvider>
            <ThemeProvider>
              <ToastProvider>
                <OnlineStatusProvider>
                  <PlayerProvider>
                    <NotificationsProvider>
                      <SidebarProvider>
                        <MobileHeader />
                        <OfflineBanner />
                        <div className="flex min-h-screen">
                          <Sidebar />
                          <MainContent>{children}</MainContent>
                        </div>
                        <NotificationsDrawer />
                        <MiniPlayerBar />
                        <FullPlayerPage />
                        <FloatingInstallButton />
                        <MobileNav />
                      </SidebarProvider>
                    </NotificationsProvider>
                  </PlayerProvider>
                </OnlineStatusProvider>
              </ToastProvider>
            </ThemeProvider>
          </AuthProvider>
        </SiteConfigProvider>
      </body>
    </html>
  );
}
