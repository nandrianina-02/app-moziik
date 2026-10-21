package com.moziik.app.ui.lecteur

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.moziik.app.R
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LienTexte
import kotlinx.coroutines.delay

/**
 * Le mur des visiteurs (QuotaWall.tsx) : la limite d'écoute du jour est
 * atteinte, la suite demande un compte. Fermer ne relance pas la lecture.
 */
@Composable
fun MurQuota(onInscription: () -> Unit, onConnexion: () -> Unit, onFermer: () -> Unit) {
    val p = LocalPalette.current
    Dialog(onDismissRequest = onFermer) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(p.rayon.dp))
                .background(p.surface.compose)
                .border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(p.rayon.dp))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(Modifier.size(56.dp).clip(CircleShape).background(p.accent.compose.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                Icone(R.drawable.lucide_headphones, description = null, teinte = p.accent.compose, taille = 26.dp)
            }
            Spacer(Modifier.height(16.dp))
            Text("La suite demande un compte", style = Texte.titreSection, color = p.encre.compose, textAlign = TextAlign.Center)
            Spacer(Modifier.height(8.dp))
            Text(
                "Tu as atteint la limite d'écoute des visiteurs. Crée un compte pour continuer, c'est gratuit.",
                style = Texte.corps,
                color = p.encreAttenuee.compose,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(20.dp))
            BoutonPrincipal("Créer un compte gratuit", onInscription)
            Spacer(Modifier.height(8.dp))
            LienTexte("J'ai déjà un compte", onConnexion)
            Spacer(Modifier.height(4.dp))
            Text(
                "Fermer",
                style = Texte.corps,
                color = p.encreAttenuee.compose,
                modifier = Modifier.clip(RoundedCornerShape(4.dp)).clickable(role = Role.Button, onClick = onFermer).padding(4.dp),
            )
        }
    }
}

/**
 * Un message court du lecteur (titre indisponible, réseau coupé), au-dessus
 * du mini-lecteur ; il s'efface seul après quatre secondes.
 */
@Composable
fun BandeauMessage(message: String?, onFini: () -> Unit, modifier: Modifier = Modifier, succes: Boolean = false) {
    val p = LocalPalette.current
    var affiche by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(message) {
        if (message != null) {
            affiche = message
            delay(4_000)
            onFini()
        }
    }
    AnimatedVisibility(
        visible = message != null,
        enter = fadeIn(tween(180)) + slideInVertically(tween(220)) { it / 2 },
        exit = fadeOut(tween(160)) + slideOutVertically(tween(160)) { it / 2 },
        modifier = modifier,
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp)
                .clip(RoundedCornerShape(p.rayon.dp))
                .background(p.encre.compose)
                .padding(horizontal = 14.dp, vertical = 12.dp)
                .semantics { liveRegion = LiveRegionMode.Polite },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icone(if (succes) R.drawable.lucide_circle_check else R.drawable.lucide_circle_alert, description = null, teinte = p.base.compose, taille = 16.dp)
            Spacer(Modifier.width(10.dp))
            Text(affiche.orEmpty(), style = Texte.corps, color = p.base.compose)
        }
    }
}
