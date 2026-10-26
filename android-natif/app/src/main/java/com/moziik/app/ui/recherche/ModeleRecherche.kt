package com.moziik.app.ui.recherche

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.moziik.app.donnees.catalogue.Catalogue
import com.moziik.app.donnees.catalogue.FonctionsIA
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
import com.moziik.app.donnees.catalogue.Resultat
import com.moziik.app.donnees.horsligne.rechercheLocale

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
    /** Sans réseau : les titres téléchargés qui correspondent (6.4). */
    val locaux: List<Titre>? = null,
)

/** Au plus cinq raccourcis vers les meilleurs résultats, pour ouvrir directement ce qu'on cherchait. */
fun suggestionsDe(resultats: Resultats?): List<Resultat> {
    if (resultats == null) return emptyList()
    val tous = listOfNotNull(resultats.meilleur) + resultats.sections.flatMap { it.resultats.take(2) }
    return tous.distinctBy {
        when (it) {
            is Resultat.DeTitre -> "t" + it.titre.id
            is Resultat.DArtiste -> "a" + it.artiste.id
            is Resultat.DAlbum -> "l" + it.album.id
            is Resultat.DePlaylist -> "p" + it.playlist.id
            is Resultat.DeGenre -> "g" + it.nom
        }
    }.take(5)
}

@OptIn(FlowPreview::class)
/** La recherche par description (D6) : proposée seulement quand la recherche classique trouve peu. */
sealed interface EtatRechercheIA {
    data object Aucune : EtatRechercheIA
    data object Proposee : EtatRechercheIA
    data object Chargement : EtatRechercheIA
    data class Resultat(val explication: String, val titres: List<Titre>) : EtatRechercheIA
    data class Erreur(val message: String) : EtatRechercheIA
}

/** Au moins quatre mots de plus de deux lettres : une description, pas un nom de titre (D6). */
fun estUneDescription(terme: String): Boolean = terme.split(Regex("\\s+")).count { it.length > 2 } >= 4

class ModeleRecherche(
    private val catalogue: Catalogue,
    private val historique: HistoriqueRecherche,
    private val ia: FonctionsIA,
    /** Les titres téléchargés et l'état du réseau : sans réseau, la recherche se fait sur le téléphone. */
    private val telecharges: () -> List<Titre> = { emptyList() },
    private val horsReseau: () -> Boolean = { false },
) : ViewModel() {
    /** Les recherches récentes : revenir sur un terme (effacer une lettre) est instantané. */
    private val cache = object : LinkedHashMap<String, Pair<Resultats, Long>>(32, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Pair<Resultats, Long>>?) = size > 40
    }
    private val _rechercheIA = MutableStateFlow<EtatRechercheIA>(EtatRechercheIA.Aucune)
    val rechercheIA: StateFlow<EtatRechercheIA> = _rechercheIA.asStateFlow()

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
            // 250 ms après la dernière frappe (le site attend 420 ms) : les résultats suivent la saisie,
            // et un terme déjà cherché revient aussitôt du cache. Un changement de filtre relance sans attendre.
            combine(_terme.debounce { if (it.isBlank()) 0L else 250L }, _type) { t, ty -> t.trim() to ty }
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

    /** Demande à l'IA les titres qui correspondent à la description saisie. */
    fun chercherParDescription() {
        val terme = _terme.value.trim()
        _rechercheIA.value = EtatRechercheIA.Chargement
        viewModelScope.launch {
            _rechercheIA.value = try {
                val r = ia.chercherParDescription(terme)
                EtatRechercheIA.Resultat(r.interpretation?.explication.orEmpty(), r.songs)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                EtatRechercheIA.Erreur(messageErreur(e))
            }
        }
    }

    private suspend fun chercher(terme: String, type: TypeRecherche) {
        _rechercheIA.value = EtatRechercheIA.Aucune
        // Sous deux caractères, le site renvoie une réponse vide : l'écran montre l'état par défaut.
        if (terme.length < 2) {
            _etat.value = EtatRecherche()
            return
        }
        if (horsReseau()) {
            _etat.value = EtatRecherche(locaux = rechercheLocale(telecharges(), terme))
            return
        }
        val cle = "${type.cle}|${terme.lowercase()}"
        val enCache = cache[cle]?.takeIf { System.currentTimeMillis() - it.second < 120_000 }?.first
        if (enCache != null) {
            _etat.value = EtatRecherche(resultats = enCache)
            return
        }
        _etat.update { it.copy(chargement = true, erreur = null, locaux = null) }
        try {
            val resultats = catalogue.recherche(terme, type.cle, 1)
            cache[cle] = resultats to System.currentTimeMillis()
            _etat.value = EtatRecherche(resultats = resultats)
            val trouves = resultats.sections.sumOf { it.total }
            _rechercheIA.value = if (estUneDescription(terme) && trouves <= 3 && ia.active("recherche")) EtatRechercheIA.Proposee else EtatRechercheIA.Aucune
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
