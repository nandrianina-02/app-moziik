package com.moziik.app.ui.lecteur

import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.moziik.app.lecteur.Lecteur
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.duree
import kotlinx.coroutines.delay

/** Position et durée du titre en cours, en millisecondes, relues quatre fois par seconde tant qu'elles sont affichées. */
data class Avancement(val positionMs: Long, val dureeMs: Long)

@Composable
fun rememberAvancement(lecteur: Lecteur, cle: Any?): State<Avancement> =
    produceState(Avancement(lecteur.position(), lecteur.duree()), lecteur, cle) {
        while (true) {
            value = Avancement(lecteur.position(), lecteur.duree())
            delay(250)
        }
    }

fun temps(ms: Long): String = duree(ms / 1000.0)

/**
 * La barre de progression du lecteur (SeekBar.tsx, variante « pill ») :
 * un appui y déplace la lecture, un glissement la suit du doigt et ne
 * déplace qu'au relâchement, pour ne pas recharger le son à chaque pixel.
 */
@Composable
fun BarreProgression(avancement: Avancement, onDeplacer: (Long) -> Unit, modifier: Modifier = Modifier, epaisseur: Dp = 4.dp) {
    val p = LocalPalette.current
    val duree = avancement.dureeMs
    var glisse by remember { mutableStateOf<Float?>(null) }
    val fraction = glisse ?: if (duree > 0) (avancement.positionMs.toFloat() / duree).coerceIn(0f, 1f) else 0f
    val piste = p.bordure.compose
    val accent = p.accent.compose
    Box(
        modifier
            .fillMaxWidth()
            .height(24.dp)
            .pointerInput(duree) {
                detectTapGestures { o -> if (duree > 0) onDeplacer(((o.x / size.width).coerceIn(0f, 1f) * duree).toLong()) }
            }
            .pointerInput(duree) {
                detectHorizontalDragGestures(
                    onDragStart = { o -> glisse = (o.x / size.width).coerceIn(0f, 1f) },
                    onDragEnd = {
                        glisse?.let { if (duree > 0) onDeplacer((it * duree).toLong()) }
                        glisse = null
                    },
                    onDragCancel = { glisse = null },
                ) { changement, _ -> glisse = (changement.position.x / size.width).coerceIn(0f, 1f) }
            }
            .semantics {
                contentDescription = "Position dans le titre : ${temps(avancement.positionMs)} sur ${temps(duree)}"
                progressBarRangeInfo = ProgressBarRangeInfo(fraction, 0f..1f)
                setProgress { valeur ->
                    if (duree > 0) onDeplacer((valeur.coerceIn(0f, 1f) * duree).toLong())
                    duree > 0
                }
            }
            .drawBehind {
                val h = epaisseur.toPx()
                val y = (size.height - h) / 2
                val rayon = CornerRadius(h / 2, h / 2)
                drawRoundRect(piste, Offset(0f, y), Size(size.width, h), rayon)
                drawRoundRect(accent, Offset(0f, y), Size(size.width * fraction, h), rayon)
                // La pastille n'apparaît que sous le doigt : au repos, la barre reste un simple filet.
                if (glisse != null) drawCircle(accent, radius = 7.dp.toPx(), center = Offset(size.width * fraction, size.height / 2))
            },
    )
}
