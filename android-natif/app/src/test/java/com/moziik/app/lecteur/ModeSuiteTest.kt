package com.moziik.app.lecteur

import com.moziik.app.donnees.catalogue.ArtisteCourt
import com.moziik.app.donnees.catalogue.Titre
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/** La suite automatique : ressemblance, mélange, diversité. */
class ModeSuiteTest {
    private fun t(
        id: String,
        bpm: Double? = null,
        genre: String? = null,
        annee: Int? = null,
        ecoutes: Int = 0,
        artiste: String = "a$id",
    ) = Titre(
        id = id, title = id, bpm = bpm, genre = genre, playsCount = ecoutes,
        releaseDate = annee?.let { "$it-01-01T00:00:00.000Z" }, artist = ArtisteCourt(artiste, artiste),
    )

    @Test
    fun meme_rythme_trie_par_tempo_proche_et_ecarte_l_inconnu() {
        val candidats = listOf(t("a", 120.0), t("b", 101.0), t("c", null), t("d", 97.0), t("e", 0.0), t("f", 104.0))
        assertEquals(listOf("b", "d", "f"), parRythme(100.0, candidats).map { it.id })
    }

    @Test
    fun le_titre_le_plus_ressemblant_a_la_meilleure_note() {
        val ref = t("ref", 100.0, "Salegy", 2020)
        val proche = t("p", 102.0, "Salegy", 2021)
        val loin = t("l", 150.0, "Gospel", 1995)
        assertTrue(noteSuite(ref, proche, emptySet(), 0) > noteSuite(ref, loin, emptySet(), 0) + 5)
        // « Autre » n'est pas un genre commun : il ne rapproche pas deux titres.
        assertEquals(0.0, noteSuite(t("r", genre = "Autre"), t("x", genre = "Autre"), emptySet(), 0), 0.0)
    }

    @Test
    fun le_melange_privilegie_la_ressemblance_sans_qu_un_artiste_domine() {
        val ref = t("ref", 100.0, "Salegy", 2020)
        val memeArtiste = (1..6).map { t("m$it", 100.0, "Salegy", 2020, artiste = "x") }
        val autres = (1..6).map { t("o$it", 160.0, "Gospel", 1990) }
        val suite = melangeSuite(ref, memeArtiste + autres, emptySet(), Random(3))
        assertEquals(3, suite.count { it.artist?.id == "x" })
        assertTrue(suite.take(3).all { it.artist?.id == "x" })
    }
}
