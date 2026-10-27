package com.moziik.app.lecteur

import com.moziik.app.donnees.catalogue.Titre
import org.junit.Assert.assertEquals
import org.junit.Test

/** Les modes de suite de lecture. */
class ModeSuiteTest {
    private fun t(id: String, bpm: Double? = null, ecoutes: Int = 0) = Titre(id = id, title = id, bpm = bpm, playsCount = ecoutes)

    @Test
    fun meme_rythme_trie_par_tempo_proche_et_ecarte_l_inconnu() {
        val candidats = listOf(t("a", 120.0), t("b", 101.0), t("c", null), t("d", 97.0), t("e", 0.0), t("f", 104.0))
        assertEquals(listOf("d", "b", "f"), parRythme(100.0, candidats).map { it.id })
    }

    @Test
    fun decouverte_les_moins_ecoutes_d_abord() {
        assertEquals(listOf("y", "z", "x"), parDecouverte(listOf(t("x", ecoutes = 50), t("y", ecoutes = 0), t("z", ecoutes = 3))).map { it.id })
    }

    @Test
    fun un_mode_inconnu_revient_a_la_meme_ambiance() {
        assertEquals(ModeSuite.RYTHME, ModeSuite.de("rythme"))
        assertEquals(ModeSuite.AMBIANCE, ModeSuite.de(null))
        assertEquals(ModeSuite.AMBIANCE, ModeSuite.de("inconnu"))
    }
}
