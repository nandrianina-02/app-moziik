package com.moziik.app.lecteur

import android.net.Uri
import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import com.moziik.app.donnees.catalogue.ArtisteCourt
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.reseau.adresseMedia

/**
 * L'unique adresse d'écoute d'un titre (spécification 5.2) : jamais
 * `audioUrl`, qui contournerait le quota des visiteurs et le plafond de
 * qualité. La qualité demandée est un souhait, plafonnée par le site
 * (128 kb/s sans Premium).
 */
fun adresseFlux(site: String, id: String, qualite: String = "high"): String = "${site}api/stream/$id?q=$qualite"

/** L'identifiant du titre d'une adresse de flux du site, ou null si l'adresse n'en est pas une. */
fun idDuFlux(adresse: String, site: String): String? {
    if (!adresse.startsWith("${site}api/stream/")) return null
    return adresse.removePrefix("${site}api/stream/").substringBefore('?').takeIf { it.isNotEmpty() && '/' !in it }
}

private const val DUREE = "duree"
private const val ARTISTE_ID = "artisteId"
private const val VERIFIE = "verifie"
private const val SOURCE = "source"
private const val UNIVERS = "univers"
private const val SONIE = "sonie"
private const val ALBUM = "album"
private const val ORIGINE = "origine"

/** Ce que le lecteur montre d'un titre en cours ou en file. */
@kotlinx.serialization.Serializable
data class TitreLu(
    val id: String,
    val titre: String,
    val artiste: String?,
    val artisteId: String?,
    val verifie: Boolean,
    val pochette: String?,
    val dureeSecondes: Double,
    /** « depuis … » : l'album, la playlist ou la section d'où vient la file. */
    val source: String?,
)

/**
 * Un titre pour le lecteur. Les métadonnées voyagent jusqu'au service, à
 * la notification et à l'écran verrouillé ; l'adresse, elle, est reposée
 * par le service (une MediaController ne transmet pas l'URI).
 */
fun Titre.versElement(site: String, source: String?, qualite: String = "high", origine: String? = null): MediaItem {
    val extras = Bundle().apply {
        putDouble(DUREE, duration)
        putString(ARTISTE_ID, artist?.id)
        putBoolean(VERIFIE, artist?.verified == true)
        putString(SOURCE, source)
        putString(UNIVERS, univers)
        loudness?.let { putDouble(SONIE, it) }
        putString(ALBUM, album?.id)
        putString(ORIGINE, origine)
    }
    val metadonnees = MediaMetadata.Builder()
        .setTitle(title)
        .setArtist(artist?.stageName ?: "Artiste supprimé")
        .setArtworkUri(adresseMedia(coverUrl, site)?.let(Uri::parse))
        .setIsPlayable(true)
        .setIsBrowsable(false)
        .setExtras(extras)
        .build()
    return MediaItem.Builder()
        .setMediaId(id)
        .setUri(adresseFlux(site, id, qualite))
        .setMediaMetadata(metadonnees)
        .build()
}

/** Un élément de file reconstruit depuis sa sauvegarde, pour reprendre la lecture au lancement (E10). */
fun TitreLu.versElement(site: String): MediaItem {
    val extras = Bundle().apply {
        putDouble(DUREE, dureeSecondes)
        putString(ARTISTE_ID, artisteId)
        putBoolean(VERIFIE, verifie)
        putString(SOURCE, source)
    }
    val metadonnees = MediaMetadata.Builder()
        .setTitle(titre)
        .setArtist(artiste ?: "Artiste supprimé")
        .setArtworkUri(pochette?.let(Uri::parse))
        .setIsPlayable(true)
        .setIsBrowsable(false)
        .setExtras(extras)
        .build()
    return MediaItem.Builder().setMediaId(id).setUri(adresseFlux(site, id)).setMediaMetadata(metadonnees).build()
}

fun MediaItem.versTitreLu(): TitreLu {
    val m = mediaMetadata
    val extras = m.extras
    return TitreLu(
        id = mediaId,
        titre = m.title?.toString().orEmpty(),
        artiste = m.artist?.toString(),
        artisteId = extras?.getString(ARTISTE_ID),
        verifie = extras?.getBoolean(VERIFIE) == true,
        pochette = m.artworkUri?.toString(),
        dureeSecondes = extras?.getDouble(DUREE) ?: 0.0,
        source = extras?.getString(SOURCE),
    )
}

/** La durée connue d'un élément, en secondes, avant même que le fichier soit chargé. */
fun MediaItem.dureeSecondes(): Double = mediaMetadata.extras?.getDouble(DUREE) ?: 0.0

/** Un titre de la file ramené au modèle du catalogue : pour le télécharger depuis le lecteur. */
fun TitreLu.versTitre() = Titre(
    id = id,
    title = titre,
    artist = artisteId?.let { ArtisteCourt(it, artiste, verifie) },
    coverUrl = pochette,
    duration = dureeSecondes,
)

/** L'univers du titre (general ou christian), s'il était connu quand il a été mis en file. */
fun MediaItem.univers(): String? = mediaMetadata.extras?.getString(UNIVERS)

/** Le volume perçu mesuré du titre, s'il l'était quand il a été mis en file. */
fun MediaItem.sonie(): Double? = mediaMetadata.extras?.takeIf { it.containsKey(SONIE) }?.getDouble(SONIE)

/** L'album du titre : deux titres du même album s'enchaînent sans fondu. */
fun MediaItem.albumId(): String? = mediaMetadata.extras?.getString(ALBUM)

/** D'où la file a été lancée (« artiste:<id> » depuis la page d'un artiste) : la suite en dépend. */
fun MediaItem.origine(): String? = mediaMetadata.extras?.getString(ORIGINE)
