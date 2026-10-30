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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
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
import com.moziik.app.ui.composants.LogoMoziik
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.foundation.layout.aspectRatio
import com.moziik.app.donnees.envoi.preparerImage
import com.moziik.app.donnees.messagerie.Piece

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
 * Les six réactions rapides du site (REACTIONS_RAPIDES de lib/messagerie.ts).
 * La donnée échangée reste l'emoji du site, pour que web et app se
 * comprennent ; l'app la montre en pictogramme, avec un libellé.
 */
private data class ReactionRapide(val emoji: String, val icone: Int, val libelle: String)

private val REACTIONS = listOf(
    ReactionRapide("\u2764\uFE0F", R.drawable.lucide_heart_plein, "J'adore"),
    ReactionRapide("\uD83D\uDD25", R.drawable.lucide_flame, "Ça chauffe"),
    ReactionRapide("\uD83D\uDC4F", R.drawable.lucide_thumbs_up, "Bravo"),
    ReactionRapide("\uD83D\uDE02", R.drawable.lucide_laugh, "Trop drôle"),
    ReactionRapide("\uD83D\uDE2E", R.drawable.lucide_sparkles, "Waouh"),
    ReactionRapide("\uD83D\uDE22", R.drawable.lucide_frown, "Triste"),
)

/** Le sélecteur de variation (U+FE0F) est parfois omis : « coeur » s'écrit avec ou sans. */
private fun reactionDe(emoji: String): ReactionRapide? = REACTIONS.firstOrNull { it.emoji.replace("\uFE0F", "") == emoji.replace("\uFE0F", "") }

