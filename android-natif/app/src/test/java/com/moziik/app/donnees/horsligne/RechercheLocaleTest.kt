package com.moziik.app.donnees.horsligne

import com.moziik.app.donnees.catalogue.ArtisteCourt
import com.moziik.app.donnees.catalogue.Titre
import org.junit.Assert.assertEquals
import org.junit.Test

/** La recherche sans réseau, dans les titres téléchargés. */
class RechercheLocaleTest {
    private fun t(id: String, titre: String, artiste: String) = Titre(id = id, title = titre, artist = ArtisteCourt("a$id", artiste))

    private val titres = listOf(
        t("1", "Raha ny olon-tiana", "Levelo"),
        t("2", "Deuxième Bureau", "TCHI UR ACHE"),
        t("3", "Mafy", "Thiera Bruno"),
        t("4", "Mila namana", "Thiera Bruno"),
    )

    @Test
    fun sans_accents_ni_casse_ni_tirets() {
        assertEquals(listOf("1"), rechercheLocale(titres, "OLON TIANA").map { it.id })
        assertEquals(listOf("2"), rechercheLocale(titres, "deuxieme bureau").map { it.id })
    }

    @Test
    fun le_nom_de_l_artiste_compte_et_le_debut_du_titre_passe_en_tete() {
        assertEquals(listOf("3", "4"), rechercheLocale(titres, "thiera").map { it.id })
        assertEquals(listOf("4"), rechercheLocale(titres, "mila").map { it.id })
        assertEquals(emptyList<String>(), rechercheLocale(titres, "zzz").map { it.id })
    }
}
