package com.moziik.app.ui.coquille

import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.moziik.app.R
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Mouvement
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.ecrans.EcranProvisoire

/**
 * La coquille commune à tous les écrans, comme celle du site sur mobile :
 * en-tête de 56 dp, contenu, barre de navigation basse à cinq entrées.
 */
@Composable
fun Coquille(sombre: Boolean, onBasculerMode: () -> Unit) {
    val p = LocalPalette.current
    val navigation = rememberNavController()
    val entree by navigation.currentBackStackEntryAsState()
    val montee = with(LocalDensity.current) { 6.dp.roundToPx() }

    Column(Modifier.fillMaxSize().background(p.base.compose)) {
        EnTete(sombre = sombre, onBasculerMode = onBasculerMode)
        NavHost(
            navController = navigation,
            startDestination = Destination.ACCUEIL.route,
            modifier = Modifier.weight(1f),
            // Entrée de page du site : fondu et 6 dp de montée, 280 ms.
            enterTransition = {
                fadeIn(tween(Mouvement.ENTREE_PAGE, easing = Mouvement.sortieDouce)) +
                    slideInVertically(tween(Mouvement.ENTREE_PAGE, easing = Mouvement.sortieDouce)) { montee }
            },
            exitTransition = { fadeOut(tween(Mouvement.ENTREE_PAGE / 2)) },
        ) {
            Destination.entries.forEach { d ->
                composable(d.route) { EcranProvisoire(titre = d.libelle) }
            }
        }
        BarreDuBas(
            courante = entree?.destination,
            onChoisir = { d ->
                navigation.navigate(d.route) {
                    // Comme une barre d'onglets : une seule pile, l'état de chaque onglet est gardé.
                    popUpTo(navigation.graph.findStartDestination().id) { saveState = true }
                    launchSingleTop = true
                    restoreState = true
                }
            },
        )
    }
}

@Composable
private fun EnTete(sombre: Boolean, onBasculerMode: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier
            .fillMaxWidth()
            .background(p.base.compose)
            .windowInsetsPadding(WindowInsets.statusBars)
            .height(56.dp)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Sans logo publié par le site, l'égaliseur sert de marque (comme MobileHeader.tsx).
        Egaliseur(hauteur = 20.dp, libelle = null)
        Spacer(Modifier.width(10.dp))
        Text("Moziik", style = Texte.marque, color = p.encre.compose)
        Spacer(Modifier.weight(1f))
        Box(
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .border(BorderStroke(1.dp, p.bordure.compose), CircleShape)
                .clickable(role = Role.Button, onClick = onBasculerMode),
            contentAlignment = Alignment.Center,
        ) {
            Icone(
                dessin = if (sombre) R.drawable.lucide_sun else R.drawable.lucide_moon,
                description = if (sombre) "Passer en mode clair" else "Passer en mode sombre",
                teinte = p.encre.compose,
                taille = 18.dp,
            )
        }
    }
}

@Composable
private fun BarreDuBas(courante: NavDestination?, onChoisir: (Destination) -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier
            .fillMaxWidth()
            .background(p.surface.compose.copy(alpha = 0.95f))
            .filetSuperieur(p.bordure.compose)
            .windowInsetsPadding(WindowInsets.navigationBars)
            .height(64.dp),
        horizontalArrangement = Arrangement.SpaceAround,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Destination.entries.forEach { d ->
            val active = courante?.hierarchy?.any { it.route == d.route } == true
            val couleur = if (active) p.accent.compose else p.encreAttenuee.compose
            Column(
                Modifier
                    .weight(1f)
                    .clip(CircleShape)
                    .clickable(role = Role.Tab) { onChoisir(d) }
                    .semantics { selected = active }
                    .padding(vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icone(dessin = d.icone, description = null, teinte = couleur)
                Spacer(Modifier.height(3.dp))
                Text(d.libelle, style = Texte.navigation, color = couleur)
            }
        }
    }
}

/** Le filet de 1 dp qui sépare la barre du contenu, comme border-t sur le site. */
private fun Modifier.filetSuperieur(couleur: Color): Modifier =
    drawBehind { drawLine(couleur, start = Offset.Zero, end = Offset(size.width, 0f), strokeWidth = 1.dp.toPx()) }
