@file:OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)

package com.moziik.app.ui.bibliotheque

import com.moziik.app.ui.composants.entree
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.AlbumCourt
import com.moziik.app.donnees.catalogue.ArtisteCarte
import com.moziik.app.donnees.catalogue.Bibliotheque
import com.moziik.app.donnees.catalogue.PlaylistMienne
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.EtatLecteur
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.CarteArtiste
import com.moziik.app.ui.composants.CarteCollection
import com.moziik.app.ui.composants.CarteTitre
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.EnTeteSection
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LigneTitre
import com.moziik.app.ui.composants.Puce
import com.moziik.app.ui.composants.apparitionUneFois
import com.moziik.app.ui.composants.pressable
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.horsligne.listeTelechargements
import com.moziik.app.ui.menus.LocalMenus
import com.moziik.app.ui.menus.TuileIA
import com.moziik.app.ui.menus.fonctionIA
import com.moziik.app.ui.navigation
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.moziik.app.ui.horsligne.PastilleAlbum
import com.moziik.app.ui.horsligne.PastillePlaylist
import com.moziik.app.ui.composants.SqueletteListe

/** Une liste de la bibliothèque, chargée à part : chacune s'affiche à son arrivée (F1). */
data class Liste<T>(val elements: List<T>? = null, val erreur: String? = null)

class ModeleBibliotheque(private val bibliotheque: Bibliotheque) : ViewModel() {
    private fun <T> flux() = MutableStateFlow(Liste<T>())
    private val _playlists = flux<PlaylistMienne>()
    private val _aimes = flux<Titre>()
    private val _albums = flux<AlbumCourt>()
    private val _artistes = flux<ArtisteCarte>()
    private val _recents = flux<Titre>()
    val playlists: StateFlow<Liste<PlaylistMienne>> = _playlists.asStateFlow()
    val aimes: StateFlow<Liste<Titre>> = _aimes.asStateFlow()
    val albums: StateFlow<Liste<AlbumCourt>> = _albums.asStateFlow()
    val artistes: StateFlow<Liste<ArtisteCarte>> = _artistes.asStateFlow()
    val recents: StateFlow<Liste<Titre>> = _recents.asStateFlow()

    private fun <T> remplir(cible: MutableStateFlow<Liste<T>>, chargement: suspend () -> List<T>) {
        viewModelScope.launch {
            cible.value = try {
                Liste(chargement())
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // La liste déjà affichée reste en place : une panne ne vide pas l'écran.
                cible.value.copy(erreur = messageErreur(e))
            }
        }
    }

    fun charger() {
        remplir(_playlists) { bibliotheque.mesPlaylists() }
        remplir(_aimes) { bibliotheque.titresAimes() }
        remplir(_albums) { bibliotheque.albumsEnregistres() }
        remplir(_artistes) { bibliotheque.artistesSuivis() }
        remplir(_recents) { bibliotheque.recents() }
    }
}

private enum class Onglet(val libelle: String) { TOUT("Tout"), PLAYLISTS("Playlists"), TITRES("Titres"), ALBUMS("Albums"), ARTISTES("Artistes"), PODCASTS("Podcasts"), TELECHARGEMENTS("Téléchargements") }

/**
 * « Ma zone » (app/bibliotheque/page.tsx) : playlists, titres aimés, albums
 * et podcasts enregistrés, artistes suivis, écoutes récentes, titres
 * téléchargés. Réservée aux comptes connectés : une déconnexion efface les
 * téléchargements (6.1).
 */
