package com.moziik.app.ui.composants

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Une icône Lucide (res/drawable/lucide_*.xml, générées par outils/icones.mjs). */
@Composable
fun Icone(@DrawableRes dessin: Int, description: String?, teinte: Color, modifier: Modifier = Modifier, taille: Dp = 20.dp) {
    Icon(painterResource(dessin), contentDescription = description, tint = teinte, modifier = modifier.size(taille))
}
