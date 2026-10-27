package com.moziik.app.ui.messages

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.moziik.app.R
import com.moziik.app.donnees.messagerie.Conversation
import com.moziik.app.donnees.messagerie.PartageEnvoye
import com.moziik.app.donnees.messagerie.Personne
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Avatar
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.ChampTexte
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.MessageErreur
import com.moziik.app.ui.composants.dateCourte
import com.moziik.app.ui.composants.presence
import com.moziik.app.ui.composants.pressable
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.menus.Feuille
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.moziik.app.ui.composants.LogoMoziik
import com.moziik.app.ui.composants.SqueletteListe

/** L'identifiant de route du fil de l'assistant d'écoute (H12). */
const val ASSISTANT = "assistant"

/** Le nom affiché de l'assistant, celui du site. */
const val NOM_ASSISTANT = "Assistant Moziik"

/** La liste se relit toutes les 12 secondes tant qu'elle est à l'écran, comme sur le site (H4). */
private const val RAFRAICHISSEMENT_LISTE_MS = 12_000L

/** Titre affiché d'une conversation : le nom de l'autre, ou « Groupe » sans titre. */
fun titreDe(c: Conversation): String = when {
    c.type == "direct" -> c.interlocuteur?.name?.ifBlank { null } ?: c.titre.ifBlank { "Conversation" }
    else -> c.titre.ifBlank { "Groupe" }
}

/**
 * L'onglet Messages (ListeConversations.tsx) : aperçu, non-lus, sourdine,
 * « Écrit… » ; « Nouveau » ouvre un tête-à-tête avec un membre.
 */
@Composable
fun EcranMessages(onConnexion: () -> Unit, onOuvrir: (String) -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val session by c.session.etat.collectAsStateWithLifecycle()
    if (session !is EtatSession.Connecte) {
        Invitation(onConnexion)
        return
    }
    var conversations by remember { mutableStateOf<List<Conversation>?>(null) }
    var erreur by remember { mutableStateOf<String?>(null) }
    var nouvelle by rememberSaveable { mutableStateOf(false) }
    var groupe by rememberSaveable { mutableStateOf(false) }
    val cycle = LocalLifecycleOwner.current
    val avecAssistant = com.moziik.app.ui.menus.fonctionIA("assistant")

    LaunchedEffect(session) {
        cycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                try {
                    conversations = c.messagerie.conversations()
                    erreur = null
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    erreur = messageErreur(e)
                }
                delay(RAFRAICHISSEMENT_LISTE_MS)
            }
        }
    }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 12.dp, top = 16.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Messages", style = Texte.titreFiche, color = p.encre.compose, modifier = Modifier.weight(1f))
            Row(
                Modifier.clip(CircleShape).background(p.accent.compose).pressable { nouvelle = true }.padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icone(R.drawable.lucide_message_square_plus, description = null, teinte = p.base.compose, taille = 16.dp)
                Spacer(Modifier.width(6.dp))
                Text("Nouveau", style = Texte.corpsFort, color = p.base.compose)
            }
        }
        MessageErreur(erreur.takeIf { conversations == null }, Modifier.padding(16.dp))
        val liste = conversations
        when {
            liste == null && erreur == null -> SqueletteListe(7, Modifier.padding(top = 8.dp), cote = 48.dp, rond = true)
            liste != null && liste.isEmpty() -> Column(
                Modifier.fillMaxSize().padding(32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icone(R.drawable.lucide_message_circle, description = null, teinte = p.encreAttenuee.compose, taille = 32.dp)
                Spacer(Modifier.height(12.dp))
                Text("Aucune conversation pour l'instant.", style = Texte.corps, color = p.encreAttenuee.compose, textAlign = TextAlign.Center)
                Spacer(Modifier.height(20.dp))
                BoutonPrincipal("Écrire à quelqu'un", { nouvelle = true }, Modifier.width(220.dp))
            }
            liste != null -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
                if (avecAssistant) item(key = ASSISTANT) { LigneAssistant { onOuvrir(ASSISTANT) } }
                items(liste, key = { it.id }) { conv -> LigneConversation(conv) { onOuvrir(conv.id) } }
            }
        }
    }

    if (nouvelle) {
        ChoixDestinataire(
            titre = "Nouvelle conversation",
            onFermer = { nouvelle = false },
            onConversation = { conv ->
                nouvelle = false
                onOuvrir(conv)
            },
            onGroupe = {
                nouvelle = false
                groupe = true
            },
        )
    }
    if (groupe) {
        CreationGroupe(
            onFermer = { groupe = false },
            onCree = { id ->
                groupe = false
                onOuvrir(id)
            },
        )
    }
}