@Composable
fun EcranBibliotheque(onConnexion: () -> Unit) {
    val c = conteneur()
    val session by c.session.etat.collectAsStateWithLifecycle()
    if (session !is EtatSession.Connecte) {
        Invitation(onConnexion)
        return
    }
    val menus = LocalMenus.current
    val modele: ModeleBibliotheque = viewModel { ModeleBibliotheque(c.bibliotheque) }
    // Rechargée à chaque changement fait ailleurs : un j'aime, une playlist créée ou modifiée.
    LaunchedEffect(menus.version, session) { modele.charger() }
    val playlists by modele.playlists.collectAsStateWithLifecycle()
    val aimes by modele.aimes.collectAsStateWithLifecycle()
    val albums by modele.albums.collectAsStateWithLifecycle()
    val artistes by modele.artistes.collectAsStateWithLifecycle()
    val recents by modele.recents.collectAsStateWithLifecycle()
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    val telecharges by c.horsLigne.telechargements.titres.collectAsStateWithLifecycle()
    val titresHorsLigne = androidx.compose.runtime.remember(telecharges) { telecharges.map(c.horsLigne.telechargements::versTitre) }
    // Sans réseau, rien d'autre ne se charge : Ma zone s'ouvre sur ce qui est sur le téléphone.
    var onglet by rememberSaveable { mutableStateOf(if (c.horsLigne.horsReseau.value) Onglet.TELECHARGEMENTS else Onglet.TOUT) }
    val p = LocalPalette.current
    val nav = navigation()
    val vus = androidx.compose.runtime.remember { mutableSetOf<Any>() }

    val podcasts = albums.elements.orEmpty().filter { it.type == "podcast" }
    val disques = albums.elements.orEmpty().filter { it.type != "podcast" }
    val onglets = Onglet.entries.filter { it != Onglet.PODCASTS || podcasts.isNotEmpty() }
    val avecIA = fonctionIA("playlist")

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp)) {
        item(key = "titre") { Text("Ma bibliothèque", style = Texte.titreFiche, color = p.encre.compose, modifier = Modifier.padding(top = 16.dp)) }
        // Les onglets restent en haut : on passe des titres aux albums sans remonter.
        stickyHeader(key = "onglets") {
            LazyRow(Modifier.fillMaxWidth().background(p.base.compose).padding(vertical = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(onglets) { o -> Puce(o.libelle, o == onglet) { onglet = o } }
            }
        }
        if (onglet == Onglet.TOUT) {
            item(key = "compteurs") {
                Column(Modifier.apparitionUneFois("compteurs", 0, vus), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Compteur(R.drawable.lucide_heart, "Titres likés", aimes.elements?.size, Color(0xFFF43F5E), Modifier.weight(1f)) { onglet = Onglet.TITRES }
                        Compteur(R.drawable.lucide_list_music, "Playlists", playlists.elements?.size, Color(0xFF10B981), Modifier.weight(1f)) { onglet = Onglet.PLAYLISTS }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Compteur(R.drawable.lucide_disc_3, "Albums", disques.size.takeIf { albums.elements != null }, Color(0xFF6366F1), Modifier.weight(1f)) { onglet = Onglet.ALBUMS }
                        Compteur(R.drawable.lucide_users, "Artistes suivis", artistes.elements?.size, Color(0xFFF59E0B), Modifier.weight(1f)) { onglet = Onglet.ARTISTES }
                    }
                }
            }
            recents.elements?.takeIf { it.isNotEmpty() }?.let { titres ->
                item(key = "recents") {
                    Column(Modifier.padding(top = 28.dp)) {
                        EnTeteSection("Récemment écoutés")
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            itemsIndexed(titres, key = { _, t -> t.id }) { i, t ->
                                CarteTitre(
                                    t, t.id == lecture.courant?.id, lecture.enLecture,
                                    onClick = { c.lecteur.lire(titres, i, "Récemment écouté") },
                                    modifier = Modifier.width(132.dp),
                                    onAppuiLong = { menus.titre(t, "Récemment écouté") },
                                )
                            }
                        }
                    }
                }
            }
            item(key = "playlists-apercu") {
                Column(Modifier.padding(top = 28.dp)) {
                    EnTeteSection("Playlists", onVoirTout = { onglet = Onglet.PLAYLISTS })
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        item(key = "creer") { TuileCreer(Modifier.width(132.dp)) { menus.nouvellePlaylist() } }
                        if (avecIA) item(key = "ia") { TuileIA(Modifier.width(132.dp)) { menus.composerAvecIA() } }
                        items(playlists.elements.orEmpty().take(8), key = { it.id }) { pl -> CartePlaylist(pl, Modifier.width(132.dp)) { nav.playlist(pl.id) } }
                    }
                }
            }
            titresAimes(aimes, lecture, apercu = true, onVoirTout = { onglet = Onglet.TITRES })
            if (disques.isNotEmpty()) {
                item(key = "albums-apercu") {
                    Column(Modifier.padding(top = 28.dp)) {
                        EnTeteSection("Albums", onVoirTout = { onglet = Onglet.ALBUMS })
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            items(disques.take(8), key = { it.id }) { a ->
                                CarteCollection(
                                    a.title, a.artist?.stageName ?: "Artiste supprimé", a.coverUrl, onClick = { nav.album(a.id) },
                                    modifier = Modifier.width(132.dp), verifie = a.artist?.verified == true, badge = R.drawable.lucide_disc_3, pastille = { PastilleAlbum(a.id, a.title, a.coverUrl) },
                                )
                            }
                        }
                    }
                }
            }
            artistes.elements?.takeIf { it.isNotEmpty() }?.let { liste ->
                item(key = "artistes-apercu") {
                    Column(Modifier.padding(top = 28.dp)) {
                        EnTeteSection("Artistes suivis", onVoirTout = { onglet = Onglet.ARTISTES })
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            items(liste.take(10), key = { it.id }) { a ->
                                CarteArtiste(a.stageName, a.coverUrl, a.verified, null, onClick = { nav.artiste(a.id) }, modifier = Modifier.width(88.dp))
                            }
                        }
                    }
                }
            }
        }
        when (onglet) {
            Onglet.PLAYLISTS -> grille("playlists", listOfNotNull<Any>("creer", if (avecIA) "ia" else null) + playlists.elements.orEmpty(), playlists.erreur, playlists.elements == null) { element ->
                when (element) {
                    is PlaylistMienne -> CartePlaylist(element, Modifier.fillMaxWidth()) { nav.playlist(element.id) }
                    "ia" -> TuileIA(Modifier.fillMaxWidth()) { menus.composerAvecIA() }
                    else -> TuileCreer(Modifier.fillMaxWidth()) { menus.nouvellePlaylist() }
                }
            }
            Onglet.TITRES -> titresAimes(aimes, lecture, apercu = false, onVoirTout = null)
            Onglet.ALBUMS -> grille("albums", disques, albums.erreur, albums.elements == null, vide = "Aucun album enregistré. Touche « Ajouter » sur la fiche d'un album.") { a ->
                a as AlbumCourt
                CarteCollection(
                    a.title, a.artist?.stageName ?: "Artiste supprimé", a.coverUrl, onClick = { nav.album(a.id) },
                    modifier = Modifier.fillMaxWidth(), verifie = a.artist?.verified == true, badge = R.drawable.lucide_disc_3, pastille = { PastilleAlbum(a.id, a.title, a.coverUrl) },
                )
            }
            Onglet.PODCASTS -> grille("podcasts", podcasts, albums.erreur, albums.elements == null) { a ->
                a as AlbumCourt
                CarteCollection(
                    a.title, a.artist?.stageName ?: "Artiste supprimé", a.coverUrl, onClick = { nav.album(a.id) }, modifier = Modifier.fillMaxWidth(),
                    badge = R.drawable.lucide_podcast, pastille = { PastilleAlbum(a.id, a.title, a.coverUrl) },
                )
            }
            Onglet.ARTISTES -> grille("artistes", artistes.elements.orEmpty(), artistes.erreur, artistes.elements == null, colonnes = 3, vide = "Tu ne suis encore aucun artiste.") { a ->
                a as ArtisteCarte
                CarteArtiste(a.stageName, a.coverUrl, a.verified, a.followersCount?.let { "$it abonné${if (it > 1) "s" else ""}" }, onClick = { nav.artiste(a.id) }, modifier = Modifier.fillMaxWidth())
            }
            Onglet.TELECHARGEMENTS -> listeTelechargements(titresHorsLigne, lecture)
            Onglet.TOUT -> Unit
        }
    }
}

