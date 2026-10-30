package com.moziik.app.ui.selections

import com.moziik.app.ui.composants.entree
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.DetailSelection
import com.moziik.app.donnees.catalogue.SelectionPerso
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LigneTitre
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.fiches.BarreCollante
import com.moziik.app.ui.fiches.BoutonFiche
import com.moziik.app.ui.fiches.ContenuFiche
import com.moziik.app.ui.fiches.EnTeteFiche
import com.moziik.app.ui.fiches.ModeleFiche
import com.moziik.app.ui.fiches.SectionFiche
import com.moziik.app.ui.fiches.dureeTotale
import com.moziik.app.ui.fiches.nombre
import com.moziik.app.ui.menus.LocalMenus
import com.moziik.app.ui.navigation
import kotlinx.coroutines.launch

/*
 * Les sélections personnelles du site (Mix du jour, Découvertes de la
 * semaine, Radar des sorties), dans l'application : mêmes données, mêmes
 * pochettes dessinées (components/selections/PochetteSelection.tsx).
 * Une pochette est un objet : ses couleurs ne suivent pas le thème.
 */

/** Une couleur par numéro de mix, la même que sur le site : on reconnaît son Mix 2. */
private val COULEURS_MIX = listOf(0xFFA78BFA, 0xFF38BDF8, 0xFF34D399, 0xFFFBBF24, 0xFFF472B6, 0xFF22D3EE).map { Color(it) }
private val ORANGE = Color(0xFFF84A26)
private val NUIT = Color(0xFF111827)
private val ENCRE_POCHETTE = Color(0xFF0D0F1A)

