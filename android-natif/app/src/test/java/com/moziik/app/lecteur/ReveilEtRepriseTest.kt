package com.moziik.app.lecteur

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.Calendar

/** Le prochain réveil, et les positions gardées des longues écoutes. */
class ReveilEtRepriseTest {
    /** Lundi 2 novembre 2026 à `h`:`m`, heure du téléphone. */
    private fun lundi(h: Int, m: Int): Long = Calendar.getInstance().apply {
        clear()
        set(2026, Calendar.NOVEMBER, 2, h, m)
    }.timeInMillis

    @Test
    fun le_reveil_sonne_aujourd_hui_s_il_est_encore_temps_sinon_le_jour_voulu_suivant() {
        assertEquals(1, jourDe(Calendar.getInstance().apply { timeInMillis = lundi(8, 0) }))
        // Lundi 6 h, réveil à 7 h tous les jours : aujourd'hui.
        assertEquals(lundi(7, 0), prochainReveil(lundi(6, 0), 7 * 60, emptySet()))
        // Lundi 8 h, réveil à 7 h du lundi au vendredi : mardi.
        assertEquals(lundi(7, 0) + 86_400_000L, prochainReveil(lundi(8, 0), 7 * 60, setOf(1, 2, 3, 4, 5)))
        // Lundi 8 h, réveil le samedi seulement : cinq jours plus tard.
        assertEquals(lundi(7, 0) + 5 * 86_400_000L, prochainReveil(lundi(8, 0), 7 * 60, setOf(6)))
        assertNull(prochainReveil(lundi(8, 0), 24 * 60, emptySet()))
    }

    @Test
    fun seule_une_longue_ecoute_entamee_et_pas_finie_est_gardee() {
        val longue = 45 * 60_000L
        var liste = retenirPosition(emptyList(), "a", 10 * 60_000L, longue, 1)
        assertEquals(10 * 60_000L, liste.single().positionMs)
        // Un titre court n'est pas gardé.
        assertEquals(liste, retenirPosition(liste, "b", 60_000L, 4 * 60_000L, 2))
        // Fini (dans les 30 dernières secondes) : la position est oubliée.
        liste = retenirPosition(liste, "a", longue - 10_000L, longue, 3)
        assertEquals(emptyList<PositionLongue>(), liste)
    }
}
