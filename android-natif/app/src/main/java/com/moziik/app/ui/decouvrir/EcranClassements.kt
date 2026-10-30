@file:OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)

package com.moziik.app.ui.decouvrir

import com.moziik.app.ui.composants.entree
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.Catalogue
import com.moziik.app.donnees.catalogue.Classement
import com.moziik.app.donnees.catalogue.EntreeClassement
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.MessageErreur
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.Puce
import com.moziik.app.ui.composants.pressable
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.fiches.BarreRetour
import com.moziik.app.ui.navigation
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale
import com.moziik.app.ui.composants.LogoMoziik
import com.moziik.app.ui.horsligne.PastilleTelechargement
import com.moziik.app.ui.composants.SqueletteListe
import androidx.compose.foundation.lazy.rememberLazyListState
import com.moziik.app.ui.fiches.BarreCollante

/** Les onglets du site (app/classements/page.tsx), dans son ordre et avec ses libellés. */
enum class TypeClassement(val cle: String, val libelle: String) {
    TITRES("songs", "Sons"),
    ARTISTES("artists", "Artistes"),
    ALBUMS("albums", "Albums"),
    AUDITEURS("listeners", "Auditeurs"),
}

enum class Periode(val cle: String, val libelle: String) {
    JOUR("day", "Aujourd'hui"),
    SEMAINE("week", "Semaine"),
    MOIS("month", "Mois"),
    ANNEE("year", "Année"),
    TOUT("all", "Tout"),
}

/** « 12 345 » : les nombres à la française. */
fun nombreFr(n: Int): String = NumberFormat.getIntegerInstance(Locale.FRANCE).format(n)

data class EtatClassements(
    val classement: Classement? = null,
    val chargement: Boolean = true,
    val erreur: String? = null,
    /** Gardés d'un chargement à l'autre : la rangée de genres ne clignote pas quand on en change. */
    val genres: List<String> = emptyList(),
)

class ModeleClassements(private val catalogue: Catalogue, type: String?, periode: String?) : ViewModel() {
    // Le site ne valide pas ces paramètres : une valeur inconnue retombe sur le défaut (D8).
    val type = MutableStateFlow(TypeClassement.entries.firstOrNull { it.cle == type } ?: TypeClassement.TITRES)
    val periode = MutableStateFlow(Periode.entries.firstOrNull { it.cle == periode } ?: Periode.SEMAINE)
    val genre = MutableStateFlow<String?>(null)
    private val _etat = MutableStateFlow(EtatClassements())
    val etat: StateFlow<EtatClassements> = _etat.asStateFlow()

    init {
        viewModelScope.launch {
            combine(this@ModeleClassements.type, this@ModeleClassements.periode, genre) { t, p, g -> Triple(t, p, g) }
                .collectLatest { (t, p, g) ->
                    _etat.value = _etat.value.copy(chargement = true, erreur = null)
                    _etat.value = try {
                        val c = catalogue.classement(p.cle, t.cle, g)
                        EtatClassements(c, chargement = false, genres = c.genres.ifEmpty { _etat.value.genres })
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        _etat.value.copy(chargement = false, erreur = messageErreur(e))
                    }
                }
        }
    }
}

/** Couleurs des médailles du podium, fixes comme sur le site (or, argent, bronze). */
private val MEDAILLES = listOf(Color(0xFFF5C542), Color(0xFFC7C7C7), Color(0xFFC08A50))

/**
 * Les classements (D8) : titres, artistes, albums ou auditeurs, sur une
 * période, filtrés par genre. Podium, tendance de la période, la place de
 * l'auditeur connecté, puis le reste du top 20.
 */
