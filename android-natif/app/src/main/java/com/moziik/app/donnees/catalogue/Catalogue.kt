package com.moziik.app.donnees.catalogue

import com.moziik.app.donnees.reseau.JsonMoziik
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.donnees.session.Session
import com.moziik.app.donnees.session.appel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.util.Calendar
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

/** Les diapositives lisibles de la bannière ; une diapositive d'une forme inattendue est écartée. */
fun diaposDe(accueil: Accueil): List<Diapo> = accueil.hero.mapNotNull { lire(Diapo.serializer(), it) }

/** Une section de l'accueil, lue selon sa clé. */
sealed interface Section {
    val cle: String
    val titre: String

    /** `liste` : en lignes groupées par trois (nouveautés, artiste à l'honneur) plutôt qu'en cartes. */
    data class Titres(
        override val cle: String,
        override val titre: String,
        val titres: List<Titre>,
        val liste: Boolean = false,
        val voirTout: Cible? = null,
    ) : Section
    data class PourToi(override val cle: String, override val titre: String, val cartes: List<CartePourToi>) : Section
    data class Genres(override val cle: String, override val titre: String, val genres: List<Genre>) : Section
    data class Albums(override val cle: String, override val titre: String, val albums: List<AlbumCourt>, val voirTout: Cible? = null) : Section
    data class Playlists(override val cle: String, override val titre: String, val playlists: List<PlaylistCourte>) : Section
    /** `grands` : de grandes photos rondes, pour faire connaître des visages (artistes en herbe). */
    data class Artistes(override val cle: String, override val titre: String, val artistes: List<ArtisteCarte>, val grands: Boolean = false) : Section
    data class Evenements(override val cle: String, override val titre: String, val evenements: List<EvenementCourt>) : Section
    data class Collection(override val cle: String, override val titre: String, val elements: List<ElementCollection>) : Section
}

/**
 * Sur le site, ces sections forment la colonne latérale de l'accueil, qui
 * passe sous le contenu sur téléphone (app/page.tsx) : l'app les place de
 * même après le flux principal, dans l'ordre de cette colonne.
 */
private val SECTIONS_LATERALES = listOf("top_tracks", "events", "trending_artists")

private fun <T> lire(serialiseur: KSerializer<T>, data: JsonElement?): T? =
    data?.let { runCatching { JsonMoziik.decodeFromJsonElement(serialiseur, it) }.getOrNull() }

private fun <T> liste(serialiseur: KSerializer<T>, data: JsonElement?): List<T> =
    lire(ListSerializer(serialiseur), data).orEmpty()

/**
 * Les sections affichables, dans l'ordre. Une section vide, inconnue ou
 * illisible n'est pas affichée : mieux vaut pas de bloc qu'un titre suivi
 * d'un blanc (components/home/SectionBlock.tsx). `radio`, `activity` et
 * `premium` attendent les écrans Radio et Abonnement.
 */
fun sectionsDe(accueil: Accueil): List<Section> {
    val lues = accueil.sections.mapNotNull { s ->
        when (s.key) {
            "new_releases", "recommendations", "top_tracks", "recently_played" ->
                Section.Titres(s.key, s.title, liste(Titre.serializer(), s.data).filter { it.publie })
            "for_you" -> Section.PourToi(s.key, s.title, liste(CartePourToi.serializer(), s.data))
            "genres" -> Section.Genres(s.key, s.title, liste(Genre.serializer(), s.data))
            "albums" -> Section.Albums(s.key, s.title, liste(AlbumCourt.serializer(), s.data))
            "playlists" -> Section.Playlists(s.key, s.title, liste(PlaylistCourte.serializer(), s.data))
            "trending_artists" -> Section.Artistes(s.key, s.title, liste(ArtisteCarte.serializer(), s.data))
            "events" -> Section.Evenements(s.key, s.title, lire(SectionEvenements.serializer(), s.data)?.events.orEmpty())
            "custom" -> Section.Collection(s.key, s.title, liste(ElementCollection.serializer(), s.data))
            else -> null
        }
    }.filterNot { it.estVide() }
    val (laterales, principales) = lues.partition { it.cle in SECTIONS_LATERALES }
    return principales + laterales.sortedBy { SECTIONS_LATERALES.indexOf(it.cle) }
}

