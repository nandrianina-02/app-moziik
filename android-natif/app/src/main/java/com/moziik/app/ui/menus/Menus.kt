package com.moziik.app.ui.menus

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.PlaylistMienne
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.messagerie.PartageEnvoye
import com.moziik.app.ui.messages.ChoixDestinataire
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.donnees.session.appel
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.ChampTexte
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LienTexte
import com.moziik.app.ui.composants.MessageErreur
import com.moziik.app.ui.composants.NomArtiste
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.navigation
import com.moziik.app.ui.partager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** Une action propre à l'écran d'où le menu s'ouvre (« Retirer de la playlist »). */
data class ActionMenu(val libelle: String, val icone: Int, val action: () -> Unit)

/**
 * Les menus et fenêtres partagés par tous les écrans : le menu d'un titre
 * (appui long, comme le menu contextuel du site, F13), l'ajout à une
 * playlist et la création d'une playlist. `version` augmente à chaque
 * changement de la bibliothèque, pour que les écrans qui l'affichent se
 * rechargent.
 */
class Menus {
    var titre by mutableStateOf<Titre?>(null)
        private set
    var source by mutableStateOf<String?>(null)
        private set
    var extras by mutableStateOf<List<ActionMenu>>(emptyList())
        private set
    var ajout by mutableStateOf<List<Titre>?>(null)
        private set
    var creation by mutableStateOf<List<Titre>?>(null)
        private set
    var version by mutableIntStateOf(0)
        private set
    var envoi by mutableStateOf<PartageEnvoye?>(null)
        private set

    /** « Envoyer dans un message » (H10). */
    fun envoyerDansUnMessage(partage: PartageEnvoye) {
        envoi = partage
    }

    fun fermerEnvoi() {
        envoi = null
    }

    fun titre(titre: Titre, source: String? = null, extras: List<ActionMenu> = emptyList()) {
        this.source = source
        this.extras = extras
        this.titre = titre
    }

    fun fermerTitre() {
        titre = null
    }

    fun ajouterAPlaylist(titres: List<Titre>) {
        ajout = titres
    }

    fun fermerAjout() {
        ajout = null
    }

    fun nouvellePlaylist(titres: List<Titre> = emptyList()) {
        creation = titres
    }

    fun fermerCreation() {
        creation = null
    }

    fun bibliothequeChangee() {
        version++
    }
}

val LocalMenus = staticCompositionLocalOf<Menus> { error("Menus absents : l'écran doit être dans la coquille.") }

/** Les fenêtres ouvertes par les écrans, posées une fois dans la coquille. */
@Composable
fun HoteMenus(menus: Menus) {
    menus.titre?.let { MenuTitre(it, menus) }
    menus.ajout?.let { AjoutPlaylist(it, menus) }
    menus.envoi?.let { partage ->
        val c = conteneur()
        val nav = navigation()
        var conversations by remember { mutableStateOf<List<com.moziik.app.donnees.messagerie.Conversation>?>(null) }
        LaunchedEffect(partage) { conversations = runCatching { c.messagerie.conversations() }.getOrNull() }
        ChoixDestinataire(
            titre = "Envoyer à…",
            partage = partage,
            conversations = conversations,
            onFermer = menus::fermerEnvoi,
            onConversation = { id ->
                menus.fermerEnvoi()
                nav.conversation(id)
            },
        )
    }
    menus.creation?.let { titres ->
        val c = conteneur()
        DialoguePlaylist(
            entete = "Nouvelle playlist",
            action = "Créer",
            onFermer = menus::fermerCreation,
            onValider = { titre, description, publique ->
                c.bibliotheque.creer(titre, description, publique, titres.map { it.id })
                c.alertes.signaler(AlerteLecture.Message(if (titres.isEmpty()) "Playlist créée." else "Playlist créée avec « ${titres.first().title} ».", succes = true))
                menus.bibliothequeChangee()
                menus.fermerCreation()
            },
        )
    }
}

