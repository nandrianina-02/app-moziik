package com.moziik.app.ui.composants

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Mouvement
import com.moziik.app.theme.compose

/**
 * La signature de Moziik : trois barres d'accent qui montent et descendent
 * (EqualizerLoader du site). Sert d'indicateur de chargement, de logo de
 * repli et d'indicateur « en cours de lecture ».
 */
@Composable
fun Egaliseur(modifier: Modifier = Modifier, hauteur: Dp = 12.dp, libelle: String? = "Chargement") {
    val transition = rememberInfiniteTransition(label = "egaliseur")
    val accent = LocalPalette.current.accent.compose
    Row(
        modifier = modifier
            .height(hauteur)
            .semantics { if (libelle != null) contentDescription = libelle },
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        listOf(0, 200, 400).forEach { decalage ->
            val echelle = transition.animateFloat(
                initialValue = 0.3f,
                targetValue = 0.3f,
                animationSpec = infiniteRepeatable(
                    animation = keyframes {
                        durationMillis = Mouvement.EGALISEUR
                        0.3f at 0 using FastOutSlowInEasing
                        1f at Mouvement.EGALISEUR / 2 using FastOutSlowInEasing
                        0.3f at Mouvement.EGALISEUR
                    },
                    repeatMode = RepeatMode.Restart,
                    initialStartOffset = StartOffset(decalage),
                ),
                label = "barre",
            )
            Box(
                Modifier
                    .width(3.dp)
                    .height(hauteur)
                    .graphicsLayer {
                        scaleY = echelle.value
                        transformOrigin = TransformOrigin(0.5f, 1f)
                    }
                    .background(accent, RoundedCornerShape(2.dp)),
            )
        }
    }
}
