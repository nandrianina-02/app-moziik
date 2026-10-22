package com.moziik.app.donnees.catalogue

import com.moziik.app.donnees.notifications.PageAvis
import com.moziik.app.donnees.reseau.JsonMoziik
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Les réponses de /api/events/{id} et /api/notifications, telles que le site les écrit. */
class EvenementTest {
    @Test
    fun une_fiche_remplie_au_minimum_se_lit() {
        val e = JsonMoziik.decodeFromString(
            ReponseEvenement.serializer(),
            """{"event":{"_id":"e1","title":"Concert","date":"2026-12-12T15:00:00.000Z","location":"Antsahamanitra","status":"published","interestedCount":3,"viewerInterested":false}}""",
        ).event
        assertEquals("Concert", e.title)
        assertTrue(e.program.isEmpty())
        assertNull(e.organizer)
        assertEquals(3, e.interestedCount)
    }

    @Test
    fun un_artiste_supprime_ne_fait_pas_tomber_la_fiche() {
        val e = JsonMoziik.decodeFromString(
            ReponseEvenement.serializer(),
            """{"event":{"_id":"e1","title":"Festival","date":"2026-12-12T15:00:00.000Z",
              "lineup":[null,{"_id":"a1","stageName":"Ambondrona","verified":true,"coverUrl":"/media/x"}],
              "program":[{"time":"18:00","title":"Ouverture"}],
              "tickets":[{"name":"Standard","price":10,"soldOut":true},{"name":"VIP","price":25.5,"originalPrice":30}],
              "organizer":{"name":"Moziik","phone":"034 00 000 00"},"viewerInterested":true}}""",
        ).event
        assertEquals(listOf("a1"), e.lineup.filterNotNull().map { it.id })
        assertEquals("18:00", e.program.single().time)
        assertTrue(e.tickets.first().soldOut)
        assertEquals(25.5, e.tickets.last().price, 0.0)
        assertTrue(e.viewerInterested)
    }

    @Test
    fun une_page_de_notifications_se_lit() {
        val page = JsonMoziik.decodeFromString(
            PageAvis.serializer(),
            """{"notifications":[{"_id":"n1","recipient":"u1","type":"new_song","title":"Nouveau son","message":"Ambondrona a publié Fanamby","link":"/son/abc","read":false,"createdAt":"2026-10-21T10:00:00.000Z"},
                {"_id":"n2","type":"inconnu_demain","title":"Annonce","message":"","read":true}],"hasMore":true}""",
        )
        assertEquals(2, page.notifications.size)
        assertFalse(page.notifications.first().read)
        assertEquals("inconnu_demain", page.notifications.last().type)
        assertTrue(page.hasMore)
    }
}