/** Les titres aimés : cinq en aperçu sur « Tout », tous sur leur onglet, avec « Tout écouter ». */
private fun LazyListScope.titresAimes(aimes: Liste<Titre>, lecture: EtatLecteur, apercu: Boolean, onVoirTout: (() -> Unit)?) {
    val titres = aimes.elements
    item(key = "aimes-entete") {
        Column(Modifier.padding(top = if (apercu) 28.dp else 0.dp)) {
            EnTeteSection("Titres likés", titres?.let { "${it.size} titre${if (it.size > 1) "s" else ""}" }, onVoirTout = onVoirTout)
            val c = conteneur()
            if (!apercu && !titres.isNullOrEmpty()) {
                BoutonPrincipal("Tout écouter", { c.lecteur.lire(titres, 0, "Titres likés") }, Modifier.padding(bottom = 12.dp))
            }
            when {
                aimes.erreur != null && titres == null -> Text(aimes.erreur, style = Texte.corps, color = LocalPalette.current.encreAttenuee.compose)
                titres == null -> Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 16.dp) }
                titres.isEmpty() -> Text("Aucun son aimé pour l'instant.", style = Texte.corps, color = LocalPalette.current.encreAttenuee.compose)
            }
        }
    }
    val affiches = titres.orEmpty().let { if (apercu) it.take(5) else it }
    itemsIndexed(affiches, key = { _, t -> "aime-${t.id}" }) { i, t ->
        val c = conteneur()
        val menus = LocalMenus.current
        LigneTitre(
            t, null, t.id == lecture.courant?.id, lecture.enLecture,
            onClick = { c.lecteur.lire(titres.orEmpty(), i, "Titres likés") },
            modifier = Modifier.animateItem().entree(i),
            onAppuiLong = { menus.titre(t, "Titres likés") },
        )
    }
}

