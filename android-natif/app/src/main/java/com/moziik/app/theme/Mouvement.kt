package com.moziik.app.theme

import androidx.compose.animation.core.CubicBezierEasing

/**
 * Les mouvements du site (app/globals.css, framer-motion), repris tels
 * quels : courts, discrets, jamais décoratifs. L'app suit en plus le réglage
 * d'animation de l'appareil (échelle de durée du système).
 */
object Mouvement {
    /** cubic-bezier(0.16, 1, 0.3, 1) : entrée de page, tiroir, cascades. */
    val sortieDouce = CubicBezierEasing(0.16f, 1f, 0.3f, 1f)
    /** cubic-bezier(0.4, 0, 0.2, 1) : carrousel. */
    val standard = CubicBezierEasing(0.4f, 0f, 0.2f, 1f)

    /** Entrée de page : opacité et 6 dp de montée. */
    const val ENTREE_PAGE = 280
    /** Apparition d'un élément de liste ou de grille. */
    const val APPARITION = 450
    /** Décalage entre deux éléments d'une cascade, plafonné au 9e. */
    const val CASCADE_PAS = 40
    const val CASCADE_MAX = 320
    /** Appui sur un élément pressable. */
    const val APPUI = 140
    const val TIROIR = 300
    const val VOILE = 250
    /** Cycle de l'égaliseur, seule animation en boucle avec les squelettes. */
    const val EGALISEUR = 900
}
