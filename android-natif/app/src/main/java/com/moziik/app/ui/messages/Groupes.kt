package com.moziik.app.ui.messages

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.moziik.app.R
import com.moziik.app.donnees.messagerie.ChangementGestionnaire
import com.moziik.app.donnees.messagerie.Conversation
import com.moziik.app.donnees.messagerie.ModificationConversation
import com.moziik.app.donnees.messagerie.Participant
import com.moziik.app.donnees.messagerie.Personne
import com.moziik.app.donnees.reseau.messageErreur
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
import com.moziik.app.ui.composants.presence
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.menus.Confirmation
import com.moziik.app.ui.menus.Feuille
import com.moziik.app.ui.menus.Interrupteur
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** 50 personnes au plus dans un groupe, créateur compris (H5). */
private const val MEMBRES_MAX = 50

/**
 * Choisir plusieurs membres : recherche, cases cochées, et les choisis en
 * pastilles au-dessus. `exclus` : déjà dans le groupe, pas proposés.
 */
@Composable
private fun SelecteurMembres(choisis: MutableList<Personne>, exclus: Set<String>, maximum: Int) {
    val c = conteneur()
    val p = LocalPalette.current
    var terme by remember { mutableStateOf("") }
    var personnes by remember { mutableStateOf<List<Personne>?>(null) }
    var erreur by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(terme) {
        if (terme.isNotBlank()) delay(300)
        try {
            personnes = c.messagerie.destinataires(terme).personnes.filter { it.id !in exclus }
            erreur = null
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            erreur = messageErreur(e)
        }
    }
    Column {
        if (choisis.isNotEmpty()) {
            LazyRow(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(choisis.toList(), key = { it.id }) { personne ->
                    Row(
                        Modifier
                            .clip(CircleShape)
                            .background(p.accent.compose.copy(alpha = 0.12f))
                            .clickable(role = Role.Button, onClickLabel = "Retirer") { choisis.removeAll { it.id == personne.id } }
                            .padding(start = 10.dp, end = 6.dp, top = 4.dp, bottom = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(personne.name, style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.accent.compose, maxLines = 1)
                        Spacer(Modifier.width(4.dp))
                        Icone(R.drawable.lucide_x, description = null, teinte = p.accent.compose, taille = 12.dp)
                    }
                }
            }
        }
        ChampTexte(terme, { terme = it }, "Rechercher un membre", R.drawable.lucide_search, Modifier.padding(horizontal = 20.dp, vertical = 10.dp), indication = "Nom ou @nom d'utilisateur")
        MessageErreur(erreur, Modifier.padding(horizontal = 20.dp))
        val liste = personnes
        LazyColumn(Modifier.heightIn(max = 300.dp)) {
            if (liste == null) {
                item(key = "attente") { Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 16.dp) } }
            } else if (liste.isEmpty()) {
                item(key = "vide") {
                    Text(if (terme.isBlank()) "Cherche un membre par son nom." else "Aucun membre trouvé.", style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(20.dp))
                }
            }
            items(liste.orEmpty(), key = { it.id }) { personne ->
                val coche = choisis.any { it.id == personne.id }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable(role = Role.Checkbox) {
                            if (coche) {
                                choisis.removeAll { it.id == personne.id }
                            } else if (choisis.size < maximum) {
                                choisis += personne
                            } else {
                                c.alertes.signaler(AlerteLecture.Message("Un groupe compte $MEMBRES_MAX personnes au plus."))
                            }
                        }
                        .semantics { selected = coche }
                        .padding(horizontal = 20.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Avatar(personne.name, personne.avatarUrl, taille = 38.dp)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(personne.name, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        listOfNotNull(personne.username?.let { "@$it" }, presence(personne.vuLe)).joinToString(" · ").ifEmpty { null }?.let {
                            Text(it, style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1)
                        }
                    }
                    Box(
                        Modifier
                            .size(22.dp)
                            .clip(CircleShape)
                            .background(if (coche) p.accent.compose else p.base.compose)
                            .border(BorderStroke(1.5.dp, if (coche) p.accent.compose else p.bordure.compose), CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (coche) Icone(R.drawable.lucide_check, description = null, teinte = p.base.compose, taille = 14.dp)
                    }
                }
            }
        }
    }
}

