"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ecouter, estNatif, plugin } from "@/lib/native/pont";
import { fermerOngletConnexion } from "@/lib/native/authGoogle";
import { usePlayer } from "@/context/PlayerProvider";
import { useNotifications } from "@/context/NotificationsProvider";
import { useTheme } from "@/context/ThemeProvider";
import { useToast } from "@/context/ToastProvider";

/**
 * Tout ce que la coquille Android doit au site, et réciproquement.
 *
 * Ce composant ne rend rien : il ne fait que brancher les événements
 * natifs sur l'état React déjà existant. C'est délibéré — l'app Android
 * affiche les mêmes composants que le web, à l'octet près ; ce fichier est
 * la seule couche qui les sépare, et il tient en quelques effets.
 *
 * Hors de l'app (Chrome, PWA installée, rendu serveur), `plugin()` renvoie
 * `null` partout et l'ensemble est inerte.
 */

/** Fenêtre pendant laquelle un second appui sur Retour ferme l'application. */
const DELAI_DOUBLE_RETOUR_MS = 2000;

export function NativeShell() {
  const router = useRouter();
  const pushToast = useToast();
  const { theme } = useTheme();
  const { isFullPlayerOpen, closeFullPlayer } = usePlayer();
  const { drawerOpen, closeDrawer } = useNotifications();

  // Les gestionnaires natifs sont enregistrés une seule fois, mais doivent
  // voir l'état courant. Sans ces refs, le callback capturerait les valeurs
  // du premier rendu et le bouton Retour fermerait un lecteur déjà fermé.
  const etat = useRef({ isFullPlayerOpen, drawerOpen, closeFullPlayer, closeDrawer });
  etat.current = { isFullPlayerOpen, drawerOpen, closeFullPlayer, closeDrawer };

  const dernierRetour = useRef(0);

  // ---------------------------------------------------------------- splash

  useEffect(() => {
    const splash = plugin("SplashScreen");
    if (!splash) return;

    // Masqué ici plutôt qu'après un délai fixe (launchAutoHide est à false
    // dans capacitor.config.ts) : le premier rendu de l'app dépend d'un
    // aller-retour réseau vers Vercel, dont la durée varie de 200 ms en
    // wifi à plusieurs secondes en 3G. Une durée fixe donnerait soit un
    // écran figé après le chargement, soit une page blanche avant lui.
    //
    // requestAnimationFrame double : le premier s'exécute avant le paint,
    // le second après. On masque donc quand quelque chose est réellement
    // affiché dessous.
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => void splash.hide({ fadeOutDuration: 200 }))
    );
    return () => cancelAnimationFrame(id);
  }, []);

  // ------------------------------------------------------------ barre d'état

  useEffect(() => {
    const barre = plugin("StatusBar");
    if (!barre) return;

    // Le fond de la barre suit le thème, sinon l'app affiche un bandeau
    // indigo au-dessus d'une interface claire. Les valeurs sont celles de
    // --color-base dans app/globals.css.
    const sombre = theme === "dark";
    void barre.setBackgroundColor({ color: sombre ? "#0D0F1A" : "#FBF9F4" });
    // Contre-intuitif : `DARK` désigne un CONTENU sombre (icônes noires),
    // à utiliser sur fond clair. L'inverse rend l'heure et la batterie
    // invisibles.
    void barre.setStyle({ style: sombre ? "LIGHT" : "DARK" });
  }, [theme]);

  // ------------------------------------------------------------ liens profonds

  const traiterLien = useCallback(
    (url: string) => {
      let lien: URL;
      try {
        lien = new URL(url);
      } catch {
        return;
      }

      // Retour du relais de connexion Google (voir lib/native/authGoogle.ts).
      if (lien.protocol === "moziik:") {
        fermerOngletConnexion();

        const erreur = lien.searchParams.get("erreur");
        if (erreur) {
          pushToast("error", "Connexion Google interrompue. Réessaie.");
          return;
        }

        const code = lien.searchParams.get("code");
        if (!code) return;

        // Navigation complète et non router.push : cette route pose un
        // cookie de session par en-tête HTTP. Une navigation côté client
        // ne rejouerait pas la réponse du serveur, et la session ne
        // prendrait pas.
        window.location.href = `/api/mobile-auth/relais/consommer?code=${encodeURIComponent(code)}`;
        return;
      }

      // App Link : un lien moziik ouvert depuis WhatsApp, un SMS, un mail.
      // On reste dans la WebView et on navigue côté client, ce qui préserve
      // la lecture en cours — un rechargement complet la couperait.
      if (lien.origin === window.location.origin) {
        router.push(lien.pathname + lien.search);
      }
    },
    [router, pushToast]
  );

  useEffect(() => {
    const app = plugin("App");
    if (!app) return;

    // L'app était déjà ouverte : Android la ramène au premier plan avec
    // l'URL.
    const stop = ecouter(app.addListener("appUrlOpen", (e) => traiterLien(e.url)));

    // L'app était fermée : l'URL a servi à la lancer, et l'événement
    // ci-dessus est passé avant que ce composant existe. On la relit donc
    // au montage.
    void app.getLaunchUrl().then((r) => {
      if (r?.url) traiterLien(r.url);
    });

    return stop;
  }, [traiterLien]);

  // ----------------------------------------------------------- bouton Retour

  useEffect(() => {
    const app = plugin("App");
    if (!app) return;

    return ecouter(
      app.addListener("backButton", ({ canGoBack }) => {
        const { isFullPlayerOpen: lecteurOuvert, drawerOpen: tiroirOuvert, closeFullPlayer, closeDrawer } =
          etat.current;

        // Ordre du plus superficiel au plus profond : ce que l'auditeur
        // voit en dernier est ce qu'il s'attend à voir se refermer en
        // premier. Ces deux panneaux ne sont pas des routes — sans ce
        // traitement, Retour quitterait la page derrière eux en les
        // laissant ouverts.
        if (tiroirOuvert) {
          closeDrawer();
          return;
        }
        if (lecteurOuvert) {
          closeFullPlayer();
          return;
        }

        if (canGoBack) {
          // history.back() plutôt que router.back() : on veut l'historique
          // réel de la WebView, y compris les entrées créées hors du
          // routeur Next (retour du relais de connexion, par exemple).
          window.history.back();
          return;
        }

        // Racine de l'historique. Quitter sur un seul appui ferait perdre
        // la lecture en cours sur une fausse manœuvre — d'où la
        // confirmation par double appui, convention Android répandue.
        const maintenant = Date.now();
        if (maintenant - dernierRetour.current < DELAI_DOUBLE_RETOUR_MS) {
          void app.exitApp();
          return;
        }
        dernierRetour.current = maintenant;
        pushToast("info", "Appuie encore une fois pour quitter Moziik.");
      })
    );
  }, [pushToast]);

  // --------------------------------------------------------------- marquage

  useEffect(() => {
    if (!estNatif()) return;
    // Permet à la CSS de cibler l'app (`html.natif`) — utile pour les
    // marges de sécurité sous la barre de navigation gestuelle, que le
    // navigateur n'a pas.
    document.documentElement.classList.add("natif");
    return () => document.documentElement.classList.remove("natif");
  }, []);

  return null;
}
