package com.moziik.app.lecteur

import com.moziik.app.donnees.catalogue.ArtisteCourt
import com.moziik.app.donnees.catalogue.Titre
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CompteurEcouteTest {
    private val compteur = CompteurEcoute()

    @Test
    fun moins_de_trente_secondes_ne_compte_pas() {
        compteur.demarrer("a", 200.0, enLecture = true, maintenant = 0)
        assertNull(compteur.terminer(29_999))
    }

    @Test
    fun ecoute_partielle_declaree_non_complete() {
        compteur.demarrer("a", 200.0, enLecture = true, maintenant = 0)
        assertEquals(EcouteFinie("a", 45, false), compteur.terminer(45_000))
    }

    @Test
    fun les_pauses_ne_comptent_pas() {
        compteur.demarrer("a", 100.0, enLecture = true, maintenant = 0)
        compteur.lecture(false, 50_000)
        // Dix minutes de pause : rien ne s'ajoute.
        compteur.lecture(true, 650_000)
        assertEquals(EcouteFinie("a", 80, true), compteur.terminer(680_000))
    }

    @Test
    fun complete_a_quatre_vingts_pour_cent() {
        compteur.demarrer("a", 100.0, enLecture = false, maintenant = 0)
        compteur.lecture(true, 1_000)
        assertEquals(EcouteFinie("a", 79, false), compteur.terminer(80_999))
        compteur.demarrer("b", 100.0, enLecture = true, maintenant = 0)
        assertEquals(true, compteur.terminer(80_000)?.complete)
    }

    @Test
    fun duree_inconnue_jamais_complete() {
        compteur.demarrer("a", 0.0, enLecture = true, maintenant = 0)
        assertEquals(EcouteFinie("a", 300, false), compteur.terminer(300_000))
    }

    @Test
    fun une_seule_declaration_par_ecoute() {
        compteur.demarrer("a", 100.0, enLecture = true, maintenant = 0)
        compteur.terminer(90_000)
        assertNull(compteur.terminer(120_000))
    }

    @Test
    fun suite_sans_brouillon_ni_deja_vu() {
        val titres = listOf(
            Titre("1", "Un", ArtisteCourt("x")),
            Titre("2", "Deux", status = "draft"),
            Titre("3", "Trois"),
            Titre("3", "Trois bis"),
            Titre("4", "Quatre"),
        )
        assertEquals(listOf("3", "4"), retenirSuite(titres, exclus = setOf("1")).map { it.id })
        assertEquals(listOf("3"), retenirSuite(titres, exclus = setOf("1"), maximum = 1).map { it.id })
    }
}
