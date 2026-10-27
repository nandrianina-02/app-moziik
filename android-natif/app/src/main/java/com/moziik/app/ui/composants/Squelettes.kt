package com.moziik.app.ui.composants

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.compose

/**
 * Les squelettes de chargement : la forme du contenu attendu, en blocs
 * neutres qui respirent doucement. Ils remplacent un indicateur centré
 * là où l'on sait ce qui va venir (une liste, une fiche, l'accueil) : la
 * page ne saute pas quand le contenu arrive.
 */

/** L'opacité commune des blocs : une seule respiration pour tout l'écran, pas une par bloc. */
private val LocalRespiration = compositionLocalOf { 1f }

@Composable
private fun Respiration(contenu: @Composable () -> Unit) {
    val alpha = if (animationsReduites()) {
        0.7f
    } else {
        val cycle = rememberInfiniteTransition(label = "squelette")
        cycle.animateFloat(0.45f, 0.9f, infiniteRepeatable(tween(900, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "respiration").value
    }
    CompositionLocalProvider(LocalRespiration provides alpha) {
        Box(Modifier.semantics { contentDescription = "Chargement" }) { contenu() }
    }
}

@Composable
private fun Bloc(modifier: Modifier, forme: Shape = RoundedCornerShape(6.dp)) {
    val p = LocalPalette.current
    val alpha = LocalRespiration.current
    Box(modifier.graphicsLayer { this.alpha = alpha }.clip(forme).background(p.bordure.compose))
}

@Composable
private fun LigneSquelette(cote: Dp, rond: Boolean, largeur: Float) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Bloc(Modifier.size(cote), if (rond) CircleShape else RoundedCornerShape(LocalPalette.current.rayon.dp))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Bloc(Modifier.fillMaxWidth(largeur).height(12.dp))
            Spacer(Modifier.height(8.dp))
            Bloc(Modifier.fillMaxWidth(largeur * 0.55f).height(10.dp))
        }
    }
}

/** Une liste : vignette et deux lignes de texte, de longueurs variées pour ne pas faire grille. */
@Composable
fun SqueletteListe(nombre: Int = 6, modifier: Modifier = Modifier, cote: Dp = 48.dp, rond: Boolean = false) {
    Respiration {
        Column(modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
            repeat(nombre) { LigneSquelette(cote, rond, listOf(0.7f, 0.5f, 0.85f, 0.6f)[it % 4]) }
        }
    }
}

@Composable
private fun RangeeSquelette() {
    Column(Modifier.fillMaxWidth().padding(top = 24.dp)) {
        Bloc(Modifier.padding(horizontal = 16.dp).width(160.dp).height(16.dp))
        Spacer(Modifier.height(14.dp))
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            repeat(3) {
                Column(Modifier.width(140.dp)) {
                    Bloc(Modifier.size(140.dp), RoundedCornerShape(LocalPalette.current.rayon.dp))
                    Spacer(Modifier.height(10.dp))
                    Bloc(Modifier.fillMaxWidth(0.8f).height(11.dp))
                    Spacer(Modifier.height(6.dp))
                    Bloc(Modifier.fillMaxWidth(0.5f).height(10.dp))
                }
            }
        }
    }
}

/** L'accueil : un grand bandeau puis des rangées de cartes. */
@Composable
fun SqueletteAccueil(modifier: Modifier = Modifier) {
    Respiration {
        Column(modifier.fillMaxWidth()) {
            Bloc(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(180.dp), RoundedCornerShape(LocalPalette.current.rayon.dp))
            repeat(3) { RangeeSquelette() }
        }
    }
}

/** Une fiche (album, artiste, playlist, titre) : l'en-tête, puis la liste des titres. */
@Composable
fun SqueletteFiche(modifier: Modifier = Modifier) {
    Respiration {
        Column(modifier.fillMaxWidth().padding(top = 56.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Bloc(Modifier.size(200.dp), RoundedCornerShape(LocalPalette.current.rayon.dp))
            Spacer(Modifier.height(18.dp))
            Bloc(Modifier.width(200.dp).height(20.dp))
            Spacer(Modifier.height(10.dp))
            Bloc(Modifier.width(120.dp).height(12.dp))
            Spacer(Modifier.height(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Bloc(Modifier.width(110.dp).height(40.dp), CircleShape)
                Bloc(Modifier.size(40.dp), CircleShape)
                Bloc(Modifier.size(40.dp), CircleShape)
            }
            Spacer(Modifier.height(20.dp))
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                repeat(6) { LigneSquelette(44.dp, false, listOf(0.7f, 0.5f, 0.85f, 0.6f)[it % 4]) }
            }
        }
    }
}
