package com.moziik.app.ui.fiches

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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.Commentaire
import com.moziik.app.donnees.catalogue.FilsDeCommentaires
import com.moziik.app.donnees.horsligne.ActionGardee
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Avatar
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LienTexte
import com.moziik.app.ui.composants.dateCourte
import com.moziik.app.ui.composants.duree
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.menus.Confirmation
import kotlinx.coroutines.launch
import java.io.IOException

/**
 * Les commentaires d'un titre (H1, CommentsSection.tsx) : publier, répondre
 * sur un niveau, supprimer les siens. Dans le lecteur, `position` donne
 * l'instant d'écoute : le commentaire peut s'y rattacher, et un instant
 * cité ramène le lecteur à ce moment (`onAllerA`).
 *
 * Sans réseau, le commentaire est gardé et part au retour de la connexion
 * (6.4) ; il s'affiche en attendant, marqué comme tel.
 */
@Composable
fun BlocCommentaires(
    titreId: String,
    modifier: Modifier = Modifier,
    position: (() -> Double)? = null,
    onAllerA: ((Double) -> Unit)? = null,
) {
    val c = conteneur()
    val p = LocalPalette.current
    val portee = rememberCoroutineScope()
    val session by c.session.etat.collectAsStateWithLifecycle()
    val moi = (session as? EtatSession.Connecte)?.utilisateur
    val gardees by c.horsLigne.actions.actions.collectAsStateWithLifecycle()
    val enAttente = gardees.filterIsInstance<ActionGardee.Commentaire>().filter { it.titreId == titreId }
    var liste by remember(titreId) { mutableStateOf<List<Commentaire>?>(null) }
    var erreur by remember(titreId) { mutableStateOf<String?>(null) }
    var essai by remember { mutableStateOf(0) }
    var texte by remember(titreId) { mutableStateOf("") }
    var reponseA by remember(titreId) { mutableStateOf<Commentaire?>(null) }
    var avecMoment by remember(titreId) { mutableStateOf(position != null) }
    var envoi by remember { mutableStateOf(false) }
    var aSupprimer by remember { mutableStateOf<Commentaire?>(null) }

    // Relu au premier affichage, puis quand des commentaires gardés hors connexion sont partis.
    LaunchedEffect(titreId, essai, enAttente.size) {
        erreur = null
        runCatching { c.commentaires.duTitre(titreId) }
            .onSuccess { liste = it }
            .onFailure { if (liste == null) erreur = messageErreur(it) }
    }

    val publier: () -> Unit = publier@{
        val propre = texte.trim()
        if (propre.isEmpty() || envoi) return@publier
        // Une réponse à une réponse va au commentaire de départ : un seul niveau, comme sur le site.
        val parent = reponseA?.let { it.parentComment ?: it.id }
        val moment = if (avecMoment && parent == null) position?.invoke()?.takeIf { it >= 0 } else null
        envoi = true
        portee.launch {
            runCatching { c.commentaires.publier(titreId, propre, moment, parent) }
                .onSuccess { nouveau ->
                    liste = listOf(nouveau) + liste.orEmpty()
                    texte = ""
                    reponseA = null
                }
                .onFailure { e ->
                    if (e is IOException) {
                        c.horsLigne.actions.garder(ActionGardee.Commentaire(titreId, propre.take(2000), moment, parent))
                        c.alertes.signaler(AlerteLecture.Message("Pas de réseau : ton commentaire partira au retour de la connexion."))
                        texte = ""
                        reponseA = null
                    } else {
                        c.alertes.signaler(AlerteLecture.Message(messageErreur(e)))
                    }
                }
            envoi = false
        }
    }

    Column(modifier.fillMaxWidth()) {
        if (moi == null) {
            Text("Connecte-toi pour commenter ce son.", style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(vertical = 8.dp))
        } else {
            Saisie(
                texte = texte,
                onTexte = { texte = it.take(2000) },
                reponseA = reponseA?.user?.name ?: reponseA?.let { "un membre" },
                onAnnulerReponse = { reponseA = null },
                moment = if (position != null && reponseA == null) avecMoment else null,
                onMoment = { avecMoment = !avecMoment },
                positionTexte = position?.let { duree(it()) },
                envoi = envoi,
                onEnvoyer = publier,
            )
        }
        Spacer(Modifier.height(12.dp))

        enAttente.forEach { a ->
            LigneCommentaire(
                nom = moi?.name ?: "Moi",
                photo = moi?.avatarUrl,
                texte = a.texte,
                quand = "En attente d'envoi",
                moment = a.moment,
                onAllerA = onAllerA,
                reponse = a.parent != null,
            )
        }
        val elements = liste
        when {
            elements == null && erreur != null -> Column {
                Text(erreur.orEmpty(), style = Texte.corps, color = p.encreAttenuee.compose)
                LienTexte("Réessayer", { essai++ })
            }
            elements == null -> Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 16.dp, libelle = "Chargement") }
            elements.isEmpty() && enAttente.isEmpty() -> Text(
                "Aucun commentaire pour l'instant. Sois le premier à donner ton avis.",
                style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(vertical = 8.dp),
            )
            else -> FilsDeCommentaires.fils(elements).forEach { fil ->
                LigneCommentaire(
                    nom = fil.racine.user?.name ?: "Compte supprimé",
                    photo = fil.racine.user?.avatarUrl,
                    texte = fil.racine.text,
                    quand = dateCourte(fil.racine.createdAt),
                    moment = fil.racine.timestampInSong,
                    onAllerA = onAllerA,
                    onRepondre = if (moi != null) ({ reponseA = fil.racine }) else null,
                    onSupprimer = if (moi != null && fil.racine.user?.id == moi.id) ({ aSupprimer = fil.racine }) else null,
                )
                fil.reponses.forEach { r ->
                    LigneCommentaire(
                        nom = r.user?.name ?: "Compte supprimé",
                        photo = r.user?.avatarUrl,
                        texte = r.text,
                        quand = dateCourte(r.createdAt),
                        moment = null,
                        onAllerA = null,
                        reponse = true,
                        onRepondre = if (moi != null) ({ reponseA = r }) else null,
                        onSupprimer = if (moi != null && r.user?.id == moi.id) ({ aSupprimer = r }) else null,
                    )
                }
            }
        }
    }

    aSupprimer?.let { cible ->
        Confirmation(
            titre = "Supprimer ce commentaire ?",
            texte = if (cible.parentComment == null) "Il disparaîtra avec les réponses qu'il a reçues." else "Ta réponse disparaîtra de la conversation.",
            action = "Supprimer",
            onConfirmer = {
                aSupprimer = null
                portee.launch {
                    runCatching { c.commentaires.supprimer(cible.id) }
                        // Le site garde les réponses d'un commentaire supprimé : on les masque ici.
                        .onSuccess { liste = liste.orEmpty().filter { it.id != cible.id && it.parentComment != cible.id } }
                        .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                }
            },
            onFermer = { aSupprimer = null },
        )
    }
}

