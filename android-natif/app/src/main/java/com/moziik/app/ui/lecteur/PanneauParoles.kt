package com.moziik.app.ui.lecteur

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import com.moziik.app.theme.Mouvement
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
import kotlinx.coroutines.launch
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.rememberCoroutineScope
import com.moziik.app.donnees.reseau.ErreurApi
import com.moziik.app.ui.menus.fonctionIA
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.ui.platform.LocalContext

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
        // Le chargement cède la place aux paroles par un fondu, une fois par titre.
        androidx.compose.animation.Crossfade(etat, animationSpec = tween(Mouvement.VOILE), label = "paroles") { e -> when (e) {
            EtatParoles.Chargement -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 18.dp) }
            is EtatParoles.Erreur -> Indisponibles(e.message)
            is EtatParoles.Pretes -> if (e.paroles.vides) {
                Indisponibles("Aucune parole n'a encore été ajoutée à « ${courant.titre} »${courant.artiste?.let { " par $it" }.orEmpty()}.")
            } else {
                ListeParoles(e.paroles, avancement, onDeplacer, courant)
            }
        } }
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
private fun ListeParoles(paroles: Paroles, avancement: Avancement, onDeplacer: (Long) -> Unit, courant: TitreLu) {
    // Les lignes choisies pour un partage en image : un appui long ouvre le choix, au plus quatre lignes.
    var choix by remember(paroles) { mutableStateOf<Set<Int>>(emptySet()) }
    val contexte = LocalContext.current
    val p = LocalPalette.current
    val seconde = avancement.positionMs / 1000.0
    val active = if (paroles.synchronisees) ligneActive(paroles.lignes, seconde) else -1
    val liste = rememberLazyListState()
    val c = conteneur()
    val portee = rememberCoroutineScope()
    var langue by remember(paroles) { mutableStateOf("fr") }
    var traduite by remember(paroles) { mutableStateOf<List<String>?>(null) }
    var bloc by remember(paroles) { mutableStateOf<String?>(null) }
    var enTraduction by remember(paroles) { mutableStateOf(false) }
    var erreurTraduction by remember(paroles) { mutableStateOf<String?>(null) }
    val traduire: () -> Unit = {
        if (!enTraduction) {
            enTraduction = true
            erreurTraduction = null
            portee.launch {
                try {
                    // Une ligne par ligne, vides comprises : l'alignement se vérifie au retour.
                    val lignes = c.ia.traduire(paroles.lignes.joinToString("\n") { it.texte }, langue).split("\n")
                    if (lignes.size == paroles.lignes.size) traduite = lignes else bloc = lignes.joinToString("\n")
                } catch (e: CancellationException) {
                    throw e
                } catch (e: ErreurApi) {
                    erreurTraduction = when (e.statut) {
                        401 -> "Connecte-toi pour traduire les paroles."
                        501 -> "La traduction n'est pas disponible pour le moment."
                        else -> messageErreur(e)
                    }
                } catch (e: Exception) {
                    erreurTraduction = messageErreur(e)
                }
                enTraduction = false
            }
        }
    }
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
        if (choix.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "${choix.size} ligne${if (choix.size > 1) "s" else ""} sur $LIGNES_PARTAGE_MAX",
                    style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.encreAttenuee.compose, modifier = Modifier.weight(1f),
                )
                Text(
                    "Annuler",
                    style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.encreAttenuee.compose,
                    modifier = Modifier.clip(CircleShape).clickable(role = Role.Button) { choix = emptySet() }.padding(horizontal = 10.dp, vertical = 6.dp),
                )
                Spacer(Modifier.width(6.dp))
                Row(
                    Modifier
                        .clip(CircleShape)
                        .background(p.accent.compose)
                        .clickable(role = Role.Button) {
                            val lignes = choix.sorted().map { i -> traduite?.getOrNull(i) ?: paroles.lignes[i].texte }
                            choix = emptySet()
                            c.portee.launch {
                                com.moziik.app.ui.partagerParolesEnImage(contexte, courant.id, courant.titre, courant.artiste, courant.pochette, lignes, p.accent.compose)
                            }
                        }
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icone(R.drawable.lucide_share_2, description = null, teinte = p.base.compose, taille = 13.dp)
                    Spacer(Modifier.width(6.dp))
                    Text("Partager en image", style = Texte.secondaire.copy(fontWeight = FontWeight.SemiBold), color = p.base.compose)
                }
            }
        }
        if (choix.isEmpty()) Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
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
        if (fonctionIA("traduction")) Traduction(langue, traduite != null || bloc != null, enTraduction, erreurTraduction, onLangue = {
            langue = it
            traduite = null
            bloc = null
        }, onBasculer = {
            if (traduite != null || bloc != null) {
                traduite = null
                bloc = null
            } else {
                traduire()
            }
        })
        val texteBloc = bloc
        if (texteBloc != null) {
            // Traduction non alignée ligne à ligne : affichée d'un bloc, sans suivi (5.8).
            Text(
                texteBloc, style = Texte.corps.copy(fontSize = 15.sp, lineHeight = 22.sp), color = p.encre.compose,
                modifier = Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()),
            )
            return@Column
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
                    // Une ligne traduite remplace l'originale, sans mot à mot : ses instants sont ceux des mots d'origine.
                    val traduction = traduite?.getOrNull(i)
                    LigneChantee(
                        if (traduction != null) ligne.copy(texte = traduction, mots = null) else ligne,
                        i == active,
                        if (i == active && traduction == null) motActif(ligne.mots, seconde) else -1,
                        passee = active >= 0 && i < active,
                        paroles.synchronisees && choix.isEmpty(),
                        onDeplacer,
                        choisie = i in choix,
                        enChoix = choix.isNotEmpty(),
                        onChoisir = {
                            suivi = false
                            choix = when {
                                i in choix -> choix - i
                                choix.size >= LIGNES_PARTAGE_MAX -> choix
                                else -> choix + i
                            }
                        },
                    )
                }
            }
            paroles.credits?.let { credits ->
                item { Text("Transcription : $credits", style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 16.dp)) }
            }
        }
    }
}