/** L'assistant d'écoute, épinglé en tête : on lui demande un titre, une ambiance, un artiste. */
@Composable
private fun LigneAssistant(onClick: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onClick).padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AvatarAssistant(48.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(NOM_ASSISTANT, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose)
            Text("Demande-lui quoi écouter", style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1)
        }
        Icone(R.drawable.lucide_sparkles, description = null, teinte = p.info.compose, taille = 16.dp)
    }
}

@Composable
private fun LigneConversation(conv: Conversation, onClick: () -> Unit) {
    val p = LocalPalette.current
    val nonLu = conv.nonLus > 0
    val titre = titreDe(conv)
    Row(
        Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onClick).padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box {
            Avatar(titre, conv.interlocuteur?.avatarUrl ?: conv.imageUrl, taille = 48.dp)
            if (presence(conv.interlocuteur?.vuLe) == "En ligne") {
                Box(Modifier.align(Alignment.BottomEnd).size(13.dp).clip(CircleShape).background(p.base.compose).padding(2.dp).clip(CircleShape).background(p.verifie.compose))
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    titre,
                    style = Texte.corps.copy(fontWeight = if (nonLu) FontWeight.Bold else FontWeight.Medium),
                    color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false),
                )
                if (conv.silencieux) {
                    Spacer(Modifier.width(4.dp))
                    Icone(R.drawable.lucide_bell_off, description = "Sourdine", teinte = p.encreAttenuee.compose, taille = 12.dp)
                }
                Spacer(Modifier.weight(1f))
                Text(dateCourte(conv.dernierMessageLe), style = Texte.secondaire, color = if (nonLu) p.accent.compose else p.encreAttenuee.compose)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                val ecrit = conv.saisie.isNotEmpty()
                Text(
                    if (ecrit) "Écrit…" else conv.apercu.ifBlank { "Aucun message" },
                    style = Texte.secondaire.copy(fontWeight = if (nonLu) FontWeight.SemiBold else FontWeight.Normal),
                    color = if (ecrit) p.accent.compose else if (nonLu) p.encre.compose else p.encreAttenuee.compose,
                    maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
                )
                if (nonLu) {
                    Spacer(Modifier.width(8.dp))
                    Text(
                        if (conv.nonLus > 99) "99+" else "${conv.nonLus}",
                        style = Texte.pastille.copy(fontSize = 10.sp),
                        color = p.base.compose,
                        modifier = Modifier.clip(CircleShape).background(p.accent.compose).padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }
        }
    }
}

/**
 * Choisir à qui écrire (H5) : sans recherche, les contacts récents ; un
 * tête-à-tête s'ouvre, ou se retrouve s'il existe déjà. Sert aussi à
 * « Envoyer dans un message » (H10) : `partage` part alors aussitôt.
 */
