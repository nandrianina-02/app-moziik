package com.moziik.app.ui.decouvrir

import com.moziik.app.ui.composants.entree
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.donnees.catalogue.Catalogue
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.CarteTitre
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.MessageErreur
import com.moziik.app.ui.composants.Puce
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.fiches.BarreRetour
import com.moziik.app.ui.menus.LocalMenus
import com.moziik.app.ui.navigation
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import androidx.compose.foundation.background
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.foundation.layout.Row

data class EtatTitres(
    val genre: String? = null,
    val titres: List<Titre> = emptyList(),
    val page: Int = 0,
    val encore: Boolean = true,
    val chargement: Boolean = false,
    val erreur: String? = null,
)

class ModeleTitres(private val catalogue: Catalogue, genre: String?) : ViewModel() {
    private val _etat = MutableStateFlow(EtatTitres(genre = genre))
    val etat: StateFlow<EtatTitres> = _etat.asStateFlow()
    private val _genres = MutableStateFlow<List<String>>(emptyList())
    val genres: StateFlow<List<String>> = _genres.asStateFlow()
    private var chargement: Job? = null
    /** Tirée à l'ouverture de l'écran : un nouveau mélange à chaque visite, stable pendant le défilement. */
    private val graine = 1 + kotlin.random.Random.nextInt(2_000_000_000)

    init {
        viewModelScope.launch { _genres.value = runCatching { catalogue.genres() }.getOrDefault(emptyList()) }
        suite()
    }

    /** Changer de genre remet la liste à zéro (D9). */
    fun choisir(genre: String?) {
        if (genre == _etat.value.genre) return
        chargement?.cancel()
        _etat.value = EtatTitres(genre = genre)
        suite()
    }

    fun suite() {
        val actuel = _etat.value
        if (actuel.chargement || !actuel.encore) return
        _etat.update { it.copy(chargement = true, erreur = null) }
        chargement = viewModelScope.launch {
            try {
                val page = catalogue.pageTitres(actuel.genre, actuel.page + 1, graine)
                _etat.update {
                    it.copy(titres = (it.titres + page.songs).distinctBy { t -> t.id }, page = actuel.page + 1, encore = page.hasMore, chargement = false)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _etat.update { it.copy(chargement = false, erreur = messageErreur(e)) }
            }
        }
    }
}

/**
 * Tous les titres publiés, filtrés par genre (app/titres/page.tsx), page
 * par page : la suite se charge avant d'atteindre le bas de la grille.
 */
@Composable
fun EcranTitres(genre: String?, onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val menus = LocalMenus.current
    val modele: ModeleTitres = viewModel { ModeleTitres(c.catalogue, genre) }
    val etat by modele.etat.collectAsStateWithLifecycle()
    val genres by modele.genres.collectAsStateWithLifecycle()
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    val grille = rememberLazyGridState()
    val source = etat.genre?.let { "Découvrir · $it" } ?: "Découvrir"

    // Six vignettes avant la fin, la page suivante est demandée.
    LaunchedEffect(grille) {
        snapshotFlow { grille.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0 }
            .distinctUntilChanged()
            .filter { it >= grille.layoutInfo.totalItemsCount - 6 }
            .collect { modele.suite() }
    }

    // La grille n'a pas d'en-tête collant : la barre et les genres sont posés au-dessus, et restent en place.
    val defile by remember(grille) { derivedStateOf { grille.firstVisibleItemIndex > 0 || grille.firstVisibleItemScrollOffset > 0 } }
    val filet = p.bordure.compose
    Column(Modifier.fillMaxSize()) {
    Column(Modifier.fillMaxWidth().background(p.base.compose).drawBehind { if (defile) drawLine(filet, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx()) }) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BarreRetour(onRetour)
            Text("Découvrir", style = Texte.titreSection, color = p.encre.compose, modifier = Modifier.padding(start = 4.dp, top = 4.dp))
        }
        if (genres.isNotEmpty()) {
            val choix = listOf("Tous") + genres
            LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                itemsIndexed(choix) { i, g ->
                    Puce(g, if (i == 0) etat.genre == null else etat.genre == g) { modele.choisir(if (i == 0) null else g) }
                }
            }
        }
    }
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        state = grille,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 32.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        item(key = "titre", span = { GridItemSpan(maxLineSpan) }) {
            Text("Tous les titres publiés sur Moziik.", style = Texte.corps, color = p.encreAttenuee.compose)
        }
        itemsIndexed(etat.titres, key = { _, t -> t.id }) { i, titre ->
            Box(Modifier.entree(i)) {
                CarteTitre(
                    titre, titre.id == lecture.courant?.id, lecture.enLecture,
                    onClick = { c.lecteur.lire(etat.titres, i, source) },
                    onAppuiLong = { menus.titre(titre) },
                )
            }
        }
        item(key = "pied", span = { GridItemSpan(maxLineSpan) }) {
            Box(Modifier.fillMaxWidth().padding(vertical = 16.dp), contentAlignment = Alignment.Center) {
                when {
                    etat.erreur != null -> MessageErreur(etat.erreur)
                    etat.chargement -> Egaliseur(hauteur = 18.dp)
                    etat.titres.isEmpty() -> Text("Aucun titre pour ce genre.", style = Texte.corps, color = p.encreAttenuee.compose, textAlign = TextAlign.Center)
                    !etat.encore -> Text("Tu as tout écouté — plus rien à charger.", style = Texte.secondaire, color = p.encreAttenuee.compose)
                }
            }
        }
    }
    }
}