@Composable
fun EcranClassements(type: String?, periode: String?, onRetour: () -> Unit) {
    val c = conteneur()
    val modele: ModeleClassements = viewModel { ModeleClassements(c.catalogue, type, periode) }
    val typeChoisi by modele.type.collectAsStateWithLifecycle()
    val periodeChoisie by modele.periode.collectAsStateWithLifecycle()
    val genre by modele.genre.collectAsStateWithLifecycle()
    val etat by modele.etat.collectAsStateWithLifecycle()
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    val nav = navigation()
    val p = LocalPalette.current

    val classement = etat.classement
    val places = classement?.ranking.orEmpty()
    val titres = remember(places) { places.mapNotNull { it.versTitre() } }
    val ouvrir: (EntreeClassement) -> Unit = { e ->
        when (typeChoisi) {
            TypeClassement.TITRES -> {
                val i = titres.indexOfFirst { it.id == e.id }
                if (i >= 0) c.lecteur.lire(titres, i, "Classement · ${periodeChoisie.libelle}")
            }
            TypeClassement.ARTISTES -> nav.artiste(e.id)
            TypeClassement.ALBUMS -> nav.album(e.id)
            // Les auditeurs n'ont pas de page publique accessible par leur identifiant.
            TypeClassement.AUDITEURS -> Unit
        }
    }

    val liste = rememberLazyListState()
    LazyColumn(Modifier.fillMaxSize(), state = liste, contentPadding = PaddingValues(bottom = 32.dp)) {
        stickyHeader(key = "retour") { BarreCollante(onRetour, "Classements", liste) }
        item(key = "titre") {
            Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp)) {
                Text("Classements", style = Texte.titreFiche, color = p.encre.compose)
                Text("Les contenus les plus populaires sur Moziik", style = Texte.corps, color = p.encreAttenuee.compose)
            }
        }
        // Les filtres restent sous la barre : on change de période sans remonter en haut du classement.
        stickyHeader(key = "filtres") {
            Column(Modifier.background(p.base.compose).padding(top = 16.dp, bottom = 8.dp)) {
                RangeePuces(TypeClassement.entries.map { it.libelle }, TypeClassement.entries.indexOf(typeChoisi)) { modele.type.value = TypeClassement.entries[it] }
                Spacer(Modifier.height(8.dp))
                RangeePuces(Periode.entries.map { it.libelle }, Periode.entries.indexOf(periodeChoisie)) { modele.periode.value = Periode.entries[it] }
                if (etat.genres.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    val choix = listOf("Tous les genres") + etat.genres
                    RangeePuces(choix, genre?.let { etat.genres.indexOf(it) + 1 } ?: 0) { i -> modele.genre.value = if (i == 0) null else etat.genres[i - 1] }
                }
            }
        }
        etat.erreur?.let { message -> item(key = "erreur") { MessageErreur(message, Modifier.padding(16.dp)) } }
        when {
            etat.chargement && classement == null -> item(key = "attente") {
                SqueletteListe(8, Modifier.padding(top = 8.dp))
            }
            classement != null -> {
                classement.viewer?.let { place -> item(key = "auditeur") { VotreClassement(place.rank, place.plays, place.evolution, place.toNextMilestone) } }
                item(key = "podium") { Podium(places.take(3), typeChoisi, lecture.courant?.id, ouvrir) }
                item(key = "tendance") { Tendance(classement.trendPct, classement.totalPlays) }
                val maxEcoutes = places.maxOfOrNull { it.plays } ?: 0
                itemsIndexed(places.drop(3), key = { _, e -> "place-${e.id}" }) { i, e ->
                    Box(Modifier.entree(i + 1)) {
                        LignePlace(e, typeChoisi, maxEcoutes, periodeChoisie != Periode.TOUT, e.id == lecture.courant?.id) { ouvrir(e) }
                    }
                }
            }
        }
    }
}

@Composable
private fun RangeePuces(libelles: List<String>, actif: Int, onChoisir: (Int) -> Unit) {
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        itemsIndexed(libelles) { i, libelle -> Puce(libelle, i == actif) { onChoisir(i) } }
    }
}

