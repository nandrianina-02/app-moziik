"use client";

import { useSidebar } from "@/context/SidebarProvider";
import { usePlayer } from "@/context/PlayerProvider";
import { useClavierVisible } from "@/hooks/useClavierVisible";

/**
 * Les coins arrondis du panneau de contenu, aux bords de l'écran.
 *
 * Le contenu défile avec la page entière (le défilement de la fenêtre, dont
 * dépendent la recherche, les notifications et les menus) : un panneau qui
 * défilerait à l'intérieur de lui-même aurait cassé ces écrans. Le cadre
 * est donc dessiné par-dessus, aux endroits fixes où le panneau rencontre
 * l'en-tête, la barre du bas et le lecteur : chaque bande laisse voir le
 * contenu à travers un rectangle arrondi et peint le reste à la couleur du
 * cadre (ombre portée pleine, sans flou). Elles n'interceptent aucun clic.
 *
 * Le haut du panneau sur ordinateur est l'en-tête lui-même (DesktopHeader).
 */
export function CoinsCadre() {
  const { collapsed, panneauLecture } = useSidebar();
  const { currentSong } = usePlayer();
  const clavierVisible = useClavierVisible();
  // Le panneau « En cours de lecture » prend la droite sur grand écran : le
  // coin du contenu se pose alors à sa gauche.
  const panneauOuvert = panneauLecture && !!currentSong;
  const peinture = "shadow-[0_0_0_48px_var(--cadre)]";

  return (
    <>
      {/* Téléphone : sous l'en-tête. */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-14 z-20 h-6 overflow-hidden md:hidden print:hidden">
        <div className={`absolute inset-x-1.5 top-0 h-12 rounded-t-[20px] ${peinture}`} />
      </div>

      {/* Téléphone : au-dessus du lecteur et de la barre du bas, qui se
          retirent quand le clavier s'ouvre. */}
      {!clavierVisible && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+var(--hauteur-lecteur,0px))] z-20 h-6 overflow-hidden md:hidden print:hidden"
        >
          <div className={`absolute inset-x-1.5 bottom-0 h-12 rounded-b-[20px] ${peinture}`} />
        </div>
      )}

      {/* Ordinateur : le bas du panneau, au-dessus du lecteur, à droite de la barre latérale. */}
      <div
        aria-hidden
        className={`pointer-events-none fixed bottom-[var(--hauteur-lecteur,0px)] right-0 z-20 hidden h-5 overflow-hidden transition-[left] duration-300 ease-out md:block print:hidden ${
          collapsed ? "left-20" : "left-64"
        } ${panneauOuvert ? "xl:right-80" : ""}`}
      >
        <div className={`absolute inset-x-2 bottom-2 h-12 rounded-b-panneau ${peinture}`} />
      </div>
    </>
  );
}
