"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls, useMotionValue, useTransform } from "framer-motion";
import { X } from "lucide-react";
import { Portal } from "@/components/ui/Portal";
import { useScrollLock } from "@/lib/scrollLock";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/** Distance (px) au-delà de laquelle un glissement vers le bas ferme la feuille. */
const SEUIL_FERMETURE = 110;
/** Vitesse (px/s) qui ferme la feuille même sur un geste court. */
const VITESSE_FERMETURE = 650;

/**
 * Surcouche modale : feuille qui monte depuis le bas sur mobile, boîte de
 * dialogue centrée à partir de `sm`.
 *
 * Ce composant existe pour trois raisons, toutes constatées sur les
 * modales qu'il remplace :
 *
 * 1. `grid place-items-center` + `overflow-y-auto` sur le voile centre un
 *    contenu plus haut que l'écran : le haut passe alors au-dessus de
 *    l'origine du défilement et devient inatteignable. La modale de
 *    partage mesurait 854 px sur un écran de 720 — son bas dépassait de
 *    166 px sans moyen d'y accéder. Ici le voile ne défile pas ; c'est le
 *    corps de la feuille, borné en hauteur, qui défile.
 * 2. Les appelants écrivent `{ouvert && <Modale/>}` : sans `AnimatePresence`
 *    interne, aucune animation de fermeture n'est possible. La feuille
 *    gère donc sa propre sortie et ne prévient le parent qu'une fois
 *    l'animation terminée.
 * 3. Le verrou de défilement passe par le compteur partagé
 *    (lib/scrollLock.ts) : deux surcouches empilées ne se débloquent plus
 *    mutuellement.
 */
export function ModalSheet({
  titre,
  sousTitre,
  largeur = "sm:max-w-lg",
  onClose,
  children,
  entete,
  pied,
}: {
  titre: string;
  sousTitre?: string;
  /** Classe de largeur maximale appliquée à partir de `sm`. */
  largeur?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Bloc pleine largeur sous le titre, dans l'en-tête fixe (barre de recherche, filtres…). */
  entete?: React.ReactNode;
  /**
   * Barre d'actions fixée en bas, hors de la zone défilante. Sur un
   * formulaire long en mobile, un bouton « Enregistrer » placé à la suite
   * du contenu oblige à faire défiler tout le formulaire pour le
   * retrouver ; ici il reste visible.
   */
  pied?: React.ReactNode;
}) {
  const [ouvert, setOuvert] = useState(true);
  const previenu = useRef(false);
  const idTitre = useId();
  const feuille = useMediaQuery("(max-width: 639px)");
  const controles = useDragControls();
  const y = useMotionValue(0);
  const opaciteVoile = useTransform(y, [0, 320], [1, 0.35]);

  useScrollLock(ouvert);

  const prevenirParent = useCallback(() => {
    if (previenu.current) return;
    previenu.current = true;
    onClose();
  }, [onClose]);

  const fermer = useCallback(() => {
    setOuvert(false);
    // Filet de sécurité : si l'animation de sortie n'aboutissait pas, la
    // feuille resterait montée et continuerait d'intercepter les clics —
    // c'est exactement le défaut qui rendait l'écran incliquable derrière
    // le lecteur plein écran. Le parent est prévenu dans tous les cas.
    setTimeout(prevenirParent, 400);
  }, [prevenirParent]);

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") fermer();
    }
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [fermer]);

  return (
    <Portal>
      <AnimatePresence onExitComplete={prevenirParent}>
        {ouvert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={fermer}
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={idTitre}
              onClick={(e) => e.stopPropagation()}
              // Sur mobile seulement : glissement vers le bas pour fermer.
              // `dragListener={false}` réserve le geste à la poignée, sans
              // quoi il entrerait en conflit avec le défilement du corps.
              drag={feuille ? "y" : false}
              dragControls={controles}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.55 }}
              dragMomentum={false}
              onDragEnd={(_, info) => {
                if (info.offset.y > SEUIL_FERMETURE || info.velocity.y > VITESSE_FERMETURE) fermer();
              }}
              // `y` et `opacity` ne sont pilotés QUE par des MotionValue et
              // les variantes ci-dessous : jamais par un style brut en
              // parallèle. Mélanger les deux interrompt l'animation de
              // sortie en cours de route et la modale ne se démonte plus.
              style={{ y }}
              initial={feuille ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 24 }}
              animate={feuille ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={feuille ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: "spring", stiffness: 340, damping: 34, mass: 0.85 }}
              className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-2xl sm:max-h-[86vh] sm:rounded-xl2 ${largeur}`}
            >
              {/* Poignée de glissement — mobile uniquement. `touch-none`
                  est obligatoire ici : c'est l'élément qui déclenche le
                  geste, et le navigateur y défilerait sinon à sa place. */}
              <div
                onPointerDown={(e) => controles.start(e)}
                className="flex shrink-0 touch-none justify-center pb-1 pt-3 sm:hidden"
                aria-hidden
              >
                <span className="h-1 w-10 rounded-full bg-border" />
              </div>

              <div className="shrink-0 px-5 pb-4 pt-3 sm:px-6 sm:pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id={idTitre} className="text-lg font-display text-ink sm:text-xl">
                      {titre}
                    </h2>
                    {sousTitre && <p className="mt-0.5 text-sm text-ink-muted">{sousTitre}</p>}
                  </div>
                  <button
                    onClick={fermer}
                    aria-label="Fermer"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-base hover:text-ink"
                  >
                    <X size={18} />
                  </button>
                </div>
                {entete && <div className="mt-3">{entete}</div>}
              </div>

              {/* Seule zone défilante : bornée par la hauteur de la feuille,
                  donc jamais de contenu hors d'atteinte. */}
              <div
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 ${
                  pied ? "pb-4" : "pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6"
                }`}
              >
                {children}
              </div>

              {pied && (
                <div className="shrink-0 border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-3">
                  {pied}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
