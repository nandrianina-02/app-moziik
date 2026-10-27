package com.moziik.app

import android.content.Intent
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
import androidx.compose.runtime.remember
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.moziik.app.donnees.compte.ThemeSite
import com.moziik.app.donnees.compte.themeDepuisJson
import com.moziik.app.donnees.compte.versPreference
import com.moziik.app.donnees.reseau.JsonMoziik
import com.moziik.app.donnees.session.EtatSession
import androidx.compose.runtime.setValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import kotlinx.coroutines.launch
import com.moziik.app.theme.ChoixMode
import com.moziik.app.theme.Mode
import com.moziik.app.theme.MoziikTheme
import com.moziik.app.theme.THEME_PAR_DEFAUT
import com.moziik.app.theme.modeApplique
import com.moziik.app.ui.coquille.Coquille
import com.moziik.app.donnees.push.EXTRA_LIEN
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import com.moziik.app.ui.bienvenue.EcranBienvenue
import com.moziik.app.ui.publierRaccourcis

/** Une seule activité : tout l'écran est dessiné par Compose, le mini-lecteur reste d'une page à l'autre. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        publierRaccourcis(this)
        // Retour de la connexion Google alors que l'app avait été fermée entre-temps.
        if (savedInstanceState == null) {
            recevoirRelais(intent)
            recevoirLien(intent)
        }
        setContent {
            val conteneur = (application as MoziikApplication).conteneur
            // Le thème du site (ou le thème personnel d'un abonné), gardé pour s'afficher dès le lancement (A5).
            var theme by remember { mutableStateOf(conteneur.reglages.themeGarde?.let(::themeDepuisJson) ?: THEME_PAR_DEFAUT) }
            val session by conteneur.session.etat.collectAsStateWithLifecycle()
            LaunchedEffect(session) {
                conteneur.compte.themeApplique(session is EtatSession.Connecte)?.let { lu ->
                    theme = lu.versPreference()
                    conteneur.reglages.themeGarde = JsonMoziik.encodeToString(ThemeSite.serializer(), lu)
                }
            }
            // Clair ou sombre : réglage propre à l'appareil, comme l'interrupteur Soleil/Lune du site ; il prime sur le thème.
            val apparence by conteneur.reglages.apparence.collectAsStateWithLifecycle()
            val choix = when (apparence) {
                "clair" -> ChoixMode.CLAIR
                "sombre" -> ChoixMode.SOMBRE
                "systeme" -> ChoixMode.SYSTEME
                else -> theme.mode
            }
            val mode = modeApplique(choix, isSystemInDarkTheme())
            val sombre = mode == Mode.SOMBRE

            // Icônes de la barre d'état lisibles sur le fond : claires en sombre, foncées en clair.
            LaunchedEffect(sombre) {
                val transparent = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { sombre }
                enableEdgeToEdge(statusBarStyle = transparent, navigationBarStyle = transparent)
            }

            val noir by conteneur.reglages.noirProfond.collectAsStateWithLifecycle()
            val accueilFait by conteneur.reglages.accueilFait.collectAsStateWithLifecycle()
            MoziikTheme(preference = theme, mode = mode, noir = noir) {
                // Au tout premier lancement, l'accueil guidé ; ensuite, directement l'app.
                Crossfade(accueilFait, animationSpec = tween(300), label = "bienvenue") { fait ->
                    if (fait) {
                        Coquille(
                            sombre = sombre,
                            onBasculerMode = { conteneur.reglages.choisirApparence(if (sombre) "clair" else "sombre") },
                        )
                    } else {
                        EcranBienvenue(onFini = {})
                    }
                }
            }
        }
    }

    // La télécommande du lecteur suit l'écran ; la musique, elle, continue dans son service.
    override fun onStart() {
        super.onStart()
        (application as MoziikApplication).conteneur.lecteur.connecter()
        (application as MoziikApplication).conteneur.horsLigne.avis.premierPlan = true
    }

    override fun onStop() {
        (application as MoziikApplication).conteneur.lecteur.liberer()
        (application as MoziikApplication).conteneur.horsLigne.avis.premierPlan = false
        super.onStop()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        recevoirRelais(intent)
        recevoirLien(intent)
    }

    /** Une notification touchée : la coquille ouvre la page dont elle parle. */
    private fun recevoirLien(intent: Intent?) {
        val lien = intent?.getStringExtra(EXTRA_LIEN) ?: return
        (application as MoziikApplication).conteneur.lienEntrant.value = lien.ifBlank { "/notifications" }
        intent.removeExtra(EXTRA_LIEN)
    }

    /** <schéma>://auth?code=… : le site rend la main après la connexion Google (app/api/mobile-auth/relais). */
    private fun recevoirRelais(intent: Intent?) {
        val lien = intent?.data ?: return
        if (lien.host != "auth") return
        val conteneur = (application as MoziikApplication).conteneur
        // Portée de l'app, pas de l'activité : une rotation à ce moment n'annule pas l'échange du code.
        conteneur.portee.launch { conteneur.session.terminerGoogle(lien.getQueryParameter("code"), lien.getQueryParameter("erreur")) }
        // Consommé : le code ne sert qu'une fois, il ne doit pas être rejoué.
        setIntent(Intent(intent).setData(null))
    }
}
