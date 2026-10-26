package com.moziik.app.donnees.compte

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.Locale
import kotlin.math.roundToInt

/** GET /api/artist/stats?jours= : les chiffres d'un artiste sur une période, en lecture seule. */
@Serializable
data class StatistiquesArtiste(
    val jours: Int = 30,
    val catalogue: CatalogueArtiste = CatalogueArtiste(),
    val abonnes: Int = 0,
    val resume: ResumeArtiste = ResumeArtiste(),
    val serie: List<JourEcoutes> = emptyList(),
    val topTitres: List<TitreEcoute> = emptyList(),
    val pays: List<PaysEcoutes> = emptyList(),
    val appareils: List<AppareilEcoutes> = emptyList(),
)

@Serializable
data class CatalogueArtiste(val titres: Int = 0, val publies: Int = 0)

@Serializable
data class ResumeArtiste(
    val ecoutes: Int = 0,
    val ecoutesPrecedentes: Int = 0,
    val auditeurs: Int = 0,
    val favoris: Int = 0,
    /** Null sans écoute sur la période : « 0 % » se lirait comme « personne ne va au bout ». */
    val tauxEcouteComplete: Int? = null,
)

/** `jour` au format AAAA-MM-JJ, dans le fuseau du site. */
@Serializable
data class JourEcoutes(val jour: String, val ecoutes: Int)

@Serializable
data class TitreEcoute(@SerialName("_id") val id: String, val title: String, val coverUrl: String? = null, val ecoutes: Int)

@Serializable
data class PaysEcoutes(val code: String, val ecoutes: Int)

@Serializable
data class AppareilEcoutes(val nom: String, val ecoutes: Int)

/** Les périodes proposées, comme sur le tableau de bord artiste du site. */
val PERIODES_ARTISTE = listOf(7, 30, 90)

/**
 * L'évolution en pour cent par rapport à la période précédente ; null
 * quand la précédente est vide, car tout départ de zéro ferait « +∞ %».
 */
fun evolution(actuelles: Int, precedentes: Int): Int? =
    if (precedentes <= 0) null else (((actuelles - precedentes) * 100.0) / precedentes).roundToInt()

/** « MG » donne « Madagascar » ; un code inconnu reste tel quel. */
fun nomDuPays(code: String): String {
    val nom = Locale("", code.uppercase()).getDisplayCountry(Locale.FRENCH)
    return if (nom.isBlank() || nom.equals(code, ignoreCase = true)) code.uppercase() else nom.replaceFirstChar { it.uppercase() }
}

/** Les noms d'appareil enregistrés par le site, en français. */
fun nomDeLAppareil(nom: String): String = when (nom.lowercase()) {
    "mobile" -> "Téléphone"
    "desktop" -> "Ordinateur"
    "pwa" -> "Site installé"
    else -> nom.replaceFirstChar { it.uppercase() }
}

/** Part d'une valeur dans un total, en pour cent arrondi. */
fun part(valeur: Int, total: Int): Int = if (total <= 0) 0 else ((valeur * 100.0) / total).roundToInt()
