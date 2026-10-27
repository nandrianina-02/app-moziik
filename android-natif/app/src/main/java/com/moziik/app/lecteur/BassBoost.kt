package com.moziik.app.lecteur

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Un réglage complet de la chaîne de basses.
 *
 * Les trois premiers filtres sont ceux du site (bassBoost.ts) : cloche à
 * 75 Hz pour le corps, cloche réglable (45 Hz sur le site) pour la
 * profondeur, creux à 300 Hz qui garde la voix nette. L'app va plus bas :
 * - un sous-grave (`subDb`, vers 32 Hz), qu'on ressent au casque et sur
 *   les enceintes qui descendent ;
 * - des harmoniques de basse (`harmoniques`, 0 à 1) : le grave redressé
 *   produit ses multiples entre 90 et 250 Hz, que l'oreille rattache à la
 *   fondamentale. Un haut-parleur de téléphone, qui ne descend pas sous
 *   150 Hz, fait ainsi entendre un grave qu'il ne peut pas jouer.
 */
data class ReglageBasses(
    val poidsDb: Double = 0.0,
    val profondeurDb: Double = 0.0,
    val freqProfondeur: Double = FREQ_PROFONDEUR,
    val qProfondeur: Double = Q_PROFONDEUR,
    val subDb: Double = 0.0,
    val clarteDb: Double = 0.0,
    val preGainDb: Double = 0.0,
    val harmoniques: Float = 0f,
) {
    val neutre: Boolean get() = poidsDb == 0.0 && profondeurDb == 0.0 && subDb == 0.0 && clarteDb == 0.0 && preGainDb == 0.0 && harmoniques == 0f

    companion object {
        /**
         * Le réglage personnalisé : `puissance` de 0 à 14 dB pour le grave,
         * `harmoniques` de 0 à 1. Profondeur, sous-grave, creux de la voix et
         * atténuation d'entrée suivent la puissance, dans les proportions des
         * niveaux du site.
         */
        fun personnalise(puissance: Float, harmoniques: Float): ReglageBasses {
            val p = puissance.toDouble().coerceIn(0.0, PUISSANCE_MAX)
            return ReglageBasses(
                poidsDb = p,
                profondeurDb = p * 0.8,
                freqProfondeur = 40.0,
                qProfondeur = 1.3,
                subDb = (p - 6.0).coerceAtLeast(0.0) * 0.6,
                clarteDb = -p * 0.36,
                preGainDb = -p * 0.5,
                harmoniques = harmoniques.coerceIn(0f, 1f),
            )
        }
    }
}

const val PUISSANCE_MAX = 14.0

/**
 * Les niveaux du Bass Boost. Léger et Normal sont ceux du site ; Profond et
 * Très profond partent de ceux du site et y ajoutent sous-grave et
 * harmoniques ; Extrême va au-delà de ce que propose le site ; Personnalisé
 * se règle au curseur.
 */
