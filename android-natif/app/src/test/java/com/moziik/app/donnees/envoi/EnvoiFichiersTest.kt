package com.moziik.app.donnees.envoi

import com.moziik.app.donnees.reseau.ErreurApi
import com.moziik.app.donnees.reseau.Reseau
import com.moziik.app.donnees.session.StockageSessionMemoire
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

/** L'envoi d'un fichier (K2) face aux réponses du site et de Karaks Storage. */
class EnvoiFichiersTest {
    private val serveur = MockWebServer()
    private lateinit var envoi: EnvoiFichiers

    @Before
    fun demarrer() {
        serveur.start()
        envoi = EnvoiFichiers(Reseau(serveur.url("/").toString(), StockageSessionMemoire()).api, OkHttpClient())
    }

    @After
    fun arreter() = serveur.shutdown()

    private fun ouverture() = MockResponse().setBody(
        """{"mode":"karaks-storage","fichierId":"file_abc123","adresseEnvoi":"${serveur.url("/api/v1/uploads/u1?token=t")}","tailleMorceau":4194304}""",
    )

    @Test
    fun annonce_puis_depot_et_adresse_media() = runTest {
        serveur.enqueue(ouverture())
        serveur.enqueue(MockResponse().setBody("""{"success":true,"file":{"id":"file_abc123"}}"""))
        val octets = ByteArray(10) { it.toByte() }

        assertEquals("/media/file_abc123", envoi.envoyer(octets, "photo.jpg", "image/jpeg", "messages"))

        val annonce = serveur.takeRequest()
        assertEquals("/api/fichiers/envoi", annonce.path)
        assertEquals("""{"nom":"photo.jpg","type":"image/jpeg","taille":10,"dossier":"messages"}""", annonce.body.readUtf8())
        val depot = serveur.takeRequest()
        assertEquals("PUT", depot.method)
        assertEquals("bytes 0-9/10", depot.getHeader("Content-Range"))
        // Le jeton du compte ne part pas chez l'hébergeur : l'adresse porte le sien.
        assertEquals(null, depot.getHeader("Authorization"))
        assertEquals(10L, depot.bodySize)
    }

    @Test
    fun une_panne_reprend_la_ou_le_stockage_en_est() = runTest {
        serveur.enqueue(ouverture())
        serveur.enqueue(MockResponse().setResponseCode(503).setBody("""{"error":{"message":"Indisponible"}}"""))
        serveur.enqueue(MockResponse().setBody("""{"success":true,"upload":{"received":0}}"""))
        serveur.enqueue(MockResponse().setBody("""{"success":true,"file":{"id":"file_abc123"}}"""))

        assertEquals("/media/file_abc123", envoi.envoyer(ByteArray(10), "photo.jpg", "image/jpeg", "messages"))
        serveur.takeRequest()
        assertEquals("PUT", serveur.takeRequest().method)
        assertEquals("GET", serveur.takeRequest().method)
        assertEquals("bytes 0-9/10", serveur.takeRequest().getHeader("Content-Range"))
    }

    @Test
    fun un_refus_du_stockage_n_est_pas_reessaye() = runTest {
        serveur.enqueue(ouverture())
        serveur.enqueue(MockResponse().setResponseCode(415).setBody("""{"error":{"message":"Le contenu ne correspond pas au format annoncé."}}"""))
        try {
            envoi.envoyer(ByteArray(10), "photo.jpg", "image/jpeg", "messages")
            fail("Un 415 doit remonter")
        } catch (e: ErreurApi) {
            assertEquals(415, e.statut)
            assertEquals("Le contenu ne correspond pas au format annoncé.", e.code)
        }
        assertEquals(2, serveur.requestCount)
    }
}
