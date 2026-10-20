package com.moziik.app

import com.moziik.app.donnees.libelleAppareil
import com.moziik.app.donnees.reseau.ErreurApi
import com.moziik.app.donnees.reseau.adresseMedia
import com.moziik.app.donnees.reseau.messageDuCorps
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.ui.compte.initiales
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.IOException

class OutilsTest {
    private val site = "https://app-moziik.vercel.app/"

    @Test
    fun adresses_des_images_du_site() {
        assertEquals("https://res.cloudinary.com/x/a.jpg", adresseMedia("https://res.cloudinary.com/x/a.jpg", site))
        assertEquals("https://app-moziik.vercel.app/media/abc", adresseMedia("/media/abc", site))
        // Un identifiant de stockage brut ne s'affiche pas tel quel.
        assertNull(adresseMedia("ks:abc", site))
        assertNull(adresseMedia("", site))
        assertNull(adresseMedia(null, site))
    }

    @Test
    fun message_d_erreur_du_site() {
        assertEquals("Ce compte a été suspendu.", messageDuCorps("""{"error":"Ce compte a été suspendu."}"""))
        assertNull(messageDuCorps("<html>Bad gateway</html>"))
        assertNull(messageDuCorps(null))
        assertEquals("Moziik ne répond pas pour le moment. Réessaie dans un instant.", messageErreur(ErreurApi(502, null)))
        assertEquals("Connexion impossible. Vérifie ton réseau et réessaie.", messageErreur(IOException()))
    }

    @Test
    fun libelle_de_l_appareil() {
        assertEquals("Samsung SM-A155F - app Moziik", libelleAppareil("samsung", "SM-A155F"))
        // Le modèle répète déjà la marque : on ne la double pas.
        assertEquals("Google Pixel 8 - app Moziik", libelleAppareil("Google", "Google Pixel 8"))
        assertEquals(120, libelleAppareil("X", "Y".repeat(200)).length)
    }

    @Test
    fun initiales_de_l_avatar() {
        assertEquals("AR", initiales("Ana Rakoto"))
        assertEquals("N", initiales("nandrianina"))
        assertEquals("JM", initiales("  Jean   Marc  Rabe "))
        assertEquals("?", initiales("   "))
    }
}
