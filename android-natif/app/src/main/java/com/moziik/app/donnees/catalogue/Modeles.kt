package com.moziik.app.donnees.catalogue

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonTransformingSerializer
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.JsonArray

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
    val sharesCount: Int = 0,
    val releaseDate: String? = null,
    val language: String? = null,
    @Serializable(with = AlbumSouple::class) val album: AlbumDuTitre? = null,
) {
    /** Un brouillon n'est jamais proposé à l'écoute (spécification, domaine D). */
    val publie: Boolean get() = status == null || status == "published"
}

/** L'album d'un titre : peuplé sur la fiche titre, simple identifiant dans les listes. */
@Serializable
data class AlbumDuTitre(@SerialName("_id") val id: String, val title: String? = null, val coverUrl: String? = null, val type: String? = null)

object AlbumSouple : JsonTransformingSerializer<AlbumDuTitre>(AlbumDuTitre.serializer()) {
    override fun transformDeserialize(element: JsonElement): JsonElement =
        if (element is JsonPrimitive) buildJsonObject { put("_id", element) } else element
}

@Serializable
data class AlbumCourt(
    @SerialName("_id") val id: String,
    val title: String,
    val coverUrl: String? = null,
    val type: String? = null,
    @Serializable(with = ArtisteSouple::class) val artist: ArtisteCourt? = null,
    val releaseDate: String? = null,
    val univers: String? = null,
    /** Identifiants ou titres peuplés selon la route : seul leur nombre sert ici. */
    @SerialName("songs") val pistes: JsonElement? = null,
) {
    /** Le nombre de pistes, s'il est connu : un album vide n'est pas proposé. */
    val nombrePistes: Int? get() = (pistes as? JsonArray)?.size
}

@Serializable
data class PlaylistCourte(
    @SerialName("_id") val id: String,
    val title: String,
    val coverUrl: String? = null,
    val songsCount: Int? = null,
    @Serializable(with = ProprietaireSouple::class) val owner: Proprietaire? = null,
)

@Serializable
data class Proprietaire(@SerialName("_id") val id: String? = null, val name: String? = null)

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

/** GET /api/charts : le top 20 de la période, la place de l'auditeur connecté, la tendance. */
@Serializable
data class Classement(
    val ranking: List<EntreeClassement> = emptyList(),
    val viewer: PlaceAuditeur? = null,
    val totalPlays: Int = 0,
    val trendPct: Double? = null,
    val genres: List<String> = emptyList(),
)

/**
 * Une place du classement. Les champs dépendent du type : titres (title,
 * artistName, artistId, duration), artistes (stageName), albums (title,
 * artistName), auditeurs (name, avatarUrl ; `_id` est alors le compte).
 */
@Serializable
data class EntreeClassement(
    @SerialName("_id") val id: String,
    val title: String? = null,
    val stageName: String? = null,
    val name: String? = null,
    val coverUrl: String? = null,
    val avatarUrl: String? = null,
    val artistName: String? = null,
    val artistId: String? = null,
    val verified: Boolean = false,
    val duration: Double = 0.0,
    val genre: String? = null,
    val plays: Int = 0,
    val rank: Int = 0,
    /** Places gagnées (positif) ou perdues ; null : nouvelle entrée. */
    val evolution: Int? = null,
) {
    val libelle: String get() = title ?: stageName ?: name.orEmpty()
    val image: String? get() = coverUrl ?: avatarUrl

    /** Le titre d'une place du classement des titres, prêt à jouer. */
    fun versTitre(): Titre? = title?.let {
        Titre(id = id, title = it, artist = artistId?.let { a -> ArtisteCourt(a, artistName, verified) }, coverUrl = coverUrl, duration = duration, genre = genre)
    }
}

@Serializable
data class PlaceAuditeur(val rank: Int = 0, val plays: Int = 0, val evolution: Int? = null, val toNextMilestone: Int = 0)

/** GET /api/radio. Les titres du jour et en progression n'ont ni audio ni artiste : ils ouvrent la fiche titre. */
@Serializable
data class ReponseRadio(
    val topToday: List<EntreeClassement> = emptyList(),
    val trending: List<EntreeClassement> = emptyList(),
    val genres: List<Genre> = emptyList(),
    val recommendedArtists: List<ArtisteCarte> = emptyList(),
)

/** GET /api/songs paginé. */
@Serializable
data class PageTitres(val songs: List<Titre> = emptyList(), val hasMore: Boolean = false, val total: Int = 0)

@Serializable
data class ConfigurationSite(
    val genres: List<String> = emptyList(),
    val aiFeatures: List<String> = emptyList(),
    /** Code ISO de la devise des prix affichés (billetterie). */
    val currency: String = "EUR",
)

