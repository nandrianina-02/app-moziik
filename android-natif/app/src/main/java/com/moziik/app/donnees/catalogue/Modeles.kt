package com.moziik.app.donnees.catalogue

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonTransformingSerializer
import kotlinx.serialization.json.buildJsonObject

/**
 * Les formes du catalogue telles que le site les renvoie. Seuls les champs
 * dont l'app se sert sont déclarés : le site ajoute des champs au fil des
 * déploiements, et les routes renvoient souvent le document Mongoose entier.
 */

/** L'artiste d'un titre : un objet peuplé, ou son seul identifiant (pistes d'un album). */
@Serializable
data class ArtisteCourt(
    @SerialName("_id") val id: String,
    val stageName: String? = null,
    val verified: Boolean = false,
    val coverUrl: String? = null,
)

/** Accepte `"artist": "<id>"` comme `"artist": { "_id": … }` : les deux formes existent selon la route. */
object ArtisteSouple : JsonTransformingSerializer<ArtisteCourt>(ArtisteCourt.serializer()) {
    override fun transformDeserialize(element: JsonElement): JsonElement =
        if (element is JsonPrimitive) buildJsonObject { put("_id", element) } else element
}

@Serializable
data class Titre(
    @SerialName("_id") val id: String,
    val title: String,
    @Serializable(with = ArtisteSouple::class) val artist: ArtisteCourt? = null,
    val coverUrl: String? = null,
    /** En secondes, parfois décimale. */
    val duration: Double = 0.0,
    val genre: String? = null,
    val bpm: Double? = null,
    val explicit: Boolean = false,
    val univers: String? = null,
    /** Absent de certaines listes (recherche, classement) qui ne servent que des titres publiés. */
    val status: String? = null,
    val playsCount: Int = 0,
    val likesCount: Int = 0,
) {
    /** Un brouillon n'est jamais proposé à l'écoute (spécification, domaine D). */
    val publie: Boolean get() = status == null || status == "published"
}

@Serializable
data class AlbumCourt(
    @SerialName("_id") val id: String,
    val title: String,
    val coverUrl: String? = null,
    val type: String? = null,
    @Serializable(with = ArtisteSouple::class) val artist: ArtisteCourt? = null,
)

@Serializable
data class PlaylistCourte(
    @SerialName("_id") val id: String,
    val title: String,
    val coverUrl: String? = null,
    val songsCount: Int? = null,
    @Serializable(with = ProprietaireSouple::class) val owner: Proprietaire? = null,
)

@Serializable
data class Proprietaire(val name: String? = null)

/** Peuplé dans la recherche, simple identifiant dans la bannière de l'accueil : le nom n'est alors pas connu. */
object ProprietaireSouple : JsonTransformingSerializer<Proprietaire>(Proprietaire.serializer()) {
    override fun transformDeserialize(element: JsonElement): JsonElement =
        if (element is JsonPrimitive) buildJsonObject {} else element
}

@Serializable
data class ArtisteCarte(
    @SerialName("_id") val id: String,
    val stageName: String,
    val verified: Boolean = false,
    val coverUrl: String? = null,
    val followersCount: Int? = null,
)

@Serializable
data class EvenementCourt(
    @SerialName("_id") val id: String,
    val title: String,
    val coverUrl: String? = null,
    val date: String? = null,
    val location: String? = null,
)

@Serializable
data class Genre(val genre: String, val count: Int = 0)

// ---------------------------------------------------------------- Accueil

/**
 * GET /api/homepage : la bannière et les sections, dans l'ordre fixé par
 * l'administration. Diapositives et sections sont lues une à une
 * (Catalogue.diaposDe, sectionsDe) : un élément d'une forme inattendue est
 * écarté sans empêcher l'affichage du reste de la page.
 */
@Serializable
data class Accueil(val hero: List<JsonElement> = emptyList(), val sections: List<SectionBrute> = emptyList())