private fun Section.estVide(): Boolean = when (this) {
    is Section.Titres -> titres.isEmpty()
    is Section.PourToi -> cartes.isEmpty()
    is Section.Genres -> genres.isEmpty()
    is Section.Albums -> albums.isEmpty()
    is Section.Playlists -> playlists.isEmpty()
    is Section.Artistes -> artistes.isEmpty()
    is Section.Evenements -> evenements.isEmpty()
    is Section.Collection -> elements.isEmpty()
}

/** Un résultat de recherche, selon son `kind`. Évènements et membres attendent leurs écrans. */
sealed interface Resultat {
    data class DeTitre(val titre: Titre) : Resultat
    data class DArtiste(val artiste: ArtisteCarte) : Resultat
    data class DAlbum(val album: AlbumCourt) : Resultat
    data class DePlaylist(val playlist: PlaylistCourte) : Resultat
    data class DeGenre(val nom: String, val nombre: Int) : Resultat
}

data class SectionResultats(val cle: String, val titre: String, val resultats: List<Resultat>, val total: Int)

data class Resultats(val meilleur: Resultat?, val sections: List<SectionResultats>, val approximatif: Boolean) {
    val vide: Boolean get() = meilleur == null && sections.isEmpty()
}

@kotlinx.serialization.Serializable
private data class GenreTrouve(val name: String, val count: Int = 0)

private fun resultatDe(kind: String, objet: JsonObject): Resultat? = when (kind) {
    "song" -> lire(Titre.serializer(), objet)?.takeIf { it.publie }?.let { Resultat.DeTitre(it) }
    "artist" -> lire(ArtisteCarte.serializer(), objet)?.let { Resultat.DArtiste(it) }
    "album" -> lire(AlbumCourt.serializer(), objet)?.let { Resultat.DAlbum(it) }
    "playlist" -> lire(PlaylistCourte.serializer(), objet)?.let { Resultat.DePlaylist(it) }
    "genre" -> lire(GenreTrouve.serializer(), objet)?.let { Resultat.DeGenre(it.name, it.count) }
    else -> null
}

fun resultatsDe(reponse: ReponseRecherche): Resultats {
    val meilleur = reponse.top?.let { top -> top["kind"]?.jsonPrimitive?.contentOrNull?.let { resultatDe(it, top) } }
    val sections = reponse.sections.mapNotNull { s ->
        val resultats = s.items.mapNotNull { resultatDe(s.kind, it) }
        if (resultats.isEmpty()) null else SectionResultats(s.key, s.title, resultats, maxOf(s.total, resultats.size))
    }
    return Resultats(meilleur, sections, reponse.approximatif)
}

/** Ses titres les plus écoutés d'abord, puis le reste de son catalogue, du plus récent au plus ancien. */
fun titresDeLArtiste(reponse: ReponseArtiste): List<Titre> =
    (reponse.topSongs + reponse.songs).distinctBy { it.id }.filter { it.publie }

/** Une liste prête à jouer, et ce qu'elle est (« depuis … » dans le lecteur). */
data class AEcouter(val titres: List<Titre>, val source: String)

fun heureLocale(): Int = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)

/**
 * L'accès au catalogue : accueil, recherche, et ce qu'il faut charger pour
 * lancer un album, une playlist, un artiste, un genre ou la station.
 */