/** Créer un groupe (H5) : un nom, au moins une autre personne ; le créateur en est le gestionnaire. */
@Composable
fun CreationGroupe(onFermer: () -> Unit, onCree: (String) -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val portee = rememberCoroutineScope()
    var nom by remember { mutableStateOf("") }
    val choisis = remember { mutableStateListOf<Personne>() }
    var enCours by remember { mutableStateOf(false) }
    var erreur by remember { mutableStateOf<String?>(null) }
    Feuille(onFermer) {
        Text("Nouveau groupe", style = Texte.titreSection, color = p.encre.compose, modifier = Modifier.padding(horizontal = 20.dp))
        ChampTexte(nom, { nom = it.take(60) }, "Nom du groupe", R.drawable.lucide_users, Modifier.padding(horizontal = 20.dp, vertical = 10.dp))
        SelecteurMembres(choisis, exclus = emptySet(), maximum = MEMBRES_MAX - 1)
        MessageErreur(erreur, Modifier.padding(horizontal = 20.dp))
        BoutonPrincipal(
            if (choisis.isEmpty()) "Créer le groupe" else "Créer le groupe (${choisis.size + 1} personnes)",
            {
                erreur = when {
                    nom.isBlank() -> "Donne un nom au groupe."
                    choisis.isEmpty() -> "Choisis au moins une personne."
                    else -> null
                }
                if (erreur == null && !enCours) {
                    enCours = true
                    portee.launch {
                        runCatching { c.messagerie.creerGroupe(nom, choisis.map { it.id }) }
                            .onSuccess { onCree(it.id) }
                            .onFailure { erreur = messageErreur(it) }
                        enCours = false
                    }
                }
            },
            Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
            enCours = enCours,
        )
    }
}

/**
 * Les réglages d'une conversation (H9) : la sourdine pour tous ; pour un
 * groupe, son nom, ses membres et leurs rôles (gestionnaires seulement),
 * et « Quitter le groupe ». On ne s'exclut pas soi-même : on quitte.
 */
