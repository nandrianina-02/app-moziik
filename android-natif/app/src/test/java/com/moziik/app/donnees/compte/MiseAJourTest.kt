package com.moziik.app.donnees.compte

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** La comparaison des versions annoncées, et la lecture des publications GitHub. */
class MiseAJourTest {
    @Test
    fun chiffre_par_chiffre_et_pas_en_texte() {
        assertTrue(plusRecente("2.16.0", "2.9.1"))
        assertTrue(plusRecente("3.0", "2.99.9"))
        assertTrue(plusRecente("2.16.1", "2.16.0-test"))
        assertFalse(plusRecente("2.16.0", "2.16.0"))
        assertFalse(plusRecente("1.0.0", "2.16.0"))
        assertFalse(plusRecente("2.16", "2.16.0"))
    }

    @Test
    fun une_publication_github_donne_sa_version_et_son_apk() {
        val json = """
            {"tag_name":"v2.41.0","draft":false,"prerelease":false,"assets":[
              {"name":"notes.txt","browser_download_url":"https://x/notes.txt","size":10},
              {"name":"moziik.apk","browser_download_url":"https://x/moziik.apk","size":20971520}
            ]}
        """.trimIndent()
        val v = versionPubliee(json)!!
        assertEquals("2.41.0", v.version)
        assertEquals("https://x/moziik.apk", v.adresse)
        assertEquals(20.0, v.tailleMo!!, 0.001)
    }

    @Test
    fun sans_apk_ou_en_brouillon_la_publication_est_ignoree() {
        assertNull(versionPubliee("""{"tag_name":"v2.41.0","assets":[]}"""))
        assertNull(versionPubliee("""{"tag_name":"v2.41.0","draft":true,"assets":[{"name":"moziik.apk","browser_download_url":"u"}]}"""))
        assertNull(versionPubliee("pas du json"))
    }

    @Test
    fun la_plus_recente_des_deux_sources_l_emporte() {
        val site = VersionDisponible("2.40.0", "site", null)
        val github = VersionDisponible("2.41.0", "github", null)
        assertEquals("github", laPlusRecente(site, github)?.adresse)
        assertEquals("site", laPlusRecente(site, null)?.adresse)
        assertEquals("github", laPlusRecente(null, github)?.adresse)
        // À version égale, l'annonce du site garde la main : l'administration peut pointer ailleurs.
        assertEquals("site", laPlusRecente(VersionDisponible("2.41.0", "site", null), github)?.adresse)
    }
}
