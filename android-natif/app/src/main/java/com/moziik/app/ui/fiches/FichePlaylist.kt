@file:OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)

package com.moziik.app.ui.fiches

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.PlaylistDetail
import com.moziik.app.donnees.catalogue.Resultat
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.ChampTexte
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LigneTitre
import com.moziik.app.ui.composants.NomArtiste
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.menus.ActionMenu
import com.moziik.app.ui.menus.Confirmation
import com.moziik.app.ui.menus.DialoguePlaylist
import com.moziik.app.ui.menus.Feuille
import com.moziik.app.ui.menus.LocalMenus
import com.moziik.app.ui.partager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.moziik.app.ui.horsligne.BoutonTelechargerLot
import com.moziik.app.ui.social.FeuilleCollaboration
import androidx.compose.foundation.lazy.rememberLazyListState

/**
 * La fiche d'une playlist (F7). Son propriétaire la modifie ici même
 * (F8 à F10) : titre, description, visibilité, titres ajoutés ou retirés,
 * suppression après confirmation. Une playlist collaborative laisse aussi
 * ses collaborateurs ajouter et retirer des titres.
 *
 * `jeton` : ouverte par un lien d'invitation, la playlist est d'abord
 * rejointe, puis relue avec les droits du collaborateur.
 */
@Composable
fun FichePlaylist(id: String, onRetour: () -> Unit, jeton: String? = null) {
    val c = conteneur()
    val modele: ModeleFiche<PlaylistDetail> = viewModel { ModeleFiche { c.catalogue.playlist(id) } }
    val etat by modele.etat.collectAsStateWithLifecycle()
    val session by c.session.etat.collectAsStateWithLifecycle()
    var invitation by rememberSaveable(id) { mutableStateOf(jeton) }
    val connecte = session is EtatSession.Connecte
    LaunchedEffect(invitation, connecte) {
        val j = invitation ?: return@LaunchedEffect
        if (!connecte) {
            c.alertes.signaler(AlerteLecture.Message("Connecte-toi pour rejoindre cette playlist collaborative."))
            return@LaunchedEffect
        }
        runCatching { c.social.rejoindre(id, j) }
            .onSuccess {
                c.alertes.signaler(AlerteLecture.Message("Tu participes à cette playlist.", succes = true))
                modele.recharger()
            }
            .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
        invitation = null
    }
    ContenuFiche(etat, modele::recharger) { playlist -> CorpsPlaylist(playlist, onRetour, modele::recharger) }
}