/** Quatre pièces par message (H11). */
private const val PIECES_MAX = 4
/** Plus grand côté d'une photo envoyée : nette dans une bulle, légère à envoyer. */
private const val COTE_PHOTO = 1600

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
    var reglages by remember { mutableStateOf(false) }
    // Les photos choisies, envoyées au stockage seulement au moment d'envoyer le message (H11).
    val photos = remember { mutableStateListOf<Uri>() }
    var etapeEnvoi by remember { mutableStateOf<String?>(null) }
    val contexte = LocalContext.current
    val choixPhotos = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(PIECES_MAX)) { choisies ->
        photos.addAll(choisies.filter { it !in photos }.take(PIECES_MAX - photos.size))
    }

    // L'assistant d'écoute a son propre fil, créé au premier usage (H12) : on l'ouvre par l'identifiant « assistant ».
    val assistant = id == ASSISTANT
    var fil by remember { mutableStateOf(if (assistant) null else id) }
    var disponible by remember { mutableStateOf(true) }
    val nav = navigation()
    val lancement = rememberLancement()
    // La carte d'une réponse de l'assistant : un titre ou une radio se lancent, le reste s'ouvre.
    val lancerPartage: (Partage) -> Unit = { partage ->
        when (partage.type) {
            "song" -> lancement.cible("partage-${partage.refId}", Cible.DeTitre(partage.refId))
            "radio" -> nav.radio(partage.refId)
            else -> nav.suivre(cibleDe(partage.chemin, BuildConfig.SITE))
        }
    }

    // Premier chargement, puis rafraîchissement tant que le fil est à l'écran.
    LaunchedEffect(id) {
        try {
            if (assistant) {
                val f = c.ia.filAssistant()
                conversation = f.conversation
                disponible = f.disponible
                fil = f.conversation.id
            } else {
                conversation = c.messagerie.conversation(id)
            }
            val cible = fil ?: return@LaunchedEffect
            val page = c.messagerie.messages(cible)
            messages = fusionner(emptyList(), page.messages)
            lecteurs = page.lecteurs
            encore = page.encore
            pret = true
            c.messagerie.marquerLu(cible)
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
                    val page = c.messagerie.messages(fil ?: continue, depuis = dernierInstant(messages))
                    val recus = page.messages.any { m -> messages.none { it.id == m.id } && m.auteur?.id != moi }
                    messages = fusionner(messages, page.messages)
                    lecteurs = page.lecteurs
                    ecrivent = page.saisie.filter { it.id != moi }.map { it.name }
                    if (recus) c.messagerie.marquerLu(fil ?: continue)
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
                val cible = fil ?: return@collect
                runCatching { c.messagerie.messages(cible, avant = messages.first().createdAt) }.onSuccess { page ->
                    messages = fusionner(messages, page.messages)
                    encore = page.encore
                }
                chargementAnciens = false
            }
    }

    val envoyer: () -> Unit = {
        val corps = texte.trim()
        val modifie = enModification
        val aJoindre = if (modifie == null && !assistant) photos.toList() else emptyList()
        if ((corps.isNotEmpty() || aJoindre.isNotEmpty()) && !envoi) {
            envoi = true
            portee.launch {
                try {
                    if (assistant && modifie == null) {
                        texte = ""
                        val echange = c.ia.demanderAssistant(corps)
                        messages = fusionner(messages, listOf(echange.question, echange.reponse))
                        if (echange.lancer) echange.reponse.partage?.let(lancerPartage)
                    } else {
                        // Les pièces partent d'abord au stockage, réduites ; le message les cite ensuite (K2).
                        val pieces = aJoindre.mapIndexed { i, uri ->
                            etapeEnvoi = if (aJoindre.size > 1) "Envoi des photos (${i + 1}/${aJoindre.size})…" else "Envoi de la photo…"
                            val image = preparerImage(contexte, uri, COTE_PHOTO)
                            val adresse = c.envoi.envoyer(image.octets, "photo-${i + 1}.jpg", "image/jpeg", "messages")
                            Piece("image", adresse, "photo-${i + 1}.jpg", image.octets.size.toLong(), largeur = image.largeur, hauteur = image.hauteur)
                        }
                        etapeEnvoi = null
                        val message = if (modifie != null) c.messagerie.modifier(modifie.id, corps) else c.messagerie.envoyer(fil ?: id, corps, repondA = reponseA?.id, pieces = pieces)
                        messages = fusionner(messages, listOf(message))
                        photos.clear()
                    }
                    texte = ""
                    reponseA = null
                    enModification = null
                    liste.animateScrollToItem(0)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    etapeEnvoi = null
                    c.alertes.signaler(AlerteLecture.Message(messageErreur(e)))
                }
                envoi = false
            }
        }
    }

    // Plein écran : la coquille masque sa barre et le mini-lecteur ici ; le clavier pousse le composeur.
    Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.ime)) {
        EnTeteConversation(conversation, ecrivent, onRetour, assistant, onReglages = { reglages = true })
        if (assistant && !disponible) {
            Text(
                "L'assistant est indisponible pour le moment. Réessaie plus tard.",
                style = Texte.secondaire, color = p.alerte.compose,
                modifier = Modifier.fillMaxWidth().background(p.alerte.compose.copy(alpha = 0.1f)).padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }
        HorizontalDivider(color = p.bordure.compose)
        Box(Modifier.weight(1f)) {
            when {
                erreur != null && !pret -> MessageErreur(erreur, Modifier.padding(16.dp))
                !pret -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { LogoMoziik(hauteur = 30.dp, boucle = true) }
                messages.isEmpty() && !envoi -> Text(
                    if (assistant) "Demande-lui un titre, une ambiance, un artiste à découvrir : il cherche dans le catalogue de Moziik." else "Aucun message. Écris le premier.",
                    style = Texte.corps, color = p.encreAttenuee.compose, textAlign = TextAlign.Center,
                    modifier = Modifier.align(Alignment.Center).padding(32.dp),
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
                        if (assistant && envoi) {
                            item(key = "reflexion") {
                                Row(Modifier.padding(top = 10.dp, start = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Egaliseur(hauteur = 12.dp, libelle = "L'assistant réfléchit", couleur = p.info.compose)
                                    Spacer(Modifier.width(8.dp))
                                    Text("L'assistant réfléchit…", style = Texte.secondaire, color = p.encreAttenuee.compose)
                                }
                            }
                        }
                        items(inverses, key = { it.id }) { m ->
                          // Un message qui arrive glisse en place ; ceux d'avant remontent sans saut.
                          Box(Modifier.animateItem()) {
                            val i = messages.indexOf(m)
                            val precedent = messages.getOrNull(i - 1)
                            val aMoi = m.auteur?.id == moi
                            Bulle(
                                message = m,
                                aMoi = aMoi,
                                afficherAuteur = (groupe || m.role == "assistant") && !aMoi && precedent?.auteur?.id != m.auteur?.id,
                                statut = if (m.id == dernierMien?.id) (if (lu) "Lu" else "Envoyé") else null,
                                onAppuiLong = { if (!m.supprime) menu = m },
                            )
                          }
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
                if (!assistant && nouveau.isNotBlank() && maintenant - dernierSignal > SIGNAL_SAISIE_MS) {
                    dernierSignal = maintenant
                    portee.launch { c.messagerie.signalerSaisie(fil ?: id) }
                }
            },
            reponseA = reponseA,
            enModification = enModification != null,
            envoi = envoi,
            photos = photos,
            etapeEnvoi = etapeEnvoi,
            onJoindre = if (assistant || enModification != null) null else ({
                if (photos.size < PIECES_MAX) choixPhotos.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
            }),
            onRetirerPhoto = { photos.remove(it) },
            indication = if (assistant) "Demande à l'assistant…" else "Écrire un message…",
            actif = !assistant || disponible,
            onAnnuler = {
                if (enModification != null) texte = ""
                reponseA = null
                enModification = null
            },
            onEnvoyer = envoyer,
        )
    }

    val actuelle = conversation
    if (reglages && actuelle != null && !assistant) {
        ReglagesConversation(
            actuelle,
            moi,
            onChange = { conversation = it },
            onQuitte = {
                reglages = false
                onRetour()
            },
            onFermer = { reglages = false },
        )
    }

    menu?.let { m ->
        val presse = LocalClipboardManager.current
        val aMoi = m.auteur?.id == moi
        Feuille({ menu = null }) {
            if (!assistant) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    REACTIONS.forEach { r ->
                        val mienne = m.reactions.any { reactionDe(it.emoji) == r && moi in it.users }
                        Box(
                            Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(if (mienne) p.accent.compose.copy(alpha = 0.15f) else p.base.compose)
                                .clickable(role = Role.Button) {
                                    menu = null
                                    portee.launch {
                                        runCatching { c.messagerie.reagir(m.id, r.emoji) }
                                            .onSuccess { messages = fusionner(messages, listOf(it)) }
                                            .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                                    }
                                }
                                .semantics { contentDescription = if (mienne) "Retirer « ${r.libelle} »" else "Réagir : ${r.libelle}" },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icone(r.icone, description = null, teinte = if (mienne) p.accent.compose else p.encreAttenuee.compose, taille = 22.dp)
                        }
                    }
                }
                HorizontalDivider(color = p.bordure.compose)
                LigneAction(R.drawable.lucide_reply, "Répondre") {
                    reponseA = m
                    enModification = null
                    menu = null
                }
            }
            if (m.corps.isNotBlank()) {
                LigneAction(R.drawable.lucide_copy, "Copier le texte") {
                    presse.setText(AnnotatedString(m.corps))
                    c.alertes.signaler(AlerteLecture.Message("Texte copié.", succes = true))
                    menu = null
                }
            }
            if (aMoi && !assistant && m.corps.isNotBlank()) {
                LigneAction(R.drawable.lucide_pencil, "Modifier") {
                    enModification = m
                    reponseA = null
                    texte = m.corps
                    menu = null
                }
            }
            if (aMoi && !assistant) {
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
private fun EnTeteConversation(conversation: Conversation?, ecrivent: List<String>, onRetour: () -> Unit, assistant: Boolean, onReglages: () -> Unit) {
    val p = LocalPalette.current
    if (assistant) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onRetour), contentAlignment = Alignment.Center) {
                Icone(R.drawable.lucide_arrow_left, description = "Retour", teinte = p.encreAttenuee.compose, taille = 20.dp)
            }
            AvatarAssistant(38.dp)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(NOM_ASSISTANT, style = Texte.corpsFort, color = p.encre.compose)
                // L'assistant est toujours présenté comme une machine (H12).
                Text("Réponses générées par une IA", style = Texte.secondaire, color = p.encreAttenuee.compose)
            }
        }
        return
    }
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
            if (conversation.silencieux) {
                Icone(R.drawable.lucide_bell_off, description = "En sourdine", teinte = p.encreAttenuee.compose, taille = 15.dp)
            }
            Box(Modifier.size(44.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onReglages), contentAlignment = Alignment.Center) {
                Icone(R.drawable.lucide_ellipsis_vertical, description = if (conversation.type == "group") "Réglages du groupe" else "Réglages de la conversation", teinte = p.encreAttenuee.compose, taille = 20.dp)
            }
        }
    }
}