/** Le cadre des blocs du haut (podium, tendance, votre place). */
@Composable
private fun Bloc(contenu: @Composable () -> Unit) {
    val p = LocalPalette.current
    val forme = RoundedCornerShape(p.rayon.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .padding(start = 16.dp, end = 16.dp, top = 16.dp)
            .clip(forme)
            .border(BorderStroke(1.dp, p.bordure.compose), forme)
            .background(p.surface.compose)
            .padding(16.dp),
    ) { contenu() }
}

@Composable
private fun VotreClassement(rang: Int, ecoutes: Int, evolution: Int?, avantTop100: Int) {
    val p = LocalPalette.current
    Bloc {
        Text("Votre classement", style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.accent.compose)
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Rang : #$rang", style = Texte.titreSection, color = p.encre.compose)
            Spacer(Modifier.width(10.dp))
            Evolution(evolution, true)
        }
        Text("${nombreFr(ecoutes)} écoutes", style = Texte.secondaire, color = p.encreAttenuee.compose)
        if (rang > 100 && avantTop100 > 0) {
            Spacer(Modifier.height(10.dp))
            Text(
                "Encore $avantTop100 écoute${if (avantTop100 > 1) "s" else ""} pour entrer dans le Top 100",
                style = Texte.secondaire, color = p.encreAttenuee.compose,
            )
            Spacer(Modifier.height(6.dp))
            BarreProportion(ecoutes.toFloat() / (ecoutes + avantTop100))
        } else if (rang <= 100) {
            Spacer(Modifier.height(8.dp))
            Text("Vous êtes dans le Top 100", style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.verifie.compose)
        }
    }
}

@Composable
private fun BarreProportion(fraction: Float, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    Box(modifier.fillMaxWidth().height(6.dp).clip(CircleShape).background(p.base.compose)) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).height(6.dp).clip(CircleShape).background(p.accent.compose))
    }
}