/** Au-delà de quatre lignes, l'extrait devient un pavé illisible sur une story. */
private const val LIGNES_PARTAGE_MAX = 4

/** Les langues de traduction du site (5.8), avec leur nom dans leur langue. */
private val LANGUES = listOf("fr" to "Français", "en" to "English", "mg" to "Malagasy")

@Composable
private fun Traduction(langue: String, traduit: Boolean, enCours: Boolean, erreur: String?, onLangue: (String) -> Unit, onBasculer: () -> Unit) {
    val p = LocalPalette.current
    Row(Modifier.fillMaxWidth().padding(bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        LANGUES.forEach { (code, nom) ->
            Text(
                nom,
                style = Texte.secondaire.copy(fontSize = 11.sp, fontWeight = FontWeight.Medium),
                color = if (code == langue) p.accent.compose else p.encreAttenuee.compose,
                modifier = Modifier
                    .clip(CircleShape)
                    .clickable(role = Role.Tab) { onLangue(code) }
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }
        Spacer(Modifier.weight(1f))
        Row(
            Modifier
                .clip(CircleShape)
                .border(BorderStroke(1.dp, p.bordure.compose), CircleShape)
                .clickable(role = Role.Button, enabled = !enCours, onClick = onBasculer)
                .padding(horizontal = 10.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (enCours) {
                Egaliseur(hauteur = 10.dp, libelle = "Traduction en cours")
            } else {
                Icone(R.drawable.lucide_sparkles, description = null, teinte = p.accent.compose, taille = 11.dp)
            }
            Spacer(Modifier.width(4.dp))
            Text(if (traduit) "Version originale" else "Traduire", style = Texte.secondaire.copy(fontSize = 11.sp, fontWeight = FontWeight.Medium), color = p.encre.compose)
        }
    }
    erreur?.let { Text(it, style = Texte.secondaire, color = p.danger.compose, modifier = Modifier.padding(bottom = 6.dp)) }
}

@Composable
@OptIn(ExperimentalFoundationApi::class)
private fun LigneChantee(
    ligne: LigneParoles,
    active: Boolean,
    indexMot: Int,
    passee: Boolean,
    cliquable: Boolean,
    onDeplacer: (Long) -> Unit,
    choisie: Boolean = false,
    enChoix: Boolean = false,
    onChoisir: () -> Unit = {},
) {
    val p = LocalPalette.current
    // Une seule taille de texte pour toutes les lignes : la ligne chantée grandit par échelle, sans
    // changer la mise en page, et la liste ne saute pas à chaque changement de ligne.
    val style = Texte.corps.copy(fontSize = 16.sp, lineHeight = 24.sp, fontWeight = FontWeight.SemiBold)
    val cible = when {
        active -> p.accent.compose
        // Déjà chantée : lisible, mais en retrait de celle qui vient.
        passee -> p.encre.compose.copy(alpha = 0.45f)
        else -> p.encreAttenuee.compose
    }
    val couleur by animateColorAsState(cible, tween(Mouvement.VOILE), label = "couleur-ligne")
    val echelle by animateFloatAsState(if (active) 1.08f else 1f, tween(Mouvement.TIROIR, easing = Mouvement.sortieDouce), label = "echelle-ligne")
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
            .graphicsLayer {
                scaleX = echelle
                scaleY = echelle
                transformOrigin = TransformOrigin(0f, 0.5f)
            }
            .fillMaxWidth()
            .padding(end = 12.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(if (choisie) p.accent.compose.copy(alpha = 0.14f) else androidx.compose.ui.graphics.Color.Transparent)
            // Appui long : choisir des lignes à partager ; pendant le choix, un toucher ajoute ou retire.
            .combinedClickable(
                role = Role.Button,
                onClickLabel = if (enChoix) "Choisir cette ligne" else if (cliquable && temps != null) "Reprendre la lecture à cette ligne" else null,
                onLongClickLabel = "Partager des lignes en image",
                onLongClick = onChoisir,
                onClick = {
                    when {
                        enChoix -> onChoisir()
                        cliquable && temps != null -> onDeplacer((temps * 1000).toLong())
                    }
                },
            )
            .padding(horizontal = 4.dp, vertical = 5.dp),
    )
}
