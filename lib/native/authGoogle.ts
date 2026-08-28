"use client";

import { plugin } from "@/lib/native/pont";

/**
 * Connexion Google depuis l'app Android.
 *
 * Google rejette OAuth dans une WebView embarquée (`disallowed_useragent`) :
 * le bouton habituel de LoginForm ne peut donc pas fonctionner tel quel
 * dans l'app. On sort dans un onglet Chrome — un vrai navigateur, que
 * Google accepte — puis on rapatrie la session via le relais décrit dans
 * app/api/mobile-auth/relais/route.ts.
 *
 * Onglet personnalisé (`Browser.open`) plutôt qu'une sortie complète vers
 * Chrome : il s'ouvre par-dessus l'app, partage le pot à cookies de Chrome
 * — donc profite d'un compte Google déjà connecté sur le téléphone — et se
 * referme tout seul au retour.
 */
export function ouvrirConnexionGoogle(): boolean {
  const navigateur = plugin("Browser");
  if (!navigateur) return false;

  // `relais=android` dit à LoginForm, une fois chargé dans l'onglet, de
  // renvoyer vers /api/mobile-auth/relais après Google plutôt que vers
  // l'accueil — l'accueil s'afficherait dans l'onglet, et l'app resterait
  // déconnectée derrière.
  const url = new URL("/connexion", window.location.origin);
  url.searchParams.set("relais", "android");

  void navigateur.open({ url: url.toString() });
  return true;
}

/** Referme l'onglet Chrome une fois le code de relais reçu. */
export function fermerOngletConnexion(): void {
  // `catch` silencieux : sur certaines surcouches Android l'onglet s'est
  // déjà refermé de lui-même en lançant l'intent `moziik://`, et le plugin
  // rejette alors « pas de navigateur ouvert ». Sans conséquence.
  void plugin("Browser")?.close().catch(() => undefined);
}
