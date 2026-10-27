package com.moziik.app.donnees.catalogue

import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/** Ce dont les sections automatiques sont faites, lu sur l'API publique. */
data class MatiereAuto(
    /** Les titres publiés les plus récents de l'univers. */
    val recents: List<Titre>,
    /** Les plus écoutés de l'univers. */
    val populaires: List<Titre>,
    /** Les albums de l'univers, déjà triés du plus récent au plus ancien. */
    val albums: List<AlbumCourt> = emptyList(),
    /** L'artiste à l'honneur et ses titres les plus écoutés. */
    val honneur: Pair<ArtisteCourt, List<Titre>>? = null,
    /** Les artistes en herbe, avec leur photo. */
    val herbe: List<ArtisteCarte> = emptyList(),
    /** Les genres choisis par l'auditeur, en minuscules : leurs sélections passent en tête. */
    val genresPreferes: Set<String> = emptySet(),
)

/**
 * Les sections que l'app compose seule, entre celles de l'administration :
 * nouveautés, sélections par genre, artiste à l'honneur, artistes en herbe,
 * pépites, coups de coeur, albums. Elles ne demandent aucune saisie et
 * tournent d'un jour à l'autre (genre, artiste), sans bouger dans la
 * journée : on retrouve l'accueil qu'on a quitté.
 *
 * Tout part de titres publiés (CDC : un brouillon n'est jamais montré) et
 * de l'univers du compte, appliqué par le site sur /api/songs.
 */
object SectionsAuto {
    private const val JOUR_MS = 86_400_000L
    private const val PAR_SECTION = 10
    /**
     * Au plus six sections automatiques par jour, nouveautés comprises :
     * au-delà, l'accueil devient une liste qu'on ne finit jamais. Les
     * autres reviennent les jours suivants, à tour de rôle.
     */
    const val MAX_AUTO = 6
    /** Genres trop génériques pour faire une sélection qui ait du sens. */
    private val GENRES_ECARTES = setOf("autre", "divers")

    /** Le numéro du jour à Madagascar (UTC+3) : la rotation change à minuit, heure locale. */
    fun jour(maintenant: Long): Int = ((maintenant + 3 * 3_600_000L) / JOUR_MS).toInt()

    private fun instant(iso: String?): Long? = iso?.takeIf { it.length >= 10 }?.let {
        runCatching {
            SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.parse(it.take(10))?.time
        }.getOrNull()
    }

    /** L'artiste à l'honneur du jour : parmi ceux qui ont au moins trois titres dans les listes, à tour de rôle. */
    fun artisteALHonneur(recents: List<Titre>, populaires: List<Titre>, jour: Int): ArtisteCourt? {
        val parArtiste = (populaires + recents).distinctBy { it.id }.mapNotNull { it.artist }.groupBy { it.id }
        val candidats = parArtiste.filterValues { it.size >= 3 }.keys.sorted()
        if (candidats.isEmpty()) return null
        val id = candidats[Math.floorMod(jour, candidats.size)]
        return parArtiste.getValue(id).first()
    }

    /** Les artistes non vérifiés qui sortent des titres en ce moment : les plus récents d'abord. */
    fun artistesEnHerbe(recents: List<Titre>, maximum: Int = 6): List<ArtisteCourt> =
        recents.mapNotNull { it.artist }.filter { !it.verified && !it.stageName.isNullOrBlank() }.distinctBy { it.id }.take(maximum)

