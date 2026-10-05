"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { MESSAGE_AUTH } from "@/lib/authPopup";

/**
 * La fenêtre surgissante de connexion Google.
 *
 * Deux états dans une seule page, et c'est volontaire : la même adresse
 * sert d'aller et de retour, ce qui évite une seconde route pour un
 * écran que personne ne regarde plus d'une seconde.
 *
 *   1. à l'ouverture        on enchaîne sur Google, avec cette page
 *                           elle-même comme adresse de retour ;
 *   2. au retour (`?fini=1`) on prévient la fenêtre qui nous a ouverts,
 *                           puis on se referme.
 *
 * POURQUOI PASSER PAR `signIn` PLUTÔT QUE PAR L'URL DE GOOGLE
 *
 * Toute la mécanique — jeton anti-CSRF, état, échange du code, pose du
 * cookie de session — appartient à NextAuth. La réécrire ici créerait un
 * second chemin d'authentification à maintenir, et c'est exactement ce
 * qu'il ne faut pas faire. Cette page ne fait qu'appeler le chemin
 * existant depuis une fenêtre séparée.
 *
 * SI LA FENÊTRE N'A PAS D'OUVREUSE
 *
 * Quelqu'un peut arriver ici par un favori ou un lien partagé. On ne
 * laisse alors pas un écran mort : on renvoie à l'accueil, où la session
 * fraîchement posée est bien visible.
 */
export default function PopupConnexionGoogle() {
  const [etat, setEtat] = useState<"ouverture" | "retour" | "orpheline" | "echec">("ouverture");

  /**
   * Un départ vers Google, pas deux.
   *
   * En développement, React monte chaque effet deux fois : sans ce verrou,
   * la fenêtre partirait deux fois vers Google. Et si jamais une erreur
   * ramenait ici sans `fini=1`, la page se relancerait sans fin — une
   * boucle de redirections qu'on ne peut même pas arrêter, puisque la
   * fenêtre ne tient jamais en place assez longtemps pour être fermée.
   */
  const parti = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fini = params.get("fini") === "1";
    const erreur = params.get("error");

    // Refus chez Google, compte non autorisé, échange de code en échec :
    // on ne relance rien. La fenêtre se referme, et l'ouvreuse le constate
    // en voyant qu'elle est fermée — son bouton redevient disponible.
    if (erreur) {
      setEtat("echec");
      const fermeture = setTimeout(() => window.close(), 2200);
      return () => clearTimeout(fermeture);
    }

    if (!fini) {
      if (parti.current) return;
      parti.current = true;
      // Aller : Google, puis retour sur cette même page.
      void signIn("google", { callbackUrl: "/connexion/popup?fini=1" });
      return;
    }

    // Retour : le cookie de session est posé, il ne reste qu'à le dire.
    const ouvreuse = window.opener;
    if (!ouvreuse || ouvreuse.closed) {
      setEtat("orpheline");
      window.location.replace("/");
      return;
    }

    setEtat("retour");
    // Origine explicite plutôt que « * » : le message ne dit rien de
    // secret, mais rien n'oblige à le diffuser à qui écoute.
    ouvreuse.postMessage({ type: MESSAGE_AUTH }, window.location.origin);
    // Un souffle avant de fermer : sans lui, certains navigateurs
    // referment avant d'avoir remis le message à l'ouvreuse.
    const fermeture = setTimeout(() => window.close(), 150);
    return () => clearTimeout(fermeture);
  }, []);

  return (
    // Sans hauteur ni fond propres : la mise en page du groupe (auth)
    // centre déjà son contenu et pose la marque Moziik au-dessus. Les
    // redoubler ajouterait une seconde marge dans une fenêtre de
    // quatre cent quatre-vingts pixels.
    <main className="flex flex-col items-center gap-5 py-6 text-center">
      <span className="animate-fade-in grid h-14 w-14 place-items-center rounded-2xl border border-border bg-surface">
        <GoogleIcon size={24} />
      </span>

      <div className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
        <p className="text-[15px] font-medium text-ink">
          {etat === "retour"
            ? "Connexion réussie"
            : etat === "echec"
              ? "Connexion interrompue"
              : "Connexion à Google"}
        </p>
        <p className="mt-1 max-w-xs text-sm text-ink-muted">
          {etat === "retour"
            ? "Cette fenêtre se referme, vous revenez sur Moziik."
            : etat === "echec"
              ? "Rien n'a été enregistré. Cette fenêtre se referme, vous pouvez réessayer."
              : etat === "orpheline"
                ? "Redirection vers Moziik…"
                : "Choisissez votre compte dans la fenêtre Google."}
        </p>
      </div>

      {/* Trois points qui respirent : la fenêtre reste vivante pendant
          l'aller-retour, sans promettre une progression qu'on ne mesure pas. */}
      {etat !== "echec" && (
      <span className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
      </span>
      )}
    </main>
  );
}
