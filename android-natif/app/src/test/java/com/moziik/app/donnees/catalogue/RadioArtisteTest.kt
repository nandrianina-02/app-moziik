package com.moziik.app.donnees.catalogue

import org.junit.Assert.assertEquals
import org.junit.Test

/** La radio d'un artiste : un de ses titres pour deux découvertes. */
class RadioArtisteTest {
    private fun t(id: String, artiste: String) = Titre(id = id, title = id, artist = ArtisteCourt(artiste, artiste))

    @Test
    fun alterne_un_titre_de_l_artiste_pour_deux_proches() {
        val siens = listOf(t("a1", "A"), t("a2", "A"))
        val proches = listOf(t("b1", "B"), t("b2", "B"), t("c1", "C"), t("c2", "C"))
        assertEquals(listOf("a1", "b1", "b2", "a2", "c1", "c2"), entrelacerRadio(siens, proches).map { it.id })
    }

    @Test
    fun ecarte_l_artiste_des_proches_et_les_doublons() {
        val siens = listOf(t("a1", "A"))
        val proches = listOf(t("a1", "A"), t("a9", "A"), t("b1", "B"), t("b1", "B"))
        assertEquals(listOf("a1", "b1"), entrelacerRadio(siens, proches).map { it.id })
    }

    @Test
    fun une_liste_epuisee_laisse_l_autre_continuer_dans_la_limite() {
        val siens = (1..10).map { t("a$it", "A") }
        assertEquals(4, entrelacerRadio(siens, emptyList(), taille = 4).size)
        assertEquals(listOf("a1", "a2", "a3"), entrelacerRadio(siens.take(3), emptyList()).map { it.id })
    }
}
