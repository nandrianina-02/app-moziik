package com.moziik.app.ui.lecteur

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.LigneParoles
import com.moziik.app.donnees.catalogue.Paroles
import com.moziik.app.donnees.catalogue.ligneActive
import com.moziik.app.donnees.catalogue.motActif
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.lecteur.TitreLu
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.conteneur
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay

/** Après un défilement à la main, le suivi de la ligne chantée reprend seul au bout de 4 secondes (spécification 5.8). */
private const val REPRISE_SUIVI_MS = 4_000L

private sealed interface EtatParoles {
    data object Chargement : EtatParoles
    data class Erreur(val message: String) : EtatParoles
    data class Pretes(val paroles: Paroles) : EtatParoles
}

/** « Synchronisées » ou « Non synchronisées », comme le badge du site. */
@Composable
fun BadgeParoles(synchronisees: Boolean) {
    val p = LocalPalette.current
    Row(
        Modifier
            .clip(CircleShape)
            .background(if (synchronisees) p.accent.compose.copy(alpha = 0.12f) else p.surface.compose)
            .padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (synchronisees) {
            Icone(R.drawable.lucide_sparkles, description = null, teinte = p.accent.compose, taille = 11.dp)
            Spacer(Modifier.width(4.dp))
        }
        Text(
            if (synchronisees) "Synchronisées" else "Non synchronisées",
            style = Texte.secondaire.copy(fontSize = 10.sp, fontWeight = FontWeight.SemiBold),
            color = if (synchronisees) p.accent.compose else p.encreAttenuee.compose,
        )
    }
}

/**
 * Les paroles du titre en cours (LyricsPanel.tsx). Synchronisées, la ligne
 * chantée passe à l'accent et reste en vue ; un appui sur une ligne y
 * déplace la lecture. Le défilement suit la position du son : aucune
 * animation d'entrée ne s'y superpose.
 */
@Composable
fun PanneauParoles(courant: TitreLu, avancement: Avancement, onDeplacer: (Long) -> Unit, hauteur: Dp) {
    val c = conteneur()
    val p = LocalPalette.current
    var etat by remember(courant.id) { mutableStateOf<EtatParoles>(EtatParoles.Chargement) }
    LaunchedEffect(courant.id) {
        etat = try {
            EtatParoles.Pretes(c.catalogue.paroles(courant.id))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            EtatParoles.Erreur(messageErreur(e))
        }
    }

    Box(Modifier.fillMaxWidth().height(hauteur)) {
        when (val e = etat) {
            EtatParoles.Chargement -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 18.dp) }
            is EtatParoles.Erreur -> Indisponibles(e.message)
            is EtatParoles.Pretes -> if (e.paroles.vides) {
                Indisponibles("Aucune parole n'a encore été ajoutée à « ${courant.titre} »${courant.artiste?.let { " par $it" }.orEmpty()}.")
            } else {
                ListeParoles(e.paroles, avancement, onDeplacer)
            }
        }
    }
}

@Composable
private fun Indisponibles(texte: String) {
    val p = LocalPalette.current
    Column(
        Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(p.rayon.dp))
            .border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(p.rayon.dp))
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(Modifier.size(48.dp).clip(CircleShape).background(p.accent.compose.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) {
            Icone(R.drawable.lucide_mic_vocal, description = null, teinte = p.accent.compose, taille = 22.dp)
        }
        Spacer(Modifier.height(12.dp))
        Text("Paroles indisponibles", style = Texte.marque, color = p.encre.compose)
        Spacer(Modifier.height(4.dp))
        Text(texte, style = Texte.corps, color = p.encreAttenuee.compose, textAlign = TextAlign.Center)
    }
}

