package com.moziik.app.donnees.compte

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** GET /api/me/bilan?annee= : l'année d'écoute du compte connecté. */
@Serializable
data class Bilan(
    val annee: Int,
    val ecoutes: Int = 0,
    val minutes: Int = 0,
    val titresDifferents: Int = 0,
    val artistesDifferents: Int = 0,
    val joursActifs: Int = 0,
    val topTitres: List<TitreDuBilan> = emptyList(),
    val topArtistes: List<ArtisteDuBilan> = emptyList(),
    val topGenres: List<GenreDuBilan> = emptyList(),
    /** Douze valeurs, de janvier à décembre. */
    val parMois: List<Int> = emptyList(),
    val premiereEcoute: PremiereEcoute? = null,
)

@Serializable
data class TitreDuBilan(
    @SerialName("_id") val id: String,
    val title: String,
    val coverUrl: String? = null,
    val artist: ArtisteDuTitre? = null,
    val ecoutes: Int,
)

@Serializable
data class ArtisteDuTitre(@SerialName("_id") val id: String? = null, val stageName: String? = null)

@Serializable
data class ArtisteDuBilan(@SerialName("_id") val id: String, val stageName: String, val coverUrl: String? = null, val ecoutes: Int)

@Serializable
data class GenreDuBilan(val genre: String, val ecoutes: Int)

@Serializable
data class PremiereEcoute(@SerialName("_id") val id: String, val title: String, val coverUrl: String? = null, val date: String? = null)

private val MOIS = listOf("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre")

/** Le mois le plus écouté (« mars »), ou null sans écoute. */
fun moisLePlusEcoute(parMois: List<Int>): String? {
    val max = parMois.maxOrNull() ?: return null
    if (max <= 0) return null
    return MOIS.getOrNull(parMois.indexOf(max))
}

/** « 1 234 minutes » se lit mieux en heures au-delà de deux heures : « 20 heures ». */
fun dureeLisible(minutes: Int): Pair<Int, String> = when {
    minutes >= 120 -> (minutes / 60) to "heures"
    minutes > 1 -> minutes to "minutes"
    else -> minutes to "minute"
}

/**
 * Le bilan se propose à partir de décembre pour l'année en cours ; avant,
 * c'est celui de l'année précédente qui a du sens.
 */
fun anneeDuBilan(annee: Int, mois: Int): Int = if (mois >= 12) annee else annee - 1