/** Une bulle (BulleMessage.tsx) : les siennes à droite sur l'accent, les autres à gauche sur la surface. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Bulle(message: MessageFil, aMoi: Boolean, afficherAuteur: Boolean, statut: String?, onAppuiLong: () -> Unit) {
    val p = LocalPalette.current
    val deLAssistant = message.role == "assistant"
    val encre = if (aMoi) Color.White else p.encre.compose
    val attenuee = if (aMoi) Color.White.copy(alpha = 0.7f) else p.encreAttenuee.compose
    val forme = if (aMoi) RoundedCornerShape(18.dp, 18.dp, 6.dp, 18.dp) else RoundedCornerShape(18.dp, 18.dp, 18.dp, 6.dp)
    Column(
        Modifier.fillMaxWidth().padding(top = if (afficherAuteur) 10.dp else 3.dp),
        horizontalAlignment = if (aMoi) Alignment.End else Alignment.Start,
    ) {
        if (afficherAuteur) {
            Row(Modifier.padding(start = 6.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                if (deLAssistant) {
                    Icone(R.drawable.lucide_sparkles, description = null, teinte = p.info.compose, taille = 11.dp)
                    Spacer(Modifier.width(4.dp))
                }
                Text(if (deLAssistant) NOM_ASSISTANT else message.auteur?.name.orEmpty(), style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.encreAttenuee.compose)
            }
        }
        Column(
            Modifier
                .widthIn(max = 300.dp)
                .clip(forme)
                .background(if (aMoi) p.accent.compose else if (deLAssistant) p.info.compose.copy(alpha = 0.1f) else p.surface.compose)
                .then(if (aMoi) Modifier else Modifier.border(BorderStroke(1.dp, if (deLAssistant) p.info.compose.copy(alpha = 0.3f) else p.bordure.compose), forme))
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
                message.pieces.forEach { piece -> PieceJointe(piece.type, piece.url, piece.nom, aMoi, piece.largeur, piece.hauteur) }
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
        // Les réactions rapides en pictogrammes ; une autre, venue du web, est une donnée du membre, affichée telle quelle.
        if (message.reactions.isNotEmpty()) {
            Row(Modifier.padding(top = 2.dp, start = 6.dp, end = 6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                message.reactions.forEach { r ->
                    val connue = reactionDe(r.emoji)
                    Row(
                        Modifier
                            .clip(CircleShape)
                            .border(BorderStroke(1.dp, p.bordure.compose), CircleShape)
                            .background(p.surface.compose)
                            .semantics(mergeDescendants = true) { contentDescription = "${connue?.libelle ?: r.emoji} : ${r.users.size}" }
                            .padding(horizontal = 7.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (connue != null) {
                            Icone(connue.icone, description = null, teinte = p.accent.compose, taille = 12.dp)
                        } else {
                            Text(r.emoji, style = Texte.secondaire.copy(fontSize = 11.sp), color = p.encre.compose)
                        }
                        Spacer(Modifier.width(4.dp))
                        Text("${r.users.size}", style = Texte.secondaire.copy(fontSize = 11.sp, fontFeatureSettings = "tnum"), color = p.encreAttenuee.compose)
                    }
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

/** Une image s'affiche dans la bulle, à ses proportions quand on les connaît ; un son s'ouvre à part. */
@Composable
private fun PieceJointe(type: String, url: String, nom: String, aMoi: Boolean, largeur: Int? = null, hauteur: Int? = null) {
    val p = LocalPalette.current
    val contexte = LocalContext.current
    val adresse = adresseMedia(url, BuildConfig.SITE) ?: url
    if (type == "image") {
        AsyncImage(
            model = adresse, contentDescription = nom.ifBlank { "Image" }, contentScale = ContentScale.Crop,
            modifier = Modifier
                .padding(bottom = 6.dp)
                .widthIn(max = 260.dp)
                .heightIn(max = 320.dp)
                .then(if (largeur != null && hauteur != null && hauteur > 0) Modifier.aspectRatio(largeur.toFloat() / hauteur) else Modifier)
                .clip(RoundedCornerShape(10.dp)),
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
    indication: String,
    actif: Boolean,
    onAnnuler: () -> Unit,
    onEnvoyer: () -> Unit,
    photos: List<Uri> = emptyList(),
    etapeEnvoi: String? = null,
    onJoindre: (() -> Unit)? = null,
    onRetirerPhoto: (Uri) -> Unit = {},
) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxWidth().background(p.surface.compose)) {
        HorizontalDivider(color = p.bordure.compose)
        if (photos.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                photos.forEach { uri ->
                    Box(Modifier.size(64.dp)) {
                        AsyncImage(model = uri, contentDescription = "Photo jointe", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(10.dp)))
                        if (!envoi) {
                            Box(
                                Modifier
                                    .align(Alignment.TopEnd)
                                    .padding(3.dp)
                                    .size(22.dp)
                                    .clip(CircleShape)
                                    .background(Color.Black.copy(alpha = 0.6f))
                                    .clickable(role = Role.Button) { onRetirerPhoto(uri) },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icone(R.drawable.lucide_x, description = "Retirer la photo", teinte = Color.White, taille = 12.dp)
                            }
                        }
                    }
                }
            }
            etapeEnvoi?.let { Text(it, style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(start = 14.dp, top = 6.dp)) }
        }
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
            if (onJoindre != null) {
                Box(
                    Modifier.size(44.dp).clip(CircleShape).clickable(enabled = actif && !envoi && photos.size < PIECES_MAX, role = Role.Button, onClick = onJoindre),
                    contentAlignment = Alignment.Center,
                ) {
                    Icone(R.drawable.lucide_image_plus, description = "Joindre une photo", teinte = p.encreAttenuee.compose, taille = 21.dp)
                }
                Spacer(Modifier.width(4.dp))
            }
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(22.dp))
                    .background(p.base.compose)
                    .border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(22.dp))
                    .padding(horizontal = 16.dp, vertical = 11.dp),
            ) {
                if (texte.isEmpty()) Text(indication, style = Texte.corps, color = p.encreAttenuee.compose)
                BasicTextField(
                    value = texte,
                    onValueChange = onTexte,
                    enabled = actif,
                    textStyle = Texte.corps.copy(color = p.encre.compose),
                    cursorBrush = SolidColor(p.accent.compose),
                    maxLines = 5,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Message" },
                )
            }
            Spacer(Modifier.width(8.dp))
            val envoyable = actif && (texte.isNotBlank() || photos.isNotEmpty()) && !envoi
            Box(
                Modifier.size(44.dp).clip(CircleShape).background(p.accent.compose.copy(alpha = if (envoyable) 1f else 0.4f)).clickable(enabled = envoyable, role = Role.Button, onClick = onEnvoyer),
                contentAlignment = Alignment.Center,
            ) {
                if (envoi) Egaliseur(hauteur = 14.dp, libelle = "Envoi", couleur = p.base.compose)
                else Icone(if (enModification) R.drawable.lucide_check else R.drawable.lucide_send_horizontal, description = if (enModification) "Enregistrer" else "Envoyer", teinte = p.base.compose, taille = 18.dp)
            }
        }
    }
}

/** L'avatar de l'assistant : un pictogramme, jamais un visage, pour qu'on ne le prenne pas pour un membre. */
@Composable
fun AvatarAssistant(taille: Dp) {
    val p = LocalPalette.current
    Box(Modifier.size(taille).clip(CircleShape).background(p.info.compose.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) {
        Icone(R.drawable.lucide_sparkles, description = null, teinte = p.info.compose, taille = taille * 0.45f)
    }
}
