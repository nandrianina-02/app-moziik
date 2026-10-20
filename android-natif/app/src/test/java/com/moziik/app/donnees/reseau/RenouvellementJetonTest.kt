package com.moziik.app.donnees.reseau

import com.moziik.app.donnees.session.SessionMobile
import com.moziik.app.donnees.session.StockageSessionMemoire
import okhttp3.Request
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/**
 * Le renouvellement du jeton face à un faux site qui répond comme le vrai
 * (lib/mobileAuth.ts) : jeton d'accès refusé en 401, renouvellement par
 * /api/mobile-auth/refresh.
 */
class RenouvellementJetonTest {
    private val serveur = MockWebServer()
    private val utilisateur = UtilisateurCourt("u1", "Ana Rakoto", "ana@exemple.mg", null, "member")
    private var reponseRenouvellement = MockResponse().setBody("""{"accessToken":"neuf"}""")
    private var renouvellements = 0

    @Before
    fun demarrer() {
        serveur.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = when (request.path) {
                "/api/mobile-auth/refresh" -> {
                    renouvellements++
                    reponseRenouvellement
                }
                // Route protégée : seul le jeton neuf passe.
                "/api/me/profile" ->
                    if (request.getHeader("Authorization") == "Bearer neuf") MockResponse().setBody("{}") else MockResponse().setResponseCode(401)
                // Route publique : le site refuse pourtant un jeton expiré.
                "/api/songs" ->
                    if (request.getHeader("Authorization") == null) MockResponse().setBody("[]") else MockResponse().setResponseCode(401)
                else -> MockResponse().setResponseCode(404)
            }
        }
        serveur.start()
    }

    @After
    fun arreter() = serveur.shutdown()

    private fun appeler(stockage: StockageSessionMemoire, chemin: String) =
        Reseau(serveur.url("/").toString(), stockage).client.newCall(Request.Builder().url(serveur.url(chemin)).build()).execute()

    @Test
    fun un_jeton_expire_est_renouvele_puis_la_requete_rejouee() {
        val stockage = StockageSessionMemoire(SessionMobile("ancien", "r1", utilisateur))
        appeler(stockage, "/api/me/profile").use { assertEquals(200, it.code) }
        assertEquals("neuf", stockage.lire()?.accessToken)
        assertEquals("r1", stockage.lire()?.refreshToken)
        assertEquals(1, renouvellements)
    }

    @Test
    fun une_session_refusee_est_oubliee_et_une_route_publique_repond_quand_meme() {
        reponseRenouvellement = MockResponse().setResponseCode(401).setBody("""{"error":"Session mobile expirée, reconnecte-toi."}""")
        val stockage = StockageSessionMemoire(SessionMobile("ancien", "r1", utilisateur))
        var oubliee = false
        stockage.surChangement { if (it == null) oubliee = true }
        appeler(stockage, "/api/songs").use { assertEquals(200, it.code) }
        assertNull(stockage.lire())
        assertEquals(true, oubliee)
    }

    @Test
    fun une_panne_pendant_le_renouvellement_ne_deconnecte_pas() {
        reponseRenouvellement = MockResponse().setResponseCode(503)
        val session = SessionMobile("ancien", "r1", utilisateur)
        val stockage = StockageSessionMemoire(session)
        appeler(stockage, "/api/me/profile").use { assertEquals(401, it.code) }
        assertEquals(session, stockage.lire())
    }

    @Test
    fun sans_session_aucun_renouvellement() {
        val stockage = StockageSessionMemoire()
        appeler(stockage, "/api/me/profile").use { assertEquals(401, it.code) }
        assertEquals(0, renouvellements)
    }
}
