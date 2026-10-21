package com.moziik.app.donnees.session

import com.moziik.app.donnees.reseau.ErreurApi
import com.moziik.app.donnees.reseau.Reseau
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

/** La session face aux réponses réelles des routes de connexion du site (app/api/mobile-auth). */
class SessionTest {
    private val serveur = MockWebServer()
    private lateinit var stockage: StockageSessionMemoire
    private lateinit var session: Session

    private val jetons = """
        {"accessToken":"acces","refreshToken":"renouvellement",
         "user":{"id":"u1","name":"Ana Rakoto","email":"ana@exemple.mg","avatarUrl":null,"role":"member"}}
    """.trimIndent()

    @Before
    fun demarrer() {
        serveur.start()
        stockage = StockageSessionMemoire()
        session = Session(Reseau(serveur.url("/").toString(), stockage).api, stockage, "Pixel 8 - app Moziik")
    }

    @After
    fun arreter() = serveur.shutdown()

    @Test
    fun connexion_reussie() = runTest {
        serveur.enqueue(MockResponse().setBody(jetons))
        session.connexion("  Ana@Exemple.MG ", "secret")
        val envoye = serveur.takeRequest().body.readUtf8()
        // Adresse normalisée comme le site l'attend, appareil nommé pour la liste des sessions.
        assertTrue(envoye.contains("\"email\":\"ana@exemple.mg\""))
        assertTrue(envoye.contains("\"device\":\"Pixel 8 - app Moziik\""))
        assertEquals("renouvellement", stockage.lire()?.refreshToken)
        assertEquals(EtatSession.Connecte(stockage.lire()!!.utilisateur), session.etat.value)
    }

    @Test
    fun aucun_compte_et_mauvais_mot_de_passe_donnent_le_meme_message() = runTest {
        for (message in listOf("Aucun compte associé à cet email.", "Mot de passe incorrect.")) {
            serveur.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"$message"}"""))
            try {
                session.connexion("ana@exemple.mg", "faux")
                fail()
            } catch (e: ErreurApi) {
                assertEquals("Email ou mot de passe incorrect.", e.code)
            }
        }
        assertNull(stockage.lire())
    }

    @Test
    fun adresse_non_confirmee() = runTest {
        serveur.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"EMAIL_NOT_VERIFIED"}"""))
        try {
            session.connexion("ana@exemple.mg", "secret")
            fail()
        } catch (e: EmailNonConfirme) {
            assertEquals("ana@exemple.mg", e.email)
        }
    }

    @Test
    fun compte_suspendu_garde_le_message_du_site() = runTest {
        serveur.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"Ce compte a été suspendu."}"""))
        try {
            session.connexion("ana@exemple.mg", "secret")
            fail()
        } catch (e: ErreurApi) {
            assertEquals("Ce compte a été suspendu.", e.code)
        }
    }

    @Test
    fun connexion_google_par_le_relais() = runTest {
        serveur.enqueue(MockResponse().setBody(jetons))
        session.terminerGoogle("a".repeat(64), null)
        assertTrue(serveur.takeRequest().path == "/api/mobile-auth/relais/jetons")
        assertEquals(EtatGoogle.Repos, session.google.value)
        assertEquals("acces", stockage.lire()?.accessToken)
    }

    @Test
    fun connexion_google_integree() = runTest {
        serveur.enqueue(MockResponse().setBody(jetons))
        session.connexionJetonGoogle("jeton.google.signe")
        val requete = serveur.takeRequest()
        assertEquals("/api/mobile-auth/google", requete.path)
        assertTrue(requete.body.readUtf8().contains("\"idToken\":\"jeton.google.signe\""))
        assertEquals(EtatGoogle.Repos, session.google.value)
        assertEquals("acces", stockage.lire()?.accessToken)
    }

    @Test
    fun connexion_google_integree_refusee() = runTest {
        serveur.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"Ce compte a été suspendu."}"""))
        session.connexionJetonGoogle("jeton")
        assertEquals(EtatGoogle.Echec("Ce compte a été suspendu."), session.google.value)
        assertNull(stockage.lire())
    }

    @Test
    fun connexion_google_abandonnee() = runTest {
        session.terminerGoogle(null, "session")
        assertEquals(EtatGoogle.Echec("La connexion Google n'a pas abouti. Réessaie."), session.google.value)
        assertEquals(0, serveur.requestCount)
    }

    @Test
    fun deconnexion_revoque_l_appareil_puis_oublie_meme_sans_reseau() = runTest {
        stockage.ecrire(SessionMobile("acces", "renouvellement", com.moziik.app.donnees.reseau.UtilisateurCourt("u1", "Ana", "a@b.mg", null, "member")))
        serveur.enqueue(MockResponse().setBody("""{"success":true}"""))
        session.deconnexion()
        assertTrue(serveur.takeRequest().body.readUtf8().contains("\"refreshToken\":\"renouvellement\""))
        assertEquals(EtatSession.Anonyme, session.etat.value)

        stockage.ecrire(SessionMobile("acces", "r2", com.moziik.app.donnees.reseau.UtilisateurCourt("u1", "Ana", "a@b.mg", null, "member")))
        serveur.shutdown()
        session.deconnexion()
        assertNull(stockage.lire())
    }
}
