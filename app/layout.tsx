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
import { DesktopHeader } from "@/components/layout/DesktopHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { MiniPlayerBar } from "@/components/player/MiniPlayerBar";
import { FullPlayerPage } from "@/components/player/FullPlayerPage";
import { PlayerShortcuts } from "@/components/player/PlayerShortcuts";
import { FloatingInstallButton } from "@/components/ui/FloatingInstallButton";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { NativeShell } from "@/components/native/NativeShell";
import { NativeMediaSession } from "@/components/native/NativeMediaSession";
import { getSiteConfig } from "@/lib/siteConfig";
import { sizedIcon } from "@/lib/icons";

const display = Sora({ subsets: ["latin"], variable: "--font-display" });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  // Le favicon dédié l'emporte ; à défaut on retaille le logo, comme avant.
  const source = config.faviconUrl || config.logoUrl;
  const favicon32 = (source && sizedIcon(source, 32)) || "/favicon-32.png";
  const favicon16 = (source && sizedIcon(source, 16)) || "/favicon-16.png";
  const appleIcon = (source && sizedIcon(source, 180)) || "/icon-mark.png";

  // Ce que voient les moteurs de recherche : les champs SEO d'abord, puis
  // ce qui décrit déjà le site. Aucun texte n'est inventé ici.
  const titre = config.seoTitle?.trim() || config.siteName;
  const description = config.seoDescription?.trim() || config.description?.trim() || config.tagline;

  return {
    // Sans base, les images et liens relatifs des cartes de partage sont
    // résolus contre l'adresse courante — donc faux dès qu'un aperçu est
    // généré ailleurs.
    metadataBase: config.siteUrl ? new URL(config.siteUrl) : undefined,
    title: titre,
    description,
    openGraph: {
      title: titre,
      description,
      siteName: config.siteName,
      type: "website",
    },
    icons: {
      icon: [
        { url: favicon32, sizes: "32x32", type: "image/png" },
        { url: favicon16, sizes: "16x16", type: "image/png" },
      ],
      apple: appleIcon,
    },
    // La balise de vérification n'est posée que si un jeton est renseigné :
    // celui d'un autre compte ne servirait à personne.
    verification: config.googleSearchConsoleId ? { google: config.googleSearchConsoleId } : undefined,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FF6B4A",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const config = await getSiteConfig();
  const mesure = (config.googleAnalyticsId ?? "").trim();

  return (
    <html lang={config.defaultLanguage || "fr"}>
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        {/*
          Applique le thème stocké AVANT le premier paint, en bloquant
          (`beforeInteractive`) — sans ça, ThemeProvider ne lit
          localStorage et les préférences qu'après hydratation, donc un
          visiteur en thème clair, ou avec ses propres couleurs, voyait un
          flash de la palette par défaut à chaque chargement. Next.js
          injecte les scripts `beforeInteractive` dans le <head> quel que
          soit leur emplacement dans l'arbre JSX.

          Le lecteur relit les variables telles que ThemeProvider les a
          calculées la dernière fois : rien n'est recalculé ici, ce script
          doit rester minuscule et ne jamais échouer.
        */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            try {
              var racine = document.documentElement;
              var brut = localStorage.getItem('moziik-theme-vars');
              var etat = brut ? JSON.parse(brut) : null;
              if (etat && etat.variables) {
                for (var nom in etat.variables) racine.style.setProperty(nom, etat.variables[nom]);
                if (etat.clair) racine.classList.add('light');
              } else if (localStorage.getItem('moziik-theme') === 'light') {
                racine.classList.add('light');
              }
            } catch (e) {}
          `}
        </Script>
        {/* Mesure d'audience : rien n'est chargé tant qu'aucun identifiant
            n'est renseigné en administration — pas de script, pas de requête,
            pas de dépôt sur l'appareil du visiteur. */}
        {mesure && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${mesure}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${mesure}');
              `}
            </Script>
          </>
        )}
        <SiteConfigProvider>
          <AuthProvider>
            <ThemeProvider>
              <ToastProvider>
                <OnlineStatusProvider>
                  <PlayerProvider>
                    <NotificationsProvider>
                      <SidebarProvider>
                        <MobileHeader />
                        <div className="flex min-h-screen">
                          <Sidebar />
                          {/* Colonne de contenu : la barre supérieure doit
                              rester à droite de la sidebar, jamais par-dessus. */}
                          <div className="flex min-w-0 flex-1 flex-col">
                            <DesktopHeader />
                            {/* Dans le flux, sous l'en-tete : le bandeau ne
                                recouvre plus ni la barre de recherche ni la
                                premiere ligne de contenu. */}
                            <OfflineBanner />
                            <MainContent>{children}</MainContent>
                          </div>
                        </div>
                        <NotificationsDrawer />
                        <MiniPlayerBar />
                        <FullPlayerPage />
                        <PlayerShortcuts />
                        {/*
                          Coquille Android. Ces deux composants ne rendent
                          rien et sont inertes dans un navigateur : ils se
                          contentent de brancher le bouton Retour, les liens
                          profonds, la barre d'état et la notification média
                          sur l'état React déjà existant. Ils sont ici, et
                          non dans un layout séparé, précisément pour que
                          l'app et le site restent le même arbre de
                          composants.
                        */}
                        <NativeShell />
                        <NativeMediaSession />
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
