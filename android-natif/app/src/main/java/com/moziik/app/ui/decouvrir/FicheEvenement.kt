package com.moziik.app.ui.decouvrir

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.Billet
import com.moziik.app.donnees.catalogue.EvenementDetail
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.CarteArtiste
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.apparitionUneFois
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.fiches.BarreRetour
import com.moziik.app.ui.fiches.BoutonFiche
import com.moziik.app.ui.fiches.ContenuFiche
import com.moziik.app.ui.fiches.ModeleFiche
import com.moziik.app.ui.navigation
import com.moziik.app.ui.ouvrirLien
import com.moziik.app.ui.partager
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Currency
import java.util.Locale

data class DonneesEvenement(val evenement: EvenementDetail, val devise: String)

/** « Gratuit » pour zéro : un billet à zéro n'est pas une absence de prix (eventPresentation.ts). */
internal fun prix(montant: Double, devise: String): String {
    if (montant == 0.0) return "Gratuit"
    return runCatching {
        NumberFormat.getCurrencyInstance(Locale.FRANCE).apply {
            currency = Currency.getInstance(devise)
            maximumFractionDigits = if (montant % 1.0 == 0.0) 0 else 2
        }.format(montant)
    }.getOrElse { "$montant $devise" }
}

/**
 * La fiche d'un évènement (app/evenements/[id]) : affiche, date et lieu,
 * billetterie, programme, artistes, infos pratiques, organisateur.
 * « Ça m'intéresse » demande un compte ; billets et itinéraire s'ouvrent
 * hors de l'app, l'achat se fait chez l'organisateur.
 */
