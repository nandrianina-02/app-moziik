package com.moziik.app.lecteur

import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.catalogue.heureLocale
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel
import kotlin.math.abs

/** Titres retenus pour prolonger la file : jouables, jamais déjà vus, sans doublon (spécification 5.6). */
fun retenirSuite(candidats: List<Titre>, exclus: Set<String>, maximum: Int = TITRES_PAR_TOUR): List<Titre> =
    candidats.asSequence()
        .filter { it.publie && it.id !in exclus }
        .distinctBy { it.id }
        .take(maximum)
        .toList()

const val TITRES_PAR_TOUR = 20

/** Écart de tempo toléré pour « même rythme », en battements par minute. */
const val ECART_BPM = 8.0

/**
 * Ce qui suit une file arrivée à sa fin, au choix de l'auditeur :
 * - AMBIANCE : des titres proches du dernier (artiste, genre, mots-clés), comme avant ;
 * - RYTHME : un tempo voisin du dernier, quel que soit le genre ;
 * - ARTISTE : l'artiste du dernier titre, puis des titres proches ;
 * - DECOUVERTE : les sorties récentes encore peu écoutées ;
 * - POPULAIRES : les titres les plus écoutés, mélangés ;
 * - ARRET : la lecture s'arrête à la fin de la file.
 */
enum class ModeSuite(val cle: String, val libelle: String, val detail: String) {
    AMBIANCE("ambiance", "Même ambiance", "Des titres proches du dernier écouté"),
    RYTHME("rythme", "Même rythme", "Un tempo voisin, pour garder l'élan"),
    ARTISTE("artiste", "Même artiste", "Le reste de son catalogue, puis des titres proches"),
    DECOUVERTE("decouverte", "Découverte", "Les sorties récentes encore peu écoutées"),
    POPULAIRES("populaires", "Populaires", "Les titres les plus écoutés du moment"),
    ARRET("arret", "Arrêter à la fin", "Rien n'est ajouté après le dernier titre");

    companion object {
        fun de(cle: String?): ModeSuite = entries.firstOrNull { it.cle == cle } ?: AMBIANCE
    }
}

/** Les candidats au tempo proche de `bpm`, du plus proche au plus éloigné ; ceux sans tempo connu sont écartés. */
fun parRythme(bpm: Double, candidats: List<Titre>, ecart: Double = ECART_BPM): List<Titre> =
    candidats
        .mapNotNull { t -> t.bpm?.takeIf { it > 0 }?.let { t to abs(it - bpm) } }
        .filter { it.second <= ecart }
        .sortedBy { it.second }
        .map { it.first }

/** Les sorties récentes les moins écoutées d'abord : ce que l'accueil ne met pas encore en avant. */
fun parDecouverte(recents: List<Titre>): List<Titre> = recents.sortedBy { it.playsCount }

/**
 * La suite d'une file arrivée à sa fin : la musique ne s'arrête pas au
 * dernier titre d'un album ou d'une recherche. Chaque mode retombe sur les
 * titres proches, puis sur les recommandations du compte, quand il ne
 * trouve rien de neuf.
 */
class Prolongement(
    private val api: MoziikApi,
    private val univers: suspend () -> String?,
    private val mode: suspend () -> String? = { null },
    private val modeSuite: () -> ModeSuite = { ModeSuite.AMBIANCE },
) {
    suspend fun suite(dernier: String, exclus: Set<String>): List<Titre> {
        val choix = modeSuite()
        if (choix == ModeSuite.ARRET) return emptyList()
        val propres = when (choix) {
            ModeSuite.RYTHME -> rythme(dernier)
            ModeSuite.ARTISTE -> artiste(dernier)
            ModeSuite.DECOUVERTE -> appel { api.titres(limite = 100, univers = univers()).songs }.getOrDefault(emptyList()).let(::parDecouverte)
            ModeSuite.POPULAIRES -> appel { api.titres(tri = "popular", limite = 60, univers = univers()).songs }.getOrDefault(emptyList()).shuffled()
            else -> emptyList()
        }
        retenirSuite(propres, exclus).takeIf { it.isNotEmpty() }?.let { return it }
        val proches = appel { api.similaires(dernier, 30).songs }.getOrDefault(emptyList())
        retenirSuite(proches, exclus).takeIf { it.isNotEmpty() }?.let { return it }
        val recommandes = appel { api.recommandations(univers(), heureLocale(), mode()).songs }.getOrDefault(emptyList())
        return retenirSuite(recommandes, exclus)
    }

    /** Le tempo du dernier titre, cherché dans son genre puis dans les plus écoutés. */
    private suspend fun rythme(dernier: String): List<Titre> {
        val titre = appel { api.titre(dernier).song }.getOrNull() ?: return emptyList()
        val bpm = titre.bpm?.takeIf { it > 0 } ?: return emptyList()
        val vivier = buildList {
            titre.genre?.let { g -> addAll(appel { api.titres(genre = g, tri = "popular", limite = 100, univers = univers()).songs }.getOrDefault(emptyList())) }
            addAll(appel { api.titres(tri = "popular", limite = 100, univers = univers()).songs }.getOrDefault(emptyList()))
        }
        return parRythme(bpm, vivier.filter { it.id != dernier })
    }

    private suspend fun artiste(dernier: String): List<Titre> {
        val titre = appel { api.titre(dernier).song }.getOrNull() ?: return emptyList()
        val id = titre.artist?.id ?: return emptyList()
        return appel { api.titres(tri = "popular", limite = 50, artiste = id).songs }.getOrDefault(emptyList()).shuffled()
    }
}