@Composable
private fun CorpsPlaylist(playlist: PlaylistDetail, onRetour: () -> Unit, onRecharger: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val menus = LocalMenus.current
    val contexte = LocalContext.current
    val portee = rememberCoroutineScope()
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    val session by c.session.etat.collectAsStateWithLifecycle()
    val titres = playlist.songs
    val proprietaire = playlist.owner?.name
    // La gestion est réservée au propriétaire ; le site le vérifie aussi (403).
    val moi = (session as? EtatSession.Connecte)?.utilisateur?.id
    val aMoi = moi != null && playlist.owner?.id == moi
    val collaborateur = moi != null && playlist.collaborateurs.any { it.id == moi }
    // Les titres : propriétaire, ou collaborateur tant que la collaboration est active.
    val peutTitres = aMoi || (collaborateur && playlist.collaborative)
    var collaboration by remember { mutableStateOf(false) }
    var edition by remember { mutableStateOf(false) }
    var suppression by remember { mutableStateOf(false) }
    var ajout by remember { mutableStateOf(false) }

    val changee: () -> Unit = {
        menus.bibliothequeChangee()
        onRecharger()
    }

    val liste = rememberLazyListState()
    LazyColumn(Modifier.fillMaxSize(), state = liste, contentPadding = PaddingValues(bottom = 32.dp)) {
        stickyHeader(key = "retour") { BarreCollante(onRetour, playlist.title, liste) }
        item(key = "entete") {
            EnTeteFiche(
                pochette = playlist.coverUrl ?: titres.firstOrNull()?.coverUrl,
                banniere = playlist.coverUrl ?: titres.firstOrNull()?.coverUrl,
                type = "Playlist",
                titre = playlist.title,
                sousTitre = if (proprietaire != null) ({
                    val autres = playlist.collaborateurs.size
                    Text(
                        "par $proprietaire" + if (autres > 0) " et ${nombre(autres, "collaborateur")}" else "",
                        style = Texte.corps, color = p.encreAttenuee.compose,
                    )
                }) else null,
                pastilles = listOfNotNull(
                    nombre(titres.size, "titre"),
                    titres.sumOf { it.duration }.takeIf { it > 0 }?.let(::dureeTotale),
                    if (aMoi) (if (playlist.isPublic) "Publique" else "Privée") else null,
                    if (playlist.collaborative) "Collaborative" else null,
                ),
            ) {
                if (titres.isNotEmpty()) {
                    BoutonFiche(R.drawable.lucide_play_plein, "Tout écouter", onClick = { c.lecteur.lire(titres, 0, playlist.title) }, principal = true)
                    BoutonFiche(R.drawable.lucide_shuffle, null, onClick = { c.lecteur.lire(titres.shuffled(), 0, playlist.title) }, description = "Lecture aléatoire")
                    BoutonTelechargerLot(titres, "playlist", playlist.title)
                }
                // Une playlist privée ne se partage pas : son lien ne s'ouvrirait chez personne.
                if (playlist.isPublic) {
                    BoutonFiche(R.drawable.lucide_share_2, null, onClick = { partager(contexte, "playlist/${playlist.id}", playlist.title) }, description = "Partager")
                }
            }
        }
        if (aMoi || collaborateur) {
            item(key = "gestion") {
                Row(
                    Modifier.fillMaxWidth().padding(top = 12.dp),
                    horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
                ) {
                    if (peutTitres) BoutonFiche(R.drawable.lucide_list_plus, "Ajouter", onClick = { ajout = true })
                    if (aMoi) BoutonFiche(R.drawable.lucide_pencil, "Modifier", onClick = { edition = true })
                    BoutonFiche(R.drawable.lucide_users, null, onClick = { collaboration = true }, description = "Playlist collaborative")
                    if (aMoi) BoutonFiche(R.drawable.lucide_trash_2, null, onClick = { suppression = true }, description = "Supprimer la playlist")
                }
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
                Text(
                    if (peutTitres) "Cette playlist est vide. Ajoute des titres avec « Ajouter »." else "Cette playlist est vide pour le moment.",
                    style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(16.dp),
                )
            }
        } else {
            item(key = "titres") { SectionFiche("Titres") {} }
        }
        itemsIndexed(titres, key = { i, t -> "titre-$i-${t.id}" }) { i, titre ->
            val extras = if (peutTitres) {
                listOf(
                    ActionMenu("Retirer de la playlist", R.drawable.lucide_trash_2) {
                        portee.launch {
                            runCatching { c.bibliotheque.retirer(playlist.id, titre.id) }
                                .onSuccess {
                                    c.alertes.signaler(AlerteLecture.Message("Retiré de « ${playlist.title} ».", succes = true))
                                    changee()
                                }
                                .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                        }
                    },
                )
            } else {
                emptyList()
            }
            LigneTitre(
                titre, i + 1, titre.id == lecture.courant?.id, lecture.enLecture,
                onClick = { c.lecteur.lire(titres, i, playlist.title) },
                modifier = Modifier.padding(horizontal = 12.dp),
                onAppuiLong = { menus.titre(titre, playlist.title, extras) },
            )
        }
    }

    if (edition) {
        DialoguePlaylist(
            entete = "Modifier la playlist",
            action = "Enregistrer",
            titreInitial = playlist.title,
            descriptionInitiale = playlist.description.orEmpty(),
            publiqueInitiale = playlist.isPublic,
            onFermer = { edition = false },
            onValider = { titre, description, publique ->
                c.bibliotheque.modifier(playlist.id, titre, description, publique)
                c.alertes.signaler(AlerteLecture.Message("Playlist enregistrée.", succes = true))
                edition = false
                changee()
            },
        )
    }
    if (suppression) {
        Confirmation(
            titre = "Supprimer « ${playlist.title} » ?",
            texte = "La playlist disparaît définitivement, pour toi comme pour ceux qui l'écoutaient. Les titres, eux, restent sur Moziik.",
            action = "Supprimer",
            onFermer = { suppression = false },
            onConfirmer = {
                suppression = false
                portee.launch {
                    runCatching { c.bibliotheque.supprimer(playlist.id) }
                        .onSuccess {
                            c.alertes.signaler(AlerteLecture.Message("Playlist supprimée.", succes = true))
                            menus.bibliothequeChangee()
                            onRetour()
                        }
                        .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                }
            },
        )
    }
    if (collaboration) {
        FeuilleCollaboration(
            playlist = playlist,
            estProprietaire = aMoi,
            onFermer = { collaboration = false },
            onChangee = changee,
            onQuittee = {
                collaboration = false
                menus.bibliothequeChangee()
                // Privée, la playlist n'est plus lisible pour qui vient de la quitter.
                if (playlist.isPublic) onRecharger() else onRetour()
            },
        )
    }
    if (ajout) {
        AjoutTitres(playlist, onFermer = {
            ajout = false
            changee()
        })
    }
}

