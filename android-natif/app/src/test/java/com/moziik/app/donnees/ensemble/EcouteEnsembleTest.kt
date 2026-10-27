package com.moziik.app.donnees.ensemble

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** L'invité ne se recale que si l'écart avec l'hôte s'entend. */
class EcouteEnsembleTest {
    @Test
    fun un_petit_ecart_est_tolere_un_grand_ne_l_est_pas() {
        assertFalse(doitSeRecaler(60_000, 61_500))
        assertFalse(doitSeRecaler(61_500, 60_000))
        assertTrue(doitSeRecaler(60_000, 64_000))
        assertTrue(doitSeRecaler(0, 30_000))
    }
}
