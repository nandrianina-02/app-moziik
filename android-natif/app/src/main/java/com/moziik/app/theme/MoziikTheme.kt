package com.moziik.app.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** Couleur Compose d'une couleur du thème. */
val Rgb.compose: Color get() = Color(enArgb())

/** La palette courante, lue par tous les composants de l'app. */
val LocalPalette = staticCompositionLocalOf { palette(THEME_PAR_DEFAUT, Mode.SOMBRE) }

/**
 * Le thème Moziik. Les composants de l'app lisent [LocalPalette] ; le
 * schéma Material n'est renseigné que pour les éléments système (sélection
 * de texte, retours tactiles) afin qu'ils parlent la même langue visuelle.
 */
@Composable
fun MoziikTheme(preference: PreferenceTheme, mode: Mode, noir: Boolean = false, contenu: @Composable () -> Unit) {
    val p = remember(preference, mode, noir) { palette(preference, mode).let { if (noir) it.noirProfond() else it } }
    val schema = if (p.sombre) {
        darkColorScheme(
            primary = p.accent.compose,
            onPrimary = p.base.compose,
            background = p.base.compose,
            onBackground = p.encre.compose,
            surface = p.surface.compose,
            onSurface = p.encre.compose,
            onSurfaceVariant = p.encreAttenuee.compose,
            outline = p.bordure.compose,
            error = p.danger.compose,
        )
    } else {
        lightColorScheme(
            primary = p.accent.compose,
            onPrimary = p.base.compose,
            background = p.base.compose,
            onBackground = p.encre.compose,
            surface = p.surface.compose,
            onSurface = p.encre.compose,
            onSurfaceVariant = p.encreAttenuee.compose,
            outline = p.bordure.compose,
            error = p.danger.compose,
        )
    }
    val r = p.rayon
    val formes = Shapes(
        small = RoundedCornerShape((r * 0.67f).dp),
        medium = RoundedCornerShape(r.dp),
        large = RoundedCornerShape((r * 1.67f).dp),
    )
    CompositionLocalProvider(LocalPalette provides p) {
        MaterialTheme(colorScheme = schema, shapes = formes, content = contenu)
    }
}
