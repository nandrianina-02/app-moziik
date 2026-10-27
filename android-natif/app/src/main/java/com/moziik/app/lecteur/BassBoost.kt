package com.moziik.app.lecteur

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.pow
import kotlin.math.sin

/**
 * Les cinq niveaux du Bass Boost, repris tels quels du site
 * (components/player/constants/bassBoost.ts) : mêmes filtres, mêmes gains,
 * donc la même courbe mesurée. Deux cloches (75 Hz, le corps ; 45 Hz, le
 * sub qu'on ressent) plutôt qu'un low-shelf qui gonflerait l'infra-basse
 * inaudible, un creux à 300 Hz qui garde la voix nette, et une
 * atténuation d'entrée qui laisse la marge avant écrêtage.
 */
enum class NiveauBass(
    val cle: String,
    val libelle: String,
    val description: String,
    val poidsDb: Double,
    val profondeurDb: Double,
    val clarteDb: Double,
    val preGainDb: Double,
) {
    OFF("off", "Off", "Aucun traitement, le morceau tel qu'il a été masterisé.", 0.0, 0.0, 0.0, 0.0),
    LEGER("leger", "Léger", "Un peu de corps, sans rien changer à l'équilibre du morceau.", 3.0, 2.2, -1.1, -1.2),
    NORMAL("normal", "Normal", "Grave présent et net. Le bon réglage pour la plupart des casques.", 5.5, 4.0, -2.0, -2.2),
    PROFOND("profond", "Profond", "Basses puissantes et profondes, voix toujours dégagée.", 8.0, 6.0, -3.0, -3.2),
    TRES_PROFOND("tres-profond", "Très profond", "Maximum de grave. À réserver au casque et aux enceintes qui suivent.", 10.5, 8.0, -3.8, -4.2);

    companion object {
        fun de(cle: String?): NiveauBass = entries.firstOrNull { it.cle == cle } ?: OFF
    }
}

/** Fréquences et facteurs de qualité du site : fixes, la courbe en dépend. */
const val FREQ_POIDS = 75.0
const val Q_POIDS = 1.0
const val FREQ_PROFONDEUR = 45.0
const val Q_PROFONDEUR = 1.4
const val FREQ_CLARTE = 300.0
const val Q_CLARTE = 0.7

/** Le plafond du limiteur : −1 dBFS, la marge d'un convertisseur ou d'un encodage Bluetooth. */
const val PLAFOND = 0.891f

/** Un filtre en cloche (égaliseur paramétrique de R. Bristow-Johnson, celui de Web Audio). */
class Cloche(frequence: Double, q: Double, gainDb: Double, echantillonnage: Int) {
    private val b0: Double
    private val b1: Double
    private val b2: Double
    private val a1: Double
    private val a2: Double

    init {
        val a = 10.0.pow(gainDb / 40.0)
        val w0 = 2 * PI * frequence / echantillonnage
        val alpha = sin(w0) / (2 * q)
        val a0 = 1 + alpha / a
        b0 = (1 + alpha * a) / a0
        b1 = (-2 * cos(w0)) / a0
        b2 = (1 - alpha * a) / a0
        a1 = (-2 * cos(w0)) / a0
        a2 = (1 - alpha / a) / a0
    }

    /** Gain en dB à `frequence`, calculé sur les coefficients : sert aux tests de la courbe. */
    fun reponseDb(frequence: Double, echantillonnage: Int): Double {
        val w = 2 * PI * frequence / echantillonnage
        // |H(e^jw)|² = |b0 + b1 z⁻¹ + b2 z⁻²|² / |1 + a1 z⁻¹ + a2 z⁻²|²
        fun module(c0: Double, c1: Double, c2: Double): Double {
            val re = c0 + c1 * cos(w) + c2 * cos(2 * w)
            val im = -(c1 * sin(w) + c2 * sin(2 * w))
            return re * re + im * im
        }
        return 10 * kotlin.math.log10(module(b0, b1, b2) / module(1.0, a1, a2))
    }

    /** Forme transposée directe II : stable en virgule flottante simple, deux états par canal. */
    fun traiter(x: Float, etat: FloatArray, i: Int): Float {
        val y = (b0 * x + etat[i]).toFloat()
        etat[i] = (b1 * x - a1 * y + etat[i + 1]).toFloat()
        etat[i + 1] = (b2 * x - a2 * y).toFloat()
        return y
    }
}

/**
 * La chaîne complète, indépendante d'Android : atténuation d'entrée, les
 * trois cloches, puis un limiteur de crête. Le limiteur est la garantie
 * « jamais saturé » : un master déjà poussé à 0 dBFS, plus 10 dB de grave,
 * dépasserait malgré l'atténuation. Il réduit le gain instantanément sur
 * une crête et le rend en 80 ms ; le gain est commun aux canaux, pour que
 * l'image stéréo ne bouge pas.
 */
class ChaineBasses {
    @Volatile var niveau: NiveauBass = NiveauBass.OFF
    private var appliquee: NiveauBass? = null
    private var echantillonnage = 44_100
    private var canaux = 2
    private var cloches: List<Cloche> = emptyList()
    private var etats: Array<FloatArray> = emptyArray()
    private var preGain = 1f
    private var gainLimiteur = 1f
    private var relache = 0f

    fun configurer(echantillonnage: Int, canaux: Int) {
        this.echantillonnage = echantillonnage
        this.canaux = canaux
        appliquee = null
        relache = (1 - exp(-1.0 / (0.08 * echantillonnage))).toFloat()
        reinitialiser()
    }

    fun reinitialiser() {
        etats = Array(3) { FloatArray(2 * canaux) }
        gainLimiteur = 1f
    }

    private fun preparer() {
        val n = niveau
        if (n == appliquee) return
        appliquee = n
        cloches = listOf(
            Cloche(FREQ_POIDS, Q_POIDS, n.poidsDb, echantillonnage),
            Cloche(FREQ_PROFONDEUR, Q_PROFONDEUR, n.profondeurDb, echantillonnage),
            Cloche(FREQ_CLARTE, Q_CLARTE, n.clarteDb, echantillonnage),
        )
        preGain = 10.0.pow(n.preGainDb / 20.0).toFloat()
    }

    /** Traite des échantillons entrelacés, en place, dans [-1, 1]. */
    fun traiter(echantillons: FloatArray, nombre: Int = echantillons.size) {
        preparer()
        // Off : la chaîne serait exactement transparente ; on ne la calcule pas.
        if (appliquee == NiveauBass.OFF) return
        var i = 0
        while (i + canaux <= nombre) {
            var crete = 0f
            for (c in 0 until canaux) {
                var x = echantillons[i + c] * preGain
                for (k in cloches.indices) x = cloches[k].traiter(x, etats[k], 2 * c)
                echantillons[i + c] = x
                val a = abs(x)
                if (a > crete) crete = a
            }
            // Le gain remonte doucement vers 1, sans jamais laisser la crête passer le plafond :
            // l'attaque est instantanée, au niveau exact qui la tient.
            val rendu = gainLimiteur + (1f - gainLimiteur) * relache
            gainLimiteur = if (crete > 0f) minOf(rendu, PLAFOND / crete) else rendu
            for (c in 0 until canaux) echantillons[i + c] *= gainLimiteur
            i += canaux
        }
    }
}
