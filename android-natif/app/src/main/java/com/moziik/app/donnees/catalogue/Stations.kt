package com.moziik.app.donnees.catalogue

/** D'où une station tire ses titres (fetchUrl de lib/radios.ts). */
sealed interface SourceStation {
    data object Tendances : SourceStation
    data object Favoris : SourceStation
    data object Nouveautes : SourceStation
    /** « Lancer la radio » : tout le catalogue publié, mélangé. */
    data object Generale : SourceStation
    data class DeGenre(val genre: String) : SourceStation
}

/**
 * Une station de la page Radio, recopiée de lib/radios.ts : sa clé est son
 * adresse (`/radio?station=<cle>`), son aplat est fixe et ne suit pas le
 * thème, comme sur le site.
 */
data class StationRadio(
    val cle: String,
    val libelle: String,
    val source: SourceStation,
    val description: String,
    val couleur: Long,
)

val STATIONS = listOf(
    StationRadio("tendances", "Tendances", SourceStation.Tendances, "Ce que tout le monde écoute en ce moment.", 0xFFC63F1C),
    StationRadio("favoris", "Mes favoris", SourceStation.Favoris, "Les titres que vous avez aimés, en boucle.", 0xFFC0356B),
    StationRadio("nouveautes", "Nouveautés", SourceStation.Nouveautes, "Les dernières sorties du catalogue.", 0xFF2E5AAC),
    StationRadio("afro", "Afro", SourceStation.DeGenre("Afro"), "Le répertoire afro du catalogue.", 0xFF1B2A4A),
    StationRadio("rock", "Rock", SourceStation.DeGenre("Rock"), "Guitares en avant.", 0xFF5B4FCF),
    StationRadio("instrumental", "Instrumental", SourceStation.DeGenre("Instrumental"), "Sans voix, pour travailler ou lire.", 0xFF4B3F8F),
    StationRadio("jazz", "Jazz", SourceStation.DeGenre("Jazz"), "Standards et improvisations.", 0xFF3D2F6F),
    StationRadio("gospel", "Gospel", SourceStation.DeGenre("Gospel"), "Louange et répertoire évangélique.", 0xFFB03050),
)

val STATION_GENERALE = StationRadio("moziik", "Moziik", SourceStation.Generale, "Tout le catalogue, au hasard.", 0xFF3D2F6F)

fun stationDeGenre(genre: String) =
    StationRadio("genre:$genre", genre, SourceStation.DeGenre(genre), "Tout le $genre du catalogue.", 0xFF3D2F6F)

/** Une clé de station nommée ou `genre:<Genre>` ; null si elle ne désigne rien (« Cette station n'existe pas. »). */
fun resoudreStation(cle: String?): StationRadio? = when {
    cle.isNullOrBlank() -> null
    cle.startsWith("genre:") -> cle.removePrefix("genre:").takeIf { it.isNotBlank() }?.let(::stationDeGenre)
    else -> STATIONS.firstOrNull { it.cle == cle }
}