/** Une grille de deux (ou trois) colonnes, posée dans la liste. */
private fun LazyListScope.grille(
    cle: String,
    elements: List<Any>,
    erreur: String?,
    chargement: Boolean,
    colonnes: Int = 2,
    vide: String = "Rien ici pour l'instant.",
    vignette: @Composable (Any) -> Unit,
) {
    when {
        chargement -> item(key = "$cle-attente") { SqueletteListe(4) }
        elements.isEmpty() -> item(key = "$cle-vide") {
            Text(erreur ?: vide, style = Texte.corps, color = LocalPalette.current.encreAttenuee.compose, modifier = Modifier.padding(vertical = 16.dp))
        }
        else -> elements.chunked(colonnes).forEachIndexed { i, ligne ->
            item(key = "$cle-$i") {
                Row(Modifier.padding(bottom = 18.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    ligne.forEach { e -> Box(Modifier.weight(1f)) { vignette(e) } }
                    repeat(colonnes - ligne.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

@Composable
private fun CartePlaylist(pl: PlaylistMienne, modifier: Modifier, onClick: () -> Unit) {
    CarteCollection(
        pl.title,
        "${pl.songs.size} titre${if (pl.songs.size > 1) "s" else ""} · ${if (pl.isPublic) "Publique" else "Privée"}",
        pl.coverUrl,
        onClick = onClick,
        modifier = modifier,
        badge = R.drawable.lucide_list_music,
        pastille = if (pl.songs.isEmpty()) null else ({ PastillePlaylist(pl.id, pl.title, pl.coverUrl) }),
    )
}

/** La tuile « Créer une playlist », en tête des playlists (CreatePlaylistTile.tsx). */
@Composable
private fun TuileCreer(modifier: Modifier, onClick: () -> Unit) {
    val p = LocalPalette.current
    Column(modifier.pressable(onClick = onClick)) {
        Box(
            Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(p.rayon.dp))
                .border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(p.rayon.dp))
                .background(p.accent.compose.copy(alpha = 0.06f)),
            contentAlignment = Alignment.Center,
        ) {
            Box(Modifier.size(44.dp).clip(CircleShape).background(p.accent.compose), contentAlignment = Alignment.Center) {
                Icone(R.drawable.lucide_plus, description = null, teinte = p.base.compose, taille = 22.dp)
            }
        }
        Spacer(Modifier.height(8.dp))
        Text("Créer une playlist", style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose)
    }
}

/** Un compteur de la bibliothèque (LibraryStatCard.tsx) : il ouvre l'onglet correspondant. */
@Composable
private fun Compteur(icone: Int, libelle: String, nombre: Int?, teinte: Color, modifier: Modifier, onClick: () -> Unit) {
    val p = LocalPalette.current
    Row(
        modifier
            .clip(RoundedCornerShape(p.rayon.dp))
            .border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(p.rayon.dp))
            .background(p.surface.compose)
            .pressable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(38.dp).clip(RoundedCornerShape(10.dp)).background(teinte.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
            Icone(icone, description = null, teinte = teinte, taille = 18.dp)
        }
        Spacer(Modifier.width(10.dp))
        Column {
            Text(libelle, style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1)
            Text(nombre?.toString() ?: "…", style = Texte.titreSection, color = p.encre.compose)
        }
    }
}

@Composable
private fun Invitation(onConnexion: () -> Unit) {
    val p = LocalPalette.current
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(Modifier.size(56.dp).clip(CircleShape).background(p.accent.compose.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
            Icone(R.drawable.lucide_library, description = null, teinte = p.accent.compose, taille = 26.dp)
        }
        Spacer(Modifier.height(16.dp))
        Text("Ma bibliothèque", style = Texte.titreSection, color = p.encre.compose)
        Spacer(Modifier.height(6.dp))
        Text(
            "Connecte-toi pour retrouver tes playlists, tes titres aimés, tes albums et les artistes que tu suis.",
            style = Texte.corps, color = p.encreAttenuee.compose, textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(20.dp))
        BoutonPrincipal("Se connecter", onConnexion, Modifier.width(200.dp))
    }
}
