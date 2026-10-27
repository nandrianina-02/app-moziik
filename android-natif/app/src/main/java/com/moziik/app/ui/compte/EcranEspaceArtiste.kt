package com.moziik.app.ui.compte

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.moziik.app.R
import com.moziik.app.donnees.compte.PERIODES_ARTISTE
import com.moziik.app.donnees.compte.StatistiquesArtiste
import com.moziik.app.donnees.compte.evolution
import com.moziik.app.donnees.compte.nomDeLAppareil
import com.moziik.app.donnees.compte.nomDuPays
import com.moziik.app.donnees.compte.part
import com.moziik.app.donnees.reseau.ErreurApi
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.appel
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.MessageErreur
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.apparition
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.navigation
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import com.moziik.app.ui.composants.SqueletteListe

private val entiers: NumberFormat = NumberFormat.getIntegerInstance(Locale.FRANCE)
private fun chiffre(n: Int): String = entiers.format(n)

/**
 * L'espace artiste : les chiffres du tableau de bord du site
 * (/api/artist/stats), en lecture seule. La gestion du catalogue reste sur
 * le site, où l'envoi de fichiers et les formulaires ont leur place.
 */
@Composable
fun EcranEspaceArtiste(onRetour: () -> Unit) {
    val c = conteneur()
    var jours by rememberSaveable { mutableIntStateOf(30) }
    var stats by remember { mutableStateOf<StatistiquesArtiste?>(null) }
    var erreur by remember { mutableStateOf<String?>(null) }
    var chargement by remember { mutableStateOf(true) }
    LaunchedEffect(jours) {
        chargement = true
        erreur = null
        // Les chiffres de la période précédente restent affichés pendant le chargement : rien ne saute.
        appel { c.reseau.api.statistiquesArtiste(jours) }
            .onSuccess { stats = it }
            .onFailure { e ->
                erreur = if (e is ErreurApi && e.statut == 404) "Ce compte n'a pas encore de profil artiste." else messageErreur(e)
            }
        chargement = false
    }
    PageReglage("Espace artiste", onRetour) {
        ChoixPeriode(jours, chargement && stats != null) { jours = it }
        MessageErreur(erreur, Modifier.padding(top = 12.dp))
        val s = stats
        if (s == null) {
            if (erreur == null) SqueletteListe(5, Modifier.padding(top = 16.dp))
            return@PageReglage
        }
        Tableau(s)
    }
}

@Composable
private fun ChoixPeriode(jours: Int, chargement: Boolean, onChoix: (Int) -> Unit) {
    val p = LocalPalette.current
    val forme = RoundedCornerShape(p.rayon.dp)
    Row(verticalAlignment = Alignment.CenterVertically) {
        Row(Modifier.clip(forme).border(BorderStroke(1.dp, p.bordure.compose), forme)) {
            PERIODES_ARTISTE.forEach { j ->
                val choisi = j == jours
                Text(
                    "$j jours",
                    style = Texte.secondaire.copy(fontWeight = FontWeight.Medium),
                    color = if (choisi) p.accent.compose else p.encreAttenuee.compose,
                    modifier = Modifier
                        .background(if (choisi) p.accent.compose.copy(alpha = 0.12f) else p.surface.compose)
                        .clickable(role = Role.Tab) { onChoix(j) }
                        .semantics { selected = choisi }
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                )
            }
        }
        if (chargement) {
            Spacer(Modifier.width(12.dp))
            Egaliseur(hauteur = 12.dp, libelle = "Chargement")
        }
    }
}

