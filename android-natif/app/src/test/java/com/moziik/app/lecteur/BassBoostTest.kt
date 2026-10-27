package com.moziik.app.lecteur

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sin

/** Le Bass Boost : la courbe du site, la transparence à Off, et jamais de saturation. */
class BassBoostTest {
    private val fs = 44_100

    private fun courbe(n: NiveauBass, f: Double): Double =
        Cloche(FREQ_POIDS, Q_POIDS, n.poidsDb, fs).reponseDb(f, fs) +
            Cloche(FREQ_PROFONDEUR, Q_PROFONDEUR, n.profondeurDb, fs).reponseDb(f, fs) +
            Cloche(FREQ_CLARTE, Q_CLARTE, n.clarteDb, fs).reponseDb(f, fs)

    @Test
    fun la_courbe_profond_suit_celle_mesuree_sur_le_site() {
        // Site, niveau Profond : 50 Hz +10.0, 60 Hz +9.9, 80 Hz +9.0, 400 Hz −2.2, ≥1 kHz ~0 (à ±1,5 dB).
        assertEquals(10.0, courbe(NiveauBass.PROFOND, 50.0), 1.5)
        assertEquals(9.9, courbe(NiveauBass.PROFOND, 60.0), 1.5)
        assertEquals(9.0, courbe(NiveauBass.PROFOND, 80.0), 1.5)
        assertEquals(-2.2, courbe(NiveauBass.PROFOND, 400.0), 1.5)
        assertEquals(0.0, courbe(NiveauBass.PROFOND, 2_000.0), 0.6)
        // L'infra-basse reste presque intacte : pas de marge gaspillée à 16 Hz.
        assertTrue(courbe(NiveauBass.PROFOND, 16.0) < 2.0)
    }

    @Test
    fun off_ne_touche_a_rien() {
        val chaine = ChaineBasses().apply { configurer(fs, 2) }
        val son = FloatArray(400) { sin(it * 0.1).toFloat() * 0.5f }
        val copie = son.copyOf()
        chaine.traiter(son)
        assertArrayEquals(copie, son, 0f)
    }

    @Test
    fun tres_profond_sur_un_master_a_fond_ne_sature_jamais() {
        val chaine = ChaineBasses().apply {
            configurer(fs, 2)
            niveau = NiveauBass.TRES_PROFOND
        }
        // Une seconde de 55 Hz à pleine échelle, en stéréo : le pire cas pour un renfort de grave.
        val son = FloatArray(fs * 2) { i -> sin(2 * PI * 55.0 * (i / 2) / fs).toFloat() }
        chaine.traiter(son)
        val crete = son.maxOf { abs(it) }
        assertTrue("crête $crete", crete <= PLAFOND + 1e-4f)
        // Et le grave a bien été renforcé : le limiteur tient la crête, il n'écrase pas le signal.
        assertTrue(crete > 0.8f)
    }
}
