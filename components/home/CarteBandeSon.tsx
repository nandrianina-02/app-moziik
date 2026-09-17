"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Headphones, Loader2, Play } from "lucide-react";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { useUnivers } from "@/context/UniversProvider";
import { useMode } from "@/context/ModeProvider";
import { SafeImage } from "@/components/ui/SafeImage";

/**
 * « Ma bande son » : la compilation du visiteur, lancée d'un geste.
 *
 * ELLE JOUE VRAIMENT
 *
 * Le bouton n'ouvre pas une page : il interroge /api/station — la même
 * station que la page Radio — et lance la file. Une carte personnelle en
 * tête d'accueil qui se contenterait de renvoyer ailleurs serait une
 * bannière déguisée.
 *
 * ELLE MARCHE SANS COMPTE
 *
 * `/api/station` répond aussi à un visiteur anonyme, avec une sélection
 * générique : `personnalisee` vaut alors faux. On change le texte, pas le
 * bouton — refuser de jouer à qui n'a pas de compte transformerait la
 * première carte de l'accueil en mur.
 *
 * La file n'est pas préchargée au montage : plusieurs dizaines de titres
 * réclamés à chaque visite, pour un bouton que la plupart ne touchent
 * pas, coûteraient plus cher que l'attente d'un clic.
 */
type Reponse = {
  songs: PlayableSong[];
  personnalisee: boolean;
  presentation?: { nom: string; intro: string };
};

export function CarteBandeSon() {
  const { data: session } = useSession();
  const { playQueue } = usePlayer();
  const pushToast = useToast();
  const { mode } = useMode();
  const { univers } = useUnivers();
  const [chargement, setChargement] = useState(false);

  const prenom = (session?.user?.name ?? "").trim().split(/\s+/)[0];

  async function lancer() {
    if (chargement) return;
    setChargement(true);
    try {
      const res = await fetch(
        `/api/station?heure=${new Date().getHours()}&mode=${mode}&univers=${univers}`
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Reponse;
      if (!data.songs?.length) {
        pushToast("info", "Pas encore assez d'écoutes pour composer une sélection.");
        return;
      }
      playQueue(data.songs, 0, {
        type: "radio",
        label: data.presentation?.nom ?? "Ma bande son",
        // Marque la file comme station : la suite se demande à
        // /api/station, sinon elle cesserait d'être personnalisée au bout
        // du premier tour (voir components/radio/StationPersonnelle.tsx).
        station: true,
      });
    } catch {
      pushToast("error", "La sélection n'a pas pu être chargée.");
    } finally {
      setChargement(false);
    }
  }

  return (
    // `pt-10` et l'avatar en débord : c'est lui qui personnalise la carte
    // au premier coup d'œil, avant même qu'on ait lu le prénom.
    <section className="relative mt-9">
      {session?.user && (
        <span className="absolute -top-9 left-5 z-10 grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-full border-4 border-base bg-surface text-lg font-semibold text-ink-muted">
          {session.user.image ? (
            <SafeImage
              src={session.user.image}
              alt=""
              width={72}
              height={72}
              className="h-full w-full object-cover"
            />
          ) : (
            (prenom || "?").charAt(0).toUpperCase()
          )}
        </span>
      )}

      <div
        className={`flex items-center gap-4 rounded-xl2 bg-accent px-5 text-base ${
          session?.user ? "pb-5 pt-11" : "py-6"
        }`}
      >
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl md:text-2xl">Ma bande son</h2>
          <p className="mt-1 text-sm leading-relaxed opacity-90">
            {prenom ? `Bonjour ${prenom} ! ` : ""}
            {session?.user
              ? "Voici une compilation créée pour toi."
              : "Une sélection pour découvrir le catalogue."}
          </p>
        </div>

        <button
          type="button"
          onClick={lancer}
          disabled={chargement}
          aria-label="Écouter ma bande son"
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-current transition-transform duration-200 hover:scale-105 disabled:opacity-60 sm:h-20 sm:w-20"
        >
          {chargement ? (
            <Loader2 size={26} className="animate-spin" />
          ) : (
            <span className="relative grid place-items-center">
              <Headphones size={30} strokeWidth={1.5} />
              <span className="absolute grid h-7 w-7 place-items-center rounded-full bg-base text-accent">
                <Play size={13} fill="currentColor" className="ml-0.5" />
              </span>
            </span>
          )}
        </button>
      </div>
    </section>
  );
}
