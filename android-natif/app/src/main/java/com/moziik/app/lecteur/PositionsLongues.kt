package com.moziik.app.lecteur

import android.content.Context
import com.moziik.app.donnees.reseau.JsonMoziik
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

/** Au-delà de 20 minutes, une écoute se reprend là où on l'a laissée : podcast, prédication, live. */
const val DUREE_LONGUE_MS = 20 * 60_000L

/** Ni dans les 30 premières secondes (on vient de commencer), ni dans les 30 dernières (c'est fini). */
private const val MARGE_MS = 30_000L
private const val GARDEES_MAX = 200

@Serializable
data class PositionLongue(val id: String, val positionMs: Long, val dureeMs: Long, val le: Long)

/**
 * Où l'on s'est arrêté dans chaque longue écoute. Une position n'est gardée
 * que pour un titre long, et seulement au milieu : un titre fini ou à peine
 * commencé repart du début. Les plus anciennes s'effacent au-delà de 200.
 */
fun retenirPosition(liste: List<PositionLongue>, id: String, positionMs: Long, dureeMs: Long, maintenant: Long): List<PositionLongue> {
    if (dureeMs < DUREE_LONGUE_MS) return liste
    val sans = liste.filter { it.id != id }
    if (positionMs < MARGE_MS || positionMs > dureeMs - MARGE_MS) return sans
    return (listOf(PositionLongue(id, positionMs, dureeMs, maintenant)) + sans).take(GARDEES_MAX)
}

class PositionsLongues(contexte: Context) {
    private val preferences = contexte.getSharedPreferences("positions-longues", Context.MODE_PRIVATE)
    private val serialiseur = ListSerializer(PositionLongue.serializer())
    private val _positions = MutableStateFlow(
        runCatching { JsonMoziik.decodeFromString(serialiseur, preferences.getString("liste", "[]") ?: "[]") }.getOrDefault(emptyList()),
    )
    val positions: StateFlow<List<PositionLongue>> = _positions.asStateFlow()

    fun garder(id: String, positionMs: Long, dureeMs: Long) {
        val avant = _positions.value
        val apres = retenirPosition(avant, id, positionMs, dureeMs, System.currentTimeMillis())
        if (apres == avant) return
        _positions.value = apres
        preferences.edit().putString("liste", JsonMoziik.encodeToString(serialiseur, apres)).apply()
    }

    /** La position où reprendre ce titre, ou null s'il repart du début. */
    fun reprise(id: String): Long? = _positions.value.firstOrNull { it.id == id }?.positionMs
}