@Composable
fun ChoixDestinataire(
    titre: String,
    onFermer: () -> Unit,
    onConversation: (String) -> Unit,
    partage: PartageEnvoye? = null,
    conversations: List<Conversation>? = null,
    /** « Créer un groupe », proposé en tête quand on ouvre une conversation (pas pour un envoi). */
    onGroupe: (() -> Unit)? = null,
) {
    val c = conteneur()
    val p = LocalPalette.current
    val portee = rememberCoroutineScope()
    var terme by rememberSaveable { mutableStateOf("") }
    var personnes by remember { mutableStateOf<List<Personne>?>(null) }
    var recents by remember { mutableStateOf(true) }
    var enCours by remember { mutableStateOf<String?>(null) }
    var erreur by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(terme) {
        if (terme.isNotBlank()) delay(300)
        try {
            val r = c.messagerie.destinataires(terme)
            personnes = r.personnes
            recents = r.recents
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            erreur = messageErreur(e)
        }
    }
    val choisir: (Personne) -> Unit = { personne ->
        if (enCours == null) {
            enCours = personne.id
            portee.launch {
                try {
                    val conv = c.messagerie.ouvrirAvec(personne.id)
                    if (partage != null) {
                        c.messagerie.envoyer(conv.id, "", partage)
                        c.alertes.signaler(AlerteLecture.Message("Envoyé à ${personne.name}.", succes = true))
                    }
                    onConversation(conv.id)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    erreur = messageErreur(e)
                }
                enCours = null
            }
        }
    }

    Feuille(onFermer) {
        Text(titre, style = Texte.titreSection, color = p.encre.compose, modifier = Modifier.padding(horizontal = 20.dp))
        ChampTexte(terme, { terme = it }, "Rechercher un membre", R.drawable.lucide_search, Modifier.padding(horizontal = 20.dp, vertical = 12.dp), indication = "Nom ou @nom d'utilisateur")
        MessageErreur(erreur, Modifier.padding(horizontal = 20.dp))
        LazyColumn(Modifier.heightIn(max = 460.dp)) {
            if (onGroupe != null && terme.isBlank()) {
                item(key = "creer-groupe") {
                    Row(
                        Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onGroupe).padding(horizontal = 20.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.size(40.dp).clip(CircleShape).background(p.accent.compose.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                            Icone(R.drawable.lucide_users, description = null, teinte = p.accent.compose, taille = 19.dp)
                        }
                        Spacer(Modifier.width(12.dp))
                        Text("Créer un groupe", style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose)
                    }
                }
            }
            // Pour un envoi, les groupes et conversations existants sont proposés en tête.
            val existantes = conversations.orEmpty().filter { it.type == "group" && terme.isBlank() }
            if (existantes.isNotEmpty()) {
                item(key = "groupes") { Text("Groupes", style = Texte.surtitre, color = p.encreAttenuee.compose, modifier = Modifier.padding(start = 20.dp, top = 8.dp, bottom = 4.dp)) }
                items(existantes, key = { "g-${it.id}" }) { conv ->
                    LigneChoix(titreDe(conv), null, conv.imageUrl, enCours == conv.id) {
                        if (enCours == null && partage != null) {
                            enCours = conv.id
                            portee.launch {
                                runCatching { c.messagerie.envoyer(conv.id, "", partage) }
                                    .onSuccess {
                                        c.alertes.signaler(AlerteLecture.Message("Envoyé à ${titreDe(conv)}.", succes = true))
                                        onConversation(conv.id)
                                    }
                                    .onFailure { erreur = messageErreur(it) }
                                enCours = null
                            }
                        }
                    }
                }
            }
            val liste = personnes
            if (liste == null) {
                item(key = "attente") { Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 18.dp) } }
            } else {
                if (recents && liste.isNotEmpty()) {
                    item(key = "recents") { Text("Récents", style = Texte.surtitre, color = p.encreAttenuee.compose, modifier = Modifier.padding(start = 20.dp, top = 8.dp, bottom = 4.dp)) }
                }
                if (liste.isEmpty()) {
                    item(key = "vide") {
                        Text(
                            if (terme.isBlank()) "Cherche un membre par son nom." else "Aucun membre trouvé.",
                            style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(20.dp),
                        )
                    }
                }
                items(liste, key = { it.id }) { personne ->
                    val ligne = listOfNotNull(personne.username?.let { "@$it" }, presence(personne.vuLe)).joinToString(" · ").ifEmpty { null }
                    LigneChoix(personne.name, ligne, personne.avatarUrl, enCours == personne.id) { choisir(personne) }
                }
            }
        }
    }
}

@Composable
private fun LigneChoix(nom: String, ligne: String?, photo: String?, chargement: Boolean, onClick: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onClick).padding(horizontal = 20.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(nom, photo, taille = 40.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(nom, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
            ligne?.let { Text(it, style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1) }
        }
        if (chargement) Egaliseur(hauteur = 12.dp)
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
            Icone(R.drawable.lucide_messages_square, description = null, teinte = p.accent.compose, taille = 26.dp)
        }
        Spacer(Modifier.height(16.dp))
        Text("Messages", style = Texte.titreSection, color = p.encre.compose)
        Spacer(Modifier.height(6.dp))
        Text(
            "Connecte-toi pour écrire aux autres membres et partager tes découvertes.",
            style = Texte.corps, color = p.encreAttenuee.compose, textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(20.dp))
        BoutonPrincipal("Se connecter", onConnexion, Modifier.width(200.dp))
    }
}
