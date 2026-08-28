"use client";

import { useEffect, useRef, useState } from "react";
import { ecouter, plugin } from "@/lib/native/pont";
import { usePlayer } from "@/context/PlayerProvider";
import { useSiteConfig } from "@/context/SiteConfigProvider";
import { useToast } from "@/context/ToastProvider";

/**
 * Relie le lecteur web au service de lecture Android
 * (MoziikAudioService.java) : notification média, commandes sur l'écran
 * verrouillé, boutons de casque Bluetooth, et surtout maintien du son
 * quand l'application passe en arrière-plan.
 *
 * Le lecteur reste l'unique source de vérité. Ce composant ne fait que
 * recopier son état vers le natif, et retraduire les commandes reçues en
 * appels sur ce même lecteur. Aucun état de lecture n'est dupliqué ici —
 * c'est ce qui garantit que la notification ne peut pas afficher autre
 * chose que ce que joue réellement l'app.
 *
 * Ne rend rien, et est inerte hors de la coquille Android.
 */

/**
 * Cadence des mises à jour de position pendant la lecture.
 *
 * Android extrapole lui-même la position à partir de la vitesse fournie
 * dans PlaybackStateCompat : ces envois ne servent qu'à corriger la dérive
 * (mise en mémoire tampon, changement de vitesse). Toutes les secondes
 * serait du gaspillage — `progress` change déjà quatre fois par seconde et
 * chaque envoi traverse le pont JS/natif.
 */
const CADENCE_POSITION_MS = 2000;

export function NativeMediaSession() {
  const player = usePlayer();
  const siteConfig = useSiteConfig();
  const pushToast = useToast();

  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    queue,
    playbackRate,
    togglePlay,
    playNext,
    playPrevious,
    seek,
  } = player;

  // Même raison que dans NativeShell : les écouteurs natifs sont posés une
  // seule fois et doivent voir les fonctions du rendu courant.
  const commandes = useRef({ togglePlay, playNext, playPrevious, seek, isPlaying });
  commandes.current = { togglePlay, playNext, playPrevious, seek, isPlaying };

  // Position lue au moment de l'envoi, sans faire de `progress` une
  // dépendance d'effet : sinon l'effet se réabonnerait quatre fois par
  // seconde.
  const position = useRef(progress);
  position.current = progress;

  const service = useRef(false);

  // Passe à vrai une fois le service natif réellement prêt à recevoir des
  // mises à jour. C'est un état, et non une ref, précisément pour que
  // l'effet de recopie ci-dessous se relance à ce moment-là : `activer()`
  // est asynchrone (il peut ouvrir la boîte de dialogue de permission), et
  // toute mise à jour partie avant sa résolution est ignorée côté natif.
  // Sans ce déclencheur, la notification n'apparaissait qu'au tick suivant
  // — jusqu'à deux secondes après l'appui sur Lecture, ce qui se voit.
  const [pret, setPret] = useState(false);

  // ------------------------------------------------------- commandes natives

  useEffect(() => {
    const audio = plugin("MoziikAudio");
    if (!audio) return;

    return ecouter(
      audio.addListener("transport", ({ action, positionMs }) => {
        const c = commandes.current;
        switch (action) {
          case "play":
          case "pause":
            // Le natif envoie l'intention, pas l'état visé. togglePlay
            // reste le seul chemin vers une bascule, ce qui évite de
            // désynchroniser le graphe Web Audio.
            c.togglePlay();
            break;
          case "next":
            c.playNext();
            break;
          case "previous":
            c.playPrevious();
            break;
          case "seek":
            if (positionMs >= 0) c.seek(positionMs / 1000);
            break;
          case "stop":
            // Balayage de la notification : on met en pause plutôt que de
            // vider la file, pour que reprendre l'app permette de
            // repartir du même endroit.
            if (c.isPlaying) c.togglePlay();
            break;
        }
      })
    );
  }, []);

  // -------------------------------------------------- démarrage du service

  useEffect(() => {
    const audio = plugin("MoziikAudio");
    if (!audio || service.current) return;
    // Seulement au premier vrai début de lecture : demander la permission
    // de notification au lancement de l'app, sans contexte, la ferait
    // refuser. Ici, l'auditeur vient d'appuyer sur Lecture — la
    // notification a un sens évident.
    if (!isPlaying || !currentSong) return;

    service.current = true;
    void audio.activer().then(({ notifications }) => {
      setPret(true);
      if (notifications) return;
      // Refus explicite sur Android 13+. La lecture n'est pas cassée, mais
      // elle s'arrêtera écran éteint : mieux vaut le dire maintenant que
      // laisser croire à une panne plus tard.
      pushToast(
        "info",
        "Sans autorisation de notification, la lecture s'arrêtera quand l'écran s'éteindra."
      );
    });
  }, [isPlaying, currentSong, pushToast]);

  // ------------------------------------------------ recopie de l'état

  useEffect(() => {
    const audio = plugin("MoziikAudio");
    if (!audio || !currentSong) return;

    const envoyer = () => {
      void audio.mettreAJour({
        titre: currentSong.title,
        artiste: currentSong.artist?.stageName ?? "Artiste supprimé",
        album:
          typeof currentSong.album === "object" && currentSong.album
            ? currentSong.album.title
            : siteConfig.siteName,
        // Absolue obligatoirement : le téléchargement se fait côté Java,
        // qui n'a aucune notion de l'origine de la page.
        pochette: currentSong.coverUrl
          ? new URL(currentSong.coverUrl, window.location.origin).toString()
          : "",
        enLecture: isPlaying,
        positionMs: Math.round(position.current * 1000),
        dureeMs: Math.round(duration * 1000),
        vitesse: playbackRate,
        // La file circule : « suivant » et « précédent » ont un sens dès
        // qu'il y a plus d'un morceau.
        aSuivant: queue.length > 1,
        aPrecedent: queue.length > 1,
      });
    };

    envoyer();

    if (!isPlaying) return;
    const timer = setInterval(envoyer, CADENCE_POSITION_MS);
    return () => clearInterval(timer);
    // `progress` volontairement absent : il changerait quatre fois par
    // seconde et relancerait l'intervalle à chaque fois. Sa valeur est lue
    // via la ref au moment de l'envoi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret, currentSong, isPlaying, duration, playbackRate, queue.length, siteConfig.siteName]);

  // ------------------------------------------------------------- extinction

  useEffect(() => {
    const audio = plugin("MoziikAudio");
    if (!audio) return;
    // File vidée : plus rien à afficher. Sans ceci, la notification
    // survivrait à la fin de la dernière piste, avec des commandes sans
    // effet.
    if (currentSong || !service.current) return;
    service.current = false;
    setPret(false);
    void audio.desactiver();
  }, [currentSong]);

  return null;
}
