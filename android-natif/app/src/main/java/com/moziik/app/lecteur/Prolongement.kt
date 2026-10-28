package com.moziik.app.lecteur

import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.catalogue.heureLocale
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel
import kotlin.math.abs
import kotlin.random.Random

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

/** Une lecture lancée depuis la page d'un artiste continue avec lui, jusqu'à cinq titres. */
const val SUITE_MEME_ARTISTE = 5

/** Le préfixe de l'origine d'une file lancée depuis la page d'un artiste : « artiste:<id> ». */
const val ORIGINE_ARTISTE = "artiste:"

/** Au-delà, un même artiste occuperait trop la suite : elle doit faire découvrir. */
private const val PAR_ARTISTE_MAX = 3
private val GENRES_VAGUES = setOf("", "autre")

/**
 * Le mode de suite. Il n'est plus réglable : la suite est choisie d'après
 * l'origine de la lecture (Prolongement). ARRET sert à l'invité d'une écoute
 * à plusieurs, dont la file suit l'hôte.
 */
enum class ModeSuite { AUTOMATIQUE, ARRET }

/** Les candidats au tempo proche de `bpm`, du plus proche au plus éloigné ; ceux sans tempo connu sont écartés. */
fun parRythme(bpm: Double, candidats: List<Titre>, ecart: Double = ECART_BPM): List<Titre> =
    candidats
        .mapNotNull { t -> t.bpm?.takeIf { it > 0 }?.let { t to abs(it - bpm) } }
        .filter { it.second <= ecart }
        .sortedBy { it.second }
        .map { it.first }

private fun annee(t: Titre): Int? = t.releaseDate?.take(4)?.toIntOrNull()

/**
 * La ressemblance d'un candidat avec le titre qui vient de jouer : même
 * genre, même rythme (tempo voisin), même époque (année de sortie), même
 * style (titres proches d'après le site : artiste, mots-clés, album), même
 * univers, et sa tendance (sa popularité dans le vivier).
 */
fun noteSuite(ref: Titre, t: Titre, proches: Set<String>, ecoutesMax: Int): Double {
    var note = 0.0
    val genre = t.genre?.lowercase()
    if (genre != null && genre !in GENRES_VAGUES && genre == ref.genre?.lowercase()) note += 3.0
    val bpmRef = ref.bpm?.takeIf { it > 0 }
    val bpm = t.bpm?.takeIf { it > 0 }
    if (bpmRef != null && bpm != null) note += 3.0 * (1 - abs(bpm - bpmRef) / 15.0).coerceAtLeast(0.0)
    val anRef = annee(ref)
    val an = annee(t)
    if (anRef != null && an != null) note += 2.0 * (1 - abs(an - anRef) / 5.0).coerceAtLeast(0.0)
    if (t.id in proches) note += 2.0
    if (t.univers != null && t.univers == ref.univers) note += 1.0
    if (ecoutesMax > 0) note += t.playsCount.toDouble() / ecoutesMax
    return note
}

/**
 * La suite mélangée : chaque candidat reçoit sa note de ressemblance plus une
 * part de hasard, pour que deux écoutes du même titre n'enchaînent pas la
 * même suite. Au plus trois titres d'un même artiste.
 */
fun melangeSuite(ref: Titre, candidats: List<Titre>, proches: Set<String>, hasard: Random = Random.Default): List<Titre> {
    val vivier = candidats.filter { it.publie && it.id != ref.id }.distinctBy { it.id }
    val ecoutesMax = vivier.maxOfOrNull { it.playsCount } ?: 0
    val parArtiste = HashMap<String?, Int>()
    return vivier
        .map { it to noteSuite(ref, it, proches, ecoutesMax) + hasard.nextDouble() * 2.0 }
        .sortedByDescending { it.second }
        .map { it.first }
        .filter { t ->
            val n = parArtiste.getOrDefault(t.artist?.id, 0)
            parArtiste[t.artist?.id] = n + 1
            n < PAR_ARTISTE_MAX
        }
}

/**
 * La suite d'une file arrivée à sa fin : la musique ne s'arrête pas au
 * dernier titre d'un album ou d'une recherche, et le choix se fait seul.
 * - Lancée depuis la page d'un artiste : jusqu'à cinq autres titres de lui,
 *   puis le mélange.
 * - Sinon : un mélange de titres au même rythme, du même genre, du même
 *   style, de la même époque, parmi ceux qui marchent.
 * À défaut de vivier (titre inconnu, réseau), les recommandations du compte.
 */
class Prolongement(
    private val api: MoziikApi,
    private val univers: suspend () -> String?,
    private val mode: suspend () -> String? = { null },
    private val modeSuite: () -> ModeSuite = { ModeSuite.AUTOMATIQUE },
) {
    suspend fun suite(dernier: String, exclus: Set<String>, origine: String? = null): List<Titre> {
        if (modeSuite() == ModeSuite.ARRET) return emptyList()
        val ref = appel { api.titre(dernier).song }.getOrNull()
        val u = univers()

        val artiste = origine?.takeIf { it.startsWith(ORIGINE_ARTISTE) }?.removePrefix(ORIGINE_ARTISTE)
        val memeArtiste = if (artiste == null) emptyList() else {
            appel { api.titres(tri = "popular", limite = 50, artiste = artiste).songs }.getOrDefault(emptyList())
                .filter { it.publie && it.id !in exclus }
                .shuffled()
                .take(SUITE_MEME_ARTISTE)
        }

        val proches = appel { api.similaires(dernier, 30).songs }.getOrDefault(emptyList())
        val vivier = buildList {
            addAll(proches)
            ref?.genre?.takeIf { it.lowercase() !in GENRES_VAGUES }?.let { g ->
                addAll(appel { api.titres(genre = g, tri = "popular", limite = 80, univers = u).songs }.getOrDefault(emptyList()))
            }
            addAll(appel { api.titres(tri = "popular", limite = 80, univers = u).songs }.getOrDefault(emptyList()))
        }.filter { it.id !in exclus && memeArtiste.none { m -> m.id == it.id } }
        val melange = if (ref != null) melangeSuite(ref, vivier, proches.map { it.id }.toSet()) else vivier.shuffled()

        retenirSuite(memeArtiste + melange, exclus).takeIf { it.isNotEmpty() }?.let { return it }
        val recommandes = appel { api.recommandations(u, heureLocale(), mode()).songs }.getOrDefault(emptyList())
        return retenirSuite(recommandes, exclus)
    }
}
