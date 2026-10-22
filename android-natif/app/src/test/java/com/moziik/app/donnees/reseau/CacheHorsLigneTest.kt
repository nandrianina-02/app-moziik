package com.moziik.app.donnees.reseau

import com.moziik.app.donnees.session.SessionMobile
import com.moziik.app.donnees.session.StockageSessionMemoire
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.IOException

/** Le cache des réponses de l'API pour le hors connexion (spécification 6.4). */
class CacheHorsLigneTest {
    @get:Rule
    val dossier = TemporaryFolder()

    private val serveur = MockWebServer()
    private val stockage = StockageSessionMemoire(SessionMobile("acces", "renouvellement", UtilisateurCourt("u1", "Ana", "ana@exemple.mg", null, "member")))
    private lateinit var reseau: Reseau

    @Before
    fun demarrer() {
        serveur.start()
        reseau = Reseau(serveur.url("/").toString(), stockage, dossier.root)
    }

    @After
    fun arreter() = runCatching { serveur.shutdown() }.let { }

    private fun lire(chemin: String) = reseau.client.newCall(Request.Builder().url(serveur.url(chemin)).build()).execute()

    private fun json(corps: String) = MockResponse().setHeader("Content-Type", "application/json").setBody(corps)

    @Test
    fun une_panne_du_site_rend_la_derniere_reponse() {
        serveur.enqueue(json("""{"songs":[1]}"""))
        lire("/api/songs?genre=Pop").use { assertNull(it.header(EN_TETE_CACHE)) }

        serveur.enqueue(MockResponse().setResponseCode(503))
        lire("/api/songs?genre=Pop").use {
            assertEquals(200, it.code)
            assertEquals("1", it.header(EN_TETE_CACHE))
            assertEquals("""{"songs":[1]}""", it.body?.string())
        }
    }

    @Test
    fun sans_reseau_la_derniere_reponse_et_rien_pour_une_autre_page() {
        serveur.enqueue(json("""{"albums":[]}"""))
        lire("/api/albums").close()
        serveur.shutdown()

        lire("/api/albums").use { assertEquals("1", it.header(EN_TETE_CACHE)) }
        try {
            lire("/api/artists").close()
            fail("Une page jamais vue n'a pas de copie : l'erreur réseau remonte")
        } catch (e: IOException) {
            // attendu
        }
    }

    @Test
    fun un_autre_compte_ne_lit_pas_ce_cache_et_la_deconnexion_l_efface() {
        serveur.enqueue(json("""{"liked":true}"""))
        lire("/api/me/liked-songs").close()

        stockage.ecrire(SessionMobile("a2", "r2", UtilisateurCourt("u2", "Tojo", "tojo@exemple.mg", null, "member")))
        serveur.enqueue(MockResponse().setResponseCode(500))
        lire("/api/me/liked-songs").use { assertEquals(500, it.code) }

        stockage.ecrire(SessionMobile("acces", "renouvellement", UtilisateurCourt("u1", "Ana", "ana@exemple.mg", null, "member")))
        reseau.cacheHorsLigne!!.oublierComptes()
        serveur.enqueue(MockResponse().setResponseCode(500))
        lire("/api/me/liked-songs").use { assertEquals(500, it.code) }
    }

    @Test
    fun le_flux_audio_et_la_connexion_ne_sont_jamais_gardes() {
        serveur.enqueue(json("""{"ok":true}"""))
        lire("/api/stream/abc").close()
        serveur.enqueue(MockResponse().setResponseCode(503))
        lire("/api/stream/abc").use { assertEquals(503, it.code) }
    }
}
