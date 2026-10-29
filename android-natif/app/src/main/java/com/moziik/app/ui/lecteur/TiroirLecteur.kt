package com.moziik.app.ui.lecteur

import androidx.compose.animation.core.animate
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Velocity
import androidx.compose.ui.unit.dp
import com.moziik.app.theme.Mouvement
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/** Un geste vif décide, même court (pixels par seconde). */
private const val VITESSE_DECISIVE = 1_000f

/**
 * Le lecteur comme un seul tiroir : 0, le mini-lecteur au-dessus de la
 * barre du bas ; 1, le plein écran. Le doigt pilote l'ouverture pendant le
 * geste, puis le tiroir se pose du côté où il va, sans rebond.
 */
@Stable
class EtatTiroir internal constructor(private val portee: CoroutineScope, initiale: Float, private val hauteur: Float) {
    var ouverture by mutableFloatStateOf(initiale)
        private set
    private var pose: Job? = null

    // Dérivés : la coquille ne se recompose qu'au franchissement, pas à chaque image du geste.
    val ouvert: Boolean by derivedStateOf { ouverture > 0f }
    internal val plutotOuvert: Boolean by derivedStateOf { ouverture >= 0.5f }

    /** `delta` en pixels, positif vers le bas : le tiroir suit le doigt. */
    fun glisser(delta: Float) {
        pose?.cancel()
        ouverture = (ouverture - delta / hauteur).coerceIn(0f, 1f)
    }

    /** Au relâchement : la vitesse décide si elle est franche, sinon la moitié du chemin. */
    fun relacher(vitesse: Float) {
        val cible = when {
            vitesse < -VITESSE_DECISIVE -> 1f
            vitesse > VITESSE_DECISIVE -> 0f
            else -> if (ouverture >= 0.5f) 1f else 0f
        }
        poser(cible)
    }

    fun ouvrir() = poser(1f)
    fun fermer() = poser(0f)

    /**
     * Le tiroir posé dans celui-ci (les pages du lecteur plein écran) :
     * Retour le referme d'abord, avant de refermer le lecteur.
     */
    var interieur: EtatTiroir? = null

    fun retour() {
        val i = interieur
        if (i != null && i.ouvert) i.fermer() else fermer()
    }

    private fun poser(cible: Float) {
        pose?.cancel()
        if (ouverture == cible) return
        // Plus le chemin restant est court, plus la pose l'est : un tiroir presque fermé ne traîne pas.
        val duree = (Mouvement.TIROIR * kotlin.math.abs(cible - ouverture)).toInt().coerceIn(120, Mouvement.TIROIR)
        pose = portee.launch {
            animate(ouverture, cible, animationSpec = tween(duree, easing = Mouvement.sortieDouce)) { v, _ -> ouverture = v }
        }
    }

    /**
     * Le plein écran contient une liste : tirée vers le bas une fois en
     * haut, elle referme le tiroir ; un tiroir à demi baissé remonte avant
     * que la liste ne défile. Le défilement par élan n'y touche pas.
     */
    val defilement = object : NestedScrollConnection {
        override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
            if (source != NestedScrollSource.UserInput || available.y >= 0f || ouverture >= 1f) return Offset.Zero
            glisser(available.y)
            return Offset(0f, available.y)
        }

        override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
            if (source != NestedScrollSource.UserInput || available.y <= 0f) return Offset.Zero
            glisser(available.y)
            return Offset(0f, available.y)
        }

        override suspend fun onPreFling(available: Velocity): Velocity {
            if (ouverture >= 1f) return Velocity.Zero
            relacher(available.y)
            return available
        }
    }
}

@Composable
fun rememberEtatTiroir(): EtatTiroir {
    val portee = rememberCoroutineScope()
    val hauteur = with(LocalDensity.current) { LocalConfiguration.current.screenHeightDp.dp.toPx() }
    // Après une rotation ou un retour dans l'app, le tiroir reprend sa position posée.
    var ouvertAvant by rememberSaveable { androidx.compose.runtime.mutableStateOf(false) }
    val etat = remember(hauteur) { EtatTiroir(portee, if (ouvertAvant) 1f else 0f, hauteur) }
    ouvertAvant = etat.plutotOuvert
    return etat
}

/** Le geste vertical sur une zone sans liste : le mini-lecteur, l'en-tête du plein écran. */
@Composable
fun Modifier.glissementDuTiroir(tiroir: EtatTiroir): Modifier = draggable(
    state = rememberDraggableState { tiroir.glisser(it) },
    orientation = Orientation.Vertical,
    onDragStopped = { vitesse -> tiroir.relacher(vitesse) },
)
