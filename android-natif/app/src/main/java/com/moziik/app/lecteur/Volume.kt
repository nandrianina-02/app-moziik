package com.moziik.app.lecteur

import kotlin.math.pow

/**
 * Le volume visé d'un titre à l'autre, sur l'échelle des mesures (sonie
 * mono, voir outils d'import) : −17 LUFS mono correspond à −14 LUFS en
 * stéréo, le niveau des grandes plateformes d'écoute.
 */
const val SONIE_CIBLE = -17.0

/** Un titre pas encore mesuré : traité comme un master récent typique, très fort. */
const val SONIE_PAR_DEFAUT = -10.0

/** Au-delà, une baisse ferait d'un titre très fort un titre trop faible. */
const val BAISSE_MAX_DB = 15.0

/**
 * Le facteur de volume qui ramène un titre au niveau visé. Seulement vers le
 * bas : on n'augmente jamais un titre doux, ce qui risquerait de le faire
 * saturer ; les titres forts sont baissés à son niveau.
 */
fun gainNormalisation(sonie: Double?, actif: Boolean): Float {
    if (!actif) return 1f
    val ecart = (SONIE_CIBLE - (sonie ?: SONIE_PAR_DEFAUT)).coerceIn(-BAISSE_MAX_DB, 0.0)
    return 10.0.pow(ecart / 20.0).toFloat()
}

/**
 * Le fondu entre deux titres, de 0 à 1 : il descend dans les `dureeMs`
 * dernières millisecondes d'un titre et remonte dans les premières du
 * suivant. Pas de fondu entre deux titres du même album, qui s'enchaînent
 * sans blanc (un live, un mix continu), ni au début d'un titre choisi à la
 * main. La courbe est adoucie aux deux bouts : ni à-coup au début du
 * fondu, ni silence brutal à la fin.
 */
fun facteurFondu(
    positionMs: Long,
    dureeTitreMs: Long,
    dureeMs: Long,
    finVersUnAutre: Boolean,
    debutDepuisUnAutre: Boolean,
): Float {
    if (dureeMs <= 0) return 1f
    var f = 1f
    if (finVersUnAutre && dureeTitreMs > 2 * dureeMs) f = minOf(f, ((dureeTitreMs - positionMs).toFloat() / dureeMs).coerceIn(0f, 1f))
    if (debutDepuisUnAutre && positionMs < dureeMs) f = minOf(f, (positionMs.toFloat() / dureeMs).coerceIn(0f, 1f))
    return f * f * (3 - 2 * f)
}