@Composable
private fun Tableau(s: StatistiquesArtiste) {
    val p = LocalPalette.current
    val r = s.resume
    Column(Modifier.animateContentSize()) {
        // Le chiffre qui compte d'abord : les écoutes, et leur sens par rapport à la période d'avant.
        Column(Modifier.padding(top = 24.dp).apparition(0)) {
            Text("ÉCOUTES SUR ${s.jours} JOURS", style = Texte.surtitre, color = p.encreAttenuee.compose)
            Row(verticalAlignment = Alignment.Bottom) {
                Text(chiffre(r.ecoutes), style = Texte.titreFiche.copy(fontSize = Texte.titreFiche.fontSize * 1.5f), color = p.encre.compose)
                Spacer(Modifier.width(12.dp))
                Evolution(evolution(r.ecoutes, r.ecoutesPrecedentes), Modifier.padding(bottom = 8.dp))
            }
            Text("${chiffre(r.ecoutesPrecedentes)} sur les ${s.jours} jours précédents", style = Texte.secondaire, color = p.encreAttenuee.compose)
        }

        Row(Modifier.fillMaxWidth().padding(top = 20.dp).apparition(1), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Tuile(R.drawable.lucide_headphones, chiffre(r.auditeurs), "Auditeurs", Modifier.weight(1f))
            Tuile(R.drawable.lucide_users, chiffre(s.abonnes), "Abonnés", Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth().padding(top = 10.dp).apparition(2), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Tuile(R.drawable.lucide_heart, chiffre(r.favoris), "J'aime", Modifier.weight(1f))
            Tuile(R.drawable.lucide_circle_check, r.tauxEcouteComplete?.let { "$it %" } ?: "—", "Écoutés jusqu'au bout", Modifier.weight(1f))
        }

        Section("Écoutes par jour", Modifier.apparition(3))
        if (r.ecoutes == 0) {
            Text("Aucune écoute sur la période.", style = Texte.corps, color = p.encreAttenuee.compose)
        } else {
            Histogramme(s)
        }

        if (s.topTitres.isNotEmpty()) {
            Section("Titres les plus écoutés", Modifier.apparition(4))
            val nav = navigation()
            val max = s.topTitres.maxOf { it.ecoutes }.coerceAtLeast(1)
            s.topTitres.forEachIndexed { i, t ->
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable(role = Role.Button) { nav.titre(t.id) }.padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("${i + 1}", style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.width(20.dp))
                    Pochette(t.coverUrl, Modifier.size(40.dp))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(t.title, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Barre(t.ecoutes.toFloat() / max, Modifier.padding(top = 6.dp))
                    }
                    Spacer(Modifier.width(12.dp))
                    Text(chiffre(t.ecoutes), style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.encre.compose)
                }
            }
        }

        if (s.pays.isNotEmpty()) {
            Section("Pays", Modifier.apparition(5))
            val total = s.pays.sumOf { it.ecoutes }
            s.pays.take(8).forEach { LigneRepartition(nomDuPays(it.code), it.ecoutes, total) }
        }
        if (s.appareils.isNotEmpty()) {
            Section("Appareils", Modifier.apparition(6))
            val total = s.appareils.sumOf { it.ecoutes }
            s.appareils.forEach { LigneRepartition(nomDeLAppareil(it.nom), it.ecoutes, total) }
        }

        Text(
            "${chiffre(s.catalogue.publies)} titres publiés sur ${chiffre(s.catalogue.titres)}. La gestion du catalogue se fait sur le site.",
            style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 28.dp),
        )
    }
}

/** Hausse ou baisse : l'icône dit le sens, le texte reste à l'encre (la couleur seule ne suffit pas). */
@Composable
private fun Evolution(pourcent: Int?, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    if (pourcent == null) return
    val hausse = pourcent >= 0
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Icone(
            if (hausse) R.drawable.lucide_trending_up else R.drawable.lucide_trending_down,
            description = null,
            teinte = if (hausse) p.verifie.compose else p.danger.compose,
            taille = 16.dp,
        )
        Spacer(Modifier.width(4.dp))
        Text((if (hausse) "+" else "") + "$pourcent %", style = Texte.corpsFort, color = p.encre.compose)
    }
}

@Composable
private fun Tuile(icone: Int, valeur: String, libelle: String, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    val forme = RoundedCornerShape(p.rayon.dp)
    Column(modifier.clip(forme).background(p.surface.compose).border(BorderStroke(1.dp, p.bordure.compose), forme).padding(14.dp)) {
        Icone(icone, description = null, teinte = p.accent.compose, taille = 16.dp)
        Spacer(Modifier.height(8.dp))
        Text(valeur, style = Texte.titreSection, color = p.encre.compose)
        Text(libelle, style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun Section(titre: String, modifier: Modifier = Modifier) {
    Text(titre, style = Texte.titreSection, color = LocalPalette.current.encre.compose, modifier = modifier.padding(top = 28.dp, bottom = 12.dp))
}

/** Une barre de proportion fine, à l'accent, sur un rail discret. */
@Composable
private fun Barre(fraction: Float, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    Box(modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(p.bordure.compose.copy(alpha = 0.6f))) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0.02f, 1f)).fillMaxHeight().clip(RoundedCornerShape(2.dp)).background(p.accent.compose))
    }
}

