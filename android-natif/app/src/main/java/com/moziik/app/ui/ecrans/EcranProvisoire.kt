package com.moziik.app.ui.ecrans

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Egaliseur

/**
 * Place d'un écran pas encore construit, dans les versions de test
 * seulement : chaque lot remplace une de ces places par l'écran réel.
 */
@Composable
fun EcranProvisoire(titre: String) {
    val p = LocalPalette.current
    Column(
        Modifier.fillMaxSize().padding(horizontal = 32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Egaliseur(hauteur = 20.dp, libelle = null)
        Spacer(Modifier.height(20.dp))
        Text(titre, style = Texte.titreFiche, color = p.encre.compose)
        Spacer(Modifier.height(8.dp))
        Text(
            "Cet écran arrive dans un prochain lot de l'app native.",
            style = Texte.corps,
            color = p.encreAttenuee.compose,
            textAlign = TextAlign.Center,
        )
    }
}
