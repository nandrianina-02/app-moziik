package com.moziik.app.donnees.catalogue

import com.moziik.app.donnees.reseau.JsonMoziik
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CatalogueTest {
    private val site = "https://app-moziik.vercel.app/"

    @Test
    fun liens_du_site() {
        val id = "6ad74ee7f014c8c15b99fdaa"
        assertEquals(Cible.DeTitre(id), cibleDe("/son/$id", site))
        assertEquals(Cible.DAlbum(id), cibleDe("${site}album/$id", site))
        assertEquals(Cible.DePlaylist(id), cibleDe("/playlist/$id?partage=1", site))
        assertEquals(Cible.DArtiste(id), cibleDe("/artiste/$id", site))
        // Les pages de l'espace artiste ne sont pas des fiches.
        assertEquals(Cible.Inconnue, cibleDe("/artiste/gestion", site))
        assertEquals(Cible.Titres("Hip-Hop"), cibleDe("/titres?genre=Hip-Hop", site))
        assertEquals(Cible.Titres(null), cibleDe("/titres", site))
        assertEquals(Cible.Classements("artists", null), cibleDe("/classements?type=artists", site))
        assertEquals(Cible.Radio("genre:Jazz"), cibleDe("/radio?station=genre%3AJazz", site))
        assertEquals(Cible.Evenements, cibleDe("/evenements", site))
        assertEquals(Cible.DEvenement(id), cibleDe("/evenements/$id", site))
        assertEquals(Cible.DeMembre("ana.r"), cibleDe("/membre/ana.r", site))
        assertEquals(Cible.DeBlend("ana.r"), cibleDe("${site}blend/ana.r", site))
        assertEquals(Cible.Amis, cibleDe("/amis", site))
        assertEquals(Cible.Inconnue, cibleDe("/membre", site))
        assertEquals(Cible.DePlaylist(id, "aB3_x-9"), cibleDe("/playlist/$id/rejoindre?jeton=aB3_x-9", site))
        assertEquals(Cible.DePlaylist(id), cibleDe("/playlist/$id/rejoindre", site))
        assertEquals(Cible.DeRecherche("chill vibes"), cibleDe("/recherche?q=chill%20vibes", site))
        assertEquals(Cible.Ancre("recommendations"), cibleDe("#recommendations", site))
        assertEquals(Cible.Externe("https://www.facebook.com/moziik"), cibleDe("https://www.facebook.com/moziik", site))
        assertEquals(Cible.Inconnue, cibleDe("/admin/titres", site))
        assertEquals(Cible.Inconnue, cibleDe("/son/pas-un-id", site))
    }

    /** Extrait réel de /api/homepage : formes de `data` différentes selon la clé. */
    private val accueil = """
        {"hero":[{"source":"new_release","contentType":"song","song":{"_id":"s1","title":"Fanamby","artist":{"_id":"a1","stageName":"Ambondrona","verified":true},"album":"al1","duration":285,"status":"published"}}],
         "sections":[
          {"key":"top_tracks","title":"Top des titres","data":[{"_id":"s2","title":"MAMELA","artist":{"_id":"a2","stageName":"Boy Black","verified":true},"duration":231,"status":"published"}]},
          {"key":"new_releases","title":"Nouveautés","data":[{"_id":"s1","title":"Fanamby","artist":{"_id":"a1","stageName":"Ambondrona"},"album":"al1","duration":285.4,"bpm":118,"status":"published"},{"_id":"s3","title":"Brouillon","status":"draft"}]},
          {"key":"recently_played","title":"Écoutes récemment","data":[]},
          {"key":"for_you","title":"Pour vous","data":[{"_id":"f1","title":"Daily Mix","badge":"02","coverUrl":"/media/x","linkHref":"#recommendations"}]},
          {"key":"genres","title":"Ambiances pour toi","data":[{"genre":"Afrobeat","count":307}]},
          {"key":"events","title":"Évènements","data":{"upcomingCount":0,"events":[]}},
          {"key":"radio","title":"Radio Moziik","data":{"active":true}},
          {"key":"custom","title":"Les sélections de la semaine","data":[{"contentType":"playlist","_id":"/playlist/p1","title":"Les plus recherchés","href":"/playlist/p1"}]},
          {"key":"albums","title":"Albums populaires","data":[{"_id":"al1","title":"Valise","artist":{"_id":"a3","stageName":"Ljo","verified":true},"type":"album","songs":[{"_id":"x","playsCount":0}]}]}
         ]}
    """.trimIndent()

    @Test
    fun sections_de_l_accueil() {
        val sections = sectionsDe(JsonMoziik.decodeFromString(Accueil.serializer(), accueil))
        // Vides et sans rendu écartées ; le palmarès passe après le flux principal.
        assertEquals(listOf("new_releases", "for_you", "genres", "custom", "albums", "top_tracks"), sections.map { it.cle })
        val nouveautes = sections[0] as Section.Titres
        assertEquals(listOf("s1"), nouveautes.titres.map { it.id })
        assertEquals(285.4, nouveautes.titres[0].duration, 0.0)
        assertEquals("Ljo", (sections[4] as Section.Albums).albums[0].artist?.stageName)
    }

    /**
     * Relevé en production : la diapositive d'une playlist donne son
     * propriétaire par son seul identifiant. Elle faisait échouer tout
     * l'accueil ; une diapositive illisible ne doit plus rien bloquer.
     */
    @Test
    fun banniere_tolerante() {
        val reponse = JsonMoziik.decodeFromString(
            Accueil.serializer(),
            """
            {"hero":[
              {"source":"playlist","contentType":"playlist","playlist":{"_id":"p1","title":"Douceur du soir","owner":"u1","songs":["s1"]}},
              {"source":"pinned","contentType":"album","album":{"_id":"al1"}},
              {"source":"popular","contentType":"song","song":{"_id":"s2","title":"HIALAO","duration":202}}
             ],
             "sections":[]}
            """.trimIndent(),
        )
        val diapos = diaposDe(reponse)
        // L'album sans titre est écarté, les deux autres restent.
        assertEquals(listOf("playlist", "song"), diapos.map { it.contentType })
        assertEquals("Douceur du soir", diapos[0].playlist?.title)
    }

    @Test
    fun stations_de_la_radio() {
        assertEquals("Jazz", resoudreStation("jazz")?.libelle)
        assertEquals(SourceStation.DeGenre("Salegy"), resoudreStation("genre:Salegy")?.source)
        assertEquals(null, resoudreStation("inconnue"))
        assertEquals(null, resoudreStation("genre:"))
    }

    @Test
    fun artiste_reduit_a_son_identifiant() {
        val titre = JsonMoziik.decodeFromString(Titre.serializer(), """{"_id":"s1","title":"Piste","artist":"a1","duration":200}""")
        assertEquals(ArtisteCourt("a1"), titre.artist)
    }

    @Test
    fun resultats_de_recherche() {
        val reponse = JsonMoziik.decodeFromString(
            ReponseRecherche.serializer(),
            """
            {"q":"ljo","top":{"kind":"artist","_id":"a3","stageName":"Ljo","verified":true,"followers":4},
             "sections":[
              {"key":"songs","title":"Titres","kind":"song","items":[{"_id":"s1","title":"Valise","artist":{"_id":"a3","stageName":"Ljo"},"duration":200}],"total":12,"tronque":true},
              {"key":"users","title":"Membres","kind":"user","items":[{"_id":"u1","name":"Ana"}],"total":1},
              {"key":"genres","title":"Genres","kind":"genre","items":[{"_id":"g","name":"Afrobeat","count":3}],"total":1}
             ],
             "approximatif":false}
            """.trimIndent(),
        )
        val resultats = resultatsDe(reponse)
        assertTrue(resultats.meilleur is Resultat.DArtiste)
        // Les membres attendent leur écran : leur section n'est pas affichée.
        assertEquals(listOf("songs", "genres"), resultats.sections.map { it.cle })
        assertEquals(12, resultats.sections[0].total)
        assertEquals(Resultat.DeGenre("Afrobeat", 3), resultats.sections[1].resultats[0])
    }
}
