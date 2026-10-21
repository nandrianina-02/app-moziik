package com.moziik.app.ui.messages

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import coil.compose.AsyncImage
import com.moziik.app.BuildConfig
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.Cible
import com.moziik.app.donnees.catalogue.cibleDe
import com.moziik.app.donnees.messagerie.Conversation
import com.moziik.app.donnees.messagerie.LectureMembre
import com.moziik.app.donnees.messagerie.MessageFil
import com.moziik.app.donnees.messagerie.Partage
import com.moziik.app.donnees.reseau.adresseMedia
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Avatar
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.MessageErreur
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.heure
import com.moziik.app.ui.composants.instantIso
import com.moziik.app.ui.composants.presence
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.menus.Feuille
import com.moziik.app.ui.navigation
import com.moziik.app.ui.ouvrirLien
import com.moziik.app.ui.rememberLancement
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch

/** Le fil se relit toutes les 4 secondes, en ne demandant que ce qui a changé (H6). */
private const val RAFRAICHISSEMENT_FIL_MS = 4_000L
/** « Écrit… » est signalé au plus toutes les 3 secondes pendant la frappe (H8). */
private const val SIGNAL_SAISIE_MS = 3_000L

/** Les messages connus, du plus ancien au plus récent ; un message revenu modifié remplace le précédent. */
private fun fusionner(actuels: List<MessageFil>, nouveaux: List<MessageFil>): List<MessageFil> {
    val parId = LinkedHashMap<String, MessageFil>()
    (actuels + nouveaux).forEach { parId[it.id] = it }
    return parId.values.sortedBy { instantIso(it.createdAt)?.time ?: 0L }
}

/** Le plus récent instant connu du fil, création ou modification : point de départ du rafraîchissement. */
private fun dernierInstant(messages: List<MessageFil>): String? =
    messages.flatMap { listOfNotNull(it.createdAt, it.modifieLe) }.maxByOrNull { instantIso(it)?.time ?: 0L }

/**
 * Un fil de discussion (FilDiscussion.tsx) : bulles, citations, cartes de
 * partage, accusés de lecture, « Écrit… ». Appui long sur un message :
 * répondre, copier, et pour les siens modifier ou supprimer.
 */
