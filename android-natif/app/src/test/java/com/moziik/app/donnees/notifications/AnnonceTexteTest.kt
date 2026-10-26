package com.moziik.app.donnees.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Le découpage des annonces doit donner le même résultat que lib/annonceTexte.ts du site. */
class AnnonceTexteTest {
    private val exemple = "Bonjour à **tous**,\n\nNouveau : *écoute* [hors ligne](/hors-ligne) et [piège](javascript:alert(1)).\n\n- un **point**\n- deux"

    @Test
    fun paragraphes_listes_et_mise_en_forme() {
        val blocs = AnnonceTexte.blocs(exemple)
        assertEquals(3, blocs.size)
        val premier = blocs[0] as Bloc.Paragraphe
        assertEquals(listOf(Morceau.Texte("Bonjour à "), Morceau.Gras(listOf(Morceau.Texte("tous"))), Morceau.Texte(",")), premier.morceaux)
        val second = blocs[1] as Bloc.Paragraphe
        assertTrue(second.morceaux.contains(Morceau.Lien("/hors-ligne", listOf(Morceau.Texte("hors ligne")))))
        assertTrue(second.morceaux.contains(Morceau.Italique(listOf(Morceau.Texte("écoute")))))
        assertEquals(2, (blocs[2] as Bloc.Liste).elements.size)
    }

    @Test
    fun un_lien_dangereux_reste_du_texte() {
        val second = AnnonceTexte.blocs(exemple)[1] as Bloc.Paragraphe
        assertTrue(second.morceaux.none { it is Morceau.Lien && it.adresse.startsWith("javascript") })
        assertEquals(false, AnnonceTexte.adresseAcceptee("//exemple.com"))
        assertEquals(true, AnnonceTexte.adresseAcceptee("https://moziik.mg/a"))
    }

    @Test
    fun texte_brut_comme_le_site() {
        assertEquals(
            "Bonjour à tous,\n\nNouveau : écoute hors ligne et [piège](javascript:alert(1)).\n\n• un point\n• deux",
            AnnonceTexte.texteBrut(exemple),
        )
    }
}