/** `data` change de forme selon `key` : elle est lue section par section (Catalogue.sectionsDe). */
@Serializable
data class SectionBrute(val key: String, val title: String = "", val data: JsonElement? = null)

@Serializable
data class Diapo(
    val source: String = "",
    val contentType: String = "",
    val song: Titre? = null,
    val album: AlbumCourt? = null,
    val artist: ArtisteCarte? = null,
    val playlist: PlaylistCourte? = null,
    val event: EvenementCourt? = null,
    val custom: DiapoLibre? = null,
)

@Serializable
data class DiapoLibre(val title: String, val subtitle: String? = null, val coverUrl: String? = null, val href: String)

/** Une carte « Pour vous » : son lien est une ancre de l'accueil (#recommendations) ou une page du site. */
@Serializable
data class CartePourToi(
    @SerialName("_id") val id: String,
    val title: String,
    val subtitle: String? = null,
    val badge: String? = null,
    val coverUrl: String? = null,
    val linkHref: String,
)

/** Un élément d'une collection composée par l'administration. `_id` y vaut le lien : ne pas s'en servir comme identifiant. */
@Serializable
data class ElementCollection(val contentType: String, val title: String, val coverUrl: String? = null, val href: String)

@Serializable
data class SectionEvenements(val upcomingCount: Int = 0, val events: List<EvenementCourt> = emptyList())

// ---------------------------------------------------------------- Recherche

/** GET /api/search. Les éléments changent de forme selon `kind` : lus par Catalogue.resultatsDe. */
@Serializable
data class ReponseRecherche(
    val q: String = "",
    val top: JsonObject? = null,
    val sections: List<SectionRecherche> = emptyList(),
    val approximatif: Boolean = false,
)

@Serializable
data class SectionRecherche(
    val key: String,
    val title: String = "",
    val kind: String = "",
    val items: List<JsonObject> = emptyList(),
    val total: Int = 0,
    val tronque: Boolean = false,
)

@Serializable
data class TermeRecherche(val q: String)

/** GET /api/charts : seuls les titres et les artistes du classement servent ici. */
@Serializable
data class Classement(val ranking: List<EntreeClassement> = emptyList())

@Serializable
data class EntreeClassement(
    @SerialName("_id") val id: String,
    val title: String? = null,
    val stageName: String? = null,
    val coverUrl: String? = null,
    val artistName: String? = null,
    val artistId: String? = null,
    val verified: Boolean = false,
    val duration: Double = 0.0,
    val genre: String? = null,
)

// ---------------------------------------------------------------- Lecture

@Serializable
data class ListeTitres(val songs: List<Titre> = emptyList())

@Serializable
data class ReponseTitre(val song: Titre)

@Serializable
data class Station(val songs: List<Titre> = emptyList(), val personnalisee: Boolean = false, val presentation: PresentationStation? = null)

@Serializable
data class PresentationStation(val nom: String)

@Serializable
data class ReponseAlbum(val album: AlbumDetail)

@Serializable
data class AlbumDetail(
    @SerialName("_id") val id: String,
    val title: String,
    @Serializable(with = ArtisteSouple::class) val artist: ArtisteCourt? = null,
    val songs: List<Titre> = emptyList(),
)

@Serializable
data class ReponsePlaylist(val playlist: PlaylistDetail)

@Serializable
data class PlaylistDetail(@SerialName("_id") val id: String, val title: String, val songs: List<Titre> = emptyList())

@Serializable
data class ReponseArtiste(val artist: ArtisteCarte, val songs: List<Titre> = emptyList(), val topSongs: List<Titre> = emptyList())

@Serializable
data class UniversCourant(val univers: String? = null)

@Serializable
data class EtatAime(val liked: Boolean = false)

/** POST /api/songs/{id}/play. `device` vaut toujours « mobile » : toute autre valeur est refusée en 400. */
@Serializable
data class Ecoute(val secondsListened: Double, val completed: Boolean, val device: String = "mobile")

@Serializable
data class DemandeQuota(val songId: String)

@Serializable
data class Quota(val autorise: Boolean = true)
