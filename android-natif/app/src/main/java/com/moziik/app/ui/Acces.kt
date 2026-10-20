package com.moziik.app.ui

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import com.moziik.app.BuildConfig
import com.moziik.app.MoziikApplication
import com.moziik.app.donnees.Conteneur

/** Réseau et session de l'app, depuis n'importe quel écran. */
@Composable
fun conteneur(): Conteneur = (LocalContext.current.applicationContext as MoziikApplication).conteneur

/**
 * Connexion Google : Google refuse de se connecter dans une vue intégrée,
 * elle se fait donc dans un onglet Chrome, sur la page de connexion du site
 * en mode relais. Le site rend la main à l'app par son schéma
 * (moziik://auth, moziik-test://auth pour la version de test).
 */
fun ouvrirConnexionGoogle(contexte: Context, couleurBarre: Int) {
    val adresse = Uri.parse("${BuildConfig.SITE}connexion?relais=${BuildConfig.RELAIS}")
    CustomTabsIntent.Builder()
        .setDefaultColorSchemeParams(CustomTabColorSchemeParams.Builder().setToolbarColor(couleurBarre).build())
        .setShowTitle(true)
        .build()
        .launchUrl(contexte, adresse)
}