@Composable
private fun Podium(trois: List<EntreeClassement>, type: TypeClassement, enCours: String?, ouvrir: (EntreeClassement) -> Unit) {
    val p = LocalPalette.current
    Bloc {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icone(R.drawable.lucide_trophy, description = null, teinte = p.alerte.compose, taille = 16.dp)
            Spacer(Modifier.width(6.dp))
            Text("Top 3", style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose)
        }
        Spacer(Modifier.height(12.dp))
        if (trois.isEmpty()) {
            Text("Pas encore assez d'écoutes sur cette période.", style = Texte.corps, color = p.encreAttenuee.compose)
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                trois.forEachIndexed { i, e ->
                    Box(
                        Modifier
                            .weight(1f)
                            .aspectRatio(3f / 4f)
                            .clip(RoundedCornerShape(p.rayon.dp))
                            .then(if (e.id == enCours) Modifier.border(BorderStroke(2.dp, p.accent.compose), RoundedCornerShape(p.rayon.dp)) else Modifier)
                            .pressable { ouvrir(e) },
                    ) {
                        Pochette(e.image, Modifier.fillMaxSize(), RoundedCornerShape(0.dp))
                        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.3f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.85f))))
                        Box(
                            Modifier.padding(8.dp).size(26.dp).clip(CircleShape).background(MEDAILLES[i]),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("${i + 1}", style = Texte.secondaire.copy(fontWeight = FontWeight.Bold), color = Color.Black.copy(alpha = 0.8f))
                        }
                        Column(Modifier.align(Alignment.BottomStart).padding(8.dp)) {
                            Text(e.libelle, style = Texte.secondaire.copy(fontWeight = FontWeight.SemiBold), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            e.artistName?.let {
                                Text(it, style = Texte.secondaire.copy(fontSize = 11.sp), color = Color.White.copy(alpha = 0.75f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            Text("${nombreFr(e.plays)} écoutes", style = Texte.secondaire.copy(fontSize = 10.sp, fontWeight = FontWeight.Medium), color = Color.White)
                        }
                    }
                }
                repeat(3 - trois.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun Tendance(pourcentage: Double?, total: Int) {
    val p = LocalPalette.current
    Bloc {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icone(R.drawable.lucide_trending_up, description = null, teinte = p.accent.compose, taille = 16.dp)
            Spacer(Modifier.width(6.dp))
            Text("Tendances", style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.accent.compose)
        }
        if (pourcentage != null) {
            Spacer(Modifier.height(6.dp))
            Text(
                "${if (pourcentage >= 0) "+" else ""}${pourcentage.toInt()} % d'écoutes cette période",
                style = Texte.corps, color = if (pourcentage >= 0) p.verifie.compose else p.accent.compose,
            )
        }
        Text("${nombreFr(total)} écoutes au total", style = Texte.secondaire, color = p.encreAttenuee.compose)
    }
}

/** L'évolution d'une place : « Nouveau », stable, gagnée (vert) ou perdue (accent). */
@Composable
private fun Evolution(evolution: Int?, affichee: Boolean) {
    if (!affichee) return
    val p = LocalPalette.current
    when {
        evolution == null -> Text("Nouveau", style = Texte.secondaire, color = p.encreAttenuee.compose)
        evolution == 0 -> Icone(R.drawable.lucide_minus, description = "Stable", teinte = p.encreAttenuee.compose, taille = 12.dp)
        else -> Row(verticalAlignment = Alignment.CenterVertically) {
            val monte = evolution > 0
            val couleur = if (monte) p.verifie.compose else p.accent.compose
            Icone(if (monte) R.drawable.lucide_trending_up else R.drawable.lucide_trending_down, description = null, teinte = couleur, taille = 12.dp)
            Spacer(Modifier.width(3.dp))
            Text(
                "${kotlin.math.abs(evolution)}",
                style = Texte.secondaire,
                color = couleur,
                modifier = Modifier.semantics { contentDescription = if (monte) "Gagne $evolution places" else "Perd ${-evolution} places" },
            )
        }
    }
}

@Composable
private fun LignePlace(e: EntreeClassement, type: TypeClassement, maxEcoutes: Int, avecEvolution: Boolean, enCours: Boolean, onClick: () -> Unit) {
    val p = LocalPalette.current
    val forme: Shape = if (type == TypeClassement.ARTISTES || type == TypeClassement.AUDITEURS) CircleShape else RoundedCornerShape(8.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp)
            .clip(RoundedCornerShape(10.dp))
            .pressable(onClick = onClick)
            .padding(horizontal = 4.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("${e.rank}", style = Texte.secondaire.copy(fontFeatureSettings = "tnum"), color = if (enCours) p.accent.compose else p.encreAttenuee.compose, modifier = Modifier.width(28.dp))
        Pochette(e.image, Modifier.size(40.dp), forme)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    e.libelle,
                    style = Texte.corps.copy(fontWeight = FontWeight.Medium),
                    color = if (enCours) p.accent.compose else p.encre.compose,
                    maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false),
                )
                if (e.verified) {
                    Spacer(Modifier.width(4.dp))
                    Icone(R.drawable.lucide_badge_check, description = "Vérifié", teinte = p.verifie.compose, taille = 12.dp)
                }
            }
            e.artistName?.let { Text(it, style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1, overflow = TextOverflow.Ellipsis) }
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(nombreFr(e.plays), style = Texte.secondaire.copy(fontSize = 11.sp, fontFeatureSettings = "tnum"), color = p.encreAttenuee.compose, modifier = Modifier.width(56.dp))
                BarreProportion(if (maxEcoutes > 0) e.plays.toFloat() / maxEcoutes else 0f, Modifier.width(72.dp))
            }
        }
        Spacer(Modifier.width(8.dp))
        Evolution(e.evolution, avecEvolution)
        if (type == TypeClassement.TITRES) {
            e.versTitre()?.let { titre ->
                Spacer(Modifier.width(8.dp))
                PastilleTelechargement(titre, taille = 28.dp)
            }
        }
    }
}
