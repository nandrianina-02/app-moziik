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
    const val SELECTION = "selection/{cle}"
    const val TITRE = "titre/{id}"
    const val CLASSEMENTS = "classements?type={type}&periode={periode}"
    const val RADIO = "radio?station={station}"
    const val TITRES = "titres?genre={genre}"
    const val EVENEMENTS = "evenements"
    const val CONVERSATION = "conversation/{id}"
    const val EVENEMENT = "evenement/{id}"
    const val NOTIFICATIONS = "notifications"
    const val PARAMETRES = "parametres"
    const val BLIND_TEST = "blind-test"
    const val MEMBRE = "membre/{username}"
    const val AMIS = "amis"
    const val BLEND = "blend/{username}"
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
    fun selection(cle: String) = aller("selection/$cle")
    fun titre(id: String) = aller("titre/$id")
    fun classements(type: String? = null, periode: String? = null) =
        aller("classements?type=${Uri.encode(type.orEmpty())}&periode=${Uri.encode(periode.orEmpty())}")
    fun radio(station: String? = null) = aller("radio?station=${Uri.encode(station.orEmpty())}")
    fun titres(genre: String? = null) = aller("titres?genre=${Uri.encode(genre.orEmpty())}")
    fun evenements() = aller("evenements")
    fun conversation(id: String) = aller("conversation/$id")
    fun evenement(id: String) = aller("evenement/$id")
    fun notifications() = aller("notifications")
    fun parametres() = aller("parametres")
    fun blindTest() = aller("blind-test")
    fun membre(username: String) = aller("membre/${Uri.encode(username)}")
    fun amis() = aller("amis")
    fun blend(username: String) = aller("blend/${Uri.encode(username)}")
    /** L'écran Abonnement de l'onglet Compte : là où mène une fonction réservée à Premium. */
    fun abonnement() = aller("compte/abonnement")
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
            is Cible.DEvenement -> evenement(cible.id)
            is Cible.DeMembre -> membre(cible.username)
            is Cible.DeBlend -> blend(cible.username)
            Cible.Amis -> amis()
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
