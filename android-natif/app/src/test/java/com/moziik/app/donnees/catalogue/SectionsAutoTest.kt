package com.moziik.app.donnees.catalogue

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Les sections que l'app compose seule, sur des listes de titres comme celles de /api/songs. */
class SectionsAutoTest {
    private val maintenant = 1_792_540_800_000L // 21 octobre 2026, 00:00 UTC
    private val jour = SectionsAuto.jour(maintenant)

    private fun titre(
        n: Int,
        artiste: String = "a$n",
        genre: String? = "Afrobeat",
        date: String = "2026-01-01T00:00:00.000Z",
        ecoutes: Int = 0,
        aimes: Int = 0,
        verifie: Boolean = false,
        statut: String? = "published",
    ) = Titre(
        id = "t$n", title = "Titre $n", artist = ArtisteCourt(artiste, "Nom $artiste", verifie), genre = genre,
        releaseDate = date, playsCount = ecoutes, likesCount = aimes, status = statut,
    )

    @Test
    fun la_semaine_seulement_si_elle_a_assez_de_sorties() {
        val recentes = (1..6).map { titre(it, date = "2026-10-${14 + it}T00:00:00.000Z") }
        val semaine = SectionsAuto.composer(MatiereAuto(recentes, emptyList()), jour, maintenant)
            .first() as Section.Titres
        assertEquals("Nouveautés de la semaine", semaine.titre)
        assertTrue(semaine.liste)

        val anciennes = (1..6).map { titre(it, date = "2026-08-01T00:00:00.000Z") }
        val dernieres = SectionsAuto.composer(MatiereAuto(anciennes, emptyList()), jour, maintenant).first() as Section.Titres
        assertEquals("Dernières sorties", dernieres.titre)
    }

    @Test
    fun un_brouillon_n_entre_dans_aucune_section() {
        val titres = (1..10).map { titre(it, statut = if (it == 1) "draft" else "published", aimes = 3) }
        val sections = SectionsAuto.composer(MatiereAuto(titres, titres), jour, maintenant)
        val ids = sections.filterIsInstance<Section.Titres>().flatMap { it.titres }.map { it.id }
        assertFalse("t1" in ids)
    }

    @Test
    fun une_selection_par_genre_assez_fourni_et_jamais_autre() {
        val populaires = (1..5).map { titre(it, genre = "Pop") } + (6..10).map { titre(it, genre = "Autre") } + (11..12).map { titre(it, genre = "Zouk") }
        val sections = SectionsAuto.composer(MatiereAuto(emptyList(), populaires), jour, maintenant)
        val genres = sections.filter { it.cle.startsWith("auto-genre-") }
        assertEquals(listOf("Sélection Pop"), genres.map { it.titre })
        assertEquals(Cible.Titres("Pop"), (genres.single() as Section.Titres).voirTout)
    }

    @Test
    fun l_artiste_a_l_honneur_tourne_chaque_jour() {
        val titres = (1..3).map { titre(it, artiste = "x") } + (4..6).map { titre(it, artiste = "y") } + titre(7, artiste = "z")
        val premier = SectionsAuto.artisteALHonneur(titres, emptyList(), jour)
        val lendemain = SectionsAuto.artisteALHonneur(titres, emptyList(), jour + 1)
        assertNotNull(premier)
        assertTrue(premier!!.id in setOf("x", "y"))
        assertTrue(premier.id != lendemain?.id)
        // Moins de trois titres : personne.
        assertNull(SectionsAuto.artisteALHonneur(listOf(titre(1, artiste = "z")), emptyList(), jour))
    }

    @Test
    fun les_artistes_en_herbe_sont_les_non_verifies_les_plus_recents() {
        val recents = listOf(titre(1, artiste = "v", verifie = true), titre(2, artiste = "h1"), titre(3, artiste = "h1"), titre(4, artiste = "h2"))
        assertEquals(listOf("h1", "h2"), SectionsAuto.artistesEnHerbe(recents).map { it.id })
    }

    @Test
    fun un_album_vide_n_est_pas_propose() {
        val albums = listOf(
            AlbumCourt("a1", "Plein", pistes = kotlinx.serialization.json.JsonArray(listOf(kotlinx.serialization.json.JsonPrimitive("t1")))),
            AlbumCourt("a2", "Vide", pistes = kotlinx.serialization.json.JsonArray(emptyList())),
            AlbumCourt("a3", "Inconnu"),
            AlbumCourt("a4", "Autre plein", pistes = kotlinx.serialization.json.JsonArray(listOf(kotlinx.serialization.json.JsonPrimitive("t2")))),
        )
        val section = SectionsAuto.composer(MatiereAuto(emptyList(), emptyList(), albums), jour, maintenant)
            .filterIsInstance<Section.Albums>().single()
        assertEquals(listOf("a1", "a3", "a4"), section.albums.map { it.id })
    }

    @Test
    fun entrelacer_garde_l_ordre_de_l_administration() {
        val admin = (1..4).map { Section.Titres("admin$it", "A$it", emptyList()) }
        val auto = (1..5).map { Section.Titres("auto$it", "B$it", emptyList()) }
        val cles = SectionsAuto.entrelacer(admin, auto).map { it.cle }
        assertEquals(listOf("admin1", "admin2", "auto1", "admin3", "auto2", "admin4", "auto3", "auto4", "auto5"), cles)
        assertEquals(admin, SectionsAuto.entrelacer(admin, emptyList()))
    }

    @Test
    fun au_plus_six_sections_qui_tournent_chaque_jour() {
        val candidates = listOf("a", "b", "c", "d", "e", "f", "g", "h")
        assertEquals(listOf("a", "b", "c"), SectionsAuto.tournantes(candidates, 3, 0))
        // Le départ avance d'un rang par jour ; l'ordre d'origine est gardé.
        assertEquals(listOf("a", "g", "h"), SectionsAuto.tournantes(candidates, 3, 6))
        assertEquals(candidates.take(2), SectionsAuto.tournantes(candidates.take(2), 5, 3))
        assertEquals(emptyList<String>(), SectionsAuto.tournantes(candidates, 0, 1))
    }

    @Test
    fun les_genres_choisis_passent_en_tete() {
        val pop = (1..4).map { titre(it, genre = "Pop") } + (5..8).map { titre(it, genre = "Rap") } + (9..14).map { titre(it, genre = "Salegy") }
        val sections = SectionsAuto.composer(MatiereAuto(emptyList(), pop, genresPreferes = setOf("rap")), jour = 0, maintenant = 0L)
        val genres = sections.filter { it.cle.startsWith("auto-genre-") }.map { it.titre }
        assertEquals("Sélection Rap", genres.first())
    }
}