@Composable
fun EcranConversation(id: String, onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val portee = rememberCoroutineScope()
    val session by c.session.etat.collectAsStateWithLifecycle()
    val moi = (session as? EtatSession.Connecte)?.utilisateur?.id
    val cycle = LocalLifecycleOwner.current

    var conversation by remember { mutableStateOf<Conversation?>(null) }
    var messages by remember { mutableStateOf<List<MessageFil>>(emptyList()) }
    var lecteurs by remember { mutableStateOf<List<LectureMembre>>(emptyList()) }
    var ecrivent by remember { mutableStateOf<List<String>>(emptyList()) }
    var encore by remember { mutableStateOf(false) }
    var chargementAnciens by remember { mutableStateOf(false) }
    var erreur by remember { mutableStateOf<String?>(null) }
    var pret by remember { mutableStateOf(false) }

    var texte by rememberSaveable { mutableStateOf("") }
    var reponseA by remember { mutableStateOf<MessageFil?>(null) }
    var enModification by remember { mutableStateOf<MessageFil?>(null) }
    var envoi by remember { mutableStateOf(false) }
    var dernierSignal by remember { mutableLongStateOf(0L) }
    var menu by remember { mutableStateOf<MessageFil?>(null) }

    // Premier chargement, puis rafraîchissement tant que le fil est à l'écran.
    LaunchedEffect(id) {
        try {
            conversation = c.messagerie.conversation(id)
            val page = c.messagerie.messages(id)
            messages = fusionner(emptyList(), page.messages)
            lecteurs = page.lecteurs
            encore = page.encore
            pret = true
            c.messagerie.marquerLu(id)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            erreur = messageErreur(e)
        }
    }
    LaunchedEffect(id, pret) {
        if (!pret) return@LaunchedEffect
        cycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                delay(RAFRAICHISSEMENT_FIL_MS)
                try {
                    val page = c.messagerie.messages(id, depuis = dernierInstant(messages))
                    val recus = page.messages.any { m -> messages.none { it.id == m.id } && m.auteur?.id != moi }
                    messages = fusionner(messages, page.messages)
                    lecteurs = page.lecteurs
                    ecrivent = page.saisie.filter { it.id != moi }.map { it.name }
                    if (recus) c.messagerie.marquerLu(id)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    // Une coupure passagère : le prochain passage rattrapera.
                }
            }
        }
    }

    // La liste est inversée : le plus récent en bas, et le haut atteint charge les messages plus anciens.
    val liste = rememberLazyListState()
    LaunchedEffect(liste) {
        snapshotFlow { liste.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0 }
            .distinctUntilChanged()
            .filter { it >= liste.layoutInfo.totalItemsCount - 3 }
            .collect {
                if (!encore || chargementAnciens || messages.isEmpty()) return@collect
                chargementAnciens = true
                runCatching { c.messagerie.messages(id, avant = messages.first().createdAt) }.onSuccess { page ->
                    messages = fusionner(messages, page.messages)
                    encore = page.encore
                }
                chargementAnciens = false
            }
    }

    val envoyer: () -> Unit = {
        val corps = texte.trim()
        val modifie = enModification
        if (corps.isNotEmpty() && !envoi) {
            envoi = true
            portee.launch {
                try {
                    val message = if (modifie != null) c.messagerie.modifier(modifie.id, corps) else c.messagerie.envoyer(id, corps, repondA = reponseA?.id)
                    messages = fusionner(messages, listOf(message))
                    texte = ""
                    reponseA = null
                    enModification = null
                    liste.animateScrollToItem(0)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    c.alertes.signaler(AlerteLecture.Message(messageErreur(e)))
                }
                envoi = false
            }
        }
    }

    // Plein écran : la coquille masque sa barre et le mini-lecteur ici ; le clavier pousse le composeur.
    Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars).windowInsetsPadding(WindowInsets.ime.union(WindowInsets.navigationBars))) {
        EnTeteConversation(conversation, ecrivent, onRetour)
        HorizontalDivider(color = p.bordure.compose)
        Box(Modifier.weight(1f)) {
            when {
                erreur != null && !pret -> MessageErreur(erreur, Modifier.padding(16.dp))
                !pret -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 20.dp) }
                messages.isEmpty() -> Text(
                    "Aucun message. Écris le premier.", style = Texte.corps, color = p.encreAttenuee.compose,
                    modifier = Modifier.align(Alignment.Center),
                )
                else -> {
                    val groupe = conversation?.type == "group"
                    val inverses = messages.asReversed()
                    // Le dernier de mes messages lu par au moins un autre participant porte « Lu ».
                    val dernierMien = messages.lastOrNull { it.auteur?.id == moi && !it.supprime }
                    val lu = dernierMien != null && lecteurs.any { l ->
                        l.user != moi && (instantIso(l.luJusqua)?.time ?: 0L) >= (instantIso(dernierMien.createdAt)?.time ?: Long.MAX_VALUE)
                    }
                    LazyColumn(Modifier.fillMaxSize(), state = liste, reverseLayout = true, contentPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp)) {
                        items(inverses, key = { it.id }) { m ->
                            val i = messages.indexOf(m)
                            val precedent = messages.getOrNull(i - 1)
                            val aMoi = m.auteur?.id == moi
                            Bulle(
                                message = m,
                                aMoi = aMoi,
                                afficherAuteur = groupe && !aMoi && precedent?.auteur?.id != m.auteur?.id,
                                statut = if (m.id == dernierMien?.id) (if (lu) "Lu" else "Envoyé") else null,
                                onAppuiLong = { if (!m.supprime) menu = m },
                            )
                        }
                        if (chargementAnciens) item(key = "anciens") { Box(Modifier.fillMaxWidth().padding(8.dp), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 14.dp) } }
                    }
                }
            }
        }
        Composeur(
            texte = texte,
            onTexte = { nouveau ->
                texte = nouveau.take(4000)
                val maintenant = System.currentTimeMillis()
                if (nouveau.isNotBlank() && maintenant - dernierSignal > SIGNAL_SAISIE_MS) {
                    dernierSignal = maintenant
                    portee.launch { c.messagerie.signalerSaisie(id) }
                }
            },
            reponseA = reponseA,
            enModification = enModification != null,
            envoi = envoi,
            onAnnuler = {
                if (enModification != null) texte = ""
                reponseA = null
                enModification = null
            },
            onEnvoyer = envoyer,
        )
    }

    menu?.let { m ->
        val presse = LocalClipboardManager.current
        val aMoi = m.auteur?.id == moi
        Feuille({ menu = null }) {
            LigneAction(R.drawable.lucide_reply, "Répondre") {
                reponseA = m
                enModification = null
                menu = null
            }
            if (m.corps.isNotBlank()) {
                LigneAction(R.drawable.lucide_copy, "Copier le texte") {
                    presse.setText(AnnotatedString(m.corps))
                    c.alertes.signaler(AlerteLecture.Message("Texte copié.", succes = true))
                    menu = null
                }
            }
            if (aMoi && m.corps.isNotBlank()) {
                LigneAction(R.drawable.lucide_pencil, "Modifier") {
                    enModification = m
                    reponseA = null
                    texte = m.corps
                    menu = null
                }
            }
            if (aMoi) {
                LigneAction(R.drawable.lucide_trash_2, "Supprimer") {
                    menu = null
                    portee.launch {
                        runCatching { c.messagerie.supprimer(m.id) }
                            .onSuccess { messages = fusionner(messages, listOf(it)) }
                            .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                    }
                }
            }
        }
    }
}

