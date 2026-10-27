package com.moziik.app.donnees.catalogue

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/** Le blind test : des manches justes, et les points. */
class BlindTestTest {
    private fun t(id: Int, artiste: Int, genre: String = "Pop") =
        Titre(id = "t$id", title = "Titre $id", artist = ArtisteCourt("a$artiste", "Artiste $artiste"), genre = genre)

    @Test
    fun chaque_manche_a_quatre_propositions_d_artistes_differents_dont_la_bonne() {
        val titres = (1..40).map { t(it, it % 15, if (it % 2 == 0) "Pop" else "Salegy") }
        val partie = preparerPartie(titres, Random(7))
        assertEquals(MANCHES, partie.size)
        assertEquals(MANCHES, partie.map { it.reponse.artist?.id }.distinct().size)
        partie.forEach { m ->
            assertEquals(4, m.propositions.size)
            assertTrue(m.reponse in m.propositions)
            assertEquals(4, m.propositions.map { it.artist?.id }.distinct().size)
        }
    }

    @Test
    fun trop_peu_d_artistes_donne_une_partie_plus_courte_mais_juste() {
        val titres = (1..10).map { t(it, it % 4) }
        val partie = preparerPartie(titres, Random(1))
        assertTrue(partie.size <= 4)
        partie.forEach { assertEquals(4, it.propositions.size) }
    }

    @Test
    fun les_points() {
        assertEquals(0, pointsDe(false, 1_000, 3))
        assertEquals(190, pointsDe(true, 1_000, 1))
        assertEquals(100 + 50 * 2, pointsDe(true, 12_000, 3))
        assertEquals(84_000L, debutExtraitMs(240.0))
        assertEquals(20_000L, debutExtraitMs(30.0))
    }
}
