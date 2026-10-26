package com.moziik.app.donnees.compte

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** La comparaison des versions annoncées par le site. */
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
}