@Composable
private fun ListeParoles(paroles: Paroles, avancement: Avancement, onDeplacer: (Long) -> Unit) {
    val p = LocalPalette.current
    val seconde = avancement.positionMs / 1000.0
    val active = if (paroles.synchronisees) ligneActive(paroles.lignes, seconde) else -1
    val liste = rememberLazyListState()
    val glisse by liste.interactionSource.collectIsDraggedAsState()
    var suivi by remember { mutableStateOf(true) }
    var derniereMain by remember { mutableIntStateOf(0) }

    // Le doigt reprend la main : le suivi s'interrompt, puis reprend seul après 4 secondes sans toucher.
    LaunchedEffect(glisse) {
        if (glisse) {
            suivi = false
            derniereMain++
        }
    }
    LaunchedEffect(derniereMain, glisse) {
        if (!suivi && !glisse) {
            delay(REPRISE_SUIVI_MS)
            suivi = true
        }
    }
    // La ligne chantée est amenée au tiers haut de la zone (marge haute de la liste).
    LaunchedEffect(active, suivi) {
        if (suivi && active >= 0) liste.animateScrollToItem(active)
    }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icone(R.drawable.lucide_mic_vocal, description = null, teinte = p.accent.compose, taille = 14.dp)
            Spacer(Modifier.width(6.dp))
            Text("PAROLES", style = Texte.surtitre, color = p.encreAttenuee.compose)
            Spacer(Modifier.width(8.dp))
            BadgeParoles(paroles.synchronisees)
            Spacer(Modifier.weight(1f))
            if (paroles.synchronisees && !suivi) {
                Row(
                    Modifier
                        .clip(CircleShape)
                        .border(BorderStroke(1.dp, p.accent.compose.copy(alpha = 0.4f)), CircleShape)
                        .clickable(role = Role.Button) { suivi = true }
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icone(R.drawable.lucide_rotate_ccw, description = null, teinte = p.accent.compose, taille = 11.dp)
                    Spacer(Modifier.width(4.dp))
                    Text("Suivre", style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.accent.compose)
                }
            }
        }
        LazyColumn(
            Modifier.fillMaxWidth().weight(1f),
            state = liste,
            contentPadding = PaddingValues(top = if (paroles.synchronisees) 96.dp else 0.dp, bottom = 160.dp),
        ) {
            itemsIndexed(paroles.lignes) { i, ligne ->
                if (ligne.texte.isBlank()) {
                    Spacer(Modifier.height(14.dp))
                } else {
                    LigneChantee(ligne, i == active, if (i == active) motActif(ligne.mots, seconde) else -1, paroles.synchronisees, onDeplacer)
                }
            }
            paroles.credits?.let { credits ->
                item { Text("Transcription : $credits", style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 16.dp)) }
            }
        }
    }
}

@Composable
private fun LigneChantee(ligne: LigneParoles, active: Boolean, indexMot: Int, cliquable: Boolean, onDeplacer: (Long) -> Unit) {
    val p = LocalPalette.current
    val style = if (active) Texte.titreSection.copy(fontWeight = FontWeight.SemiBold) else Texte.corps.copy(fontSize = 15.sp, lineHeight = 22.sp)
    val couleur = if (active) p.accent.compose else p.encreAttenuee.compose
    val mots = ligne.mots
    // Le mot à mot ne s'affiche que sur la ligne chantée : les mots à venir restent estompés.
    val texte = if (active && mots != null && indexMot >= 0) {
        buildAnnotatedString {
            mots.forEachIndexed { i, mot ->
                withStyle(SpanStyle(color = if (i > indexMot) couleur.copy(alpha = 0.4f) else couleur)) { append(mot.texte) }
                if (i < mots.lastIndex) append(" ")
            }
        }
    } else {
        buildAnnotatedString { append(ligne.texte) }
    }
    val temps = ligne.temps
    Text(
        texte,
        style = style,
        color = couleur,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .then(if (cliquable && temps != null) Modifier.clickable(role = Role.Button, onClickLabel = "Reprendre la lecture à cette ligne") { onDeplacer((temps * 1000).toLong()) } else Modifier)
            .padding(horizontal = 4.dp, vertical = 5.dp),
    )
}