/**
 * Ajouter des titres à sa playlist (F9) : une recherche, ou à défaut les
 * titres populaires. Les titres déjà présents sont marqués et ne
 * s'ajoutent pas deux fois.
 */
@Composable
private fun AjoutTitres(playlist: PlaylistDetail, onFermer: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val portee = rememberCoroutineScope()
    var terme by rememberSaveable { mutableStateOf("") }
    var resultats by remember { mutableStateOf<List<Titre>?>(null) }
    val presents = remember { mutableStateListOf<String>().apply { addAll(playlist.songs.map { it.id }) } }
    var enCours by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(terme) {
        val t = terme.trim()
        resultats = null
        resultats = try {
            if (t.length < 2) {
                c.catalogue.populaires()
            } else {
                delay(420)
                c.catalogue.recherche(t, "songs", 1).sections.flatMap { s -> s.resultats.filterIsInstance<Resultat.DeTitre>().map { it.titre } }
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            c.alertes.signaler(AlerteLecture.Message(messageErreur(e)))
            emptyList()
        }
    }

    Feuille(onFermer) {
        Text("Ajouter à « ${playlist.title} »", style = Texte.titreSection, color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 20.dp))
        ChampTexte(terme, { terme = it }, "Rechercher un titre", R.drawable.lucide_search, Modifier.padding(horizontal = 20.dp, vertical = 12.dp), indication = "Titre ou artiste")
        val liste = resultats
        if (liste == null) {
            Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 18.dp) }
        } else if (liste.isEmpty()) {
            Text("Aucun titre trouvé.", style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(20.dp))
        } else {
            LazyColumn(Modifier.heightIn(max = 460.dp)) {
                items(liste, key = { it.id }) { t ->
                    val deja = t.id in presents
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable(enabled = !deja && enCours == null, role = Role.Button) {
                                enCours = t.id
                                portee.launch {
                                    runCatching { c.bibliotheque.ajouter(playlist.id, listOf(t.id)) }
                                        .onSuccess { presents += t.id }
                                        .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                                    enCours = null
                                }
                            }
                            .padding(horizontal = 20.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Pochette(t.coverUrl, Modifier.size(44.dp), RoundedCornerShape(8.dp))
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(t.title, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            NomArtiste(t.artist?.stageName, t.artist?.verified == true)
                        }
                        when {
                            enCours == t.id -> Egaliseur(hauteur = 12.dp)
                            deja -> Text("Déjà présent", style = Texte.secondaire, color = p.encreAttenuee.compose)
                            else -> Icone(R.drawable.lucide_plus, description = "Ajouter", teinte = p.accent.compose, taille = 20.dp)
                        }
                    }
                }
            }
        }
    }
}
