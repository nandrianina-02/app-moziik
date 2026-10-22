package com.moziik.app.ui.decouvrir

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.Evenement
import com.moziik.app.donnees.catalogue.ListeEvenements
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.EnTeteSection
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.pressable
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.fiches.BarreRetour
import com.moziik.app.ui.fiches.ContenuFiche
import com.moziik.app.ui.fiches.ModeleFiche
import com.moziik.app.ui.ouvrirLien
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import com.moziik.app.ui.navigation

/** Libellés des catégories (lib/evenements.ts) ; sans catégorie, « Évènement ». */
internal val CATEGORIES = mapOf(
    "musique" to "Musique",
    "concert" to "Concert",
    "festival" to "Festival",
    "culte" to "Culte",
    "conference" to "Conférence",
    "atelier" to "Atelier",
)

/** Le site ne donne qu'une heure de début : un évènement est « en cours » pendant les 6 heures qui suivent (eventStatus.ts). */
internal const val FENETRE_EN_COURS_MS = 6 * 60 * 60 * 1000L

internal enum class Moment(val libelle: String) { A_VENIR("À venir"), EN_COURS("En cours"), PASSE("Passé") }

internal fun instant(iso: String): Date? = runCatching {
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.parse(iso.take(19))
}.getOrNull()

internal fun momentDe(date: Date?, maintenant: Long): Moment = when {
    date == null -> Moment.A_VENIR
    maintenant < date.time -> Moment.A_VENIR
    maintenant <= date.time + FENETRE_EN_COURS_MS -> Moment.EN_COURS
    else -> Moment.PASSE
}

/**
 * Les évènements publiés (H15) : à venir d'abord, puis les passés, du plus
 * récent au plus ancien. « Ça m'intéresse » demande un compte ; la
 * billetterie s'ouvre dans le navigateur.
 */
@Composable
fun EcranEvenements(onRetour: () -> Unit) {
    val c = conteneur()
    val modele: ModeleFiche<ListeEvenements> = viewModel { ModeleFiche { c.catalogue.evenements() } }
    val etat by modele.etat.collectAsStateWithLifecycle()
    ContenuFiche(etat, modele::recharger) { liste -> CorpsEvenements(liste, onRetour) }
}

@Composable
private fun CorpsEvenements(liste: ListeEvenements, onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val portee = rememberCoroutineScope()
    val session by c.session.etat.collectAsStateWithLifecycle()
    val interets = remember(liste) { mutableStateMapOf<String, Boolean>().apply { liste.interestedIds.forEach { put(it, true) } } }
    val nombres = remember(liste) { mutableStateMapOf<String, Int>() }
    val maintenant = remember { System.currentTimeMillis() }
    val (passes, prochains) = remember(liste) {
        liste.events.map { it to instant(it.date) }.partition { (_, d) -> momentDe(d, maintenant) == Moment.PASSE }
    }

    val basculer: (Evenement) -> Unit = { e ->
        if (session !is EtatSession.Connecte) {
            c.alertes.signaler(AlerteLecture.Message("Connecte-toi pour marquer ton intérêt."))
        } else {
            val avant = interets[e.id] == true
            interets[e.id] = !avant
            portee.launch {
                runCatching { c.catalogue.basculerInteret(e.id) }
                    .onSuccess {
                        interets[e.id] = it.interested
                        nombres[e.id] = it.interestedCount
                    }
                    .onFailure {
                        interets[e.id] = avant
                        c.alertes.signaler(AlerteLecture.Message(messageErreur(it)))
                    }
            }
        }
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item(key = "retour") { BarreRetour(onRetour) }
        item(key = "titre") { Text("Évènements", style = Texte.titreFiche, color = p.encre.compose) }
        if (liste.events.isEmpty()) {
            item(key = "vide") { Text("Aucun évènement annoncé pour le moment.", style = Texte.corps, color = p.encreAttenuee.compose) }
        }
        if (prochains.isNotEmpty()) {
            item(key = "prochains") { EnTeteSection("À venir", modifier = Modifier.padding(top = 8.dp)) }
            items(prochains, key = { it.first.id }) { (e, d) ->
                CarteEvenement(e, momentDe(d, maintenant), d, interets[e.id] == true, nombres[e.id] ?: e.interestedCount) { basculer(e) }
            }
        }
        if (passes.isNotEmpty()) {
            item(key = "passes") { EnTeteSection("Passés", modifier = Modifier.padding(top = 8.dp)) }
            items(passes.reversed(), key = { it.first.id }) { (e, d) ->
                CarteEvenement(e, Moment.PASSE, d, interets[e.id] == true, nombres[e.id] ?: e.interestedCount) { basculer(e) }
            }
        }
    }
}

