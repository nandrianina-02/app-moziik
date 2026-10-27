package com.moziik.app.lecteur

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/** Le Bass Boost : la courbe du site, un grave plus profond dans l'app, et jamais de saturation. */
class BassBoostTest {
    private val fs = 44_100

    private fun courbe(r: ReglageBasses, f: Double): Double =
        Biquad.cloche(FREQ_POIDS, Q_POIDS, r.poidsDb, fs).reponseDb(f, fs) +
            Biquad.cloche(r.freqProfondeur, r.qProfondeur, r.profondeurDb, fs).reponseDb(f, fs) +
            Biquad.cloche(FREQ_SUB, Q_SUB, r.subDb, fs).reponseDb(f, fs) +
            Biquad.cloche(FREQ_CLARTE, Q_CLARTE, r.clarteDb, fs).reponseDb(f, fs)

    @Test
    fun les_cloches_de_profond_suivent_la_courbe_mesuree_sur_le_site() {
        // Site, niveau Profond : 50 Hz +10.0, 60 Hz +9.9, 80 Hz +9.0, 400 Hz −2.2, ≥1 kHz ~0.
        val r = NiveauBass.PROFOND.reglage!!
        assertEquals(10.0, courbe(r, 50.0), 0.3)
        assertEquals(9.9, courbe(r, 60.0), 0.3)
        assertEquals(9.0, courbe(r, 80.0), 0.3)
        assertEquals(-2.2, courbe(r, 400.0), 0.3)
        assertEquals(0.0, courbe(r, 2_000.0), 0.3)
    }

    @Test
    fun l_app_descend_plus_bas_que_le_site() {
        // À 30 Hz, le Profond du site monte de 4 dB ; Très profond et Extrême de l'app vont bien au-delà.
        val site = courbe(NiveauBass.PROFOND.reglage!!, 30.0)
        assertTrue(courbe(NiveauBass.TRES_PROFOND.reglage!!, 30.0) > site + 3)
        assertTrue(courbe(NiveauBass.EXTREME.reglage!!, 30.0) > site + 6)
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
    fun extreme_sur_un_master_a_fond_ne_sature_jamais() {
        for (niveau in listOf(NiveauBass.TRES_PROFOND, NiveauBass.EXTREME)) {
            val chaine = ChaineBasses().apply {
                configurer(fs, 2)
                reglage = niveau.reglage!!
            }
            // Une seconde de 40 Hz à pleine échelle, en stéréo : le pire cas pour un renfort de grave.
            val son = FloatArray(fs * 2) { i -> sin(2 * PI * 40.0 * (i / 2) / fs).toFloat() }
            chaine.traiter(son)
            val crete = son.maxOf { abs(it) }
            assertTrue("$niveau crête $crete", crete <= PLAFOND + 1e-4f)
            assertTrue(crete > 0.8f)
        }
    }

    /** L'amplitude de la composante à `f` (corrélation sur un nombre entier de périodes, canal gauche). */
    private fun composante(son: FloatArray, f: Double): Double {
        var re = 0.0
        var im = 0.0
        val n = son.size / 2
        val debut = n / 2
        for (k in debut until n) {
            val t = 2 * PI * f * k / fs
            re += son[2 * k] * cos(t)
            im += son[2 * k] * sin(t)
        }
        return 2 * sqrt(re * re + im * im) / (n - debut)
    }

    @Test
    fun les_harmoniques_font_entendre_le_grave_au_dessus_de_100_hz() {
        // Un 50 Hz pur, discret : sans harmoniques, rien à 100 Hz ; avec, une composante nette.
        fun essai(harmoniques: Float): Double {
            val chaine = ChaineBasses().apply {
                configurer(fs, 2)
                reglage = ReglageBasses.personnalise(0f, harmoniques)
            }
            val son = FloatArray(fs * 2) { i -> (0.2 * sin(2 * PI * 50.0 * (i / 2) / fs)).toFloat() }
            chaine.traiter(son)
            return composante(son, 100.0)
        }
        assertTrue(essai(0.01f) < 0.01)
        assertTrue(essai(1f) > 0.03)
    }

    @Test
    fun le_reglage_personnalise_suit_ses_curseurs() {
        assertTrue(ReglageBasses.personnalise(0f, 0f).neutre)
        val fort = ReglageBasses.personnalise(14f, 0.5f)
        assertEquals(14.0, fort.poidsDb, 0.0)
        assertTrue(fort.subDb > 0 && fort.preGainDb < -6)
        assertEquals(PUISSANCE_MAX, ReglageBasses.personnalise(40f, 0f).poidsDb, 0.0)
    }
}
