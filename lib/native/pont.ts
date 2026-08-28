/**
 * Accès au pont natif Capacitor depuis le code web.
 *
 * POURQUOI AUCUN `import "@capacitor/core"` ICI
 *
 * La coquille Android charge le site distant (capacitor.config.ts). Dans ce
 * mode, Capacitor injecte lui-même, avant tout script de la page, un objet
 * `window.Capacitor.Plugins.<Nom>` complet pour chaque plugin natif —
 * méthodes et `addListener` compris. C'est fait par
 * `WebViewCompat.addDocumentStartJavaScript` (Bridge.java) à partir du code
 * généré par `JSExport.getPluginJS`.
 *
 * Autrement dit, le pont est DÉJÀ là quand notre code s'exécute. Importer
 * les paquets npm ferait embarquer une seconde copie de la même chose dans
 * le bundle — payée par tous les visiteurs du site, dont 100 % n'en ont
 * aucun usage. On lit donc simplement le global, et on dégrade en no-op
 * partout ailleurs.
 *
 * Les paquets `@capacitor/*` restent dans package.json : `npx cap sync` en
 * a besoin pour installer le code natif correspondant dans android/. Ils ne
 * sont jamais importés par du code web, donc jamais bundlés.
 */

/** Ce que le service natif accepte, en miroir de MoziikAudioPlugin.java. */
export type EtatLectureNatif = {
  titre: string;
  artiste: string;
  album: string;
  /** URL absolue de la pochette. Vide = pas d'illustration. */
  pochette: string;
  enLecture: boolean;
  positionMs: number;
  dureeMs: number;
  vitesse: number;
  aSuivant: boolean;
  aPrecedent: boolean;
};

export type CommandeTransport = {
  action: "play" | "pause" | "next" | "previous" | "stop" | "seek";
  /** Rempli seulement pour `seek`. Vaut -1 dans tous les autres cas. */
  positionMs: number;
};

/** Objet rendu par le `addListener` injecté (synchrone, contrairement au paquet npm). */
type Abonnement = { remove: () => void | Promise<void> };

type PluginMoziikAudio = {
  activer: () => Promise<{ actif: boolean; notifications: boolean }>;
  mettreAJour: (etat: EtatLectureNatif) => Promise<void>;
  desactiver: () => Promise<void>;
  addListener: (event: "transport", cb: (c: CommandeTransport) => void) => Abonnement;
};

type PluginApp = {
  addListener: {
    (event: "backButton", cb: (e: { canGoBack: boolean }) => void): Abonnement;
    (event: "appUrlOpen", cb: (e: { url: string }) => void): Abonnement;
    (event: "appStateChange", cb: (e: { isActive: boolean }) => void): Abonnement;
  };
  exitApp: () => Promise<void>;
  getLaunchUrl: () => Promise<{ url: string } | null>;
};

type PluginSplashScreen = { hide: (o?: { fadeOutDuration?: number }) => Promise<void> };

type PluginStatusBar = {
  setBackgroundColor: (o: { color: string }) => Promise<void>;
  setStyle: (o: { style: "DARK" | "LIGHT" | "DEFAULT" }) => Promise<void>;
};

type PluginBrowser = {
  open: (o: { url: string; presentationStyle?: string }) => Promise<void>;
  close: () => Promise<void>;
};

type PluginsNatifs = {
  MoziikAudio?: PluginMoziikAudio;
  App?: PluginApp;
  SplashScreen?: PluginSplashScreen;
  StatusBar?: PluginStatusBar;
  Browser?: PluginBrowser;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: PluginsNatifs;
};

function global(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

/**
 * Vrai uniquement dans la coquille Android.
 *
 * À NE PAS utiliser pour décider d'un rendu : le serveur ne connaît pas
 * `window`, une branche différente ici produirait une erreur d'hydratation.
 * Pour le rendu, passer par `estAppAndroid()` de lib/native/serveur.ts, qui
 * lit l'en-tête User-Agent. Ici : effets et appels seulement.
 */
export function estNatif(): boolean {
  const cap = global();
  return Boolean(cap?.isNativePlatform?.() && cap.getPlatform?.() === "android");
}

/**
 * Renvoie un plugin natif, ou `null` hors de l'app.
 *
 * Chaque appelant doit gérer le `null` — c'est le cas nominal, pas une
 * anomalie : la même page tourne dans Chrome, dans la PWA installée et
 * dans l'app Android.
 */
export function plugin<K extends keyof PluginsNatifs>(nom: K): NonNullable<PluginsNatifs[K]> | null {
  if (!estNatif()) return null;
  return (global()?.Plugins?.[nom] as NonNullable<PluginsNatifs[K]> | undefined) ?? null;
}

/**
 * Abonnement tolérant. Le pont injecté rend l'abonnement de façon
 * synchrone, alors que le paquet npm rend une promesse : la coquille
 * pourrait basculer de l'un à l'autre au fil des versions de Capacitor. On
 * accepte les deux, et on renvoie une fonction de désabonnement qui reste
 * correcte même si le composant est démonté avant la résolution.
 */
export function ecouter(
  abonnement: Abonnement | Promise<Abonnement> | undefined | null
): () => void {
  let vivant = true;
  let resolu: Abonnement | null = null;

  Promise.resolve(abonnement)
    .then((a) => {
      if (!a) return;
      // Démonté pendant l'attente : on retire tout de suite plutôt que de
      // laisser un écouteur orphelin renvoyer des commandes à un lecteur
      // qui n'existe plus.
      if (!vivant) void a.remove();
      else resolu = a;
    })
    .catch(() => undefined);

  return () => {
    vivant = false;
    void resolu?.remove();
  };
}
