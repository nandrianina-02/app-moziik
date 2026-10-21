package com.moziik.app.donnees.catalogue

import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Une playlist de « Mes playlists » : ses titres ne sont que des identifiants (GET /api/playlists?owner=me). */
@Serializable
data class PlaylistMienne(
    @SerialName("_id") val id: String,
    val title: String,
    val description: String? = null,
    val coverUrl: String? = null,
    val songs: List<String> = emptyList(),
    val isPublic: Boolean = false,
)

@Serializable
data class ListePlaylists(val playlists: List<PlaylistMienne> = emptyList())

@Serializable
data class NouvellePlaylist(val title: String, val description: String? = null, val isPublic: Boolean = false, val songIds: List<String>? = null)

@Serializable
data class ReponsePlaylistCreee(val playlist: PlaylistMienne)

/** PATCH partiel : seuls les champs renseignés sont envoyés. */
@Serializable
data class ModificationPlaylist(val title: String? = null, val description: String? = null, val isPublic: Boolean? = null)

@Serializable
data class TitresDePlaylist(val songIds: List<String>)

/** Le corps d'un retrait : la route DELETE lit `songId` dans le corps (F9). */
@Serializable
data class TitreDePlaylist(val songId: String)

/** La bibliothèque du compte connecté (domaine F) : chaque liste se charge indépendamment. */
class Bibliotheque(private val api: MoziikApi, private val univers: suspend () -> String?) {
    suspend fun mesPlaylists(): List<PlaylistMienne> = appel { api.mesPlaylists().playlists }.getOrThrow()

    /** Les titres aimés, dans l'ordre où ils l'ont été ; seuls les publiés s'écoutent. */
    suspend fun titresAimes(): List<Titre> = appel { api.titresAimes().songs }.getOrThrow().filter { it.publie }

    suspend fun albumsEnregistres(): List<AlbumCourt> = appel { api.albumsEnregistres().albums }.getOrThrow()

    suspend fun artistesSuivis(): List<ArtisteCarte> = appel { api.artistesSuivis().artists }.getOrThrow()

    suspend fun recents(): List<Titre> = appel { api.recents(univers()).songs }.getOrThrow()

    /** Privée par défaut (F6) ; créée avec ses titres en une seule requête. */
    suspend fun creer(titre: String, description: String?, publique: Boolean, titres: List<String> = emptyList()): PlaylistMienne =
        appel { api.creerPlaylist(NouvellePlaylist(titre.trim(), description?.trim()?.ifEmpty { null }, publique, titres.ifEmpty { null })).playlist }.getOrThrow()

    suspend fun modifier(id: String, titre: String? = null, description: String? = null, publique: Boolean? = null) {
        appel { api.modifierPlaylist(id, ModificationPlaylist(titre?.trim(), description, publique)) }.getOrThrow()
    }

    suspend fun supprimer(id: String) {
        appel { api.supprimerPlaylist(id) }.getOrThrow()
    }

    /** Les doublons sont ignorés par le site. */
    suspend fun ajouter(playlist: String, titres: List<String>) {
        appel { api.ajouterTitres(playlist, TitresDePlaylist(titres)) }.getOrThrow()
    }

    suspend fun retirer(playlist: String, titre: String) {
        appel { api.retirerTitre(playlist, TitreDePlaylist(titre)) }.getOrThrow()
    }
}
