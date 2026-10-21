package com.moziik.app.ui.fiches

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.PlaylistDetail
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.LigneTitre
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.navigation
import com.moziik.app.ui.partager

/**
 * La fiche d'une playlist (F7), en lecture : la modifier relève de la
 * bibliothèque, qui viendra avec l'onglet Ma zone.
 */
@Composable
fun FichePlaylist(id: String, onRetour: () -> Unit) {
    val c = conteneur()
    val modele: ModeleFiche<PlaylistDetail> = viewModel { ModeleFiche { c.catalogue.playlist(id) } }
    val etat by modele.etat.collectAsStateWithLifecycle()
    ContenuFiche(etat, modele::recharger) { playlist -> CorpsPlaylist(playlist, onRetour) }
}

@Composable
private fun CorpsPlaylist(playlist: PlaylistDetail, onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val contexte = LocalContext.current
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    val titres = playlist.songs
    val proprietaire = playlist.owner?.name

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 32.dp)) {
        item(key = "retour") { BarreRetour(onRetour) }
        item(key = "entete") {
            EnTeteFiche(
                pochette = playlist.coverUrl ?: titres.firstOrNull()?.coverUrl,
                banniere = playlist.coverUrl ?: titres.firstOrNull()?.coverUrl,
                type = "Playlist",
                titre = playlist.title,
                sousTitre = if (proprietaire != null) ({ Text("par $proprietaire", style = Texte.corps, color = p.encreAttenuee.compose) }) else null,
                pastilles = listOfNotNull(
                    nombre(titres.size, "titre"),
                    titres.sumOf { it.duration }.takeIf { it > 0 }?.let(::dureeTotale),
                ),
            ) {
                if (titres.isNotEmpty()) {
                    BoutonFiche(R.drawable.lucide_play_plein, "Tout écouter", onClick = { c.lecteur.lire(titres, 0, playlist.title) }, principal = true)
                    BoutonFiche(R.drawable.lucide_shuffle, null, onClick = { c.lecteur.lire(titres.shuffled(), 0, playlist.title) }, description = "Lecture aléatoire")
                }
                BoutonFiche(R.drawable.lucide_share_2, null, onClick = { partager(contexte, "playlist/${playlist.id}", playlist.title) }, description = "Partager")
            }
        }
        playlist.description?.takeIf { it.isNotBlank() }?.let { texte ->
            item(key = "description") {
                Text(
                    texte, style = Texte.corps, color = p.encreAttenuee.compose, textAlign = TextAlign.Center,
                    modifier = Modifier.padding(start = 24.dp, end = 24.dp, top = 16.dp),
                )
            }
        }
        if (titres.isEmpty()) {
            item(key = "vide") {
                Text("Cette playlist est vide pour le moment.", style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(16.dp))
            }
        } else {
            item(key = "titres") { SectionFiche("Titres") {} }
        }
        itemsIndexed(titres, key = { i, t -> "titre-$i-${t.id}" }) { i, titre ->
            LigneTitre(
                titre, i + 1, titre.id == lecture.courant?.id, lecture.enLecture,
                onClick = { c.lecteur.lire(titres, i, playlist.title) },
                modifier = Modifier.padding(horizontal = 12.dp),
                onAppuiLong = { nav.titre(titre.id) },
            )
        }
    }
}