@Composable
private fun Saisie(
    texte: String,
    onTexte: (String) -> Unit,
    reponseA: String?,
    onAnnulerReponse: () -> Unit,
    moment: Boolean?,
    onMoment: () -> Unit,
    positionTexte: String?,
    envoi: Boolean,
    onEnvoyer: () -> Unit,
) {
    val p = LocalPalette.current
    Column {
        if (reponseA != null) {
            Row(Modifier.padding(bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icone(R.drawable.lucide_reply, description = null, teinte = p.accent.compose, taille = 14.dp)
                Spacer(Modifier.width(6.dp))
                Text("Réponse à $reponseA", style = Texte.secondaire.copy(fontWeight = FontWeight.SemiBold), color = p.accent.compose, modifier = Modifier.weight(1f))
                Box(Modifier.size(28.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onAnnulerReponse), contentAlignment = Alignment.Center) {
                    Icone(R.drawable.lucide_x, description = "Annuler la réponse", teinte = p.encreAttenuee.compose, taille = 14.dp)
                }
            }
        }
        Row(verticalAlignment = Alignment.Bottom) {
            Box(
                Modifier
                    .weight(1f)
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(22.dp))
                    .background(p.surface.compose)
                    .border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(22.dp))
                    .padding(horizontal = 16.dp, vertical = 11.dp),
            ) {
                if (texte.isEmpty()) {
                    Text(if (reponseA != null) "Ta réponse…" else "Dis ce que tu penses de ce son…", style = Texte.corps, color = p.encreAttenuee.compose)
                }
                BasicTextField(
                    value = texte,
                    onValueChange = onTexte,
                    textStyle = Texte.corps.copy(color = p.encre.compose),
                    cursorBrush = SolidColor(p.accent.compose),
                    maxLines = 5,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Commentaire" },
                )
            }
            Spacer(Modifier.width(8.dp))
            val envoyable = texte.isNotBlank() && !envoi
            Box(
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(p.accent.compose.copy(alpha = if (envoyable) 1f else 0.4f))
                    .clickable(enabled = envoyable, role = Role.Button, onClick = onEnvoyer),
                contentAlignment = Alignment.Center,
            ) {
                if (envoi) Egaliseur(hauteur = 14.dp, libelle = "Envoi", couleur = p.base.compose)
                else Icone(R.drawable.lucide_send_horizontal, description = "Publier", teinte = p.base.compose, taille = 18.dp)
            }
        }
        if (moment != null && positionTexte != null) {
            // Rattacher le commentaire à l'instant écouté : « à 1:23 », comme sur le site.
            Row(
                Modifier
                    .padding(top = 8.dp)
                    .clip(CircleShape)
                    .border(BorderStroke(1.dp, if (moment) p.accent.compose else p.bordure.compose), CircleShape)
                    .clickable(role = Role.Checkbox, onClick = onMoment)
                    .padding(horizontal = 12.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icone(R.drawable.lucide_clock, description = null, teinte = if (moment) p.accent.compose else p.encreAttenuee.compose, taille = 13.dp)
                Spacer(Modifier.width(6.dp))
                Text(
                    if (moment) "À $positionTexte" else "Sans moment précis",
                    style = Texte.secondaire.copy(fontWeight = FontWeight.Medium),
                    color = if (moment) p.accent.compose else p.encreAttenuee.compose,
                )
            }
        }
    }
}

