package com.moziik.app.theme

import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt

/**
 * Boîte à outils couleur, portage fidèle de lib/color.ts du site.
 *
 * Le thème est entièrement déduit de quelques choix (accent, fonds) et
 * vérifié pour le contraste ; l'app doit tomber exactement sur les mêmes
 * couleurs que le site. D'où les composantes en Double, jamais arrondies en
 * cours de calcul : le site ne les arrondit qu'à l'écriture.
 */
data class Rgb(val r: Double, val g: Double, val b: Double) {
    /** « #RRGGBB » en majuscules, comme rgbEnHex. */
    fun enHex(): String {
        fun part(v: Double) = borner(v, 0.0, 255.0).roundToInt().toString(16).padStart(2, '0')
        return "#${part(r)}${part(g)}${part(b)}".uppercase()
    }

    /** Couleur Android (ARGB) opaque. */
    fun enArgb(): Long {
        fun part(v: Double) = borner(v, 0.0, 255.0).roundToInt().toLong()
        return (0xFFL shl 24) or (part(r) shl 16) or (part(g) shl 8) or part(b)
    }

    companion object {
        val NOIR = Rgb(0.0, 0.0, 0.0)
        val BLANC = Rgb(255.0, 255.0, 255.0)

        /** Accepte « #RGB », « #RRGGBB » et la même chose sans dièse ; null sinon. */
        fun depuisHex(hex: String?): Rgb? {
            if (hex == null) return null
            val brut = hex.trim().removePrefix("#")
            val complet = if (brut.length == 3) brut.map { "$it$it" }.joinToString("") else brut
            if (!Regex("^[0-9a-fA-F]{6}$").matches(complet)) return null
            return Rgb(
                complet.substring(0, 2).toInt(16).toDouble(),
                complet.substring(2, 4).toInt(16).toDouble(),
                complet.substring(4, 6).toInt(16).toDouble(),
            )
        }
    }
}

private fun borner(valeur: Double, min: Double, max: Double) = min(max, max(min, valeur))

/** Mélange linéaire : `poids` = part de `b` dans le résultat. */
fun melange(a: Rgb, b: Rgb, poids: Double): Rgb {
    val p = borner(poids, 0.0, 1.0)
    return Rgb(a.r + (b.r - a.r) * p, a.g + (b.g - a.g) * p, a.b + (b.b - a.b) * p)
}

/** Luminance relative WCAG : 0 pour le noir, 1 pour le blanc. */
fun luminance(c: Rgb): Double {
    fun canal(v: Double): Double {
        val x = v / 255
        return if (x <= 0.03928) x / 12.92 else ((x + 0.055) / 1.055).pow(2.4)
    }
    return 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b)
}

/** Rapport de contraste WCAG entre deux couleurs opaques (1 à 21). */
fun contraste(a: Rgb, b: Rgb): Double {
    val la = luminance(a)
    val lb = luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
}

/** Un fond sur lequel il faut écrire en clair plutôt qu'en foncé. */
fun estFondSombre(fond: Rgb): Boolean = luminance(fond) < 0.35

/**
 * Éloigne `couleur` de `fond` jusqu'au rapport demandé, par pas de 4 % vers
 * le blanc (fond sombre) ou le noir (fond clair). Quarante pas suffisent
 * toujours : au pire, du blanc ou du noir purs.
 */
fun assurerContraste(couleur: Rgb, fond: Rgb, cible: Double = 4.5): Rgb {
    if (contraste(couleur, fond) >= cible) return couleur
    val direction = if (estFondSombre(fond)) Rgb.BLANC else Rgb.NOIR
    var resultat = couleur
    var i = 0
    while (i < 40 && contraste(resultat, fond) < cible) {
        resultat = melange(resultat, direction, 0.04)
        i++
    }
    return resultat
}
