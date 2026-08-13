import type { Metadata, Viewport } from "next";
import { Sora, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeProvider";
import { AuthProvider } from "@/context/AuthProvider";
import { ToastProvider } from "@/context/ToastProvider";
import { OnlineStatusProvider } from "@/context/OnlineStatusProvider";
import { PlayerProvider } from "@/context/PlayerProvider";
import { SiteConfigProvider } from "@/context/SiteConfigProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { PageTransition } from "@/components/layout/PageTransition";
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
    <html lang="fr" className="dark">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <SiteConfigProvider>
          <AuthProvider>
            <ThemeProvider>
              <ToastProvider>
                <OnlineStatusProvider>
                  <PlayerProvider>
                    <NotificationsProvider>
                      <MobileHeader />
                      <OfflineBanner />
                      <div className="flex min-h-screen">
                        <Sidebar />
                        <main className="min-w-0 flex-1 pt-14 pb-40 md:pt-0 md:pb-24">
                          <PageTransition>{children}</PageTransition>
                        </main>
                      </div>
                      <NotificationsDrawer />
                      <MiniPlayerBar />
                      <FullPlayerPage />
                      <FloatingInstallButton />
                      <MobileNav />
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
