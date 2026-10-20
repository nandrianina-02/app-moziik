package com.moziik.app.donnees.session

import com.moziik.app.donnees.reseau.AdresseEmail
import com.moziik.app.donnees.reseau.CodeRelais
import com.moziik.app.donnees.reseau.DemandeRenouvellement
import com.moziik.app.donnees.reseau.ErreurApi
import com.moziik.app.donnees.reseau.Identifiants
import com.moziik.app.donnees.reseau.Inscription
import com.moziik.app.donnees.reseau.Jetons
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.reseau.UtilisateurCourt
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.reseau.versErreurApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed interface EtatSession {
    data object Anonyme : EtatSession
    data class Connecte(val utilisateur: UtilisateurCourt) : EtatSession
}

/** La connexion par e-mail a été refusée parce que l'adresse n'est pas confirmée (B3 de la spécification). */
class EmailNonConfirme(val email: String) : Exception()

/** Où en est une connexion Google, qui se termine hors de l'écran qui l'a lancée (retour du navigateur). */
sealed interface EtatGoogle {
    data object Repos : EtatGoogle
    data object EnCours : EtatGoogle
    data class Echec(val message: String) : EtatGoogle
}

/**
 * Le compte sur cet appareil : connexion (e-mail ou Google), inscription,
 * déconnexion. L'état suit le stockage : une session que le réseau oublie
 * (renouvellement refusé) repasse aussitôt l'app en visiteur.
 */
class Session(
    private val api: MoziikApi,
    private val stockage: StockageSession,
    /** Libellé de l'appareil, visible par l'utilisateur dans ses « Sessions ouvertes » sur le site. */
    private val appareil: String,
) {
    private val _etat = MutableStateFlow(etatDe(stockage.lire()))
    val etat: StateFlow<EtatSession> = _etat.asStateFlow()

    init {
        stockage.surChangement { _etat.value = etatDe(it) }
    }

    /**
     * Le site distingue « aucun compte » et « mot de passe incorrect » ; on
     * ne le dit pas : cela révélerait qu'une adresse a un compte.
     */
    suspend fun connexion(email: String, motDePasse: String) {
        val adresse = email.trim().lowercase()
        val jetons = appel { api.connexion(Identifiants(adresse, motDePasse, appareil)) }.getOrElse { e ->
            throw when {
                e is ErreurApi && e.statut == 403 && e.code == "EMAIL_NOT_VERIFIED" -> EmailNonConfirme(adresse)
                e is ErreurApi && e.statut == 401 -> ErreurApi(401, "Email ou mot de passe incorrect.")
                else -> e
            }
        }
        retenir(jetons)
    }

    private val _google = MutableStateFlow<EtatGoogle>(EtatGoogle.Repos)
    val google: StateFlow<EtatGoogle> = _google.asStateFlow()

    /**
     * Retour du relais Google (<schéma>://auth?code=… ou ?erreur=session) :
     * le code, à usage unique et valable une minute, contre des jetons.
     */
    suspend fun terminerGoogle(code: String?, erreur: String?) {
        if (code == null) {
            _google.value = EtatGoogle.Echec(
                if (erreur == "session") "La connexion Google n'a pas abouti. Réessaie." else "Connexion Google interrompue.",
            )
            return
        }
        _google.value = EtatGoogle.EnCours
        appel { api.connexionRelais(CodeRelais(code, appareil)) }
            .onSuccess {
                retenir(it)
                _google.value = EtatGoogle.Repos
            }
            .onFailure { _google.value = EtatGoogle.Echec(messageErreur(it)) }
    }

    fun oublierEchecGoogle() {
        if (_google.value is EtatGoogle.Echec) _google.value = EtatGoogle.Repos
    }

    /** Aucune connexion automatique : le site envoie un lien de confirmation (B1). */
    suspend fun inscription(nom: String, email: String, motDePasse: String) {
        appel { api.inscription(Inscription(nom.trim(), email.trim().lowercase(), motDePasse)) }.getOrThrow()
    }

    suspend fun renvoyerConfirmation(email: String): String =
        appel { api.renvoyerConfirmation(AdresseEmail(email.trim().lowercase())) }.getOrThrow().message

    suspend fun motDePasseOublie(email: String): String =
        appel { api.motDePasseOublie(AdresseEmail(email.trim().lowercase())) }.getOrThrow().message

    /**
     * Révoque ce seul appareil sur le site, puis oublie la session. Sans
     * réseau, la session est oubliée quand même : on ne retient pas
     * quelqu'un qui veut se déconnecter.
     */
    suspend fun deconnexion() {
        stockage.lire()?.let { session -> appel { api.deconnexion(DemandeRenouvellement(session.refreshToken)) } }
        stockage.effacer()
    }

    private fun retenir(jetons: Jetons) {
        stockage.ecrire(SessionMobile(jetons.accessToken, jetons.refreshToken, jetons.user))
    }

    private fun etatDe(session: SessionMobile?): EtatSession =
        session?.let { EtatSession.Connecte(it.utilisateur) } ?: EtatSession.Anonyme
}

/** Un appel à l'API, ses erreurs HTTP ramenées à ErreurApi. */
suspend fun <T> appel(bloc: suspend () -> T): Result<T> = try {
    Result.success(bloc())
} catch (e: Exception) {
    if (e is kotlinx.coroutines.CancellationException) throw e
    Result.failure(versErreurApi(e))
}
