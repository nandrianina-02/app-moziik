package com.moziik.app.ui.fiches

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.AlbumCourt
import com.moziik.app.donnees.catalogue.AlbumDetail
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.CarteCollection
import com.moziik.app.ui.composants.LigneTitre
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.menus.LocalMenus
import com.moziik.app.ui.navigation
import com.moziik.app.ui.partager
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import com.moziik.app.ui.horsligne.BoutonTelechargerLot
import com.moziik.app.ui.horsligne.PastilleAlbum

data class DonneesAlbum(val album: AlbumDetail, val autres: List<AlbumCourt>, val enregistre: Boolean)

private val TYPES = mapOf("album" to "Album", "ep" to "EP", "single" to "Single", "podcast" to "Podcast")

/** La fiche album (D11) : en-tête, actions, pistes, puis les autres sorties de l'artiste. */
@Composable
fun FicheAlbum(id: String, onRetour: () -> Unit) {
    val c = conteneur()
    val modele: ModeleFiche<DonneesAlbum> = viewModel {
        ModeleFiche {
            coroutineScope {
                val enregistre = async { c.catalogue.albumEnregistre(id) }
                val album = c.catalogue.album(id)
                val autres = album.artist?.id?.let { runCatching { c.catalogue.albumsDe(it) }.getOrDefault(emptyList()) }.orEmpty()
                DonneesAlbum(album, autres.filter { it.id != id }, enregistre.await())
            }
        }
    }
    val etat by modele.etat.collectAsStateWithLifecycle()
    ContenuFiche(etat, modele::recharger) { donnees -> CorpsAlbum(donnees, onRetour) }
}

@Composable
private fun CorpsAlbum(donnees: DonneesAlbum, onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val menus = LocalMenus.current
    val contexte = LocalContext.current
    val portee = rememberCoroutineScope()
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    val session by c.session.etat.collectAsStateWithLifecycle()
    val album = donnees.album
    val titres = album.songs
    // Un podcast compte des épisodes, pas des titres.
    val unite = if (album.type == "podcast") "épisode" else "titre"
    var enregistre by remember(donnees) { mutableStateOf(donnees.enregistre) }
    var bascule by remember { mutableStateOf(false) }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 32.dp)) {
        item(key = "retour") { BarreRetour(onRetour) }
        item(key = "entete") {
            EnTeteFiche(
                pochette = album.coverUrl,
                banniere = album.bannerUrl ?: album.coverUrl,
                type = TYPES[album.type] ?: "Album",
                titre = album.title,
                sousTitre = {
                    LienArtiste(album.artist?.stageName, album.artist?.verified == true, album.artist?.id?.let { a -> { nav.artiste(a) } })
                },
                pastilles = listOfNotNull(
                    annee(album.releaseDate),
                    nombre(titres.size, unite),
                    titres.sumOf { it.duration }.takeIf { it > 0 }?.let(::dureeTotale),
                ),
            ) {
                BoutonFiche(R.drawable.lucide_play_plein, "Tout écouter", onClick = { c.lecteur.lire(titres, 0, album.title) }, principal = true)
                BoutonFiche(R.drawable.lucide_shuffle, null, onClick = { c.lecteur.lire(titres.shuffled(), 0, album.title) }, description = "Lecture aléatoire")
                BoutonFiche(
                    if (enregistre) R.drawable.lucide_check else R.drawable.lucide_plus,
                    if (enregistre) "Ajouté" else "Ajouter",
                    actif = enregistre,
                    chargement = bascule,
                    onClick = {
                        if (session !is EtatSession.Connecte) {
                            c.alertes.signaler(AlerteLecture.Message("Connecte-toi pour enregistrer un album."))
                        } else if (!bascule) {
                            bascule = true
                            portee.launch {
                                runCatching { c.catalogue.basculerAlbum(album.id) }
                                    .onSuccess { enregistre = it }
                                    .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                                bascule = false
                            }
                        }
                    },
                )
                BoutonTelechargerLot(titres, "album", album.title, albumId = album.id)
                BoutonFiche(R.drawable.lucide_share_2, null, onClick = { partager(contexte, "album/${album.id}", album.title) }, description = "Partager")
            }
        }
        album.description?.takeIf { it.isNotBlank() }?.let { texte ->
            item(key = "description") {
                Text(texte, style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 20.dp))
            }
        }
        if (titres.isEmpty()) {
            item(key = "vide") {
                Text("Aucun titre publié dans cet album pour le moment.", style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(16.dp))
            }
        }
        item(key = "pistes-titre") { SectionFiche(if (album.type == "podcast") "Épisodes" else "Pistes") {} }
        itemsIndexed(titres, key = { _, t -> "piste-${t.id}" }) { i, titre ->
            LigneTitre(
                titre, i + 1, titre.id == lecture.courant?.id, lecture.enLecture,
                onClick = { c.lecteur.lire(titres, i, album.title) },
                modifier = Modifier.padding(horizontal = 12.dp),
                onAppuiLong = { menus.titre(titre) },
            )
        }
        if (donnees.autres.isNotEmpty()) {
            item(key = "autres") {
                SectionFiche("Plus de ${album.artist?.stageName ?: "cet artiste"}") {
                    RangeeAlbums(donnees.autres) { nav.album(it) }
                }
            }
        }
    }
}

/** Une rangée d'albums qui ouvrent leur fiche. */
@Composable
fun RangeeAlbums(albums: List<AlbumCourt>, onOuvrir: (String) -> Unit) {
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        items(albums, key = { it.id }) { a ->
            val ligne = listOfNotNull(TYPES[a.type], annee(a.releaseDate)).joinToString(" · ").ifEmpty { null }
            CarteCollection(a.title, ligne, a.coverUrl, onClick = { onOuvrir(a.id) }, modifier = Modifier.width(140.dp), badge = R.drawable.lucide_disc_3, pastille = { PastilleAlbum(a.id, a.title, a.coverUrl) })
        }
    }
}