/** Les feuilles du bas de l'app : surface du thème, poignée discrète, coins du rayon du thème. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Feuille(onFermer: () -> Unit, contenu: @Composable () -> Unit) {
    val p = LocalPalette.current
    ModalBottomSheet(
        onDismissRequest = onFermer,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = p.surface.compose,
        contentColor = p.encre.compose,
        shape = RoundedCornerShape(topStart = (p.rayon + 8).dp, topEnd = (p.rayon + 8).dp),
        dragHandle = {
            Box(Modifier.padding(vertical = 10.dp).size(width = 40.dp, height = 4.dp).clip(CircleShape).background(p.bordure.compose))
        },
    ) {
        Column(Modifier.windowInsetsPadding(WindowInsets.navigationBars).padding(bottom = 12.dp)) { contenu() }
    }
}

@Composable
private fun LigneMenu(icone: Int, libelle: String, actif: Boolean = false, onClick: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icone(icone, description = null, teinte = if (actif) p.accent.compose else p.encreAttenuee.compose, taille = 20.dp)
        Spacer(Modifier.width(16.dp))
        Text(libelle, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose)
    }
}

/** Le menu d'un titre, dans l'ordre du site (F13), avec l'état J'aime réel relu à l'ouverture. */
@Composable
private fun MenuTitre(titre: Titre, menus: Menus) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val contexte = LocalContext.current
    val portee = rememberCoroutineScope()
    val connecte = c.session.etat.value is EtatSession.Connecte
    var aime by remember(titre.id) { mutableStateOf<Boolean?>(null) }
    LaunchedEffect(titre.id) {
        aime = if (connecte) appel { c.reseau.api.aime(titre.id).liked }.getOrNull() else false
    }
    val fermer = menus::fermerTitre
    val exiger: (String, () -> Unit) -> Unit = { raison, action ->
        if (connecte) action() else c.alertes.signaler(AlerteLecture.Message(raison))
    }

    Feuille(fermer) {
        Row(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Pochette(titre.coverUrl, Modifier.size(48.dp), RoundedCornerShape(8.dp))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(titre.title, style = Texte.corpsFort, color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                NomArtiste(titre.artist?.stageName, titre.artist?.verified == true)
            }
        }
        HorizontalDivider(color = p.bordure.compose)
        Column(Modifier.heightIn(max = 520.dp).verticalScroll(rememberScrollState())) {
            val enCours = c.lecteur.etat.value.courant
            if (enCours != null && enCours.id != titre.id) {
                LigneMenu(R.drawable.lucide_list_start, "Écouter ensuite") {
                    c.lecteur.lireEnsuite(titre, menus.source)
                    c.alertes.signaler(AlerteLecture.Message("Sera lu juste après le morceau en cours.", succes = true))
                    fermer()
                }
            }
            LigneMenu(R.drawable.lucide_list_plus, "Ajouter à la file d'attente") {
                c.lecteur.ajouterALaFile(listOf(titre), menus.source)
                c.alertes.signaler(AlerteLecture.Message("Ajouté à la file d'attente.", succes = true))
                fermer()
            }
            LigneMenu(R.drawable.lucide_plus, "Ajouter à une playlist") {
                exiger("Connecte-toi pour créer tes playlists.") {
                    fermer()
                    menus.ajouterAPlaylist(listOf(titre))
                }
            }
            LigneMenu(if (aime == true) R.drawable.lucide_heart_plein else R.drawable.lucide_heart, if (aime == true) "Ne plus aimer" else "J'aime", actif = aime == true) {
                exiger("Connecte-toi pour aimer un son.") {
                    fermer()
                    portee.launch {
                        appel { c.reseau.api.basculerAime(titre.id) }
                            .onSuccess {
                                c.alertes.signaler(AlerteLecture.Message(if (it.liked) "Ajouté à tes favoris." else "Retiré de tes favoris.", succes = true))
                                menus.bibliothequeChangee()
                            }
                            .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                    }
                }
            }
            LigneMenu(R.drawable.lucide_message_circle, "Envoyer dans un message") {
                exiger("Connecte-toi pour écrire aux autres membres.") {
                    fermer()
                    menus.envoyerDansUnMessage(PartageEnvoye("song", titre.id))
                }
            }
            LigneMenu(R.drawable.lucide_share_2, "Partager") {
                partager(contexte, "son/${titre.id}", titre.title)
                c.portee.launch { appel { c.reseau.api.partage(titre.id) } }
                fermer()
            }
            LigneMenu(R.drawable.lucide_music_2, "Voir le titre") {
                fermer()
                nav.titre(titre.id)
            }
            titre.artist?.id?.let { artiste ->
                LigneMenu(R.drawable.lucide_mic_vocal, "Aller à l'artiste") {
                    fermer()
                    nav.artiste(artiste)
                }
            }
            titre.album?.id?.let { album ->
                LigneMenu(R.drawable.lucide_disc_3, "Aller à l'album") {
                    fermer()
                    nav.album(album)
                }
            }
            menus.extras.forEach { extra ->
                LigneMenu(extra.icone, extra.libelle) {
                    fermer()
                    extra.action()
                }
            }
        }
    }
}