@Composable
private fun LigneCommentaire(
    nom: String,
    photo: String?,
    texte: String,
    quand: String,
    moment: Double?,
    onAllerA: ((Double) -> Unit)?,
    reponse: Boolean = false,
    onRepondre: (() -> Unit)? = null,
    onSupprimer: (() -> Unit)? = null,
) {
    val p = LocalPalette.current
    val accent = p.accent.compose
    val corps = remember(texte, accent) {
        buildAnnotatedString {
            FilsDeCommentaires.morceaux(texte).forEach { m ->
                if (m.mention != null) withStyle(SpanStyle(color = accent, fontWeight = FontWeight.Medium)) { append(m.texte) } else append(m.texte)
            }
        }
    }
    Row(Modifier.fillMaxWidth().padding(start = if (reponse) 44.dp else 0.dp, top = 8.dp, bottom = 8.dp)) {
        Avatar(nom, photo, taille = if (reponse) 28.dp else 36.dp)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(nom, style = Texte.secondaire.copy(fontWeight = FontWeight.SemiBold), color = p.encre.compose, maxLines = 1, modifier = Modifier.weight(1f, fill = false))
                Text(quand, style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1)
                if (moment != null) {
                    Text(
                        duree(moment),
                        style = Texte.secondaire.copy(fontWeight = FontWeight.Medium, fontFeatureSettings = "tnum"),
                        color = p.accent.compose,
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(p.accent.compose.copy(alpha = 0.1f))
                            .then(if (onAllerA != null) Modifier.clickable(role = Role.Button, onClickLabel = "Écouter à ce moment") { onAllerA(moment) } else Modifier)
                            .padding(horizontal = 8.dp, vertical = 1.dp),
                    )
                }
            }
            Spacer(Modifier.height(2.dp))
            Text(corps, style = Texte.corps, color = p.encre.compose)
            if (onRepondre != null || onSupprimer != null) {
                Row(Modifier.padding(top = 2.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    onRepondre?.let { Action("Répondre", it) }
                    onSupprimer?.let { Action("Supprimer", it) }
                }
            }
        }
    }
}

@Composable
private fun Action(libelle: String, onClick: () -> Unit) {
    Text(
        libelle,
        style = Texte.secondaire.copy(fontWeight = FontWeight.Medium),
        color = LocalPalette.current.encreAttenuee.compose,
        modifier = Modifier.clip(RoundedCornerShape(6.dp)).clickable(role = Role.Button, onClick = onClick).padding(vertical = 4.dp),
    )
}

/** Les derniers commentaires des titres d'un album, en lecture : on commente un titre, pas un album (H1). */
@Composable
fun CommentairesAlbum(albumId: String, onTitre: (String) -> Unit, modifier: Modifier = Modifier) {
    val c = conteneur()
    val p = LocalPalette.current
    var liste by remember(albumId) { mutableStateOf<List<Commentaire>?>(null) }
    LaunchedEffect(albumId) { liste = runCatching { c.commentaires.delAlbum(albumId).comments }.getOrNull().orEmpty() }
    val racines = liste.orEmpty().filter { it.parentComment == null }.take(8)
    if (racines.isEmpty()) return
    SectionFiche("Ce qu'en disent les auditeurs", modifier) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        racines.forEach { com ->
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .then(com.titreId?.let { id -> Modifier.clickable(role = Role.Button, onClickLabel = "Voir le titre") { onTitre(id) } } ?: Modifier),
            ) {
                LigneCommentaire(
                    nom = com.user?.name ?: "Compte supprimé",
                    photo = com.user?.avatarUrl,
                    texte = com.text,
                    quand = listOfNotNull(com.songTitle, dateCourte(com.createdAt).ifEmpty { null }).joinToString(" · "),
                    moment = null,
                    onAllerA = null,
                )
            }
        }
        Text("On commente un titre depuis sa fiche.", style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 4.dp))
    }
    }
}