enum class NiveauBass(val cle: String, val libelle: String, val description: String, val reglage: ReglageBasses?) {
    OFF("off", "Off", "Aucun traitement, le morceau tel qu'il a été masterisé.", ReglageBasses()),
    LEGER("leger", "Léger", "Un peu de corps, sans rien changer à l'équilibre du morceau.", ReglageBasses(3.0, 2.2, clarteDb = -1.1, preGainDb = -1.2)),
    NORMAL("normal", "Normal", "Grave présent et net. Le bon réglage pour la plupart des casques.", ReglageBasses(5.5, 4.0, clarteDb = -2.0, preGainDb = -2.2)),
    PROFOND(
        "profond", "Profond", "Le Profond du site, plus des harmoniques : le grave s'entend aussi sur le haut-parleur du téléphone.",
        ReglageBasses(8.0, 6.0, clarteDb = -3.0, preGainDb = -3.6, harmoniques = 0.15f),
    ),
    TRES_PROFOND(
        "tres-profond", "Très profond", "Plus bas que le site : un sous-grave vers 32 Hz qu'on ressent au casque.",
        ReglageBasses(10.5, 8.0, freqProfondeur = 42.0, subDb = 3.0, clarteDb = -3.8, preGainDb = -5.0, harmoniques = 0.22f),
    ),
    EXTREME(
        "extreme", "Extrême", "Le grave le plus profond : sous-grave appuyé et harmoniques fortes. Toujours sans saturation.",
        ReglageBasses(12.0, 10.0, freqProfondeur = 40.0, qProfondeur = 1.3, subDb = 5.0, clarteDb = -4.5, preGainDb = -7.0, harmoniques = 0.32f),
    ),
    PERSO("perso", "Personnalisé", "Réglez vous-même la puissance du grave et les harmoniques.", null);

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
/** Le sous-grave de l'app : sous la profondeur du site. */
const val FREQ_SUB = 32.0
const val Q_SUB = 1.6

/** Le plafond du limiteur : −1 dBFS, la marge d'un convertisseur ou d'un encodage Bluetooth. */
const val PLAFOND = 0.891f

/** Un filtre biquadratique (formules de R. Bristow-Johnson, celles de Web Audio). */
class Biquad private constructor(private val b0: Double, private val b1: Double, private val b2: Double, private val a1: Double, private val a2: Double) {
    companion object {
        fun cloche(frequence: Double, q: Double, gainDb: Double, fs: Int): Biquad {
            val a = 10.0.pow(gainDb / 40.0)
            val w0 = 2 * PI * frequence / fs
            val alpha = sin(w0) / (2 * q)
            val a0 = 1 + alpha / a
            return Biquad((1 + alpha * a) / a0, (-2 * cos(w0)) / a0, (1 - alpha * a) / a0, (-2 * cos(w0)) / a0, (1 - alpha / a) / a0)
        }

        fun passeBas(frequence: Double, fs: Int, q: Double = 1 / sqrt(2.0)): Biquad {
            val w0 = 2 * PI * frequence / fs
            val alpha = sin(w0) / (2 * q)
            val a0 = 1 + alpha
            val c = cos(w0)
            return Biquad((1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, -2 * c / a0, (1 - alpha) / a0)
        }

        fun passeHaut(frequence: Double, fs: Int, q: Double = 1 / sqrt(2.0)): Biquad {
            val w0 = 2 * PI * frequence / fs
            val alpha = sin(w0) / (2 * q)
            val a0 = 1 + alpha
            val c = cos(w0)
            return Biquad((1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - alpha) / a0)
        }
    }

    /** Gain en dB à `frequence` : sert aux tests de la courbe. */
    fun reponseDb(frequence: Double, fs: Int): Double {
        val w = 2 * PI * frequence / fs
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
 * La chaîne complète, indépendante d'Android : atténuation d'entrée,
 * harmoniques de basse, les cloches, puis un limiteur de crête. Le
 * limiteur est la garantie « jamais saturé » : il réduit le gain
 * instantanément sur une crête, le maintient, puis le rend doucement ; le
 * gain est commun aux canaux, pour que l'image stéréo ne bouge pas.
 */
class ChaineBasses {
    @Volatile var reglage: ReglageBasses = ReglageBasses()
    private var applique: ReglageBasses? = null
    private var echantillonnage = 44_100
    private var canaux = 2
    private var cloches: List<Biquad> = emptyList()
    private var etats: Array<FloatArray> = emptyArray()
    // Les harmoniques : extraction du grave, puis bande où elles se font entendre.
    private var extraction: Biquad? = null
    private var bandeBasse: Biquad? = null
    private var bandeHaute: Biquad? = null
    private var etatsHarmoniques: Array<FloatArray> = emptyArray()
    private var preGain = 1f
    private var gainLimiteur = 1f
    private var relache = 0f
    // Maintien du gain réduit : plus long qu'une demi-période de grave (25 Hz),
    // pour que le gain ne remonte pas entre deux crêtes d'une même note.
    private var tenueMax = 0
    private var tenue = 0

    fun configurer(echantillonnage: Int, canaux: Int) {
        this.echantillonnage = echantillonnage
        this.canaux = canaux
        applique = null
        relache = (1 - exp(-1.0 / (0.15 * echantillonnage))).toFloat()
        tenueMax = (0.03 * echantillonnage).toInt()
        reinitialiser()
    }

    fun reinitialiser() {
        etats = Array(4) { FloatArray(2 * canaux) }
        etatsHarmoniques = Array(3) { FloatArray(2 * canaux) }
        gainLimiteur = 1f
        tenue = 0
    }

    private fun preparer() {
        val r = reglage
        if (r == applique) return
        applique = r
        val fs = echantillonnage
        cloches = listOf(
            Biquad.cloche(FREQ_POIDS, Q_POIDS, r.poidsDb, fs),
            Biquad.cloche(r.freqProfondeur, r.qProfondeur, r.profondeurDb, fs),
            Biquad.cloche(FREQ_SUB, Q_SUB, r.subDb, fs),
            Biquad.cloche(FREQ_CLARTE, Q_CLARTE, r.clarteDb, fs),
        )
        extraction = Biquad.passeBas(120.0, fs)
        bandeBasse = Biquad.passeHaut(90.0, fs)
        bandeHaute = Biquad.passeBas(250.0, fs)
        preGain = 10.0.pow(r.preGainDb / 20.0).toFloat()
    }

    /** Traite des échantillons entrelacés, en place, dans [-1, 1]. */
    fun traiter(echantillons: FloatArray, nombre: Int = echantillons.size) {
        preparer()
        val r = applique ?: return
        // Neutre : la chaîne serait exactement transparente ; on ne la calcule pas.
        if (r.neutre) return
        val extraire = extraction!!
        val bas = bandeBasse!!
        val haut = bandeHaute!!
        val dose = r.harmoniques * DOSE_HARMONIQUES
        var i = 0
        while (i + canaux <= nombre) {
            var crete = 0f
            for (c in 0 until canaux) {
                val entree = echantillons[i + c] * preGain
                var x = entree
                for (k in cloches.indices) x = cloches[k].traiter(x, etats[k], 2 * c)
                if (dose > 0f) {
                    // Redresser le grave double sa fréquence (et ses multiples pairs) ;
                    // la bande 90-250 Hz retire le continu et ne garde que ce qu'un petit haut-parleur rend.
                    val grave = extraire.traiter(entree, etatsHarmoniques[0], 2 * c)
                    var h = bas.traiter(abs(grave), etatsHarmoniques[1], 2 * c)
                    h = haut.traiter(h, etatsHarmoniques[2], 2 * c)
                    x += h * dose
                }
                echantillons[i + c] = x
                val a = abs(x)
                if (a > crete) crete = a
            }
            // Attaque instantanée, au niveau exact qui tient la crête sous le plafond ; puis le gain
            // reste 30 ms avant de remonter doucement (150 ms) : il ne module pas l'onde de basse.
            if (crete * gainLimiteur > PLAFOND) {
                gainLimiteur = PLAFOND / crete
                tenue = tenueMax
            } else if (tenue > 0) {
                tenue--
            } else {
                gainLimiteur += (1f - gainLimiteur) * relache
                if (crete * gainLimiteur > PLAFOND) gainLimiteur = PLAFOND / crete
            }
            for (c in 0 until canaux) echantillons[i + c] *= gainLimiteur
            i += canaux
        }
    }
}

/** Les harmoniques redressées valent environ 0,4 de la fondamentale : à fond, elles arrivent au niveau du grave d'origine. */
private const val DOSE_HARMONIQUES = 2.4f
