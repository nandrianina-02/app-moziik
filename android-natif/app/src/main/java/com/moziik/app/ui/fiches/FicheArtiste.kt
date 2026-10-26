package com.moziik.app.ui.fiches

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.ReponseArtiste
import com.moziik.app.donnees.catalogue.titresDeLArtiste
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.CarteArtiste
import com.moziik.app.ui.composants.CarteCollection
import com.moziik.app.ui.composants.LigneTitre
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.menus.LocalMenus
import com.moziik.app.ui.navigation
import com.moziik.app.ui.partager
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import com.moziik.app.ui.horsligne.PastillePlaylist

data class DonneesArtiste(val reponse: ReponseArtiste, val suivi: Boolean)

/** Au-delà, la liste des titres se déplie sur demande. */
private const val TITRES_REPLIES = 5

/**
 * La fiche artiste (D12) : abonnés et écoutes, Suivre, ses titres
 * populaires puis tout son catalogue, ses sorties, les playlists qui le
 * diffusent, les artistes proches et sa biographie.
 */
@Composable
fun FicheArtiste(id: String, onRetour: () -> Unit) {
    val c = conteneur()
    val modele: ModeleFiche<DonneesArtiste> = viewModel {
        ModeleFiche {
            coroutineScope {
                val suivi = async { c.catalogue.artisteSuivi(id) }
                DonneesArtiste(c.catalogue.artiste(id), suivi.await())
            }
        }
    }
    val etat by modele.etat.collectAsStateWithLifecycle()
    ContenuFiche(etat, modele::recharger) { donnees -> CorpsArtiste(donnees, onRetour) }
}

