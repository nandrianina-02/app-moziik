package com.moziik.app.ui.bienvenue

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.moziik.app.R
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Mouvement
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LogoMoziik
import com.moziik.app.ui.composants.apparition
import com.moziik.app.ui.conteneur
import kotlinx.coroutines.launch

/** Au plus cinq genres : au-delà, le choix ne trie plus rien. */
private const val GENRES_MAX = 5

/**
 * Le premier lancement : l'univers musical puis quelques genres, pour que
 * l'accueil et « Pour toi » soient justes dès la première ouverture. Trois
 * écrans courts, chacun passable ; rien n'est obligatoire, tout se change
 * ensuite dans les paramètres.
 */
@Composable
fun EcranBienvenue(onFini: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    var etape by rememberSaveable { mutableIntStateOf(0) }
    var univers by rememberSaveable { mutableStateOf<String?>(null) }
    val genres by c.reglages.genresPreferes.collectAsStateWithLifecycle()
    val session by c.session.etat.collectAsStateWithLifecycle()

    val terminer: () -> Unit = {
        univers?.let { u ->
            c.reglages.universVisiteur = u
            // Un compte déjà connecté garde son choix sur le site, comme depuis les préférences.
            if (session is EtatSession.Connecte) c.portee.launch { runCatching { c.compte.changerUnivers(u) } }
            c.catalogue.preferencesChangees()
        }
        c.reglages.terminerAccueil()
        onFini()
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(p.base.compose)
            .windowInsetsPadding(WindowInsets.statusBars)
            .windowInsetsPadding(WindowInsets.navigationBars)
            .padding(horizontal = 24.dp, vertical = 16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            LogoMoziik(hauteur = 22.dp)
            Spacer(Modifier.weight(1f))
            if (etape < 2) {
                Text(
                    "Passer",
                    style = Texte.corps.copy(fontWeight = FontWeight.Medium),
                    color = p.encreAttenuee.compose,
                    modifier = Modifier.clip(CircleShape).clickable(role = Role.Button, onClick = terminer).padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
        }
        // Les étapes avancent de droite à gauche, en fondu court.
        AnimatedContent(
            targetState = etape,
            transitionSpec = {
                (slideInHorizontally(tween(Mouvement.ENTREE_PAGE, easing = Mouvement.sortieDouce)) { it / 8 } + fadeIn(tween(Mouvement.ENTREE_PAGE)))
                    .togetherWith(fadeOut(tween(Mouvement.VOILE / 2)))
            },
            modifier = Modifier.weight(1f),
            label = "etape",
        ) { e ->
            when (e) {
                0 -> EtapeAccueil()
                1 -> EtapeUnivers(univers) { univers = it }
                else -> EtapeGenres(genres) { c.reglages.choisirGenres(it) }
            }
        }
        Indicateur(etape)
        Spacer(Modifier.height(16.dp))
        BoutonPrincipal(
            when (etape) {
                0 -> "Commencer"
                1 -> "Continuer"
                else -> if (genres.isEmpty()) "Découvrir sans choisir" else "Découvrir Moziik"
            },
            onClick = { if (etape < 2) etape++ else terminer() },
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun EtapeAccueil() {
    val p = LocalPalette.current
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center) {
        LogoMoziik(hauteur = 44.dp, anime = true, modifier = Modifier.apparition(0))
        Spacer(Modifier.height(28.dp))
        Text("Bienvenue sur Moziik", style = Texte.titreFiche.copy(fontSize = Texte.titreFiche.fontSize * 1.3f), color = p.encre.compose, modifier = Modifier.apparition(1))
        Spacer(Modifier.height(10.dp))
        Text(
            "Deux questions rapides pour que l'accueil vous ressemble dès maintenant. Tout se change ensuite dans les paramètres.",
            style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.apparition(2),
        )
    }
}

@Composable
private fun EtapeUnivers(choisi: String?, onChoisir: (String) -> Unit) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxSize().padding(top = 32.dp)) {
        Text("Quelle musique écoutez-vous ?", style = Texte.titreFiche, color = p.encre.compose, modifier = Modifier.apparition(0))
        Spacer(Modifier.height(6.dp))
        Text("L'accueil, la recherche et la radio suivent ce choix.", style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.apparition(1))
        Spacer(Modifier.height(24.dp))
        CarteUnivers(R.drawable.lucide_music_2, "Général", "Tout le catalogue de Moziik", choisi == "general", Modifier.apparition(2)) { onChoisir("general") }
        Spacer(Modifier.height(12.dp))
        CarteUnivers(R.drawable.lucide_sparkles, "Évangélique", "Musique chrétienne et gospel", choisi == "christian", Modifier.apparition(3)) { onChoisir("christian") }
    }
}

@Composable
private fun CarteUnivers(icone: Int, titre: String, detail: String, choisie: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val p = LocalPalette.current
    val forme = RoundedCornerShape(p.rayon.dp)
    Row(
        modifier
            .fillMaxWidth()
            .clip(forme)
            .border(BorderStroke(if (choisie) 2.dp else 1.dp, if (choisie) p.accent.compose else p.bordure.compose), forme)
            .background(if (choisie) p.accent.compose.copy(alpha = 0.08f) else p.surface.compose)
            .clickable(role = Role.RadioButton, onClick = onClick)
            .semantics { selected = choisie }
            .padding(18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(44.dp).clip(CircleShape).background(p.accent.compose.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
            Icone(icone, description = null, teinte = p.accent.compose, taille = 22.dp)
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(titre, style = Texte.titreSection, color = p.encre.compose)
            Text(detail, style = Texte.secondaire, color = p.encreAttenuee.compose)
        }
        if (choisie) Icone(R.drawable.lucide_check, description = "Choisi", teinte = p.accent.compose, taille = 20.dp)
    }
}

@Composable
private fun EtapeGenres(choisis: Set<String>, onChanger: (Set<String>) -> Unit) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxSize().padding(top = 32.dp)) {
        Text("Vos genres", style = Texte.titreFiche, color = p.encre.compose, modifier = Modifier.apparition(0))
        Spacer(Modifier.height(6.dp))
        Text(
            "Jusqu'à $GENRES_MAX. Leurs sélections passent en tête de l'accueil.",
            style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.apparition(1),
        )
        Spacer(Modifier.height(20.dp))
        ChoixGenres(choisis, onChanger, Modifier.weight(1f).apparition(2))
    }
}

/** Les genres du catalogue en pastilles : partagé avec les paramètres. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ChoixGenres(choisis: Set<String>, onChanger: (Set<String>) -> Unit, modifier: Modifier = Modifier) {
    val c = conteneur()
    val p = LocalPalette.current
    var genres by remember { mutableStateOf<List<String>?>(null) }
    var echec by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        runCatching { c.catalogue.genres() }
            .onSuccess { liste -> genres = liste.filter { it.isNotBlank() && it.lowercase() !in setOf("autre", "divers") } }
            .onFailure { echec = true }
    }
    val liste = genres
    when {
        echec -> Text("Les genres se chargeront avec le réseau. Vous pourrez les choisir dans les paramètres.", style = Texte.corps, color = p.encreAttenuee.compose, modifier = modifier)
        liste == null -> Box(modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.TopCenter) { Egaliseur(hauteur = 16.dp) }
        else -> FlowRow(
            modifier.verticalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            liste.forEach { g ->
                val actif = g in choisis
                val complet = !actif && choisis.size >= GENRES_MAX
                Row(
                    Modifier
                        .clip(CircleShape)
                        .border(BorderStroke(1.dp, if (actif) p.accent.compose else p.bordure.compose), CircleShape)
                        .background(if (actif) p.accent.compose.copy(alpha = 0.12f) else p.surface.compose)
                        .clickable(enabled = !complet, role = Role.Checkbox) { onChanger(if (actif) choisis - g else choisis + g) }
                        .semantics { selected = actif }
                        .padding(horizontal = 14.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (actif) {
                        Icone(R.drawable.lucide_check, description = null, teinte = p.accent.compose, taille = 14.dp)
                        Spacer(Modifier.width(6.dp))
                    }
                    Text(
                        g,
                        style = Texte.corps.copy(fontWeight = FontWeight.Medium),
                        color = when {
                            actif -> p.accent.compose
                            complet -> p.encreAttenuee.compose.copy(alpha = 0.5f)
                            else -> p.encre.compose
                        },
                    )
                }
            }
        }
    }
}

/** Trois traits, le courant à l'accent et plus long. */
@Composable
private fun Indicateur(etape: Int) {
    val p = LocalPalette.current
    Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally)) {
        repeat(3) { i ->
            Box(
                Modifier
                    .height(4.dp)
                    .width(if (i == etape) 22.dp else 8.dp)
                    .clip(CircleShape)
                    .background(if (i == etape) p.accent.compose else p.bordure.compose),
            )
        }
    }
}
