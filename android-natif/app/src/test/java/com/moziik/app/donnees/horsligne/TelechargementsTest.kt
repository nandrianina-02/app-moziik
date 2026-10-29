package com.moziik.app.donnees.horsligne

import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.reseau.JsonMoziik
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.builtins.ListSerializer
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/** Le stockage des téléchargements face aux réponses de /api/stream (spécification 6.2 et 6.3). */
class TelechargementsTest {
    @get:Rule
    val dossier = TemporaryFolder()

    private val serveur = MockWebServer()
    private lateinit var site: String

    @Before
    fun demarrer() {
        serveur.start()
        site = serveur.url("/").toString()
    }

    @After
    fun arreter() = serveur.shutdown()

    private fun stockage(compte: String? = "u1") = Telechargements(dossier.root, OkHttpClient(), site, compte)

    @Test
    fun chaque_compte_garde_les_siens_et_la_deconnexion_n_efface_rien() = runTest {
        serveur.enqueue(MockResponse().setBody("AUDIO"))
        val t = stockage()
        t.telecharger(Titre(id = "abc", title = "Son"), "high")

        // Déconnexion : la liste se vide à l'écran, le fichier reste.
        t.changerDeCompte(null)
        assertTrue(t.titres.value.isEmpty())
        assertTrue(File(dossier.root, "telechargements/abc.mp3").exists())

        // Un autre compte ne voit rien ; le même titre partage le fichier, sans nouvelle requête.
        t.changerDeCompte("u2")
        assertTrue(t.titres.value.isEmpty())
        t.telecharger(Titre(id = "abc", title = "Son"), "high")
        assertEquals(1, serveur.requestCount)
        assertEquals(listOf("abc"), t.titres.value.map { it.id })

        // Retiré par u2, le fichier reste pour u1, qui le retrouve à son retour.
        t.supprimer("abc")
        assertTrue(File(dossier.root, "telechargements/abc.mp3").exists())
        t.changerDeCompte("u1")
        assertEquals("AUDIO", t.fichier("abc")?.readText())

        // Retiré par son dernier compte, le fichier part.
        t.toutSupprimer()
        assertFalse(File(dossier.root, "telechargements/abc.mp3").exists())
    }

    @Test
    fun suit_la_redirection_et_garde_le_fichier() = runTest {
        serveur.enqueue(MockResponse().setResponseCode(302).setHeader("Location", "${site}fichier.mp3"))
        serveur.enqueue(MockResponse().setBody("AUDIO"))
        val t = stockage()
        t.telecharger(Titre(id = "abc", title = "Son", duration = 200.0), "high")

        assertEquals("/api/stream/abc?q=high", serveur.takeRequest().path)
        assertEquals("AUDIO", t.fichier("abc")?.readText())
        assertEquals(listOf("abc"), t.titres.value.map { it.id })
        assertEquals(5L, t.titres.value.single().octets)
        assertTrue(t.enCours.value.isEmpty())
        // Relu au démarrage suivant de l'app.
        assertEquals(listOf("abc"), stockage().titres.value.map { it.id })
    }

    @Test
    fun un_titre_indisponible_ne_laisse_rien() = runTest {
        serveur.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"Ce son n'est pas disponible."}"""))
        val t = stockage()
        try {
            t.telecharger(Titre(id = "abc", title = "Son"), "high")
            fail("Un 403 doit être signalé")
        } catch (e: TitreIndisponible) {
            assertEquals("Ce son n'est pas disponible.", e.message)
        }
        assertNull(t.fichier("abc"))
        assertTrue(t.titres.value.isEmpty())
        assertFalse(File(dossier.root, "telechargements/abc.partiel").exists())
    }

    @Test
    fun le_nettoyage_retire_ce_qui_dort_depuis_90_jours() {
        val rep = File(dossier.root, "telechargements").apply { mkdirs() }
        val maintenant = System.currentTimeMillis()
        val jour = 86_400_000L
        val index = listOf(
            // Téléchargé il y a longtemps, mais écouté hier : gardé.
            TitreTelecharge("ecoute", "Écouté", telechargeLe = maintenant - 200 * jour, ecouteLe = maintenant - jour),
            TitreTelecharge("oublie", "Oublié", telechargeLe = maintenant - 120 * jour),
            TitreTelecharge("recent", "Récent", telechargeLe = maintenant - 3 * jour),
        )
        index.forEach { File(rep, "${it.id}.mp3").writeText("x") }
        File(rep, "index.json").writeText(JsonMoziik.encodeToString(ListSerializer(TitreTelecharge.serializer()), index))

        val t = stockage()
        assertEquals(1, t.nettoyer())
        assertEquals(listOf("ecoute", "recent"), t.titres.value.map { it.id })
        assertFalse(File(rep, "oublie.mp3").exists())
    }

    @Test
    fun un_index_sans_fichier_est_ignore() {
        val rep = File(dossier.root, "telechargements").apply { mkdirs() }
        val index = listOf(TitreTelecharge("perdu", "Perdu"))
        File(rep, "index.json").writeText(JsonMoziik.encodeToString(ListSerializer(TitreTelecharge.serializer()), index))
        assertTrue(stockage().titres.value.isEmpty())
    }
}
