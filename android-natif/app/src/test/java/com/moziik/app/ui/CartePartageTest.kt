package com.moziik.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** Le titre de la carte de partage, coupé en lignes ; un caractère mesure 1. */
class CartePartageTest {
    private val mesure: (String) -> Float = { it.length.toFloat() }

    @Test
    fun coupe_mot_a_mot() {
        assertEquals(listOf("Raha ny", "olon tiana"), couperEnLignes("Raha ny olon tiana", 2, 10f, mesure))
    }

    @Test
    fun la_derniere_ligne_finit_par_des_points_de_suspension() {
        assertEquals(listOf("Mafy be", "dia mafy…"), couperEnLignes("Mafy be dia mafy loatra izy", 2, 10f, mesure))
    }

    @Test
    fun un_mot_trop_long_est_tronque() {
        assertEquals(listOf("Abcdefghi…"), couperEnLignes("Abcdefghijklmnop", 1, 10f, mesure))
    }
}
