package com.moziik.app.ui.coquille

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.navigation
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.ui.compte.EcranConnexion
import com.moziik.app.ui.compte.EcranInscription
import com.moziik.app.ui.compte.EcranMotDePasseOublie
import com.moziik.app.ui.compte.AvecProfil
import com.moziik.app.ui.compte.EcranAbonnement
import com.moziik.app.ui.compte.EcranEspaceArtiste
import com.moziik.app.ui.compte.EcranBilan
import com.moziik.app.ui.compte.EcranApparence
import com.moziik.app.ui.compte.EcranLecture
import com.moziik.app.ui.compte.EcranMonCompte
import com.moziik.app.ui.compte.EcranPreferences
import com.moziik.app.ui.compte.EcranProfil
import com.moziik.app.ui.compte.EcranSecurite
import com.moziik.app.ui.conteneur

private const val RACINE = "compte/racine"
/** Ouverte aussi depuis le mur des visiteurs du lecteur. */
internal const val INSCRIPTION = "compte/inscription"
private const val MOT_DE_PASSE = "compte/mot-de-passe-oublie"

/**
 * L'onglet Compte : la connexion pour un visiteur, Mon compte une fois
 * connecté. Inscription et mot de passe oublié sont des pages filles,
 * l'onglet reste allumé dans la barre du bas.
 */
fun NavGraphBuilder.grapheCompte(navigation: NavController) {
    navigation(startDestination = RACINE, route = Destination.COMPTE.route) {
        composable(RACINE) {
            val etat by conteneur().session.etat.collectAsStateWithLifecycle()
            Crossfade(etat is EtatSession.Connecte, animationSpec = tween(250), label = "compte") { connecte ->
                if (connecte) {
                    EcranMonCompte(onOuvrir = { navigation.navigate(it) })
                } else {
                    EcranConnexion(
                        onInscription = { navigation.navigate(INSCRIPTION) },
                        onMotDePasseOublie = { navigation.navigate(MOT_DE_PASSE) },
                    )
                }
            }
        }
        // Les rubriques de Mon compte, empilées sur l'onglet Compte.
        val retour: () -> Unit = { navigation.popBackStack() }
        composable("compte/profil") {
            AvecProfil(retour) { profil -> EcranProfil(profil.user.name, profil.user.username, retour, onEnregistre = retour) }
        }
        composable("compte/preferences") { EcranPreferences(retour) }
        composable("compte/lecture") { EcranLecture(retour) }
        composable("compte/apparence") { EcranApparence(retour) }
        composable("compte/abonnement") { EcranAbonnement(retour) }
        composable("compte/artiste") { EcranEspaceArtiste(retour) }
        composable("compte/bilan") { EcranBilan(retour) }
        composable("compte/securite") {
            AvecProfil(retour) { profil -> EcranSecurite(profil.user.hasPassword, retour) }
        }
        composable(INSCRIPTION) {
            RetourSiConnecte(navigation)
            EcranInscription(onConnexion = { navigation.popBackStack(RACINE, inclusive = false) })
        }
        composable(MOT_DE_PASSE) {
            RetourSiConnecte(navigation)
            EcranMotDePasseOublie(onRetour = { navigation.popBackStack(RACINE, inclusive = false) })
        }
    }
}

/** Une connexion Google aboutie depuis une page fille ramène à Mon compte. */
@Composable
private fun RetourSiConnecte(navigation: NavController) {
    val etat by conteneur().session.etat.collectAsStateWithLifecycle()
    LaunchedEffect(etat) {
        if (etat is EtatSession.Connecte) navigation.popBackStack(RACINE, inclusive = false)
    }
}
