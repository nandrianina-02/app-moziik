package com.moziik.app.donnees.compte

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Les petites règles du bilan de l'année. */
class BilanTest {
    @Test
    fun le_mois_le_plus_ecoute() {
        assertEquals("mars", moisLePlusEcoute(listOf(1, 2, 9, 0, 0, 0, 0, 0, 0, 0, 0, 3)))
        assertNull(moisLePlusEcoute(List(12) { 0 }))
        assertNull(moisLePlusEcoute(emptyList()))
    }

    @Test
    fun la_duree_passe_en_heures_au_dela_de_deux_heures() {
        assertEquals(20 to "heures", dureeLisible(1234))
        assertEquals(45 to "minutes", dureeLisible(45))
        assertEquals(1 to "minute", dureeLisible(1))
    }

    @Test
    fun l_annee_proposee() {
        assertEquals(2026, anneeDuBilan(2026, 12))
        assertEquals(2025, anneeDuBilan(2026, 10))
    }
}
