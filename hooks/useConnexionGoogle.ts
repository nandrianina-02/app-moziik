"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastProvider";
import { ouvrirConnexionGoogle } from "@/lib/native/authGoogle";
import { connexionGooglePopup } from "@/lib/authPopup";

/**
 * Le bouton « Continuer avec Google », partout pareil.
 *
 * Trois chemins, essayés dans cet ordre, et l'ordre compte :
 *
 * 1. **L'application Android.** Google refuse OAuth dans une WebView
 *    embarquée : on sort vers un onglet Chrome et la session revient par
 *    le relais (lib/native/authGoogle.ts). Ce chemin passe en premier,
 *    sans quoi l'app ouvrirait une fenêtre surgissante qui n'a aucun sens
 *    sur un téléphone.
 * 2. **La fenêtre surgissante**, dans un navigateur. Moziik reste en
 *    place derrière : rien de ce qui était à l'écran n'est perdu.
 * 3. **La redirection d'avant**, si la fenêtre est bloquée. Ce repli
 *    n'est pas optionnel — sans lui, un bloqueur de fenêtres rendrait le
 *    bouton inerte, ce qui est la pire des pannes : celle qui ne dit rien.
 *
 * Partagé par la connexion et l'inscription : les deux portent le même
 * bouton, et un comportement qui diverge entre les deux se remarquerait
 * le jour où l'un des deux cesserait de marcher.
 */
export function useConnexionGoogle(): { lancer: () => void; enCours: boolean } {
  const router = useRouter();
  const pushToast = useToast();
  const { update } = useSession();
  const [enCours, setEnCours] = useState(false);

  // La fenêtre peut revenir après un démontage — on change de page
  // pendant l'aller-retour, par exemple. Écrire dans un état disparu
  // n'est pas dramatique, mais naviguer depuis un écran qu'on a quitté
  // le serait.
  const monte = useRef(true);
  useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
    };
  }, []);

  const lancer = useCallback(() => {
    if (enCours) return;

    if (ouvrirConnexionGoogle()) return;

    setEnCours(true);

    // Ouverture SYNCHRONE : tout `await` avant ce point ferait perdre le
    // lien avec le clic, et le navigateur bloquerait la fenêtre.
    const ouverte = connexionGooglePopup(async (resultat) => {
      if (!monte.current) return;
      setEnCours(false);
      if (resultat === "abandonne") return;

      // La session vient d'être posée dans un autre onglet : cet onglet-ci
      // ne le sait pas encore. `update()` relit /api/auth/session, ce qui
      // repeint l'en-tête avant même la navigation.
      await update();
      pushToast("success", "Connecté avec succès.");
      router.push("/");
      router.refresh();
    });

    if (!ouverte) {
      setEnCours(false);
      void signIn("google", { callbackUrl: "/" });
    }
  }, [enCours, pushToast, router, update]);

  return { lancer, enCours };
}