/** « Ajouter à une playlist » : mes playlists, celles qui ont déjà le titre marquées, et la création d'une nouvelle. */
@Composable
private fun AjoutPlaylist(titres: List<Titre>, menus: Menus) {
    val c = conteneur()
    val p = LocalPalette.current
    val portee = rememberCoroutineScope()
    var playlists by remember { mutableStateOf<List<PlaylistMienne>?>(null) }
    var erreur by remember { mutableStateOf<String?>(null) }
    var enCours by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        try {
            playlists = c.bibliotheque.mesPlaylists()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            erreur = messageErreur(e)
        }
    }
    val ids = titres.map { it.id }

    Feuille(menus::fermerAjout) {
        Text(
            if (titres.size == 1) "Ajouter « ${titres.first().title} »" else "Ajouter ${titres.size} titres",
            style = Texte.titreSection, color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 8.dp),
        )
        LigneMenu(R.drawable.lucide_plus, "Nouvelle playlist") {
            menus.fermerAjout()
            menus.nouvellePlaylist(titres)
        }
        HorizontalDivider(color = p.bordure.compose)
        MessageErreur(erreur, Modifier.padding(16.dp))
        val liste = playlists
        when {
            liste == null && erreur == null -> Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 18.dp) }
            liste != null && liste.isEmpty() -> Text(
                "Tu n'as pas encore de playlist.", style = Texte.corps, color = p.encreAttenuee.compose,
                modifier = Modifier.padding(20.dp),
            )
            liste != null -> LazyColumn(Modifier.heightIn(max = 420.dp)) {
                items(liste, key = { it.id }) { pl ->
                    val deja = ids.all { it in pl.songs }
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable(enabled = !deja && enCours == null, role = Role.Button) {
                                enCours = pl.id
                                portee.launch {
                                    runCatching { c.bibliotheque.ajouter(pl.id, ids) }
                                        .onSuccess {
                                            c.alertes.signaler(AlerteLecture.Message("Ajouté à « ${pl.title} ».", succes = true))
                                            menus.bibliothequeChangee()
                                            menus.fermerAjout()
                                        }
                                        .onFailure { erreur = messageErreur(it) }
                                    enCours = null
                                }
                            }
                            .padding(horizontal = 20.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Pochette(pl.coverUrl, Modifier.size(44.dp), RoundedCornerShape(8.dp))
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(pl.title, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(
                                "${pl.songs.size} titre${if (pl.songs.size > 1) "s" else ""} · ${if (pl.isPublic) "Publique" else "Privée"}",
                                style = Texte.secondaire, color = p.encreAttenuee.compose,
                            )
                        }
                        when {
                            enCours == pl.id -> Egaliseur(hauteur = 12.dp)
                            deja -> Text("Déjà présent", style = Texte.secondaire, color = p.encreAttenuee.compose)
                        }
                    }
                }
            }
        }
    }
}

