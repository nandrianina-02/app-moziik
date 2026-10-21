package com.moziik.app.ui.composants

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import com.moziik.app.theme.Mouvement
import kotlinx.coroutines.delay
import kotlin.math.min

/**
 * Entrée en cascade d'une grille ou d'une liste, comme la classe .stagger
 * du site : fondu et 10 dp de montée en 450 ms, 40 ms d'écart entre deux
 * éléments, plafonné à 320 ms pour qu'une longue liste n'attende pas.
 * Jouée une fois, à l'apparition.
 */
fun Modifier.apparition(rang: Int = 0): Modifier = composed {
    val avancement = remember { Animatable(0f) }
    val montee = with(LocalDensity.current) { 10.dp.toPx() }
    LaunchedEffect(Unit) {
        delay(min(rang * Mouvement.CASCADE_PAS, Mouvement.CASCADE_MAX).toLong())
        avancement.animateTo(1f, tween(Mouvement.APPARITION, easing = Mouvement.sortieDouce))
    }
    graphicsLayer {
        alpha = avancement.value
        translationY = montee * (1f - avancement.value)
    }
}

/**
 * L'apparition d'un élément de liste paresseuse, jouée une seule fois par
 * clé : un élément qui sort de l'écran puis revient au défilement ne
 * rejoue pas son entrée.
 */
@androidx.compose.runtime.Composable
fun Modifier.apparitionUneFois(cle: Any, rang: Int, vus: MutableSet<Any>): Modifier {
    val premiere = remember(cle) { vus.add(cle) }
    return if (premiere) apparition(rang) else this
}