@Composable
private fun LigneAction(icone: Int, libelle: String, onClick: () -> Unit) {
    val p = LocalPalette.current
    Row(Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onClick).padding(horizontal = 20.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
        Icone(icone, description = null, teinte = p.encreAttenuee.compose, taille = 20.dp)
        Spacer(Modifier.width(16.dp))
        Text(libelle, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose)
    }
}

@Composable
private fun EnTeteConversation(conversation: Conversation?, ecrivent: List<String>, onRetour: () -> Unit) {
    val p = LocalPalette.current
    val titre = conversation?.let(::titreDe).orEmpty()
    val ligne = when {
        ecrivent.isNotEmpty() -> if (conversation?.type == "group") "${ecrivent.first()} écrit…" else "Écrit…"
        conversation?.type == "group" -> "${conversation.participants.size} membres"
        else -> presence(conversation?.interlocuteur?.vuLe)
    }
    Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(44.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onRetour), contentAlignment = Alignment.Center) {
            Icone(R.drawable.lucide_arrow_left, description = "Retour", teinte = p.encreAttenuee.compose, taille = 20.dp)
        }
        if (conversation != null) {
            Avatar(titre, conversation.interlocuteur?.avatarUrl ?: conversation.imageUrl, taille = 38.dp)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(titre, style = Texte.corpsFort, color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                ligne?.let { Text(it, style = Texte.secondaire, color = if (ecrivent.isNotEmpty() || it == "En ligne") p.accent.compose else p.encreAttenuee.compose) }
            }
        }
    }
}