class Catalogue(
    private val api: MoziikApi,
    private val session: Session,
    /** Où garder la copie de l'accueil, propre à chaque compte. */
    private val dossier: File,
) {
    @Volatile private var universConnu: Pair<String?, String>? = null
    @Volatile private var modeConnu: Pair<String?, String?>? = null

    private val _preferences = kotlinx.coroutines.flow.MutableStateFlow(0)
    /** Augmente à chaque changement d'univers ou de mode : l'accueil se recharge. */
    val preferences: kotlinx.coroutines.flow.StateFlow<Int> = _preferences

    /** Après un changement d'univers ou de mode dans les préférences : relus au prochain appel, accueil rechargé. */
    fun preferencesChangees() {
        universConnu = null
        modeConnu = null
        _preferences.value++
    }

    /**
     * Le mode d'écoute choisi sur le compte, s'il est concret. « auto » ou
     * rien : null, et le site déduit le moment de l'heure envoyée (A3).
     * Envoyé, il prime sur l'heure.
     */
    suspend fun mode(): String? {
        val compte = compte()
        modeConnu?.let { (c, m) -> if (c == compte) return m }
        if (compte == null) return null
        val mode = appel { api.mode().mode }.getOrNull()?.takeIf { it != "auto" }
        modeConnu = compte to mode
        return mode
    }

    private fun compte(): String? = (session.etat.value as? EtatSession.Connecte)?.utilisateur?.id

    /**
     * L'univers du compte (ou celui du site pour un visiteur), relu à chaque
     * changement de compte. Sans réseau : null, et le site applique son
     * univers par défaut.
     */
    suspend fun univers(): String? {
        val compte = compte()
        universConnu?.let { (c, u) -> if (c == compte) return u }
        val univers = appel { api.univers().univers }.getOrNull() ?: return null
        universConnu = compte to univers
        return univers
    }

    private fun fichierAccueil() = File(dossier, "accueil-${compte() ?: "visiteur"}.json")

    /**
     * La dernière version de l'accueil vue sur cet appareil, pour un
     * affichage immédiat au lancement (spécification D1). Rangée par compte :
     * elle contient les écoutes récentes de la personne.
     */
    fun accueilGarde(): Accueil? = runCatching {
        fichierAccueil().takeIf { it.exists() }?.readText()?.let { JsonMoziik.decodeFromString(Accueil.serializer(), it) }
    }.getOrNull()

    /**
     * Les sections que l'app compose elle-même (SectionsAuto), lues en
     * parallèle. Une source en panne retire ses sections sans bloquer les
     * autres.
     */
    suspend fun sectionsAuto(maintenant: Long = System.currentTimeMillis()): List<Section> = coroutineScope {
        val u = univers()
        val jour = SectionsAuto.jour(maintenant)
        val recents = async { appel { api.titres(limite = 100, univers = u) }.getOrNull()?.songs.orEmpty() }
        val populaires = async { appel { api.titres(tri = "popular", limite = 100, univers = u) }.getOrNull()?.songs.orEmpty() }
        val albums = async {
            // /api/albums ne filtre pas l'univers : l'app le fait (un album suit l'univers de son auteur).
            appel { api.albums() }.getOrNull()?.albums.orEmpty().filter { u == null || it.univers == null || it.univers == u }
        }
        val r = recents.await().filter { it.publie }
        val pop = populaires.await().filter { it.publie }
        val honneur = SectionsAuto.artisteALHonneur(r, pop, jour)?.let { artiste ->
            async {
                appel { api.titres(tri = "popular", limite = 9, univers = u, artiste = artiste.id) }.getOrNull()
                    ?.songs?.filter { it.publie }?.let { artiste to it }
            }
        }
        val herbe = SectionsAuto.artistesEnHerbe(r).map { a ->
            async {
                appel { api.artiste(a.id).artist }.getOrNull()
                    ?.takeIf { !it.coverUrl.isNullOrBlank() }
                    ?.let { ArtisteCarte(it.id, it.stageName, it.verified, it.coverUrl, it.followersCount) }
            }
        }
        SectionsAuto.composer(
            MatiereAuto(r, pop, albums.await(), honneur?.await(), herbe.awaitAll().filterNotNull()),
            jour,
            maintenant,
        )
    }

    suspend fun accueil(): Accueil {
        val accueil = appel { api.accueil(univers(), heureLocale(), mode()) }.getOrThrow()
        val fichier = fichierAccueil()
        withContext(Dispatchers.IO) {
            runCatching {
                dossier.mkdirs()
                fichier.writeText(JsonMoziik.encodeToString(Accueil.serializer(), accueil))
            }
        }
        return accueil
    }

    suspend fun recherche(terme: String, type: String, page: Int): Resultats =
        resultatsDe(appel { api.recherche(terme, type, page, TAILLE_PAGE, univers()) }.getOrThrow())

    /** Une fois par terme, quand la recherche est stable et a trouvé quelque chose (D5). Échec sans conséquence. */
    suspend fun journaliser(terme: String) {
        appel { api.journalRecherche(TermeRecherche(terme)) }
    }

    /** « Suggestions populaires » de la recherche vide : les titres du mois (D7). */
    suspend fun populaires(): List<Titre> =
        appel { api.classement("month", "songs", univers()) }.getOrThrow().ranking.take(6).mapNotNull { it.versTitre() }

    /** Les titres les plus écoutés de la semaine : la liste « Tendances » d'Android Auto. */
    suspend fun tendances(): List<Titre> =
        appel { api.classement("week", "songs", univers()) }.getOrThrow().ranking.mapNotNull { it.versTitre() }.filter { it.publie }

    // ------------------------------------------------------------ Découvrir

    suspend fun classement(periode: String, type: String, genre: String?): Classement =
        appel { api.classement(periode, type, univers(), genre) }.getOrThrow()

    suspend fun radio(): ReponseRadio = appel { api.radio(univers()) }.getOrThrow()

    suspend fun pageTitres(genre: String?, page: Int): PageTitres =
        appel { api.pageTitres(genre, page, TAILLE_PAGE, univers()) }.getOrThrow().let { it.copy(songs = it.songs.filter { t -> t.publie }) }

    @Volatile private var genresConnus: List<String>? = null

    /** Les genres proposés par le site (SiteConfig.genres), lus une fois. */
    suspend fun genres(): List<String> {
        genresConnus?.let { return it }
        return appel { api.configuration().genres }.getOrThrow().also { genresConnus = it }
    }

    suspend fun evenements(): ListeEvenements = appel { api.evenements() }.getOrThrow()

    suspend fun evenement(id: String): EvenementDetail = appel { api.evenement(id).event }.getOrThrow()

    @Volatile private var deviseConnue: String? = null

    /** La devise des prix du site, lue une fois ; l'euro si le site ne répond pas. */
    suspend fun devise(): String {
        deviseConnue?.let { return it }
        return appel { api.configuration().currency }.getOrNull()?.also { deviseConnue = it } ?: "EUR"
    }

    suspend fun basculerInteret(id: String): EtatInteret = appel { api.basculerInteret(id) }.getOrThrow()

    /** Les titres d'une station de la page Radio, mélangés comme sur le site. */
    suspend fun station(station: StationRadio): AEcouter {
        val titres = when (val source = station.source) {
            SourceStation.Tendances -> appel { api.titres(tri = "popular", limite = 50, univers = univers()).songs }.getOrThrow()
            SourceStation.Nouveautes, SourceStation.Generale -> appel { api.titres(limite = 50, univers = univers()).songs }.getOrThrow()
            SourceStation.Favoris -> appel { api.titresAimes().songs }.getOrThrow()
            is SourceStation.DeGenre -> appel { api.titres(genre = source.genre, limite = 50, univers = univers()).songs }.getOrThrow()
        }
        return AEcouter(titres.filter { it.publie }.shuffled(), station.libelle)
    }

    // ------------------------------------------------------------ Fiches

    /** Un titre non publié n'a pas de fiche publique : le site ne filtre pas cette route, l'app le fait. */
    suspend fun titre(id: String): Titre =
        appel { api.titre(id).song }.getOrThrow().takeIf { it.publie } ?: throw com.moziik.app.donnees.reseau.ErreurApi(404, "Son introuvable.")

    suspend fun similaires(id: String): List<Titre> = appel { api.similaires(id, 12).songs }.getOrThrow().filter { it.publie }

    /**
     * L'album n'a pas de statut : ses pistes non publiées sont écartées ici.
     * Elles n'ont que l'identifiant de l'artiste, que celui de l'album complète.
     */
    suspend fun album(id: String): AlbumDetail {
        val album = appel { api.album(id).album }.getOrThrow()
        return album.copy(
            songs = album.songs.filter { it.publie }.map { t ->
                if (t.artist?.stageName == null && album.artist != null) t.copy(artist = album.artist) else t
            },
        )
    }

    suspend fun albumsDe(artiste: String): List<AlbumCourt> = appel { api.albumsDe(artiste).albums }.getOrThrow()

    suspend fun playlist(id: String): PlaylistDetail =
        appel { api.playlist(id).playlist }.getOrThrow().let { it.copy(songs = it.songs.filter { t -> t.publie }) }

    suspend fun artiste(id: String): ReponseArtiste = appel { api.artiste(id) }.getOrThrow()

    /**
     * La radio d'un artiste : ses titres mélangés, et des titres proches de
     * ses trois plus écoutés. Une recherche de titres proches qui échoue
     * n'empêche pas la radio : elle se contente alors de l'artiste.
     */
    suspend fun radioArtiste(r: ReponseArtiste): List<Titre> = coroutineScope {
        val siens = titresDeLArtiste(r)
        val proches = siens.take(3)
            .map { graine -> async { runCatching { similaires(graine.id) }.getOrDefault(emptyList()) } }
            .awaitAll()
            .flatten()
            .shuffled()
        // Le titre le plus écouté ouvre la radio ; la suite est mélangée pour qu'elle change à chaque lancement.
        entrelacerRadio(siens.take(1) + siens.drop(1).shuffled(), proches)
    }

    /** Faux pour un visiteur : il n'a ni albums enregistrés ni artistes suivis. */
    suspend fun albumEnregistre(id: String): Boolean =
        compte() != null && appel { api.albumsEnregistres().albums }.getOrDefault(emptyList()).any { it.id == id }

    suspend fun basculerAlbum(id: String): Boolean = appel { api.basculerAlbum(AlbumAEnregistrer(id)).saved }.getOrThrow()

    /** Le site ne dit pas sur la fiche si l'on suit l'artiste : on le déduit de la liste des suivis (D12). */
    suspend fun artisteSuivi(id: String): Boolean =
        compte() != null && appel { api.artistesSuivis().artists }.getOrDefault(emptyList()).any { it.id == id }

    suspend fun basculerSuivi(id: String): EtatSuivi = appel { api.basculerSuivi(id) }.getOrThrow()

    private val paroles = object : LinkedHashMap<String, Paroles>(16, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Paroles>?) = size > 20
    }

    /** Les paroles d'un titre, gardées pour les vingt derniers : rouvrir l'onglet ne les redemande pas. */
    suspend fun paroles(id: String): Paroles {
        synchronized(paroles) { paroles[id] }?.let { return it }
        val brut = appel { api.paroles(id).raw }.getOrThrow()
        val analysees = withContext(Dispatchers.Default) { analyserParoles(brut) }
        synchronized(paroles) { paroles[id] = analysees }
        return analysees
    }

    /** Ce qu'il faut jouer pour une cible du routeur, ou null si elle ne se joue pas. */
    suspend fun aEcouter(cible: Cible): AEcouter? = when (cible) {
        is Cible.DeTitre -> titre(cible.id).let { AEcouter(listOf(it), it.title) }
        is Cible.DAlbum -> album(cible.id).let { AEcouter(it.songs, it.title) }
        is Cible.DePlaylist -> playlist(cible.id).let { AEcouter(it.songs, it.title) }
        is Cible.DArtiste -> {
            val reponse = artiste(cible.id)
            AEcouter(titresDeLArtiste(reponse), reponse.artist.stageName)
        }
        // Comme une station de genre de la page Radio : les plus écoutés, mélangés (lib/radios.ts).
        is Cible.DeGenre -> AEcouter(
            appel { api.titres(genre = cible.genre, tri = "popular", limite = 50, univers = univers()).songs }.getOrThrow()
                .filter { it.publie }.shuffled(),
            cible.genre,
        )
        else -> null
    }

    /** « Ma bande son » : la station personnelle, générique pour un visiteur (D14). */
    suspend fun station(): AEcouter {
        val station = appel { api.station(heureLocale(), univers(), mode()) }.getOrThrow()
        return AEcouter(station.songs, station.presentation?.nom ?: "Ma bande son")
    }

    companion object {
        /** Le site envoie 24 ; au-delà de 50 il refuse. */
        const val TAILLE_PAGE = 24
    }
}