@Composable
fun ReglagesConversation(
    conversation: Conversation,
    moi: String?,
    onChange: (Conversation) -> Unit,
    onQuitte: () -> Unit,
    onFermer: () -> Unit,
) {
    val c = conteneur()
    val p = LocalPalette.current
    val portee = rememberCoroutineScope()
    val groupe = conversation.type == "group"
    val gere = conversation.gestionnaire
    var nom by remember(conversation.id) { mutableStateOf(conversation.titre) }
    var ajout by remember { mutableStateOf(false) }
    var aRetirer by remember { mutableStateOf<Participant?>(null) }
    var quitter by remember { mutableStateOf(false) }
    var enCours by remember { mutableStateOf(false) }

    val regler: (ModificationConversation, String?) -> Unit = { modification, confirmation ->
        if (!enCours) {
            enCours = true
            portee.launch {
                runCatching { c.messagerie.regler(conversation.id, modification) }
                    .onSuccess {
                        onChange(it)
                        confirmation?.let { texte -> c.alertes.signaler(AlerteLecture.Message(texte, succes = true)) }
                    }
                    .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                enCours = false
            }
        }
    }

    if (ajout) {
        val choisis = remember { mutableStateListOf<Personne>() }
        Feuille({ ajout = false }) {
            Text("Ajouter des membres", style = Texte.titreSection, color = p.encre.compose, modifier = Modifier.padding(horizontal = 20.dp))
            SelecteurMembres(choisis, exclus = conversation.participants.map { it.id }.toSet(), maximum = (MEMBRES_MAX - conversation.participants.size).coerceAtLeast(0))
            BoutonPrincipal(
                if (choisis.isEmpty()) "Ajouter" else "Ajouter ${choisis.size} personne${if (choisis.size > 1) "s" else ""}",
                {
                    if (choisis.isNotEmpty()) {
                        regler(ModificationConversation(ajouter = choisis.map { it.id }), "Membres ajoutés.")
                        ajout = false
                    }
                },
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
                enCours = enCours,
                actif = choisis.isNotEmpty(),
            )
        }
        return
    }

    Feuille(onFermer) {
        Column(Modifier.heightIn(max = 560.dp).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            Text(if (groupe) "Réglages du groupe" else "Réglages de la conversation", style = Texte.titreSection, color = p.encre.compose)
            Spacer(Modifier.size(12.dp))
            Interrupteur(conversation.silencieux, "Sourdine : pas de notification") {
                regler(ModificationConversation(silencieux = it), if (it) "Conversation en sourdine." else "Notifications réactivées.")
            }
            Text(
                "Les messages arrivent toujours ; seules les notifications se taisent.",
                style = Texte.secondaire, color = p.encreAttenuee.compose,
            )
            if (groupe) {
                Spacer(Modifier.size(18.dp))
                if (gere) {
                    ChampTexte(nom, { nom = it.take(60) }, "Nom du groupe", R.drawable.lucide_users)
                    if (nom.isNotBlank() && nom.trim() != conversation.titre) {
                        BoutonPrincipal("Renommer", { regler(ModificationConversation(titre = nom.trim()), "Groupe renommé.") }, Modifier.fillMaxWidth().padding(top = 8.dp), enCours = enCours)
                    }
                    Spacer(Modifier.size(14.dp))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${conversation.participants.size} membres", style = Texte.corpsFort, color = p.encre.compose, modifier = Modifier.weight(1f))
                    if (gere && conversation.participants.size < MEMBRES_MAX) {
                        Row(
                            Modifier.clip(CircleShape).clickable(role = Role.Button) { ajout = true }.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icone(R.drawable.lucide_user_plus, description = null, teinte = p.accent.compose, taille = 16.dp)
                            Spacer(Modifier.width(6.dp))
                            Text("Ajouter", style = Texte.secondaire.copy(fontWeight = FontWeight.SemiBold), color = p.accent.compose)
                        }
                    }
                }
                conversation.participants.forEach { membre ->
                    LigneMembre(
                        membre,
                        estMoi = membre.id == moi,
                        gere = gere,
                        onRole = { regler(ModificationConversation(gestionnaire = ChangementGestionnaire(membre.id, !membre.gestionnaire)), null) },
                        onRetirer = { aRetirer = membre },
                    )
                }
                Spacer(Modifier.size(10.dp))
                HorizontalDivider(color = p.bordure.compose)
                Row(
                    Modifier.fillMaxWidth().clickable(role = Role.Button) { quitter = true }.padding(vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icone(R.drawable.lucide_log_out, description = null, teinte = p.alerte.compose, taille = 18.dp)
                    Spacer(Modifier.width(12.dp))
                    Text("Quitter le groupe", style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.alerte.compose)
                }
            }
        }
    }

    aRetirer?.let { membre ->
        Confirmation(
            titre = "Retirer ${membre.name} ?",
            texte = "${membre.name} ne verra plus les nouveaux messages du groupe.",
            action = "Retirer",
            onConfirmer = {
                aRetirer = null
                regler(ModificationConversation(exclure = membre.id), "${membre.name} a été retiré du groupe.")
            },
            onFermer = { aRetirer = null },
        )
    }
    if (quitter) {
        Confirmation(
            titre = "Quitter le groupe ?",
            texte = "Tu ne recevras plus ses messages. Un membre devra t'ajouter pour revenir.",
            action = "Quitter",
            onConfirmer = {
                quitter = false
                portee.launch {
                    runCatching { c.messagerie.quitter(conversation.id) }
                        .onSuccess {
                            c.alertes.signaler(AlerteLecture.Message("Tu as quitté le groupe.", succes = true))
                            onQuitte()
                        }
                        .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                }
            },
            onFermer = { quitter = false },
        )
    }
}

@Composable
private fun LigneMembre(membre: Participant, estMoi: Boolean, gere: Boolean, onRole: () -> Unit, onRetirer: () -> Unit) {
    val p = LocalPalette.current
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Avatar(membre.name, membre.avatarUrl, taille = 38.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(if (estMoi) "${membre.name} (toi)" else membre.name, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (membre.gestionnaire) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icone(R.drawable.lucide_shield, description = null, teinte = p.accent.compose, taille = 11.dp)
                    Spacer(Modifier.width(4.dp))
                    Text("Gestionnaire", style = Texte.secondaire, color = p.accent.compose)
                }
            }
        }
        if (gere && !estMoi) {
            Box(
                Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .clickable(role = Role.Button, onClick = onRole)
                    .semantics { contentDescription = if (membre.gestionnaire) "Retirer le rôle de gestionnaire" else "Nommer gestionnaire" },
                contentAlignment = Alignment.Center,
            ) {
                Icone(R.drawable.lucide_shield, description = null, teinte = if (membre.gestionnaire) p.accent.compose else p.encreAttenuee.compose, taille = 17.dp)
            }
            Box(
                Modifier.size(36.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onRetirer).semantics { contentDescription = "Retirer du groupe" },
                contentAlignment = Alignment.Center,
            ) {
                Icone(R.drawable.lucide_user_minus, description = null, teinte = p.encreAttenuee.compose, taille = 17.dp)
            }
        }
    }
}