@Composable
fun FicheEvenement(id: String, onRetour: () -> Unit) {
    val c = conteneur()
    val modele: ModeleFiche<DonneesEvenement> = viewModel(key = "evenement-$id") {
        ModeleFiche { DonneesEvenement(c.catalogue.evenement(id), c.catalogue.devise()) }
    }
    val etat by modele.etat.collectAsStateWithLifecycle()
    ContenuFiche(etat, modele::recharger) { CorpsEvenement(it, onRetour) }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CorpsEvenement(donnees: DonneesEvenement, onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val contexte = LocalContext.current
    val portee = rememberCoroutineScope()
    val session by c.session.etat.collectAsStateWithLifecycle()
    val e = donnees.evenement
    val vus = remember { mutableSetOf<Any>() }
    val date = remember(e.date) { instant(e.date) }
    val fin = remember(e.endDate) { e.endDate?.let(::instant) }
    val maintenant = remember { System.currentTimeMillis() }
    val moment = momentDe(date, maintenant)
    var interesse by remember(e.id) { mutableStateOf(e.viewerInterested) }
    var interesses by remember(e.id) { mutableIntStateOf(e.interestedCount) }
    var bascule by remember { mutableStateOf(false) }

    val quand = date?.let {
        val jour = SimpleDateFormat("EEEE d MMMM yyyy 'à' HH:mm", Locale.FRANCE).format(it).replaceFirstChar(Char::uppercase)
        val jusqua = fin?.let { f ->
            val memeJour = SimpleDateFormat("yyyyMMdd", Locale.US).let { d -> d.format(f) == d.format(it) }
            if (memeJour) " jusqu'à " + SimpleDateFormat("HH:mm", Locale.FRANCE).format(f)
            else " au " + SimpleDateFormat("d MMMM 'à' HH:mm", Locale.FRANCE).format(f)
        }.orEmpty()
        jour + jusqua
    }
    val lieu = listOfNotNull(e.location, e.address, listOfNotNull(e.postalCode, e.city).joinToString(" ").ifBlank { null }, e.country)
        .filter { it.isNotBlank() }.distinct().joinToString(", ")
    val billets = e.ticketUrl?.takeIf { it.startsWith("http") && moment != Moment.PASSE }
    val prixMin = e.tickets.filter { !it.soldOut }.minOfOrNull { it.price } ?: e.price

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 40.dp)) {
        item(key = "retour") { BarreRetour(onRetour) }
        item(key = "affiche") {
            Column(Modifier.padding(horizontal = 16.dp).apparitionUneFois("affiche", 0, vus)) {
                Pochette(e.coverUrl, Modifier.fillMaxWidth().aspectRatio(16f / 10f), RoundedCornerShape(p.rayon.dp))
                Spacer(Modifier.height(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Etiquette(CATEGORIES[e.category] ?: "Évènement", p.accent.compose)
                    Etiquette(moment.libelle, if (moment == Moment.EN_COURS) p.verifie.compose else if (moment == Moment.PASSE) p.encreAttenuee.compose else p.accent.compose)
                    e.minAge?.let { Etiquette("$it ans et plus", p.encreAttenuee.compose) }
                }
                Spacer(Modifier.height(10.dp))
                Text(e.title, style = Texte.titreFiche, color = p.encre.compose)
                e.artist?.let { a ->
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Présenté par ${a.stageName}",
                        style = Texte.corps.copy(fontWeight = FontWeight.Medium),
                        color = p.accent.compose,
                        modifier = Modifier.clip(RoundedCornerShape(6.dp)).padding(vertical = 2.dp),
                    )
                }
                Spacer(Modifier.height(12.dp))
                quand?.let { InfoFiche(R.drawable.lucide_calendar_days, it) }
                if (lieu.isNotBlank()) InfoFiche(R.drawable.lucide_map_pin, lieu)
                prixMin?.let { InfoFiche(R.drawable.lucide_ticket, if (it == 0.0) "Entrée libre" else "À partir de ${prix(it, donnees.devise)}") }
                if (interesses > 0) InfoFiche(R.drawable.lucide_users, "$interesses intéressé${if (interesses > 1) "s" else ""}")
                Spacer(Modifier.height(18.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (billets != null) {
                        BoutonFiche(R.drawable.lucide_ticket, "Billets", onClick = { ouvrirLien(contexte, billets, p.base.enArgb().toInt()) }, principal = true)
                    }
                    BoutonFiche(
                        if (interesse) R.drawable.lucide_heart_plein else R.drawable.lucide_heart,
                        if (interesse) "Intéressé" else "Ça m'intéresse",
                        actif = interesse,
                        chargement = bascule,
                        onClick = {
                            if (session !is EtatSession.Connecte) {
                                c.alertes.signaler(AlerteLecture.Message("Connecte-toi pour marquer ton intérêt."))
                            } else if (!bascule) {
                                bascule = true
                                portee.launch {
                                    runCatching { c.catalogue.basculerInteret(e.id) }
                                        .onSuccess {
                                            interesse = it.interested
                                            interesses = it.interestedCount
                                        }
                                        .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                                    bascule = false
                                }
                            }
                        },
                    )
                    BoutonFiche(R.drawable.lucide_share_2, null, onClick = { partager(contexte, "evenements/${e.id}", e.title) }, description = "Partager")
                }
            }
        }
        if (e.highlights.isNotEmpty()) {
            item(key = "points") {
                FlowRow(
                    Modifier.padding(start = 16.dp, end = 16.dp, top = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    e.highlights.forEach { h ->
                        Text(
                            h,
                            style = Texte.secondaire.copy(fontWeight = FontWeight.Medium),
                            color = p.encre.compose,
                            modifier = Modifier.clip(CircleShape).border(BorderStroke(1.dp, p.bordure.compose), CircleShape).padding(horizontal = 12.dp, vertical = 6.dp),
                        )
                    }
                }
            }
        }
        e.description?.takeIf { it.isNotBlank() }?.let { texte ->
            item(key = "description") {
                Bloc("À propos") {
                    texte.split(Regex("\n{2,}")).forEach { paragraphe ->
                        Text(paragraphe.trim(), style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(bottom = 10.dp))
                    }
                }
            }
        }
        if (e.program.isNotEmpty()) {
            item(key = "programme") {
                Bloc("Programme") {
                    e.program.forEachIndexed { i, creneau ->
                        if (i > 0) HorizontalDivider(color = p.bordure.compose)
                        Row(Modifier.padding(vertical = 10.dp)) {
                            Text(creneau.time, style = Texte.corpsFort.copy(fontFeatureSettings = "tnum"), color = p.accent.compose, modifier = Modifier.width(64.dp))
                            Column(Modifier.weight(1f)) {
                                Text(creneau.title, style = Texte.corpsFort, color = p.encre.compose)
                                creneau.detail?.takeIf { it.isNotBlank() }?.let { Text(it, style = Texte.secondaire, color = p.encreAttenuee.compose) }
                            }
                        }
                    }
                }
            }
        }
        val artistes = (listOfNotNull(e.artist) + e.lineup.filterNotNull()).distinctBy { it.id }
        if (artistes.isNotEmpty()) {
            item(key = "artistes") {
                Bloc("Artistes", horizontal = false) {
                    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        items(artistes, key = { it.id }) { a ->
                            CarteArtiste(a.stageName, a.coverUrl, a.verified, null, onClick = { nav.artiste(a.id) }, modifier = Modifier.width(96.dp))
                        }
                    }
                }
            }
        }
        if (e.tickets.isNotEmpty()) {
            item(key = "billetterie") {
                Bloc("Billetterie") {
                    e.tickets.forEach { b -> LigneBillet(b, donnees.devise) }
                    Text(
                        "L'achat se fait auprès de l'organisateur.",
                        style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }
        if (e.inclusions.isNotEmpty()) {
            item(key = "inclus") { Bloc("Inclus") { e.inclusions.forEach { InfoFiche(R.drawable.lucide_check, it) } } }
        }
        if (e.practicalInfo.isNotEmpty()) {
            item(key = "pratique") { Bloc("Bon à savoir") { e.practicalInfo.forEach { InfoFiche(R.drawable.lucide_info, it) } } }
        }
        if (lieu.isNotBlank()) {
            item(key = "lieu") {
                Bloc("Lieu") {
                    Text(lieu, style = Texte.corps, color = p.encre.compose)
                    Spacer(Modifier.height(10.dp))
                    BoutonFiche(R.drawable.lucide_map_pin, "Itinéraire", onClick = { ouvrirCarte(contexte, e, lieu) })
                }
            }
        }
        e.organizer?.takeIf { listOfNotNull(it.name, it.email, it.phone, it.website).any(String::isNotBlank) }?.let { o ->
            item(key = "organisateur") {
                Bloc("Organisateur") {
                    o.name?.takeIf { it.isNotBlank() }?.let { Text(it, style = Texte.corpsFort, color = p.encre.compose, modifier = Modifier.padding(bottom = 6.dp)) }
                    o.phone?.takeIf { it.isNotBlank() }?.let { tel ->
                        LienInfo(R.drawable.lucide_phone, tel) { ouvrirIntention(contexte, Intent(Intent.ACTION_DIAL, Uri.parse("tel:$tel"))) }
                    }
                    o.email?.takeIf { it.isNotBlank() }?.let { mail ->
                        LienInfo(R.drawable.lucide_mail, mail) { ouvrirIntention(contexte, Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$mail"))) }
                    }
                    o.website?.takeIf { it.startsWith("http") }?.let { site ->
                        LienInfo(R.drawable.lucide_external_link, site.removePrefix("https://").removePrefix("http://").trimEnd('/')) {
                            ouvrirLien(contexte, site, p.base.enArgb().toInt())
                        }
                    }
                }
            }
        }
    }
}

/** Une rubrique de la fiche : titre de section, filet, contenu. */
@Composable
private fun Bloc(titre: String, horizontal: Boolean = true, contenu: @Composable () -> Unit) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxWidth().padding(top = 28.dp)) {
        Text(titre, style = Texte.titreSection, color = p.encre.compose, modifier = Modifier.padding(horizontal = 16.dp))
        Spacer(Modifier.height(10.dp))
        if (horizontal) Column(Modifier.padding(horizontal = 16.dp)) { contenu() } else contenu()
    }
}

@Composable
private fun InfoFiche(icone: Int, texte: String) {
    val p = LocalPalette.current
    Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.Top) {
        Icone(icone, description = null, teinte = p.encreAttenuee.compose, taille = 16.dp, modifier = Modifier.padding(top = 2.dp))
        Spacer(Modifier.width(10.dp))
        Text(texte, style = Texte.corps, color = p.encre.compose)
    }
}

@Composable
private fun LienInfo(icone: Int, texte: String, onClick: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable(onClick = onClick).padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icone(icone, description = null, teinte = p.accent.compose, taille = 16.dp)
        Spacer(Modifier.width(10.dp))
        Text(texte, style = Texte.corps, color = p.accent.compose)
    }
}

@Composable
private fun LigneBillet(b: Billet, devise: String) {
    val p = LocalPalette.current
    val forme = RoundedCornerShape(p.rayon.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .padding(bottom = 10.dp)
            .clip(forme)
            .border(BorderStroke(1.dp, p.bordure.compose), forme)
            .background(p.surface.compose)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(b.name, style = Texte.corpsFort, color = if (b.soldOut) p.encreAttenuee.compose else p.encre.compose)
            b.description?.takeIf { it.isNotBlank() }?.let { Text(it, style = Texte.secondaire, color = p.encreAttenuee.compose) }
        }
        Spacer(Modifier.width(12.dp))
        Column(horizontalAlignment = Alignment.End) {
            if (b.soldOut) {
                Etiquette("Complet", p.encreAttenuee.compose)
            } else {
                Text(prix(b.price, devise), style = Texte.corpsFort, color = p.encre.compose)
                b.originalPrice?.takeIf { it > b.price }?.let {
                    Text(prix(it, devise), style = Texte.secondaire.copy(textDecoration = TextDecoration.LineThrough), color = p.encreAttenuee.compose)
                }
            }
        }
    }
}

private fun ouvrirIntention(contexte: android.content.Context, intention: Intent) {
    runCatching { contexte.startActivity(intention.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

/**
 * L'itinéraire : le lien de carte de l'organisateur s'il y en a un, sinon
 * le point exact s'il est connu, sinon une recherche sur l'adresse
 * (lienCarte de eventPresentation.ts). L'app de cartes du téléphone le prend.
 */
private fun ouvrirCarte(contexte: android.content.Context, e: EvenementDetail, lieu: String) {
    val adresse = when {
        !e.mapsUrl.isNullOrBlank() -> e.mapsUrl
        e.latitude != null && e.longitude != null -> "geo:${e.latitude},${e.longitude}?q=${e.latitude},${e.longitude}(${Uri.encode(e.title)})"
        else -> "geo:0,0?q=${Uri.encode(lieu)}"
    }
    ouvrirIntention(contexte, Intent(Intent.ACTION_VIEW, Uri.parse(adresse)))
}