/** Une bulle (BulleMessage.tsx) : les siennes à droite sur l'accent, les autres à gauche sur la surface. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Bulle(message: MessageFil, aMoi: Boolean, afficherAuteur: Boolean, statut: String?, onAppuiLong: () -> Unit) {
    val p = LocalPalette.current
    val encre = if (aMoi) Color.White else p.encre.compose
    val attenuee = if (aMoi) Color.White.copy(alpha = 0.7f) else p.encreAttenuee.compose
    val forme = if (aMoi) RoundedCornerShape(18.dp, 18.dp, 6.dp, 18.dp) else RoundedCornerShape(18.dp, 18.dp, 18.dp, 6.dp)
    Column(
        Modifier.fillMaxWidth().padding(top = if (afficherAuteur) 10.dp else 3.dp),
        horizontalAlignment = if (aMoi) Alignment.End else Alignment.Start,
    ) {
        if (afficherAuteur) {
            Text(message.auteur?.name.orEmpty(), style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.encreAttenuee.compose, modifier = Modifier.padding(start = 6.dp, bottom = 2.dp))
        }
        Column(
            Modifier
                .widthIn(max = 300.dp)
                .clip(forme)
                .background(if (aMoi) p.accent.compose else p.surface.compose)
                .then(if (aMoi) Modifier else Modifier.border(BorderStroke(1.dp, p.bordure.compose), forme))
                .combinedClickable(onLongClick = onAppuiLong, onLongClickLabel = "Options du message", onClick = {})
                .padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            if (message.supprime) {
                Text("Message supprimé", style = Texte.corps.copy(fontStyle = FontStyle.Italic), color = attenuee)
            } else {
                message.citation?.let { cit ->
                    Column(
                        Modifier
                            .padding(bottom = 6.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (aMoi) Color.White.copy(alpha = 0.15f) else p.base.compose)
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                    ) {
                        Text(cit.auteurNom, style = Texte.secondaire.copy(fontWeight = FontWeight.SemiBold, fontSize = 11.sp), color = if (aMoi) Color.White else p.accent.compose)
                        Text(cit.extrait, style = Texte.secondaire, color = attenuee, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                }
                message.partage?.let { CartePartage(it, aMoi) }
                message.pieces.forEach { piece -> PieceJointe(piece.type, piece.url, piece.nom, aMoi) }
                if (message.corps.isNotBlank()) Text(message.corps, style = Texte.corps, color = encre)
            }
            Row(Modifier.align(Alignment.End).padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                if (message.modifieLe != null && !message.supprime) Text("Modifié · ", style = Texte.secondaire.copy(fontSize = 10.sp), color = attenuee)
                Text(heure(message.createdAt), style = Texte.secondaire.copy(fontSize = 10.sp), color = attenuee)
                if (statut != null) {
                    Spacer(Modifier.width(4.dp))
                    Icone(if (statut == "Lu") R.drawable.lucide_check_check else R.drawable.lucide_check, description = statut, teinte = attenuee, taille = 12.dp)
                }
            }
        }
        // Les réactions sont des données des membres, affichées telles quelles.
        if (message.reactions.isNotEmpty()) {
            Row(Modifier.padding(top = 2.dp, start = 6.dp, end = 6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                message.reactions.forEach { r ->
                    Text(
                        "${r.emoji} ${r.users.size}",
                        style = Texte.secondaire.copy(fontSize = 11.sp),
                        color = p.encreAttenuee.compose,
                        modifier = Modifier.clip(CircleShape).border(BorderStroke(1.dp, p.bordure.compose), CircleShape).background(p.surface.compose).padding(horizontal = 6.dp, vertical = 1.dp),
                    )
                }
            }
        }
    }
}

/** Les libellés d'action des cartes, ceux du site (ACTIONS_PARTAGE). */
private val ACTIONS = mapOf(
    "song" to "Écouter", "album" to "Ouvrir l'album", "podcast" to "Écouter l'épisode", "playlist" to "Ouvrir la playlist",
    "artist" to "Voir l'artiste", "event" to "Voir l'évènement", "radio" to "Lancer la radio",
)

/** Une carte de partage : un titre ou une radio se lancent ; les autres ouvrent leur écran. */
@Composable
private fun CartePartage(partage: Partage, aMoi: Boolean) {
    val p = LocalPalette.current
    val nav = navigation()
    val lancement = rememberLancement()
    val ouvrir: () -> Unit = {
        when (partage.type) {
            "song" -> lancement.cible("partage-${partage.refId}", Cible.DeTitre(partage.refId))
            else -> nav.suivre(cibleDe(partage.chemin, BuildConfig.SITE))
        }
    }
    Row(
        Modifier
            .padding(bottom = 6.dp)
            .widthIn(min = 220.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (aMoi) Color.White.copy(alpha = 0.15f) else p.base.compose)
            .clickable(role = Role.Button, onClick = ouvrir)
            .padding(8.dp)
            .semantics { contentDescription = "${ACTIONS[partage.type] ?: "Ouvrir"} : ${partage.titre}" },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Pochette(partage.imageUrl, Modifier.size(48.dp), RoundedCornerShape(8.dp))
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f, fill = false)) {
            Text(partage.titre, style = Texte.corps.copy(fontWeight = FontWeight.SemiBold), color = if (aMoi) Color.White else p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
            partage.sousTitre?.let { Text(it, style = Texte.secondaire, color = if (aMoi) Color.White.copy(alpha = 0.75f) else p.encreAttenuee.compose, maxLines = 1, overflow = TextOverflow.Ellipsis) }
            Text(
                if (lancement.enCours == "partage-${partage.refId}") "Chargement…" else ACTIONS[partage.type] ?: "Ouvrir",
                style = Texte.secondaire.copy(fontWeight = FontWeight.Medium, fontSize = 11.sp),
                color = if (aMoi) Color.White else p.accent.compose,
            )
        }
    }
}

