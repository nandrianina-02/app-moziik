package com.moziik.app.ui.compte

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.moziik.app.donnees.reseau.ErreurApi
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.reseau.Profil
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.EmailNonConfirme
import com.moziik.app.donnees.session.Session
import com.moziik.app.donnees.session.appel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * L'état des écrans du compte, gardé hors de l'écran : une rotation ou un
 * passage en arrière-plan n'interrompt pas une connexion en cours.
 */
data class EtatFormulaire(
    val enCours: Boolean = false,
    val erreur: String? = null,
    /** Adresse refusée faute de confirmation : on propose de renvoyer le lien. */
    val aConfirmer: String? = null,
    /** Message de réussite (lien envoyé, compte créé). */
    val confirmation: String? = null,
)

class ConnexionModele(private val session: Session) : ViewModel() {
    private val _etat = MutableStateFlow(EtatFormulaire())
    val etat: StateFlow<EtatFormulaire> = _etat.asStateFlow()

    fun connexion(email: String, motDePasse: String) {
        if (email.isBlank() || motDePasse.isEmpty()) {
            _etat.value = EtatFormulaire(erreur = "Indique ton email et ton mot de passe.")
            return
        }
        _etat.value = EtatFormulaire(enCours = true)
        viewModelScope.launch {
            _etat.value = try {
                session.connexion(email, motDePasse)
                EtatFormulaire()
            } catch (e: EmailNonConfirme) {
                EtatFormulaire(erreur = "Ton adresse email n'est pas encore confirmée.", aConfirmer = e.email)
            } catch (e: Exception) {
                EtatFormulaire(erreur = messageErreur(e))
            }
        }
    }

    fun renvoyerConfirmation() {
        val email = _etat.value.aConfirmer ?: return
        _etat.update { it.copy(enCours = true) }
        viewModelScope.launch {
            _etat.value = try {
                EtatFormulaire(confirmation = session.renvoyerConfirmation(email))
            } catch (e: Exception) {
                EtatFormulaire(erreur = messageErreur(e), aConfirmer = email)
            }
        }
    }
}

class InscriptionModele(private val session: Session) : ViewModel() {
    private val _etat = MutableStateFlow(EtatFormulaire())
    val etat: StateFlow<EtatFormulaire> = _etat.asStateFlow()

    /** Adresse du compte créé : l'écran passe à « Vérifie ta boîte mail ». */
    private val _cree = MutableStateFlow<String?>(null)
    val cree: StateFlow<String?> = _cree.asStateFlow()

    fun inscription(nom: String, email: String, motDePasse: String) {
        // Mêmes bornes que le site (registerSchema) : on les dit avant d'envoyer.
        val erreur = when {
            nom.trim().length < 2 -> "Ton nom doit faire au moins 2 caractères."
            !email.contains('@') -> "Adresse email invalide."
            motDePasse.length < 8 -> "Ton mot de passe doit faire au moins 8 caractères."
            else -> null
        }
        if (erreur != null) {
            _etat.value = EtatFormulaire(erreur = erreur)
            return
        }
        _etat.value = EtatFormulaire(enCours = true)
        viewModelScope.launch {
            try {
                session.inscription(nom, email, motDePasse)
                _cree.value = email.trim().lowercase()
                _etat.value = EtatFormulaire()
            } catch (e: Exception) {
                _etat.value = EtatFormulaire(erreur = messageErreur(e))
            }
        }
    }

    fun renvoyer() {
        val email = _cree.value ?: return
        _etat.value = EtatFormulaire(enCours = true)
        viewModelScope.launch {
            _etat.value = try {
                EtatFormulaire(confirmation = session.renvoyerConfirmation(email))
            } catch (e: Exception) {
                EtatFormulaire(erreur = messageErreur(e))
            }
        }
    }
}

class MotDePasseModele(private val session: Session) : ViewModel() {
    private val _etat = MutableStateFlow(EtatFormulaire())
    val etat: StateFlow<EtatFormulaire> = _etat.asStateFlow()

    fun envoyer(email: String) {
        if (!email.contains('@')) {
            _etat.value = EtatFormulaire(erreur = "Adresse email invalide.")
            return
        }
        _etat.value = EtatFormulaire(enCours = true)
        viewModelScope.launch {
            _etat.value = try {
                // Réponse identique qu'un compte existe ou non (le site ne le révèle pas).
                EtatFormulaire(confirmation = session.motDePasseOublie(email))
            } catch (e: Exception) {
                EtatFormulaire(erreur = messageErreur(e))
            }
        }
    }
}

sealed interface EtatProfil {
    data object Chargement : EtatProfil
    data class Pret(val profil: Profil) : EtatProfil
    data class Echec(val message: String) : EtatProfil
}

class CompteModele(
    private val api: MoziikApi,
    private val session: Session,
    private val horsLigne: com.moziik.app.donnees.horsligne.HorsLigne,
) : ViewModel() {
    private val _profil = MutableStateFlow<EtatProfil>(EtatProfil.Chargement)
    val profil: StateFlow<EtatProfil> = _profil.asStateFlow()

    private val _deconnexion = MutableStateFlow(false)
    val deconnexion: StateFlow<Boolean> = _deconnexion.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        _profil.value = EtatProfil.Chargement
        viewModelScope.launch {
            appel { api.profil() }
                .onSuccess { _profil.value = EtatProfil.Pret(it) }
                .onFailure { e ->
                    // 401 : session révoquée ailleurs, le réseau l'a déjà oubliée ; l'écran repasse à la connexion.
                    if (!(e is ErreurApi && e.statut == 401)) _profil.value = EtatProfil.Echec(messageErreur(e))
                }
        }
    }

    /**
     * Par défaut, les données du compte restent sur le téléphone et
     * reviennent à la reconnexion ; `effacer` les retire, à la demande.
     */
    fun seDeconnecter(effacer: Boolean) {
        _deconnexion.value = true
        viewModelScope.launch {
            if (effacer) horsLigne.effacerDonneesDuCompte()
            session.deconnexion()
            _deconnexion.value = false
        }
    }
}
