package com.moziik.app.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.navigation.NavController
import com.moziik.app.BuildConfig
import com.moziik.app.donnees.catalogue.Cible

/** Les fiches, empilées sur l'onglet d'où on les ouvre : Retour ramène à la liste de départ. */
object Fiches {
    const val ALBUM = "album/{id}"
    const val ARTISTE = "artiste/{id}"
    const val PLAYLIST = "playlist/{id}"
    const val TITRE = "titre/{id}"
    const val CLASSEMENTS = "classements?type={type}&periode={periode}"
    const val RADIO = "radio?station={station}"
    const val TITRES = "titres?genre={genre}"
    const val EVENEMENTS = "evenements"
}

/**
 * Ouvrir une fiche depuis n'importe quel écran, y compris le lecteur plein
 * écran, qui se ferme alors : il couvrait la fiche qu'on vient de demander.
 */
class Navigation(
    private val controleur: NavController,
    private val onRechercher: (String) -> Unit,
    private val onAvantNavigation: () -> Unit,
) {
    fun album(id: String) = aller("album/$id")
    fun artiste(id: String) = aller("artiste/$id")
    fun playlist(id: String) = aller("playlist/$id")
    fun titre(id: String) = aller("titre/$id")
    fun classements(type: String? = null, periode: String? = null) =
        aller("classements?type=${Uri.encode(type.orEmpty())}&periode=${Uri.encode(periode.orEmpty())}")
    fun radio(station: String? = null) = aller("radio?station=${Uri.encode(station.orEmpty())}")
    fun titres(genre: String? = null) = aller("titres?genre=${Uri.encode(genre.orEmpty())}")
    fun evenements() = aller("evenements")
    fun rechercher(terme: String) {
        onAvantNavigation()
        onRechercher(terme)
    }

    /** Suit un lien du site vers un écran de l'app ; faux si ce lien ne mène pas à un écran. */
    fun suivre(cible: Cible): Boolean {
        when (cible) {
            is Cible.DAlbum -> album(cible.id)
            is Cible.DArtiste -> artiste(cible.id)
            is Cible.DePlaylist -> playlist(cible.id)
            is Cible.DeTitre -> titre(cible.id)
            is Cible.DeRecherche -> rechercher(cible.terme)
            is Cible.Titres -> titres(cible.genre)
            is Cible.Classements -> classements(cible.type, cible.periode)
            is Cible.Radio -> radio(cible.station)
            Cible.Evenements -> evenements()
            else -> return false
        }
        return true
    }

    private fun aller(route: String) {
        onAvantNavigation()
        controleur.navigate(route) { launchSingleTop = true }
    }
}

val LocalNavigation = staticCompositionLocalOf<Navigation> { error("Navigation absente : l'écran doit être dans la coquille.") }

@Composable
fun navigation(): Navigation = LocalNavigation.current

/**
 * Partage par la feuille du système. L'adresse est celle du site, pour
 * garder l'aperçu (titre, pochette) dans les messageries (D10).
 */
fun partager(contexte: Context, chemin: String, titre: String) {
    val texte = "$titre\n${BuildConfig.SITE}$chemin"
    val envoi = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, texte)
    runCatching { contexte.startActivity(Intent.createChooser(envoi, "Partager").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}