/** L'interrupteur Publique / Privée, aux couleurs du thème. */
@Composable
fun Interrupteur(actif: Boolean, libelle: String, onChange: (Boolean) -> Unit) {
    val p = LocalPalette.current
    val decalage by animateDpAsState(if (actif) 20.dp else 2.dp, tween(150), label = "interrupteur")
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable(role = Role.Switch) { onChange(!actif) }
            .semantics {
                contentDescription = libelle
                stateDescription = if (actif) "Activé" else "Désactivé"
            }
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(libelle, style = Texte.corps, color = p.encre.compose, modifier = Modifier.weight(1f))
        Box(Modifier.size(width = 42.dp, height = 24.dp).clip(CircleShape).background(if (actif) p.accent.compose else p.bordure.compose)) {
            Box(Modifier.offset(x = decalage, y = 2.dp).size(20.dp).clip(CircleShape).background(p.base.compose))
        }
    }
}

/** Création ou modification d'une playlist : titre obligatoire, description, visibilité (privée par défaut, F6). */
@Composable
fun DialoguePlaylist(
    entete: String,
    action: String,
    onFermer: () -> Unit,
    onValider: suspend (titre: String, description: String, publique: Boolean) -> Unit,
    titreInitial: String = "",
    descriptionInitiale: String = "",
    publiqueInitiale: Boolean = false,
) {
    val p = LocalPalette.current
    val portee = rememberCoroutineScope()
    var titre by rememberSaveable { mutableStateOf(titreInitial) }
    var description by rememberSaveable { mutableStateOf(descriptionInitiale) }
    var publique by rememberSaveable { mutableStateOf(publiqueInitiale) }
    var enCours by remember { mutableStateOf(false) }
    var erreur by remember { mutableStateOf<String?>(null) }
    val valider: () -> Unit = {
        if (titre.isBlank()) {
            erreur = "Le titre est requis."
        } else if (!enCours) {
            enCours = true
            erreur = null
            portee.launch {
                try {
                    onValider(titre, description, publique)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    erreur = messageErreur(e)
                }
                enCours = false
            }
        }
    }
    Dialog(onDismissRequest = onFermer) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(p.rayon.dp))
                .background(p.surface.compose)
                .padding(20.dp),
        ) {
            Text(entete, style = Texte.titreSection, color = p.encre.compose)
            Spacer(Modifier.height(16.dp))
            ChampTexte(titre, { titre = it.take(150) }, "Titre", R.drawable.lucide_list_music, indication = "Ma playlist")
            Spacer(Modifier.height(12.dp))
            ChampTexte(description, { description = it.take(1000) }, "Description", R.drawable.lucide_pencil, indication = "Facultative")
            Spacer(Modifier.height(8.dp))
            Interrupteur(publique, "Visible par tout le monde") { publique = it }
            Text(
                if (publique) "Tout le monde peut la trouver et l'écouter." else "Toi seul la vois.",
                style = Texte.secondaire, color = p.encreAttenuee.compose,
            )
            MessageErreur(erreur, Modifier.padding(top = 12.dp))
            Spacer(Modifier.height(20.dp))
            BoutonPrincipal(action, valider, enCours = enCours)
            Box(Modifier.fillMaxWidth().padding(top = 10.dp), contentAlignment = Alignment.Center) { LienTexte("Annuler", onFermer) }
        }
    }
}

/** Une confirmation avant une action définitive (supprimer une playlist, F10). */
@Composable
fun Confirmation(titre: String, texte: String, action: String, onConfirmer: () -> Unit, onFermer: () -> Unit) {
    val p = LocalPalette.current
    Dialog(onDismissRequest = onFermer) {
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(p.rayon.dp)).background(p.surface.compose).padding(20.dp),
        ) {
            Text(titre, style = Texte.titreSection, color = p.encre.compose)
            Spacer(Modifier.height(8.dp))
            Text(texte, style = Texte.corps, color = p.encreAttenuee.compose)
            Spacer(Modifier.height(20.dp))
            Box(
                Modifier.fillMaxWidth().height(46.dp).clip(RoundedCornerShape(p.rayon.dp)).background(p.danger.compose).clickable(role = Role.Button, onClick = onConfirmer),
                contentAlignment = Alignment.Center,
            ) {
                Text(action, style = Texte.corpsFort, color = p.base.compose)
            }
            Box(Modifier.fillMaxWidth().padding(top = 10.dp), contentAlignment = Alignment.Center) { LienTexte("Annuler", onFermer) }
        }
    }
}