@Composable
fun PochetteSelection(s: SelectionPerso, personnel: Boolean, modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier.aspectRatio(1f).clip(RoundedCornerShape(6.dp))) {
        // Les textes suivent la taille de la pochette : la même sert en vignette et en en-tête.
        val unite = maxWidth / 10
        when (s.type) {
            "decouvertes" -> Box(Modifier.fillMaxSize().background(ORANGE).padding(unite * 0.8f)) {
                Icone(R.drawable.lucide_sparkles, description = null, teinte = ENCRE_POCHETTE, taille = unite * 2.2f, modifier = Modifier.align(Alignment.TopEnd))
                TexteGrand("Découvertes de la semaine", unite, ENCRE_POCHETTE, Modifier.align(Alignment.BottomStart))
            }
            "radar" -> Box(Modifier.fillMaxSize().background(NUIT).padding(unite * 0.8f)) {
                Box(
                    Modifier.align(Alignment.TopEnd).offset(x = unite * 2.5f, y = -unite * 2.5f).size(unite * 9f)
                        .border(2.dp, ORANGE.copy(alpha = 0.7f), CircleShape),
                )
                Box(
                    Modifier.align(Alignment.TopEnd).offset(x = unite * 0.5f, y = -unite * 0.5f).size(unite * 5f)
                        .border(2.dp, ORANGE.copy(alpha = 0.9f), CircleShape),
                )
                Icone(R.drawable.lucide_radio, description = null, teinte = ORANGE, taille = unite * 1.8f, modifier = Modifier.align(Alignment.TopEnd))
                TexteGrand("Radar des sorties", unite, Color.White, Modifier.align(Alignment.BottomStart))
            }
            else -> {
                val couleur = COULEURS_MIX[(maxOf(1, s.rang) - 1) % COULEURS_MIX.size]
                Box(Modifier.fillMaxSize().background(Color(0xFF1F2433))) {
                    if (s.couverture != null) Pochette(s.couverture, Modifier.fillMaxSize(), RoundedCornerShape(0.dp))
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.5f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.45f))))
                    Box(Modifier.padding(top = unite * 0.6f).width(unite * 1.4f).size(width = unite * 1.4f, height = unite * 0.3f).background(couleur))
                    Row(
                        Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(unite * 0.6f),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Bottom,
                    ) {
                        Text(
                            if (personnel) "Mix du jour" else s.genre ?: "Mix",
                            style = Texte.marque.copy(fontSize = (unite.value * 0.95f).sp, lineHeight = (unite.value * 1.05f).sp, fontWeight = FontWeight.Bold),
                            color = ENCRE_POCHETTE,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false).background(couleur).padding(horizontal = unite * 0.3f),
                        )
                        Text(
                            s.rang.toString().padStart(2, '0'),
                            style = Texte.marque.copy(fontSize = (unite.value * 2.2f).sp, lineHeight = (unite.value * 2.2f).sp, fontWeight = FontWeight.Bold),
                            color = ENCRE_POCHETTE,
                            modifier = Modifier.padding(start = unite * 0.3f).background(couleur).padding(horizontal = unite * 0.3f),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TexteGrand(texte: String, unite: Dp, couleur: Color, modifier: Modifier) {
    Text(
        texte,
        style = Texte.titreFiche.copy(fontSize = (unite.value * 1.55f).sp, lineHeight = (unite.value * 1.5f).sp, fontWeight = FontWeight.Bold),
        color = couleur,
        modifier = modifier,
    )
}

/**
 * La rangée « Conçu pour » de l'accueil : une ligne qui défile de côté.
 * Elle se tait tant qu'elle n'a rien (chargement, réseau absent) plutôt que
 * d'occuper l'accueil avec des squelettes.
 */
@Composable
fun RangeeSelections(modifier: Modifier = Modifier) {
    val c = conteneur()
    val p = LocalPalette.current
    val session by c.session.etat.collectAsStateWithLifecycle()
    val connecte = session is EtatSession.Connecte
    val selections by produceState<List<SelectionPerso>?>(null, connecte) {
        value = runCatching { c.catalogue.selections() }.getOrNull()
    }
    val liste = selections?.takeIf { it.isNotEmpty() } ?: return
    val nom = (session as? EtatSession.Connecte)?.utilisateur?.name

    Column(modifier) {
        Text(if (connecte) "Conçu pour" else "Pour bien commencer", style = Texte.secondaire, color = p.encreAttenuee.compose)
        Text(if (connecte) nom ?: "vous" else "Les mix Moziik", style = Texte.titreFiche, color = p.encre.compose)
        LazyRow(
            Modifier.padding(top = 12.dp),
            contentPadding = PaddingValues(end = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(liste, key = { it.cle }) { s -> CarteSelection(s, connecte) }
        }
    }
}

@Composable
private fun CarteSelection(s: SelectionPerso, personnel: Boolean) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val portee = rememberCoroutineScope()
    var chargement by remember { mutableStateOf(false) }
    Column(Modifier.width(148.dp).clip(RoundedCornerShape(8.dp)).clickable(role = Role.Button, onClickLabel = "Ouvrir ${s.titre}") { nav.selection(s.cle) }) {
        Box {
            PochetteSelection(s, personnel, Modifier.fillMaxWidth())
            // Lancer sans ouvrir : comme le bouton qui monte de la pochette sur le site.
            Box(
                Modifier.align(Alignment.BottomEnd).padding(6.dp).size(38.dp).clip(CircleShape).background(p.accent.compose)
                    .clickable(role = Role.Button, onClickLabel = "Écouter ${s.titre}", enabled = !chargement) {
                        chargement = true
                        portee.launch {
                            runCatching { c.catalogue.selection(s.cle) }
                                .onSuccess { d -> if (d.titres.isNotEmpty()) c.lecteur.lire(d.titres, 0, s.titre) }
                                .onFailure { c.alertes.signaler(AlerteLecture.Message("La sélection n'a pas pu être chargée.")) }
                            chargement = false
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                Icone(R.drawable.lucide_play_plein, description = null, teinte = p.base.compose, taille = 16.dp)
            }
        }
        Text(s.titre, style = Texte.corpsFort, color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 8.dp))
        Text(s.description, style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

/** L'écran d'une sélection : l'en-tête des fiches, la pochette dessinée, puis ses titres. */
@Composable
fun EcranSelection(cle: String, onRetour: () -> Unit) {
    val c = conteneur()
    val modele: ModeleFiche<DetailSelection> = viewModel(key = "selection-$cle") { ModeleFiche { c.catalogue.selection(cle) } }
    val etat by modele.etat.collectAsStateWithLifecycle()
    ContenuFiche(etat, modele::recharger) { detail -> CorpsSelection(detail, onRetour) }
}

@Composable
private fun CorpsSelection(detail: DetailSelection, onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val menus = LocalMenus.current
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    val session by c.session.etat.collectAsStateWithLifecycle()
    val connecte = session is EtatSession.Connecte
    val s = detail.selection
    val titres = detail.titres
    val liste = rememberLazyListState()

    LazyColumn(Modifier.fillMaxSize(), state = liste, contentPadding = PaddingValues(bottom = 32.dp)) {
        item(key = "retour") { BarreCollante(onRetour, s.titre, liste) }
        item(key = "entete") {
            EnTeteFiche(
                pochette = null,
                banniere = s.couverture,
                type = if (s.type == "mix") (if (connecte) "Mix personnel" else "Mix") else "Playlist",
                titre = s.titre,
                sousTitre = s.description.takeIf { it.isNotBlank() }?.let { { Text(it, style = Texte.corps, color = p.encreAttenuee.compose) } },
                pastilles = listOfNotNull(nombre(titres.size, "titre"), titres.sumOf { it.duration }.takeIf { it > 0 }?.let(::dureeTotale)),
                pochetteDessinee = { PochetteSelection(s, connecte, Modifier.fillMaxSize()) },
            ) {
                if (titres.isNotEmpty()) {
                    BoutonFiche(R.drawable.lucide_play_plein, "Tout écouter", onClick = { c.lecteur.lire(titres, 0, s.titre) }, principal = true)
                    BoutonFiche(R.drawable.lucide_shuffle, null, onClick = { c.lecteur.lire(titres.shuffled(), 0, s.titre) }, description = "Lecture aléatoire")
                }
            }
        }
        if (titres.isNotEmpty()) item(key = "titres") { SectionFiche("Titres") {} }
        itemsIndexed(titres, key = { i, t -> "titre-$i-${t.id}" }) { i, titre ->
            LigneTitre(
                titre, i + 1, titre.id == lecture.courant?.id, lecture.enLecture,
                onClick = { c.lecteur.lire(titres, i, s.titre) },
                modifier = Modifier.padding(horizontal = 12.dp).entree(i),
                onAppuiLong = { menus.titre(titre, s.titre) },
            )
        }
    }
}
