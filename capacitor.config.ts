import type { CapacitorConfig } from "@capacitor/cli";

// Coquille Android de Moziik.
//
// Choix central : la WebView charge le site Next.js déployé plutôt qu'un
// bundle embarqué. Ce n'est pas un raccourci, c'est la seule façon de tenir
// la promesse « même design, même API » sans dupliquer l'interface — l'app
// rend exactement les mêmes composants server, lit les mêmes routes et suit
// automatiquement chaque déploiement, sans passer par une revue du Play
// Store. Un bundle embarqué supposerait de réécrire en client les 44 pages
// qui dépendent aujourd'hui de MongoDB côté serveur.
//
// La valeur native (lecture en arrière-plan, notification média, retour
// matériel, liens externes, App Links) est apportée par les plugins et par
// le service Kotlin de android/app/src/main/java/.../MoziikAudioService.kt.

// Surchargée pour tester sur un serveur local ou de recette :
//   CAP_SERVER_URL=http://192.168.1.12:3000 npx cap sync android
// Voir la mémoire « Mesurer sur un build de production » : viser un
// `next build && next start`, jamais `next dev`, sinon la première
// navigation dans la WebView attend 30 à 130 s de compilation.
const serverUrl = process.env.CAP_SERVER_URL || "https://app-moziik.vercel.app";

// http:// implique un serveur de développement en réseau local : Android 9+
// refuse le trafic en clair par défaut, il faut donc l'autoriser
// explicitement — et seulement dans ce cas.
const isCleartext = serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "com.moziik.app",
  appName: "Moziik",

  // Jamais servi tant que `server.url` est défini, SAUF pour errorPath
  // ci-dessous. Ce dossier ne contient donc qu'une page : celle affichée
  // quand le site est injoignable au démarrage.
  webDir: "android-shell",

  server: {
    url: serverUrl,
    cleartext: isCleartext,
    // Le site est déjà en https, l'origine de la WebView est donc celle du
    // domaine réel : les cookies NextAuth (Secure, SameSite=Lax) et la CSP
    // de next.config.mjs s'appliquent tels quels, sans exception à écrire.
    androidScheme: "https",
    // Sans ceci, un lancement hors réseau donne l'écran d'erreur brut de
    // Chrome — dinosaure compris. Avec, on garde la marque et un bouton
    // « Réessayer ».
    errorPath: "erreur-reseau.html",
  },

  android: {
    // Le pont natif est injecté par addDocumentStartJavaScript, qui demande
    // WebView 83+. En dessous, aucun plugin ne répondrait et l'app
    // ressemblerait à un site cassé sans dire pourquoi : mieux vaut
    // rediriger vers errorPath, qui l'explique.
    minWebViewVersion: 83,
    allowMixedContent: false,
    // Même fond que le manifest PWA (app/manifest.ts) : évite le flash
    // blanc entre le splash et le premier paint du thème sombre.
    backgroundColor: "#0D0F1A",
    // Repris côté serveur par lib/native/detectNative.ts pour masquer ce
    // qui n'a pas de sens dans l'app (invite à installer la PWA) dès le
    // rendu, sans attendre l'hydratation.
    appendUserAgent: "MoziikAndroid",
  },

  plugins: {
    SplashScreen: {
      // Masqué à la main par NativeShell une fois la page réellement
      // interactive : une durée fixe afficherait soit un écran figé après
      // le chargement, soit une page blanche avant.
      launchAutoHide: false,
      backgroundColor: "#0D0F1A",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      // La barre suit le thème choisi dans l'app ; NativeShell la
      // repeint à chaque bascule sombre/clair.
      backgroundColor: "#0D0F1A",
      style: "DARK",
      overlaysWebView: false,
    },
  },
};

export default config;
