package com.moziik.app.donnees.horsligne

import com.moziik.app.donnees.catalogue.Commentaire
import com.moziik.app.donnees.catalogue.FilsDeCommentaires
import com.moziik.app.donnees.catalogue.Morceau
import com.moziik.app.donnees.reseau.Reseau
import com.moziik.app.donnees.session.StockageSessionMemoire
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/** Commentaires (H1) et actions gardées hors connexion (6.4), face aux routes du site. */
class CommentairesTest {
    @get:Rule
    val dossier = TemporaryFolder()

    private val serveur = MockWebServer()
    private lateinit var actions: ActionsEnAttente

    @Before
    fun demarrer() {
        serveur.start()
        actions = ActionsEnAttente(dossier.root, Reseau(serveur.url("/").toString(), StockageSessionMemoire()).api)
    }

    @After
    fun arreter() = serveur.shutdown()

    private fun com(id: String, date: String, parent: String? = null) = Commentaire(id = id, text = id, createdAt = date, parentComment = parent)

    @Test
    fun les_reponses_sont_rangees_sous_leur_commentaire() {
        val fils = FilsDeCommentaires.fils(
            listOf(
                com("r2", "2026-10-21T10:00:00Z", parent = "c1"),
                com("c2", "2026-10-21T09:00:00Z"),
                com("r1", "2026-10-20T10:00:00Z", parent = "c1"),
                com("c1", "2026-10-20T09:00:00Z"),
                // Le commentaire de départ a été supprimé : la réponse restée en base est masquée.
                com("orpheline", "2026-10-21T11:00:00Z", parent = "disparu"),
            ),
        )
        assertEquals(listOf("c2", "c1"), fils.map { it.racine.id })
        assertEquals(listOf("r1", "r2"), fils[1].reponses.map { it.id })
    }

    @Test
    fun les_mentions_comme_sur_le_site() {
        assertEquals(
            listOf(Morceau("Merci "), Morceau("@ana_r", "ana_r"), Morceau(" et "), Morceau("@Tojo", "tojo"), Morceau("_. !")),
            FilsDeCommentaires.morceaux("Merci @ana_r et @Tojo_. !"),
        )
        // Une adresse e-mail n'est pas une mention, ni un nom de moins de trois caractères.
        assertEquals(listOf(Morceau("ecris a ana@moziik.mg ou @ab")), FilsDeCommentaires.morceaux("ecris a ana@moziik.mg ou @ab"))
    }

    @Test
    fun un_j_aime_garde_n_est_bascule_que_si_l_etat_differe() = runTest {
        actions.garder(ActionGardee.Aime("t1", aime = true))
        // Un second geste sur le même titre remplace le premier : seul le dernier état voulu compte.
        actions.garder(ActionGardee.Aime("t1", aime = false))
        actions.garder(ActionGardee.Aime("t2", aime = true))
        serveur.enqueue(MockResponse().setBody("""{"liked":false}"""))
        serveur.enqueue(MockResponse().setBody("""{"liked":false}"""))
        serveur.enqueue(MockResponse().setBody("""{"liked":true}"""))

        assertEquals(2, actions.rejouer())
        assertEquals("GET /api/songs/t1/like", serveur.takeRequest().requestLine.substringBeforeLast(" "))
        assertEquals("GET /api/songs/t2/like", serveur.takeRequest().requestLine.substringBeforeLast(" "))
        assertEquals("POST /api/songs/t2/like", serveur.takeRequest().requestLine.substringBeforeLast(" "))
        assertTrue(actions.actions.value.isEmpty())
    }

    @Test
    fun une_panne_garde_la_file_et_un_refus_la_vide() = runTest {
        actions.garder(ActionGardee.Commentaire("t1", "Superbe", moment = 42.0))
        actions.garder(ActionGardee.Commentaire("t2", "Encore"))
        // Site indisponible (5xx) : on réessaiera plus tard, rien n'est perdu.
        serveur.enqueue(MockResponse().setResponseCode(503))
        assertEquals(0, actions.rejouer())
        assertEquals(2, actions.actions.value.size)

        // Le titre a disparu entre-temps (404) : l'action est abandonnée, la suivante part.
        serveur.enqueue(MockResponse().setResponseCode(404).setBody("""{"error":"Son introuvable."}"""))
        serveur.enqueue(MockResponse().setResponseCode(201).setBody("""{"comment":{"_id":"c9","text":"Encore"}}"""))
        assertEquals(1, actions.rejouer())
        assertTrue(actions.actions.value.isEmpty())
        // Relue au démarrage suivant : rien ne reste.
        assertTrue(ActionsEnAttente(dossier.root, Reseau(serveur.url("/").toString(), StockageSessionMemoire()).api).actions.value.isEmpty())
    }
}
