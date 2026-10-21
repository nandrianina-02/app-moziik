package com.moziik.app.ui.composants

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Les calculs d'affichage des cartes : compteurs courts et teinte des pastilles. */
class AffichageTest {
    @Test
    fun nombres_courts_comme_sous_les_cartes() {
        assertEquals("48", nombreCourt(48))
        assertEquals("1,93 k", nombreCourt(1_930))
        assertEquals("7,7 k", nombreCourt(7_700))
        assertEquals("1 k", nombreCourt(1_000))
        assertEquals("64,3 k", nombreCourt(64_300))
        assertEquals("10 k", nombreCourt(10_000))
        assertEquals("1,2 M", nombreCourt(1_200_000))
    }

    private fun canaux(argb: Int) = Triple((argb shr 16) and 0xFF, (argb shr 8) and 0xFF, argb and 0xFF)

    @Test
    fun une_pochette_rouge_donne_une_pastille_rouge_sombre() {
        val (r, g, b) = canaux(teinteDePochette(IntArray(100) { 0xFFE0302A.toInt() }))
        assertTrue("rouge dominant : $r $g $b", r > g && r > b)
        // Assez sombre pour l'icône blanche.
        assertTrue(r < 140)
    }

    @Test
    fun la_teinte_franche_l_emporte_sur_le_fond_neutre() {
        // Un fond gris presque partout, un motif bleu : la pastille est bleue.
        val pixels = IntArray(100) { if (it < 30) 0xFF2050E0.toInt() else 0xFF808080.toInt() }
        val (r, g, b) = canaux(teinteDePochette(pixels))
        assertTrue("bleu dominant : $r $g $b", b > r && b > g)
    }

    @Test
    fun une_pochette_en_noir_et_blanc_donne_un_gris() {
        val pixels = IntArray(100) { if (it % 2 == 0) 0xFF000000.toInt() else 0xFFFFFFFF.toInt() }
        val (r, g, b) = canaux(teinteDePochette(pixels))
        assertEquals(r, g)
        assertEquals(g, b)
    }
}
