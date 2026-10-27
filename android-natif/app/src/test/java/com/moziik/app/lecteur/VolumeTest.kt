package com.moziik.app.lecteur

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Le volume égal entre les titres et le fondu. */
class VolumeTest {
    @Test
    fun un_titre_fort_est_baisse_un_titre_doux_reste_tel_quel() {
        // −9 LUFS (master très fort) : baissé de 8 dB.
        assertEquals(0.398f, gainNormalisation(-9.0, actif = true), 0.005f)
        assertEquals(1f, gainNormalisation(-22.0, actif = true), 0f)
        assertEquals(1f, gainNormalisation(-9.0, actif = false), 0f)
        // Jamais plus de 15 dB de baisse, et un titre non mesuré est traité comme un master fort.
        assertEquals(0.178f, gainNormalisation(10.0, actif = true), 0.005f)
        assertTrue(gainNormalisation(null, actif = true) < 1f)
    }

    @Test
    fun le_fondu_descend_en_fin_de_titre_et_remonte_au_suivant() {
        val d = 4_000L
        assertEquals(1f, facteurFondu(60_000, 200_000, d, finVersUnAutre = true, debutDepuisUnAutre = true), 0f)
        assertEquals(0f, facteurFondu(200_000, 200_000, d, finVersUnAutre = true, debutDepuisUnAutre = false), 0f)
        assertEquals(0.5f, facteurFondu(198_000, 200_000, d, finVersUnAutre = true, debutDepuisUnAutre = false), 0.001f)
        assertEquals(0f, facteurFondu(0, 200_000, d, finVersUnAutre = false, debutDepuisUnAutre = true), 0f)
    }

    @Test
    fun pas_de_fondu_dans_un_album_ni_reglage_coupe() {
        assertEquals(1f, facteurFondu(199_000, 200_000, 4_000, finVersUnAutre = false, debutDepuisUnAutre = false), 0f)
        assertEquals(1f, facteurFondu(199_000, 200_000, 0, finVersUnAutre = true, debutDepuisUnAutre = true), 0f)
    }
}