/** Une image s'affiche dans la bulle ; un son s'ouvre à part, l'envoi de pièces viendra avec le composeur complet. */
@Composable
private fun PieceJointe(type: String, url: String, nom: String, aMoi: Boolean) {
    val p = LocalPalette.current
    val contexte = LocalContext.current
    val adresse = adresseMedia(url, BuildConfig.SITE) ?: url
    if (type == "image") {
        AsyncImage(
            model = adresse, contentDescription = nom.ifBlank { "Image" }, contentScale = ContentScale.Crop,
            modifier = Modifier.padding(bottom = 6.dp).widthIn(max = 260.dp).heightIn(max = 260.dp).clip(RoundedCornerShape(10.dp)),
        )
    } else {
        Row(
            Modifier
                .padding(bottom = 6.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(if (aMoi) Color.White.copy(alpha = 0.15f) else p.base.compose)
                .clickable(role = Role.Button) { ouvrirLien(contexte, adresse, p.base.enArgb().toInt()) }
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icone(R.drawable.lucide_headphones, description = null, teinte = if (aMoi) Color.White else p.accent.compose, taille = 16.dp)
            Spacer(Modifier.width(8.dp))
            Text(nom.ifBlank { "Message audio" }, style = Texte.secondaire, color = if (aMoi) Color.White else p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

/** Le composeur : texte, réponse citée ou modification en cours, envoi. */
@Composable
private fun Composeur(
    texte: String,
    onTexte: (String) -> Unit,
    reponseA: MessageFil?,
    enModification: Boolean,
    envoi: Boolean,
    onAnnuler: () -> Unit,
    onEnvoyer: () -> Unit,
) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxWidth().background(p.surface.compose)) {
        HorizontalDivider(color = p.bordure.compose)
        if (reponseA != null || enModification) {
            Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.width(3.dp).heightIn(min = 30.dp).background(p.accent.compose))
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        if (enModification) "Modification du message" else "Réponse à ${reponseA?.auteur?.name.orEmpty()}",
                        style = Texte.secondaire.copy(fontWeight = FontWeight.SemiBold), color = p.accent.compose,
                    )
                    reponseA?.let { Text(it.corps.ifBlank { it.partage?.titre.orEmpty() }, style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                }
                Box(Modifier.size(36.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onAnnuler), contentAlignment = Alignment.Center) {
                    Icone(R.drawable.lucide_x, description = "Annuler", teinte = p.encreAttenuee.compose, taille = 16.dp)
                }
            }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.Bottom) {
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(22.dp))
                    .background(p.base.compose)
                    .border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(22.dp))
                    .padding(horizontal = 16.dp, vertical = 11.dp),
            ) {
                if (texte.isEmpty()) Text("Écrire un message…", style = Texte.corps, color = p.encreAttenuee.compose)
                BasicTextField(
                    value = texte,
                    onValueChange = onTexte,
                    textStyle = Texte.corps.copy(color = p.encre.compose),
                    cursorBrush = SolidColor(p.accent.compose),
                    maxLines = 5,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Message" },
                )
            }
            Spacer(Modifier.width(8.dp))
            val actif = texte.isNotBlank() && !envoi
            Box(
                Modifier.size(44.dp).clip(CircleShape).background(p.accent.compose.copy(alpha = if (actif) 1f else 0.4f)).clickable(enabled = actif, role = Role.Button, onClick = onEnvoyer),
                contentAlignment = Alignment.Center,
            ) {
                if (envoi) Egaliseur(hauteur = 14.dp, libelle = "Envoi", couleur = p.base.compose)
                else Icone(if (enModification) R.drawable.lucide_check else R.drawable.lucide_send_horizontal, description = if (enModification) "Enregistrer" else "Envoyer", teinte = p.base.compose, taille = 18.dp)
            }
        }
    }
}
