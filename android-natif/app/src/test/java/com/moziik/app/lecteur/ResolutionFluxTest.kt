package com.moziik.app.lecteur

import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

/** La résolution de /api/stream face aux réponses réelles du site (app/api/stream, app/api/ecoute/quota). */
class ResolutionFluxTest {
    private val serveur = MockWebServer()
    private lateinit var site: String
    private var visiteur = false
    private var maintenant = 0L
    private lateinit var resolution: ResolutionFlux

    @Before
    fun demarrer() {
        serveur.start()
        site = serveur.url("/").toString()
        resolution = ResolutionFlux(OkHttpClient(), site, estVisiteur = { visiteur }, horloge = { maintenant })
    }

    @After
    fun arreter() = serveur.shutdown()

    private fun redirection(vers: String) = MockResponse().setResponseCode(302).setHeader("Location", vers)

    @Test
    fun suit_la_redirection_une_fois_par_titre() {
        serveur.enqueue(redirection("https://stockage.exemple/fichier.mp3?sig=1"))
        val flux = adresseFlux(site, "abc")
        assertEquals("https://stockage.exemple/fichier.mp3?sig=1", resolution.resoudre(flux))
        // Un déplacement dans le morceau rouvre l'adresse : pas de nouvel appel au site.
        assertEquals("https://stockage.exemple/fichier.mp3?sig=1", resolution.resoudre(flux))
        assertEquals(1, serveur.requestCount)
        assertEquals("/api/stream/abc?q=high", serveur.takeRequest().path)
    }

    @Test
    fun redemande_apres_expiration_ou_oubli() {
        repeat(3) { serveur.enqueue(redirection("https://stockage.exemple/$it.mp3")) }
        val flux = adresseFlux(site, "abc")
        resolution.resoudre(flux)
        maintenant += 31 * 60 * 1000L
        assertEquals("https://stockage.exemple/1.mp3", resolution.resoudre(flux))
        resolution.oublier()
        assertEquals("https://stockage.exemple/2.mp3", resolution.resoudre(flux))
    }

    @Test
    fun ignore_ce_qui_n_est_pas_un_flux_du_site() {
        assertNull(resolution.resoudre("https://stockage.exemple/fichier.mp3"))
        assertNull(resolution.resoudre("${site}api/songs/abc"))
        assertEquals(0, serveur.requestCount)
    }

    @Test
    fun titre_indisponible() {
        serveur.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"Ce titre n'est pas disponible."}"""))
        try {
            resolution.resoudre(adresseFlux(site, "abc"))
            fail()
        } catch (e: ErreurFlux) {
            assertEquals(403, e.statut)
            assertEquals("Ce titre n'est pas disponible.", e.message)
        }
    }

    @Test
    fun visiteur_decompte_avant_d_ecouter() {
        visiteur = true
        serveur.enqueue(MockResponse().setBody("""{"autorise":true,"illimite":false,"restant":14,"limite":15}"""))
        serveur.enqueue(redirection("https://stockage.exemple/a.mp3"))
        assertEquals("https://stockage.exemple/a.mp3", resolution.resoudre(adresseFlux(site, "abc")))
        val quota = serveur.takeRequest()
        assertEquals("/api/ecoute/quota", quota.path)
        assertEquals("""{"songId":"abc"}""", quota.body.readUtf8())
    }

    @Test
    fun visiteur_au_bout_de_sa_limite() {
        visiteur = true
        serveur.enqueue(MockResponse().setBody("""{"autorise":false,"illimite":false,"restant":0,"limite":15}"""))
        try {
            resolution.resoudre(adresseFlux(site, "abc"))
            fail()
        } catch (e: ErreurFlux) {
            assertEquals(402, e.statut)
        }
        // Le fichier n'est même pas demandé.
        assertEquals(1, serveur.requestCount)
    }

    @Test
    fun quota_injoignable_laisse_jouer() {
        visiteur = true
        serveur.enqueue(MockResponse().setResponseCode(503).setBody("""{"error":"Base injoignable."}"""))
        serveur.enqueue(redirection("https://stockage.exemple/a.mp3"))
        assertEquals("https://stockage.exemple/a.mp3", resolution.resoudre(adresseFlux(site, "abc")))
    }
}
