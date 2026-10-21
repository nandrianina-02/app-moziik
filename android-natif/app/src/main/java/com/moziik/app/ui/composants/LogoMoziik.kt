package com.moziik.app.ui.composants

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.compose

/**
 * Le logo animé de Moziik (public/moziik-animated.svg du site), redessiné
 * trait pour trait : mêmes tracés, mêmes couleurs, même minutage de 5,4 s.
 * Les lettres s'écrivent, les points des « i » apparaissent, une lueur
 * passe sur le « oz ». Les traits blancs du fichier prennent la couleur du
 * texte du thème, pour rester lisibles sur un fond clair.
 */

private const val CYCLE_MS = 5_400

/** Un trait du logo : son tracé, et la fraction du cycle pendant laquelle il s'écrit. */
private class Trait(d: String, val debut: Float, val fin: Float, val degrade: Boolean = false) {
    val chemin: Path = PathParser().parsePathString(d).toPath()
    val longueur: Float = PathMeasure().apply { setPath(chemin, false) }.length
}

private val TRAITS = listOf(
    Trait("M14 80V42M14 55Q14 40 28 40Q41 40 41 55V80M41 55Q41 40 55 40Q68 40 68 55V80", 0f, 0.1481f),
    Trait("M122 60C114 44 106 40 97 40C85 40 78 49 78 60C78 71 86 80 98 80C110 80 117 70 122 60C127 50 133 40 142 40H152L128 80H152", 0.0833f, 0.3056f, degrade = true),
    Trait("M165 42V80", 0.2130f, 0.3611f),
    Trait("M186 42V80", 0.2407f, 0.3889f),
    Trait("M208 18V80", 0.2685f, 0.4167f),
    Trait("M236 40L210 62M218 57L238 80", 0.3056f, 0.4537f),
)

/** Les points des « i » : centre, et fraction du cycle où ils éclosent. */
private val POINTS = listOf(Triple(Offset(165f, 24f), 0.2963f, 0.3796f), Triple(Offset(186f, 24f), 0.3148f, 0.3981f))

private val ECRITURE = CubicBezierEasing(0.6f, 0.05f, 0.2f, 1f)
private val ECLOSION = CubicBezierEasing(0.3f, 1.6f, 0.5f, 1f)
private val BLEU_CLAIR = Color(0xFF38D0FF)
private val BLEU = Color(0xFF2F7BFF)
private val LUEUR = Color(0xFF38BDF8)

/** Le cadre utile du dessin, dans les unités du fichier (lettres et épaisseur des traits). */
private const val X0 = 4f
private const val Y0 = 8f
private const val LARGEUR = 244f
private const val HAUTEUR = 78f
/** Fin de l'écriture : au-delà, le logo est entier. */
private const val ENTIER = 0.46f

private fun progression(t: Float, debut: Float, fin: Float, courbe: CubicBezierEasing): Float = when {
    t <= debut -> 0f
    t >= fin -> 1f
    else -> courbe.transform((t - debut) / (fin - debut))
}

/** La réduction des animations demandée par le système : le logo s'affiche alors entier, immobile. */
@Composable
private fun animationsReduites(): Boolean {
    val contexte = LocalContext.current
    return remember { Settings.Global.getFloat(contexte.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }
}

/**
 * - `boucle` : l'animation tourne en continu, comme sur le site (chargements).
 * - sinon, avec `anime`, le logo s'écrit une fois puis reste entier (en-tête).
 * - sinon, il est dessiné entier.
 */
@Composable
fun LogoMoziik(modifier: Modifier = Modifier, hauteur: Dp = 24.dp, anime: Boolean = false, boucle: Boolean = false) {
    val encre = LocalPalette.current.encre.compose
    val reduit = animationsReduites()
    val dessin = Modifier.height(hauteur).aspectRatio(LARGEUR / HAUTEUR).semantics { contentDescription = "Moziik" }

    if (boucle && !reduit) {
        val cycle = rememberInfiniteTransition(label = "logo")
        val t = cycle.animateFloat(0f, 1f, infiniteRepeatable(tween(CYCLE_MS, easing = LinearEasing), RepeatMode.Restart), label = "cycle")
        Canvas(modifier.then(dessin)) { dessiner(t.value, encre, fondu = true) }
        return
    }
    val t = remember { Animatable(if (anime && !reduit) 0f else ENTIER) }
    if (anime && !reduit) {
        LaunchedEffect(Unit) { t.animateTo(ENTIER, tween((CYCLE_MS * ENTIER).toInt(), easing = LinearEasing)) }
    }
    Canvas(modifier.then(dessin)) { dessiner(t.value, encre, fondu = false) }
}

private fun DrawScope.dessiner(t: Float, encre: Color, fondu: Boolean) {
    val echelle = size.width / LARGEUR
    // Le fondu de fin de cycle, pour que la boucle reparte d'une page blanche.
    val opacite = if (!fondu) 1f else when {
        t < 0.92f -> 1f
        t < 0.97f -> 1f - (t - 0.92f) / 0.05f
        else -> 0f
    }
    if (opacite <= 0f) return
    scale(echelle, echelle, pivot = Offset.Zero) {
        translate(-X0, -Y0) {
            val epaisseur = Stroke(width = 10f, cap = StrokeCap.Round, join = StrokeJoin.Round)
            val degrade = Brush.linearGradient(listOf(BLEU_CLAIR, BLEU), start = Offset(78f, 40f), end = Offset(152f, 80f))
            // La lueur qui passe sur le « oz » une fois écrit (sans flou : une trace large et transparente).
            if (fondu) {
                val lueur = when {
                    t < 0.3148f -> 0f
                    t < 0.4444f -> 0.9f * ((t - 0.3148f) / 0.1296f)
                    t < 0.5741f -> 0.9f * (1f - (t - 0.4444f) / 0.1297f)
                    else -> 0f
                }
                if (lueur > 0f) {
                    val oz = TRAITS[1].chemin
                    drawPath(oz, LUEUR, alpha = lueur * 0.18f * opacite, style = Stroke(width = 28f, cap = StrokeCap.Round, join = StrokeJoin.Round))
                    drawPath(oz, LUEUR, alpha = lueur * 0.3f * opacite, style = Stroke(width = 18f, cap = StrokeCap.Round, join = StrokeJoin.Round))
                }
            }
            TRAITS.forEach { trait ->
                val p = progression(t, trait.debut, trait.fin, ECRITURE)
                if (p <= 0f) return@forEach
                val morceau = if (p >= 1f) trait.chemin else Path().also { PathMeasure().apply { setPath(trait.chemin, false) }.getSegment(0f, trait.longueur * p, it, true) }
                if (trait.degrade) drawPath(morceau, degrade, alpha = opacite, style = epaisseur) else drawPath(morceau, encre, alpha = opacite, style = epaisseur)
            }
            POINTS.forEach { (centre, debut, fin) ->
                val s = progression(t, debut, fin, ECLOSION)
                if (s > 0f) drawCircle(encre, radius = 6f * s, center = centre, alpha = opacite)
            }
        }
    }
}
