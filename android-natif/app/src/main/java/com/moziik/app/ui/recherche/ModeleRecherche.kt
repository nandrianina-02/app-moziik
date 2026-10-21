package com.moziik.app.ui.recherche

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.moziik.app.donnees.catalogue.Catalogue
import com.moziik.app.donnees.catalogue.HistoriqueRecherche
import com.moziik.app.donnees.catalogue.Resultats
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.reseau.messageErreur
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Les filtres de la recherche du site, sans Évènements tant que l'app n'a pas leur écran. */
enum class TypeRecherche(val cle: String, val libelle: String) {
    TOUT("all", "Tout"),
    TITRES("songs", "Titres"),
    ARTISTES("artists", "Artistes"),
    ALBUMS("albums", "Albums"),
    PLAYLISTS("playlists", "Playlists"),
    GENRES("genres", "Genres"),
}

data class EtatRecherche(
    val resultats: Resultats? = null,
    val chargement: Boolean = false,
    val erreur: String? = null,
    val page: Int = 1,
    val chargementSuite: Boolean = false,
)

@OptIn(FlowPreview::class)
class ModeleRecherche(private val catalogue: Catalogue, private val historique: HistoriqueRecherche) : ViewModel() {
    private val _terme = MutableStateFlow("")
    val terme: StateFlow<String> = _terme.asStateFlow()
    private val _type = MutableStateFlow(TypeRecherche.TOUT)
    val type: StateFlow<TypeRecherche> = _type.asStateFlow()
    private val _etat = MutableStateFlow(EtatRecherche())
    val etat: StateFlow<EtatRecherche> = _etat.asStateFlow()
    private val _populaires = MutableStateFlow<List<Titre>>(emptyList())
    val populaires: StateFlow<List<Titre>> = _populaires.asStateFlow()

    /** Un terme n'est journalisé qu'une fois : changer de filtre ne recompte pas (D5). */
    private val journalises = mutableSetOf<String>()

    init {
        viewModelScope.launch {
            // 420 ms après la dernière frappe, comme le site ; un changement de filtre relance aussitôt.
            combine(_terme.debounce { if (it.isBlank()) 0L else 420L }, _type) { t, ty -> t.trim() to ty }
                .distinctUntilChanged()
                .collectLatest { (t, ty) -> chercher(t, ty) }
        }
        viewModelScope.launch {
            _populaires.value = runCatching { catalogue.populaires() }.getOrDefault(emptyList())
        }
    }

    fun saisir(terme: String) {
        _terme.value = terme
    }

    fun choisir(type: TypeRecherche) {
        _type.value = type
    }

    fun retenir(terme: String) = historique.retenir(terme)

    private suspend fun chercher(terme: String, type: TypeRecherche) {
        // Sous deux caractères, le site renvoie une réponse vide : l'écran montre l'état par défaut.
        if (terme.length < 2) {
            _etat.value = EtatRecherche()
            return
        }
        _etat.update { it.copy(chargement = true, erreur = null) }
        try {
            val resultats = catalogue.recherche(terme, type.cle, 1)
            _etat.value = EtatRecherche(resultats = resultats)
            if (!resultats.vide) {
                // Recherche stable depuis 2,5 s et fructueuse : elle compte, une fois.
                delay(2_500)
                historique.retenir(terme)
                if (journalises.add(terme.lowercase())) catalogue.journaliser(terme)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            _etat.update { it.copy(chargement = false, erreur = messageErreur(e)) }
        }
    }

    /** Page suivante d'un filtre : ses éléments s'ajoutent à ceux déjà affichés. */
    fun suite() {
        val actuel = _etat.value
        val resultats = actuel.resultats ?: return
        if (actuel.chargementSuite || _type.value == TypeRecherche.TOUT) return
        _etat.update { it.copy(chargementSuite = true) }
        viewModelScope.launch {
            try {
                val page = actuel.page + 1
                val suivants = catalogue.recherche(_terme.value.trim(), _type.value.cle, page)
                val fusion = resultats.sections.map { s ->
                    val plus = suivants.sections.firstOrNull { it.cle == s.cle }?.resultats.orEmpty()
                    s.copy(resultats = (s.resultats + plus).distinct())
                }
                _etat.value = actuel.copy(resultats = resultats.copy(sections = fusion), page = page, chargementSuite = false)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _etat.update { it.copy(chargementSuite = false, erreur = messageErreur(e)) }
            }
        }
    }
}
