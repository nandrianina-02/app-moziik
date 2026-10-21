package com.moziik.app.ui.composants

import kotlin.math.abs

/** Clarté des pastilles : assez sombre pour qu'une icône blanche se lise sur toutes les teintes. */
private const val CLARTE = 0.30f

/**
 * La teinte d'une pochette, pour la pastille de téléchargement posée
 * dessus : la teinte la plus présente parmi les couleurs franches,
 * ramenée à une clarté fixe. Une pochette en noir et blanc donne un gris
 * sombre plutôt qu'une teinte inventée.
 */
fun teinteDePochette(pixels: IntArray): Int {
    val poids = FloatArray(12)
    val rouge = FloatArray(12)
    val vert = FloatArray(12)
    val bleu = FloatArray(12)
    var franc = 0f
    var total = 0f
    for (px in pixels) {
        if ((px ushr 24) < 128) continue
        val r = ((px shr 16) and 0xFF) / 255f
        val g = ((px shr 8) and 0xFF) / 255f
        val b = (px and 0xFF) / 255f
        val (h, s, l) = hsl(r, g, b)
        total++
        // Les couleurs franches, ni presque noires ni presque blanches, portent l'identité de l'image.
        val w = s * (1f - abs(l - 0.5f) * 1.6f).coerceAtLeast(0f)
        if (w <= 0.05f) continue
        val i = ((h / 30f).toInt()).coerceIn(0, 11)
        poids[i] += w
        rouge[i] += r * w
        vert[i] += g * w
        bleu[i] += b * w
        franc += w
    }
    if (total == 0f || franc / total < 0.08f) return argb(0f, 0f, 0.22f)
    val i = poids.indices.maxBy { poids[it] }
    val (h, s, _) = hsl(rouge[i] / poids[i], vert[i] / poids[i], bleu[i] / poids[i])
    return argb(h, s.coerceIn(0.25f, 0.65f), CLARTE)
}

private fun hsl(r: Float, g: Float, b: Float): Triple<Float, Float, Float> {
    val max = maxOf(r, g, b)
    val min = minOf(r, g, b)
    val l = (max + min) / 2f
    val d = max - min
    if (d == 0f) return Triple(0f, 0f, l)
    val s = d / (1f - abs(2f * l - 1f))
    var h = when (max) {
        r -> ((g - b) / d) % 6f
        g -> (b - r) / d + 2f
        else -> (r - g) / d + 4f
    } * 60f
    if (h < 0f) h += 360f
    return Triple(h, s.coerceIn(0f, 1f), l)
}

private fun argb(h: Float, s: Float, l: Float): Int {
    val c = (1f - abs(2f * l - 1f)) * s
    val x = c * (1f - abs((h / 60f) % 2f - 1f))
    val m = l - c / 2f
    val (r, g, b) = when {
        h < 60f -> Triple(c, x, 0f)
        h < 120f -> Triple(x, c, 0f)
        h < 180f -> Triple(0f, c, x)
        h < 240f -> Triple(0f, x, c)
        h < 300f -> Triple(x, 0f, c)
        else -> Triple(c, 0f, x)
    }
    fun canal(v: Float) = ((v + m) * 255f).toInt().coerceIn(0, 255)
    return (0xFF shl 24) or (canal(r) shl 16) or (canal(g) shl 8) or canal(b)
}