@Serializable
data class Evenement(
    @SerialName("_id") val id: String,
    val title: String,
    val coverUrl: String? = null,
    val description: String? = null,
    val location: String? = null,
    val city: String? = null,
    val date: String,
    val price: Double? = null,
    val ticketUrl: String? = null,
    val category: String? = null,
    val interestedCount: Int = 0,
)

/** Un créneau du programme : l'heure est un texte libre de l'organisateur (« 18:00 », « 22 h 30 »). */
@Serializable
data class Creneau(val time: String = "", val title: String = "", val detail: String? = null)

/** Une ligne de la billetterie, informative : l'achat se fait chez l'organisateur. */
@Serializable
data class Billet(
    val name: String = "",
    val price: Double = 0.0,
    val description: String? = null,
    val originalPrice: Double? = null,
    val availableUntil: String? = null,
    val soldOut: Boolean = false,
)

@Serializable
data class Organisateur(val name: String? = null, val email: String? = null, val phone: String? = null, val website: String? = null)

/** GET /api/events/{id} : tout ce qui suit le titre et la date est facultatif. */
@Serializable
data class EvenementDetail(
    @SerialName("_id") val id: String,
    val title: String,
    val date: String,
    val endDate: String? = null,
    val description: String? = null,
    val coverUrl: String? = null,
    val location: String? = null,
    val address: String? = null,
    val postalCode: String? = null,
    val city: String? = null,
    val country: String? = null,
    val mapsUrl: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val price: Double? = null,
    val ticketUrl: String? = null,
    val category: String? = null,
    val gallery: List<String> = emptyList(),
    /** Un artiste supprimé depuis laisse un vide dans la liste peuplée. */
    val lineup: List<ArtisteCarte?> = emptyList(),
    val artist: ArtisteCarte? = null,
    val highlights: List<String> = emptyList(),
    val inclusions: List<String> = emptyList(),
    val program: List<Creneau> = emptyList(),
    val practicalInfo: List<String> = emptyList(),
    val tickets: List<Billet> = emptyList(),
    val tags: List<String> = emptyList(),
    val minAge: Int? = null,
    val organizer: Organisateur? = null,
    val interestedCount: Int = 0,
    val viewerInterested: Boolean = false,
)

@Serializable
data class ReponseEvenement(val event: EvenementDetail)

@Serializable
data class ListeEvenements(val events: List<Evenement> = emptyList(), val interestedIds: List<String> = emptyList())

@Serializable
data class EtatInteret(val interested: Boolean = false, val interestedCount: Int = 0)

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
    val coverUrl: String? = null,
    val bannerUrl: String? = null,
    val description: String? = null,
    /** album, ep, single ou podcast : le vocabulaire de la fiche en dépend (un podcast compte des épisodes). */
    val type: String? = null,
    val releaseDate: String? = null,
)

@Serializable
data class ListeAlbums(val albums: List<AlbumCourt> = emptyList())

@Serializable
data class AlbumAEnregistrer(val albumId: String)

@Serializable
data class EtatEnregistre(val saved: Boolean = false)

@Serializable
data class ReponsePlaylist(val playlist: PlaylistDetail)

@Serializable
data class PlaylistDetail(
    @SerialName("_id") val id: String,
    val title: String,
    val songs: List<Titre> = emptyList(),
    val coverUrl: String? = null,
    val description: String? = null,
    @Serializable(with = ProprietaireSouple::class) val owner: Proprietaire? = null,
    /** Une playlist privée n'est servie qu'à son propriétaire : absente, la playlist est donc publique. */
    val isPublic: Boolean = true,
)

/** GET /api/artists/{id} : la fiche, ses titres publiés, ses sorties et son voisinage. */
@Serializable
data class ReponseArtiste(
    val artist: ArtisteDetail,
    val songs: List<Titre> = emptyList(),
    val topSongs: List<Titre> = emptyList(),
    val albums: List<AlbumCourt> = emptyList(),
    val singles: List<AlbumCourt> = emptyList(),
    val playlistsFeaturing: List<PlaylistCourte> = emptyList(),
    val similarArtists: List<ArtisteCarte> = emptyList(),
)

@Serializable
data class ArtisteDetail(
    @SerialName("_id") val id: String,
    val stageName: String,
    val bio: String? = null,
    val coverUrl: String? = null,
    val bannerUrl: String? = null,
    val verified: Boolean = false,
    val followersCount: Int = 0,
    val totalPlays: Int = 0,
    val songsCount: Int = 0,
)

@Serializable
data class ArtistesSuivis(val artists: List<ArtisteCarte> = emptyList())

@Serializable
data class EtatSuivi(val following: Boolean = false, val followersCount: Int = 0)

/** GET /api/songs/{id}/lyrics : `raw` est le texte enregistré, analysé par l'app comme par le site. */
@Serializable
data class ReponseParoles(val raw: String = "")

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