@Composable
private fun CarteEvenement(e: Evenement, moment: Moment, date: Date?, interesse: Boolean, interesses: Int, onInteret: () -> Unit) {
    val p = LocalPalette.current
    val contexte = LocalContext.current
    val nav = navigation()
    val forme = RoundedCornerShape(p.rayon.dp)
    val quand = date?.let { SimpleDateFormat("EEEE d MMMM yyyy 'à' HH:mm", Locale.FRANCE).format(it).replaceFirstChar(Char::uppercase) }
    Column(
        Modifier
            .fillMaxWidth()
            .clip(forme)
            .border(BorderStroke(1.dp, p.bordure.compose), forme)
            .background(p.surface.compose)
            .pressable(onClick = { nav.evenement(e.id) })
            .padding(12.dp),
    ) {
        Pochette(e.coverUrl, Modifier.fillMaxWidth().aspectRatio(16f / 10f), RoundedCornerShape(10.dp))
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Etiquette(CATEGORIES[e.category] ?: "Évènement", p.accent.compose)
            Etiquette(moment.libelle, if (moment == Moment.EN_COURS) p.verifie.compose else if (moment == Moment.PASSE) p.encreAttenuee.compose else p.accent.compose)
        }
        Spacer(Modifier.height(8.dp))
        Text(e.title, style = Texte.corps.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold), color = p.encre.compose, maxLines = 2, overflow = TextOverflow.Ellipsis)
        e.description?.takeIf { it.isNotBlank() }?.let {
            Spacer(Modifier.height(4.dp))
            Text(it, style = Texte.corps, color = p.encreAttenuee.compose, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.height(10.dp))
        quand?.let { Info(R.drawable.lucide_calendar_days, it) }
        listOfNotNull(e.location, e.city).joinToString(", ").takeIf { it.isNotBlank() }?.let { Info(R.drawable.lucide_map_pin, it) }
        if (interesses > 0) Info(R.drawable.lucide_users, "$interesses intéressé${if (interesses > 1) "s" else ""}")
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            val billets = e.ticketUrl?.takeIf { it.startsWith("http") }
            if (billets != null && moment != Moment.PASSE) {
                Row(
                    Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(p.accent.compose)
                        .pressable { ouvrirLien(contexte, billets, p.base.enArgb().toInt()) }
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icone(R.drawable.lucide_ticket, description = null, teinte = p.base.compose, taille = 16.dp)
                    Spacer(Modifier.width(8.dp))
                    Text("Billets", style = Texte.corpsFort, color = p.base.compose)
                }
                Spacer(Modifier.width(10.dp))
            }
            Row(
                Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .border(BorderStroke(1.dp, if (interesse) p.accent.compose else p.bordure.compose), RoundedCornerShape(12.dp))
                    .background(if (interesse) p.accent.compose.copy(alpha = 0.1f) else Color.Transparent)
                    .pressable(onClick = onInteret)
                    .semantics { contentDescription = if (interesse) "Retirer de mes intérêts" else "Ça m'intéresse" },
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icone(
                    if (interesse) R.drawable.lucide_heart_plein else R.drawable.lucide_heart,
                    description = null,
                    teinte = if (interesse) p.accent.compose else p.encreAttenuee.compose,
                    taille = 17.dp,
                )
            }
        }
    }
}

@Composable
internal fun Etiquette(texte: String, couleur: Color) {
    Text(
        texte,
        style = Texte.secondaire.copy(fontSize = 11.sp, fontWeight = FontWeight.Medium),
        color = couleur,
        modifier = Modifier.clip(CircleShape).background(couleur.copy(alpha = 0.1f)).padding(horizontal = 10.dp, vertical = 3.dp),
    )
}

@Composable
internal fun Info(icone: Int, texte: String) {
    val p = LocalPalette.current
    Row(Modifier.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Icone(icone, description = null, teinte = p.encreAttenuee.compose, taille = 13.dp)
        Spacer(Modifier.width(6.dp))
        Text(texte, style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
