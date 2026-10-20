package com.moziik.app

import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.moziik.app.theme.ChoixMode
import com.moziik.app.theme.Mode
import com.moziik.app.theme.MoziikTheme
import com.moziik.app.theme.THEME_PAR_DEFAUT
import com.moziik.app.theme.modeApplique
import com.moziik.app.ui.coquille.Coquille

/** Une seule activité : tout l'écran est dessiné par Compose, le mini-lecteur reste d'une page à l'autre. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContent {
            // Réglage propre à l'appareil, comme l'interrupteur Soleil/Lune du site.
            var choix by rememberSaveable { mutableStateOf(THEME_PAR_DEFAUT.mode) }
            val mode = modeApplique(choix, isSystemInDarkTheme())
            val sombre = mode == Mode.SOMBRE

            // Icônes de la barre d'état lisibles sur le fond : claires en sombre, foncées en clair.
            LaunchedEffect(sombre) {
                val transparent = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { sombre }
                enableEdgeToEdge(statusBarStyle = transparent, navigationBarStyle = transparent)
            }

            MoziikTheme(preference = THEME_PAR_DEFAUT, mode = mode) {
                Coquille(
                    sombre = sombre,
                    onBasculerMode = { choix = if (sombre) ChoixMode.CLAIR else ChoixMode.SOMBRE },
                )
            }
        }
    }
}
