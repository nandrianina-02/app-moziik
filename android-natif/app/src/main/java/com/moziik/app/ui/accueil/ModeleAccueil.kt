package com.moziik.app.ui.accueil

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.moziik.app.donnees.catalogue.Catalogue
import com.moziik.app.donnees.catalogue.Diapo
import com.moziik.app.donnees.catalogue.Section
import com.moziik.app.donnees.catalogue.diaposDe
import com.moziik.app.donnees.catalogue.sectionsDe
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.Session
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class EtatAccueil(
    val diapos: List<Diapo> = emptyList(),
    val sections: List<Section> = emptyList(),
    val chargement: Boolean = true,
    /** Ce qui est affiché vient de la dernière visite : le dire, plutôt que présenter d'hier comme frais. */
    val reprise: Boolean = false,
    val erreur: String? = null,
) {
    val vide: Boolean get() = diapos.isEmpty() && sections.isEmpty()
}

class ModeleAccueil(private val catalogue: Catalogue, session: Session) : ViewModel() {
    private val _etat = MutableStateFlow(EtatAccueil())
    val etat: StateFlow<EtatAccueil> = _etat.asStateFlow()
    private var chargement: Job? = null

    init {
        viewModelScope.launch {
            val garde = withContext(Dispatchers.IO) { catalogue.accueilGarde() }
            if (garde != null && _etat.value.vide) {
                _etat.value = EtatAccueil(diaposDe(garde), sectionsDe(garde), chargement = true, reprise = true)
            }
        }
        charger()
        // Connexion ou déconnexion : les sections personnelles (écoutes récentes, recommandations) changent.
        viewModelScope.launch { session.etat.drop(1).collect { charger() } }
        // Un autre univers ou mode d'écoute : d'autres sections.
        viewModelScope.launch { catalogue.preferences.drop(1).collect { charger() } }
    }

    fun charger() {
        chargement?.cancel()
        _etat.update { it.copy(chargement = true, erreur = null) }
        chargement = viewModelScope.launch {
            try {
                val accueil = catalogue.accueil()
                _etat.value = withContext(Dispatchers.Default) {
                    EtatAccueil(diaposDe(accueil), sectionsDe(accueil), chargement = false)
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                _etat.update { it.copy(chargement = false, erreur = messageErreur(e)) }
            }
        }
    }
}
