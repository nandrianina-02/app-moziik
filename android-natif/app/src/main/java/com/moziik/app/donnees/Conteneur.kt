package com.moziik.app.donnees

import android.content.Context
import android.os.Build
import com.moziik.app.BuildConfig
import com.moziik.app.donnees.catalogue.Catalogue
import com.moziik.app.donnees.catalogue.HistoriqueRecherche
import com.moziik.app.donnees.reseau.Reseau
import com.moziik.app.donnees.session.CoffreSession
import com.moziik.app.donnees.session.Session
import com.moziik.app.lecteur.AlertesLecture
import com.moziik.app.lecteur.Lecteur
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import java.io.File

/**
 * Les objets partagés par toute l'app, créés une fois au démarrage du
 * processus. Assemblés à la main : il y en a peu, un cadre d'injection
 * n'apporterait que du poids.
 */
class Conteneur(contexte: Context) {
    /** Travaux qui doivent survivre à un écran (fin d'une connexion Google, déconnexion). */
    val portee = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    val coffre = CoffreSession(contexte)
    val reseau = Reseau(BuildConfig.SITE, coffre)
    val session = Session(reseau.api, coffre, libelleAppareil())
    val catalogue = Catalogue(reseau.api, session, File(contexte.filesDir, "catalogue"))
    val historiqueRecherche = HistoriqueRecherche(contexte)
    /** Messages du service de lecture à l'écran (quota atteint, titre indisponible). */
    val alertes = AlertesLecture()
    val lecteur = Lecteur(contexte, BuildConfig.SITE)
}

/**
 * « Samsung SM-A155F - app Moziik » : ce que l'utilisateur lit dans ses
 * sessions ouvertes sur le site, pour reconnaître ce téléphone (120
 * caractères au plus côté serveur).
 */
fun libelleAppareil(fabricant: String = Build.MANUFACTURER, modele: String = Build.MODEL): String {
    val marque = fabricant.replaceFirstChar { it.uppercase() }
    val nom = if (modele.startsWith(fabricant, ignoreCase = true)) modele else "$marque $modele"
    return "$nom - app Moziik".take(120)
}
