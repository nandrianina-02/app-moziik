package com.moziik.app.donnees.catalogue

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Mêmes cas que lib/lyrics.ts du site : l'app doit lire les paroles exactement comme lui. */
class ParolesTest {
    @Test
    fun texte_simple_non_synchronise() {
        val p = analyserParoles("Première ligne\n\nDeuxième ligne")
        assertFalse(p.synchronisees)
        assertEquals(listOf("Première ligne", "", "Deuxième ligne"), p.lignes.map { it.texte })
        assertTrue(analyserParoles("  ").vides)
    }

    @Test
    fun lrc_avec_refrain_et_entetes() {
        val p = analyserParoles(
            """
            [ar:Ambondrona]
            [by:Hery R.]
            [00:12.34]Couplet
            [00:20.50][01:02.1]Refrain
            [00:30.00]Suite
            """.trimIndent(),
        )
        assertTrue(p.synchronisees)
        assertEquals("Hery R.", p.credits)
        // Le refrain devient deux lignes, triées par temps.
        assertEquals(listOf("Couplet", "Refrain", "Suite", "Refrain"), p.lignes.map { it.texte })
        assertEquals(12.34, p.lignes[0].temps!!, 1e-9)
        assertEquals(62.1, p.lignes[3].temps!!, 1e-9)
        // Fin d'une ligne = début de la suivante ; la dernière n'en a pas.
        assertEquals(20.5, p.lignes[0].fin!!, 1e-9)
        assertNull(p.lignes[3].fin)
    }

    @Test
    fun milliemes_et_decalage() {
        val p = analyserParoles("[offset:500]\n[00:01.250]Un\n[00:03.000]Deux")
        assertEquals(0.75, p.lignes[0].temps!!, 1e-9)
        assertEquals(2.5, p.lignes[1].temps!!, 1e-9)
    }

    @Test
    fun mot_a_mot() {
        val p = analyserParoles("[00:12.40]<00:12.40>Je <00:12.70>marche <00:13.20>dans\n[00:15.00]Fin")
        val mots = p.lignes[0].mots!!
        assertEquals(listOf("Je", "marche", "dans"), mots.map { it.texte })
        assertEquals("Je marche dans", p.lignes[0].texte)
        // Le dernier mot s'arrête avec la ligne.
        assertEquals(15.0, mots[2].fin!!, 1e-9)
        assertEquals(1, motActif(mots, 12.8))
        assertEquals(-1, motActif(mots, 15.5))
    }

    @Test
    fun ligne_active() {
        val p = analyserParoles("[00:10.00]A\n[00:20.00]B\n[00:30.00]C")
        assertEquals(-1, ligneActive(p.lignes, 5.0))
        assertEquals(0, ligneActive(p.lignes, 10.0))
        assertEquals(1, ligneActive(p.lignes, 29.9))
        assertEquals(2, ligneActive(p.lignes, 400.0))
    }
}