@Composable
private fun CorpsArtiste(donnees: DonneesArtiste, onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val menus = LocalMenus.current
    val contexte = LocalContext.current
    val portee = rememberCoroutineScope()
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    val session by c.session.etat.collectAsStateWithLifecycle()
    val r = donnees.reponse
    val artiste = r.artist
    val tous = remember(r) { titresDeLArtiste(r) }
    var deplie by rememberSaveable { mutableStateOf(false) }
    val affiches = if (deplie) tous else tous.take(TITRES_REPLIES)
    var suivi by remember(donnees) { mutableStateOf(donnees.suivi) }
    var abonnes by remember(donnees) { mutableIntStateOf(artiste.followersCount) }
    var bascule by remember { mutableStateOf(false) }
    var radio by remember { mutableStateOf(false) }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 32.dp)) {
        item(key = "retour") { BarreRetour(onRetour) }
        item(key = "entete") {
            EnTeteFiche(
                pochette = artiste.coverUrl,
                banniere = artiste.bannerUrl ?: artiste.coverUrl,
                type = "Artiste",
                titre = artiste.stageName,
                forme = CircleShape,
                sousTitre = if (artiste.verified) ({ LienArtiste("Artiste vérifié", verifie = true, onClick = null) }) else null,
                pastilles = listOf(nombre(abonnes, "abonné"), nombre(artiste.totalPlays, "écoute")),
            ) {
                if (tous.isNotEmpty()) {
                    BoutonFiche(R.drawable.lucide_play_plein, "Écouter", onClick = { c.lecteur.lire(tous, 0, artiste.stageName) }, principal = true)
                }
                BoutonFiche(
                    if (suivi) R.drawable.lucide_user_check else R.drawable.lucide_user_plus,
                    if (suivi) "Abonné" else "Suivre",
                    actif = suivi,
                    chargement = bascule,
                    onClick = {
                        if (session !is EtatSession.Connecte) {
                            c.alertes.signaler(AlerteLecture.Message("Connecte-toi pour suivre un artiste."))
                        } else if (!bascule) {
                            bascule = true
                            portee.launch {
                                runCatching { c.catalogue.basculerSuivi(artiste.id) }
                                    .onSuccess {
                                        suivi = it.following
                                        abonnes = it.followersCount
                                    }
                                    .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                                bascule = false
                            }
                        }
                    },
                )
                if (tous.isNotEmpty()) {
                    BoutonFiche(
                        // Sans libellé : quatre boutons titrés ne tiennent pas sur un téléphone étroit.
                        R.drawable.lucide_radio, null,
                        chargement = radio,
                        description = "Radio de ${artiste.stageName}",
                        onClick = {
                            if (!radio) {
                                radio = true
                                portee.launch {
                                    runCatching { c.catalogue.radioArtiste(r) }
                                        .onSuccess { c.lecteur.lire(it, 0, "Radio ${artiste.stageName}") }
                                        .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                                    radio = false
                                }
                            }
                        },
                    )
                }
                BoutonFiche(R.drawable.lucide_share_2, null, onClick = { partager(contexte, "artiste/${artiste.id}", artiste.stageName) }, description = "Partager")
            }
        }
        if (tous.isEmpty()) {
            item(key = "vide") {
                Text("Aucun titre publié pour le moment.", style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(16.dp))
            }
        } else {
            item(key = "titres") { SectionFiche(if (deplie) "Tous les titres" else "Titres populaires") {} }
        }
        itemsIndexed(affiches, key = { _, t -> "titre-${t.id}" }) { i, titre ->
            LigneTitre(
                titre, i + 1, titre.id == lecture.courant?.id, lecture.enLecture,
                onClick = { c.lecteur.lire(tous, i, artiste.stageName) },
                modifier = Modifier.padding(horizontal = 12.dp),
                onAppuiLong = { menus.titre(titre) },
            )
        }
        if (tous.size > TITRES_REPLIES) {
            item(key = "deplier") {
                Box(Modifier.fillMaxWidth().padding(top = 8.dp), contentAlignment = Alignment.Center) {
                    Text(
                        if (deplie) "Afficher moins" else "Afficher les ${tous.size} titres",
                        style = Texte.corps.copy(fontWeight = FontWeight.Medium),
                        color = p.encreAttenuee.compose,
                        modifier = Modifier
                            .clip(CircleShape)
                            .border(BorderStroke(1.dp, p.bordure.compose), CircleShape)
                            .clickable(role = Role.Button) { deplie = !deplie }
                            .padding(horizontal = 18.dp, vertical = 8.dp),
                    )
                }
            }
        }
        if (r.albums.isNotEmpty()) item(key = "albums") { SectionFiche("Albums") { RangeeAlbums(r.albums) { nav.album(it) } } }
        if (r.singles.isNotEmpty()) item(key = "singles") { SectionFiche("Singles") { RangeeAlbums(r.singles) { nav.album(it) } } }
        if (r.playlistsFeaturing.isNotEmpty()) {
            item(key = "playlists") {
                SectionFiche("Playlists qui le diffusent") {
                    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        items(r.playlistsFeaturing, key = { it.id }) { pl ->
                            CarteCollection(
                                pl.title, null, pl.coverUrl, onClick = { nav.playlist(pl.id) }, modifier = Modifier.width(140.dp),
                                badge = R.drawable.lucide_list_music, pastille = { PastillePlaylist(pl.id, pl.title, pl.coverUrl) },
                            )
                        }
                    }
                }
            }
        }
        if (r.similarArtists.isNotEmpty()) {
            item(key = "similaires") {
                SectionFiche("Artistes similaires") {
                    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        items(r.similarArtists, key = { it.id }) { a ->
                            CarteArtiste(a.stageName, a.coverUrl, a.verified, null, onClick = { nav.artiste(a.id) }, modifier = Modifier.width(96.dp))
                        }
                    }
                }
            }
        }
        artiste.bio?.takeIf { it.isNotBlank() }?.let { bio ->
            item(key = "bio") {
                SectionFiche("À propos") {
                    Text(bio, style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(horizontal = 16.dp))
                }
            }
        }
    }
}