    fun composer(m: MatiereAuto, jour: Int, maintenant: Long): List<Section> {
        val recents = m.recents.filter { it.publie }
        val populaires = m.populaires.filter { it.publie }
        val sections = mutableListOf<Section>()

        // Nouveautés : « de la semaine » seulement si la semaine en a assez, sinon les dernières sorties.
        val semaine = recents.filter { t -> instant(t.releaseDate)?.let { maintenant - it <= 7 * JOUR_MS } == true }
        if (semaine.size >= 6) {
            sections += Section.Titres("auto-nouveautes", "Nouveautés de la semaine", semaine.take(15), liste = true, voirTout = Cible.Titres(null))
        } else if (recents.size >= 3) {
            sections += Section.Titres("auto-nouveautes", "Dernières sorties", recents.take(15), liste = true, voirTout = Cible.Titres(null))
        }

        // Un genre par sélection, dans un ordre qui tourne chaque jour.
        val parGenre = populaires
            .filter { !it.genre.isNullOrBlank() && it.genre.lowercase() !in GENRES_ECARTES }
            .groupBy { it.genre!! }
            .filterValues { it.size >= 4 }
            .entries.sortedByDescending { it.value.size }
        // Les genres choisis d'abord, puis les autres à tour de rôle d'un jour à l'autre.
        val preferes = parGenre.filter { it.key.lowercase() in m.genresPreferes }
        val autres = parGenre.filter { it.key.lowercase() !in m.genresPreferes }
        val tournants = if (autres.isEmpty()) emptyList() else List(autres.size) { autres[Math.floorMod(jour + it, autres.size)] }
        val genres = (preferes + tournants).take(3)
        val selections = genres.map { (genre, titres) ->
            Section.Titres("auto-genre-$genre", "Sélection $genre", titres.take(PAR_SECTION), voirTout = Cible.Titres(genre))
        }

        val honneur = m.honneur?.takeIf { it.second.size >= 3 }?.let { (artiste, titres) ->
            Section.Titres(
                "auto-honneur", "À l'honneur : ${artiste.stageName ?: "Artiste"}", titres.filter { it.publie }.take(9),
                liste = true, voirTout = Cible.DArtiste(artiste.id),
            )
        }

        val herbe = m.herbe.takeIf { it.size >= 3 }?.let { Section.Artistes("auto-herbe", "Artistes en herbe", it, grands = true) }

        // Pépites : récentes, peu écoutées, mais déjà aimées ; ce que l'accueil ne montre pas ailleurs.
        val dejaVus = sections.flatMap { (it as? Section.Titres)?.titres.orEmpty() }.map { it.id }.toSet()
        val pepites = recents.drop(15)
            .filter { it.id !in dejaVus && it.likesCount > 0 }
            .sortedByDescending { it.likesCount.toDouble() / (it.playsCount + 1) }
            .take(PAR_SECTION)
            .takeIf { it.size >= 4 }
            ?.let { Section.Titres("auto-pepites", "Pépites à découvrir", it) }

        val coeur = populaires.filter { it.likesCount > 0 }.sortedByDescending { it.likesCount }.take(PAR_SECTION)
            .takeIf { it.size >= 4 }
            ?.let { Section.Titres("auto-coeur", "Coups de coeur du public", it) }

        val albums = m.albums.filter { it.type != "podcast" && it.nombrePistes != 0 }.take(PAR_SECTION)
            .takeIf { it.size >= 3 }
            ?.let { Section.Albums("auto-albums", "Albums récents", it) }
        val podcasts = m.albums.filter { it.type == "podcast" && it.nombrePistes != 0 }.take(PAR_SECTION)
            .takeIf { it.isNotEmpty() }
            ?.let { Section.Albums("auto-podcasts", "Podcasts", it) }

        // L'ordre alterne les formes : liste, cartes, ronds, pour que l'accueil se parcoure sans monotonie.
        val candidates = listOfNotNull(selections.getOrNull(0), honneur, herbe, pepites, selections.getOrNull(1), albums, coeur, selections.getOrNull(2), podcasts)
        sections += tournantes(candidates, MAX_AUTO - sections.size, jour)
        return sections
    }

    /**
     * `nombre` sections parmi `candidates`, en partant d'un rang qui avance
     * chaque jour ; l'ordre d'alternance des formes est conservé.
     */
    fun <T> tournantes(candidates: List<T>, nombre: Int, jour: Int): List<T> {
        if (nombre <= 0 || candidates.isEmpty()) return emptyList()
        if (candidates.size <= nombre) return candidates
        val depart = Math.floorMod(jour, candidates.size)
        val rangs = List(nombre) { (depart + it) % candidates.size }.sorted()
        return rangs.map { candidates[it] }
    }

    /**
     * Les sections automatiques glissées entre celles de l'administration :
     * une après chacune, à partir de la deuxième ; le reste à la fin. Les
     * choix de l'administration gardent leur ordre et leur tête d'affiche.
     */
    fun entrelacer(admin: List<Section>, auto: List<Section>): List<Section> {
        if (auto.isEmpty()) return admin
        val reste = ArrayDeque(auto)
        val resultat = mutableListOf<Section>()
        admin.forEachIndexed { i, s ->
            resultat += s
            if (i >= 1) reste.removeFirstOrNull()?.let { resultat += it }
        }
        resultat += reste
        return resultat
    }
}
