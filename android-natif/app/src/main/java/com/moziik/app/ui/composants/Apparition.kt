package com.moziik.app.ui.composants

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
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

/** Au-delà, une ligne n'était pas à l'écran à l'ouverture : elle arrive sans attendre. */
private const val ENTREE_LIGNES_MAX = 10

/**
 * L'entrée d'une ligne de liste paresseuse, en cascade sur les premières
 * lignes, une seule fois. Gardée par `rememberSaveable`, que la liste
 * conserve par clé : une ligne qui sort de l'écran au défilement, ou un
 * retour sur l'écran, ne la rejoue pas. Les lignes plus bas n'ont pas
 * d'entrée : les faire attendre au défilement ralentirait la lecture.
 */
@Composable
fun Modifier.entree(rang: Int): Modifier {
    if (rang >= ENTREE_LIGNES_MAX) return this
    var jouee by rememberSaveable { mutableStateOf(false) }
    if (jouee) return this
    val avancement = remember { Animatable(0f) }
    val montee = with(LocalDensity.current) { 8.dp.toPx() }
    LaunchedEffect(Unit) {
        delay(min(rang * Mouvement.CASCADE_PAS, Mouvement.CASCADE_MAX).toLong())
        avancement.animateTo(1f, tween(Mouvement.APPARITION, easing = Mouvement.sortieDouce))
        jouee = true
    }
    return graphicsLayer {
        alpha = avancement.value
        translationY = montee * (1f - avancement.value)
    }
}