@Composable
private fun LigneRepartition(nom: String, ecoutes: Int, total: Int) {
    val p = LocalPalette.current
    val pc = part(ecoutes, total)
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(nom, style = Texte.corps, color = p.encre.compose, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("$pc %", style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.encre.compose)
            Text("  ·  ${chiffre(ecoutes)}", style = Texte.secondaire, color = p.encreAttenuee.compose)
        }
        Barre(pc / 100f, Modifier.padding(top = 6.dp))
    }
}

/**
 * Les écoutes jour par jour : une barre par jour, un seul ton (une seule
 * série), ligne de base et maximum en repère discret. Toucher une barre
 * affiche sa date et sa valeur au-dessus du graphique.
 */
@Composable
private fun Histogramme(s: StatistiquesArtiste) {
    val p = LocalPalette.current
    val serie = s.serie
    if (serie.isEmpty()) return
    var choisi by remember(serie) { mutableIntStateOf(serie.lastIndex) }
    val max = serie.maxOf { it.ecoutes }.coerceAtLeast(1)
    val jour = serie[choisi.coerceIn(0, serie.lastIndex)]
    val accent = p.accent.compose
    val discret = accent.copy(alpha = 0.45f)
    val rail = p.bordure.compose
    Column(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(chiffre(jour.ecoutes), style = Texte.titreSection, color = p.encre.compose)
            Spacer(Modifier.width(8.dp))
            Text(dateCourte(jour.jour), style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(bottom = 3.dp))
            Spacer(Modifier.weight(1f))
            Text("max. ${chiffre(max)}", style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(bottom = 3.dp))
        }
        Spacer(Modifier.height(10.dp))
        Canvas(
            Modifier
                .fillMaxWidth()
                .height(140.dp)
                .semantics { contentDescription = "Écoutes par jour, ${serie.size} jours, au plus ${chiffre(max)} par jour" }
                .pointerInput(serie) {
                    detectTapGestures { pos -> choisi = ((pos.x / size.width) * serie.size).toInt().coerceIn(0, serie.lastIndex) }
                },
        ) {
            val pas = size.width / serie.size
            // Un écart de surface entre deux barres, réduit quand les jours sont nombreux.
            val ecart = (pas * 0.25f).coerceIn(1f, 2.dp.toPx())
            val largeur = (pas - ecart).coerceAtLeast(1f)
            val arrondi = CornerRadius(minOf(largeur / 2f, 2.dp.toPx()))
            drawLine(rail, Offset(0f, 0f), Offset(size.width, 0f), strokeWidth = 1f, alpha = 0.5f)
            serie.forEachIndexed { i, j ->
                val h = (j.ecoutes.toFloat() / max) * size.height
                if (h <= 0f) return@forEachIndexed
                drawRoundRect(
                    if (i == choisi) accent else discret,
                    topLeft = Offset(i * pas + ecart / 2f, size.height - h),
                    size = Size(largeur, h),
                    cornerRadius = arrondi,
                )
            }
            drawLine(rail, Offset(0f, size.height), Offset(size.width, size.height), strokeWidth = 1.dp.toPx())
        }
        Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
            Text(dateCourte(serie.first().jour), style = Texte.secondaire, color = p.encreAttenuee.compose)
            Spacer(Modifier.weight(1f))
            Text(dateCourte(serie.last().jour), style = Texte.secondaire, color = p.encreAttenuee.compose)
        }
    }
}

/** « 2026-10-26 » donne « 26 oct. ». */
private fun dateCourte(jour: String): String = runCatching {
    val d = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(jour)!!
    SimpleDateFormat("d MMM", Locale.FRANCE).format(d)
}.getOrDefault(jour)
