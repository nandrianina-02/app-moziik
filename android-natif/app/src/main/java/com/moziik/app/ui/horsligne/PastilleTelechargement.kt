package com.moziik.app.ui.horsligne

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.pressable
import com.moziik.app.ui.composants.rememberTeintePochette
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.menus.Confirmation
import com.moziik.app.ui.navigation
import kotlinx.coroutines.launch

/** Teinte d'attente, le temps de lire la pochette : un voile neutre, lisible sur toutes les images. */
private val VOILE = Color.Black.copy(alpha = 0.55f)

/** Ce que montre une pastille : télécharger, avancement (0 à 1, ou null en file), ou fait. */
private sealed interface EtatPastille {
    data object Libre : EtatPastille
    data class EnCours(val avancement: Float?) : EtatPastille
    data object Fait : EtatPastille
}

/**
 * La pastille ronde de téléchargement, teintée d'après la pochette : posée
 * sur les cartes et au bout des lignes de titre (G1). Un titre déjà gardé
 * se retire après confirmation : un appui distrait ne doit pas effacer ce
 * qu'on a pris le temps de télécharger.
 */
@Composable
fun PastilleTelechargement(titre: Titre, modifier: Modifier = Modifier, taille: Dp = 30.dp) {
    if (!titre.publie) return
    val c = conteneur()
    val nav = navigation()
    val portee = rememberCoroutineScope()
    val presents by c.horsLigne.telechargements.titres.collectAsStateWithLifecycle()
    val attente by c.horsLigne.attente.collectAsStateWithLifecycle()
    val avancements by c.horsLigne.telechargements.enCours.collectAsStateWithLifecycle()
    var retrait by remember { mutableStateOf(false) }
    val etat = when {
        presents.any { it.id == titre.id } -> EtatPastille.Fait
        titre.id in attente || titre.id in avancements -> EtatPastille.EnCours(avancements[titre.id])
        else -> EtatPastille.Libre
    }
    Pastille(
        pochette = titre.coverUrl,
        etat = etat,
        description = when (etat) {
            EtatPastille.Fait -> "Retirer « ${titre.title} » des téléchargements"
            is EtatPastille.EnCours -> "Annuler le téléchargement de « ${titre.title} »"
            EtatPastille.Libre -> "Télécharger « ${titre.title} »"
        },
        taille = taille,
        modifier = modifier,
        onClick = {
            if (etat == EtatPastille.Fait) retrait = true
            else portee.launch { reagirAuRefus(c.horsLigne.basculer(titre), c, nav) }
        },
    )
    if (retrait) {
        Confirmation(
            titre = "Retirer ce téléchargement ?",
            texte = "« ${titre.title} » ne sera plus disponible hors connexion.",
            action = "Retirer",
            onConfirmer = {
                portee.launch { c.horsLigne.basculer(titre) }
                retrait = false
            },
            onFermer = { retrait = false },
        )
    }
}

/**
 * La même pastille pour un album ou une playlist, sur sa carte : la liste
 * des titres n'est lue qu'au premier appui, puis l'avancement du lot
 * s'affiche.
 */
@Composable
fun PastilleTelechargementLot(
    pochette: String?,
    nom: String,
    source: String,
    charger: suspend () -> List<Titre>,
    modifier: Modifier = Modifier,
    albumId: String? = null,
    taille: Dp = 30.dp,
) {
    val c = conteneur()
    val nav = navigation()
    val portee = rememberCoroutineScope()
    val presents by c.horsLigne.telechargements.titres.collectAsStateWithLifecycle()
    val attente by c.horsLigne.attente.collectAsStateWithLifecycle()
    var titres by remember(nom) { mutableStateOf<List<Titre>?>(null) }
    var lecture by remember { mutableStateOf(false) }
    var retrait by remember { mutableStateOf(false) }
    val ids = titres?.filter { it.publie }?.map { it.id }.orEmpty()
    val gardes = presents.map { it.id }.toSet()
    val faits = ids.count { it in gardes }
    val etat = when {
        lecture -> EtatPastille.EnCours(null)
        ids.isNotEmpty() && faits == ids.size -> EtatPastille.Fait
        ids.any { it in attente } -> EtatPastille.EnCours(faits.toFloat() / ids.size)
        else -> EtatPastille.Libre
    }
    Pastille(
        pochette = pochette,
        etat = etat,
        description = if (etat == EtatPastille.Fait) "Retirer « $nom » des téléchargements" else "Télécharger « $nom »",
        taille = taille,
        modifier = modifier,
        onClick = {
            when {
                etat == EtatPastille.Fait -> retrait = true
                etat is EtatPastille.EnCours -> Unit
                else -> portee.launch {
                    lecture = true
                    val liste = runCatching { charger() }.getOrNull()
                    lecture = false
                    if (liste == null) {
                        c.alertes.signaler(AlerteLecture.Message("Connexion impossible. Vérifie ton réseau et réessaie."))
                        return@launch
                    }
                    titres = liste
                    reagirAuRefus(c.horsLigne.telechargerLot(liste, source, nom, albumId), c, nav)
                }
            }
        },
    )
    if (retrait) {
        Confirmation(
            titre = "Retirer les téléchargements ?",
            texte = "Les titres de « $nom » ne seront plus disponibles hors connexion.",
            action = "Retirer",
            onConfirmer = {
                titres?.let(c.horsLigne::retirerLot)
                retrait = false
            },
            onFermer = { retrait = false },
        )
    }
}

@Composable
private fun Pastille(pochette: String?, etat: EtatPastille, description: String, taille: Dp, modifier: Modifier, onClick: () -> Unit) {
    val teinte = rememberTeintePochette(pochette)
    val fond by animateColorAsState(teinte ?: VOILE, tween(200), label = "teinte")
    Box(
        modifier
            .size(taille)
            .clip(CircleShape)
            .background(fond)
            .pressable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        if (etat is EtatPastille.EnCours) {
            // L'anneau d'avancement ; sans avancement connu (en file), un quart d'anneau suffit à dire « en cours ».
            Canvas(Modifier.fillMaxSize()) {
                val trait = 2.dp.toPx()
                val inset = trait / 2 + 1.dp.toPx()
                val cote = size.minDimension - inset * 2
                drawArc(
                    Color.White.copy(alpha = 0.25f), 0f, 360f, false,
                    topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                    size = androidx.compose.ui.geometry.Size(cote, cote),
                    style = Stroke(trait),
                )
                drawArc(
                    Color.White, -90f, 360f * (etat.avancement ?: 0.25f).coerceIn(0.03f, 1f), false,
                    topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                    size = androidx.compose.ui.geometry.Size(cote, cote),
                    style = Stroke(trait, cap = StrokeCap.Round),
                )
            }
        }
        Icone(
            if (etat == EtatPastille.Fait) R.drawable.lucide_check else R.drawable.lucide_download,
            description = null,
            teinte = Color.White,
            taille = taille * 0.5f,
        )
    }
}

/** La pastille d'un album, sur sa carte : ses titres publiés sont lus au premier appui. */
@Composable
fun PastilleAlbum(id: String, nom: String, pochette: String?) {
    val c = conteneur()
    PastilleTelechargementLot(pochette, nom, "album", { c.catalogue.album(id).songs }, albumId = id)
}

/** La pastille d'une playlist, sur sa carte. */
@Composable
fun PastillePlaylist(id: String, nom: String, pochette: String?) {
    val c = conteneur()
    PastilleTelechargementLot(pochette, nom, "playlist", { c.catalogue.playlist(id).songs })
}
