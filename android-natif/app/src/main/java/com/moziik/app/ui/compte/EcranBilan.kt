package com.moziik.app.ui.compte

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.ArtisteCourt
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.compte.Bilan
import com.moziik.app.donnees.compte.anneeDuBilan
import com.moziik.app.donnees.compte.dureeLisible
import com.moziik.app.donnees.compte.moisLePlusEcoute
import com.moziik.app.donnees.reseau.ErreurApi
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.appel
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.MessageErreur
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.apparition
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.navigation
import com.moziik.app.ui.partagerBilanEnImage
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Calendar
import java.util.Locale
import com.moziik.app.ui.composants.SqueletteListe

private val nombres: NumberFormat = NumberFormat.getIntegerInstance(Locale.FRANCE)
private fun n(v: Int): String = nombres.format(v)

/**
 * Ton année sur Moziik : ce que le compte a écouté, ses titres, artistes
 * et genres préférés, et le rythme de l'année. Une seule page qui défile,
 * plutôt qu'une suite d'écrans à toucher : on la relit, on y revient.
 */
@Composable
fun EcranBilan(onRetour: () -> Unit) {
    val c = conteneur()
    val maintenant = remember { Calendar.getInstance() }
    val anneeCourante = maintenant.get(Calendar.YEAR)
    var annee by rememberSaveable { mutableIntStateOf(anneeDuBilan(anneeCourante, maintenant.get(Calendar.MONTH) + 1)) }
    var bilan by remember { mutableStateOf<Bilan?>(null) }
    var erreur by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(annee) {
        bilan = null
        erreur = null
        appel { c.reseau.api.bilan(annee) }
            .onSuccess { bilan = it }
            .onFailure { e -> erreur = if (e is ErreurApi && e.statut == 404) "Le bilan n'est pas encore disponible. Réessaie un peu plus tard." else messageErreur(e) }
    }
    PageReglage("Ton année", onRetour) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(anneeCourante - 1, anneeCourante).forEach { a ->
                PastilleAnnee(if (a == anneeCourante) "$a, en cours" else "$a", a == annee) { annee = a }
            }
        }
        MessageErreur(erreur, Modifier.padding(top = 12.dp))
        val b = bilan
        when {
            b == null && erreur == null -> SqueletteListe(5, Modifier.padding(top = 16.dp))
            b != null && b.ecoutes == 0 -> Text(
                "Aucune écoute enregistrée en ${b.annee}. Les écoutes comptent une fois connecté.",
                style = Texte.corps, color = LocalPalette.current.encreAttenuee.compose, modifier = Modifier.padding(top = 24.dp),
            )
            b != null -> ContenuBilan(b)
        }
    }
}

@Composable
private fun PastilleAnnee(libelle: String, choisie: Boolean, onClick: () -> Unit) {
    val p = LocalPalette.current
    Text(
        libelle,
        style = Texte.secondaire.copy(fontWeight = FontWeight.Medium),
        color = if (choisie) p.accent.compose else p.encreAttenuee.compose,
        modifier = Modifier
            .clip(CircleShape)
            .border(BorderStroke(1.dp, if (choisie) p.accent.compose else p.bordure.compose), CircleShape)
            .background(if (choisie) p.accent.compose.copy(alpha = 0.12f) else p.surface.compose)
            .clickable(role = Role.Tab, onClick = onClick)
            .semantics { selected = choisie }
            .padding(horizontal = 14.dp, vertical = 7.dp),
    )
}

@Composable
private fun ContenuBilan(b: Bilan) {
    val p = LocalPalette.current
    val c = conteneur()
    val nav = navigation()
    val contexte = LocalContext.current
    val (duree, unite) = dureeLisible(b.minutes)

    // Le chiffre d'ouverture : le temps passé à écouter.
    Column(Modifier.padding(top = 28.dp).apparition(0)) {
        Text("TON ANNÉE ${b.annee}", style = Texte.surtitre, color = p.encreAttenuee.compose)
        Row(verticalAlignment = Alignment.Bottom) {
            Text(n(duree), style = Texte.titreFiche.copy(fontSize = 52.sp, lineHeight = 56.sp), color = p.encre.compose)
            Spacer(Modifier.width(10.dp))
            Text(unite, style = Texte.titreSection, color = p.encreAttenuee.compose, modifier = Modifier.padding(bottom = 8.dp))
        }
        Text("d'écoute sur Moziik, en ${n(b.joursActifs)} jours.", style = Texte.corps, color = p.encreAttenuee.compose)
    }

    Row(Modifier.fillMaxWidth().padding(top = 20.dp).apparition(1), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Chiffre(R.drawable.lucide_headphones, n(b.ecoutes), "écoutes", Modifier.weight(1f))
        Chiffre(R.drawable.lucide_music_2, n(b.titresDifferents), "titres", Modifier.weight(1f))
        Chiffre(R.drawable.lucide_mic_vocal, n(b.artistesDifferents), "artistes", Modifier.weight(1f))
    }

    b.topTitres.firstOrNull()?.let { premier ->
        Intertitre("Ton titre de l'année", Modifier.apparition(2))
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(p.rayon.dp)).clickable(role = Role.Button) { nav.titre(premier.id) }.apparition(2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Pochette(premier.coverUrl, Modifier.size(112.dp))
            Spacer(Modifier.width(16.dp))
            Column(Modifier.weight(1f)) {
                Text(premier.title, style = Texte.titreSection, color = p.encre.compose, maxLines = 2, overflow = TextOverflow.Ellipsis)
                premier.artist?.stageName?.let { Text(it, style = Texte.corps, color = p.encreAttenuee.compose, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                Text("${n(premier.ecoutes)} écoutes", style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.accent.compose, modifier = Modifier.padding(top = 6.dp))
            }
        }
        b.topTitres.drop(1).forEachIndexed { i, t ->
            Row(
                Modifier.fillMaxWidth().padding(top = if (i == 0) 14.dp else 0.dp).clip(RoundedCornerShape(8.dp)).clickable(role = Role.Button) { nav.titre(t.id) }.padding(vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("${i + 2}", style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.width(22.dp))
                Pochette(t.coverUrl, Modifier.size(44.dp))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(t.title, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    t.artist?.stageName?.let { Text(it, style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                }
                Text(n(t.ecoutes), style = Texte.secondaire, color = p.encreAttenuee.compose)
            }
        }
        Spacer(Modifier.height(16.dp))
        BoutonPrincipal("Écouter ton top ${b.annee}", {
            val titres = b.topTitres.map { Titre(id = it.id, title = it.title, coverUrl = it.coverUrl, artist = it.artist?.id?.let { id -> ArtisteCourt(id, it.artist?.stageName) }) }
            c.lecteur.lire(titres, 0, "Ton année ${b.annee}")
        })
    }

    if (b.topArtistes.isNotEmpty()) {
        Intertitre("Tes artistes", Modifier.apparition(3))
        b.topArtistes.forEachIndexed { i, a ->
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable(role = Role.Button) { nav.artiste(a.id) }.padding(vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("${i + 1}", style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.width(22.dp))
                Pochette(a.coverUrl, Modifier.size(44.dp), forme = CircleShape)
                Spacer(Modifier.width(12.dp))
                Text(a.stageName, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${n(a.ecoutes)} écoutes", style = Texte.secondaire, color = p.encreAttenuee.compose)
            }
        }
    }

    if (b.topGenres.isNotEmpty()) {
        Intertitre("Tes genres", Modifier.apparition(4))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            b.topGenres.forEachIndexed { i, g ->
                val forme = RoundedCornerShape(p.rayon.dp)
                Text(
                    g.genre,
                    style = Texte.corps.copy(fontWeight = if (i == 0) FontWeight.SemiBold else FontWeight.Medium),
                    color = if (i == 0) p.accent.compose else p.encre.compose,
                    modifier = Modifier.clip(forme).border(BorderStroke(1.dp, if (i == 0) p.accent.compose else p.bordure.compose), forme).padding(horizontal = 14.dp, vertical = 8.dp),
                )
            }
        }
    }

    if (b.parMois.size == 12) {
        Intertitre("Ton année, mois par mois", Modifier.apparition(5))
        moisLePlusEcoute(b.parMois)?.let { Text("Ton mois le plus actif : $it.", style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(bottom = 12.dp)) }
        Mois(b.parMois)
    }

    b.premiereEcoute?.let { e ->
        Intertitre("Ta première écoute de l'année", Modifier.apparition(6))
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable(role = Role.Button) { nav.titre(e.id) }.padding(vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Pochette(e.coverUrl, Modifier.size(44.dp))
            Spacer(Modifier.width(12.dp))
            Text(e.title, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }

    // Le partage en texte : il passe partout, y compris dans une messagerie sans aperçu d'image.
    val resume = buildString {
        append("Mon année ${b.annee} sur Moziik : ${n(duree)} $unite d'écoute")
        b.topTitres.firstOrNull()?.let { append(", et en tête « ${it.title} »") }
        b.topArtistes.firstOrNull()?.let { append(" — mon artiste : ${it.stageName}") }
        append(".")
    }
    Row(
        Modifier.padding(top = 28.dp).clip(CircleShape).border(BorderStroke(1.dp, p.bordure.compose), CircleShape)
            .clickable(role = Role.Button) { c.portee.launch { partagerBilanEnImage(contexte, b, resume, p.accent.compose) } }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icone(R.drawable.lucide_share_2, description = null, teinte = p.encre.compose, taille = 16.dp)
        Spacer(Modifier.width(8.dp))
        Text("Partager mon année", style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose)
    }
}

@Composable
private fun Intertitre(texte: String, modifier: Modifier = Modifier) {
    Text(texte, style = Texte.titreSection, color = LocalPalette.current.encre.compose, modifier = modifier.padding(top = 32.dp, bottom = 12.dp))
}

@Composable
private fun Chiffre(icone: Int, valeur: String, libelle: String, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    val forme = RoundedCornerShape(p.rayon.dp)
    Column(modifier.clip(forme).background(p.surface.compose).border(BorderStroke(1.dp, p.bordure.compose), forme).padding(12.dp)) {
        Icone(icone, description = null, teinte = p.accent.compose, taille = 16.dp)
        Spacer(Modifier.height(8.dp))
        Text(valeur, style = Texte.titreSection, color = p.encre.compose, maxLines = 1)
        Text(libelle, style = Texte.secondaire, color = p.encreAttenuee.compose)
    }
}

private val INITIALES_MOIS = listOf("J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D")

/** Douze barres d'un seul ton ; le mois le plus écouté est à l'accent plein. */
@Composable
private fun Mois(parMois: List<Int>) {
    val p = LocalPalette.current
    val max = parMois.max().coerceAtLeast(1)
    val haut = parMois.indexOf(parMois.max())
    val accent = p.accent.compose
    val rail = p.bordure.compose
    Column(Modifier.fillMaxWidth()) {
        Canvas(Modifier.fillMaxWidth().height(110.dp).semantics { contentDescription = "Écoutes par mois, au plus ${n(max)} en un mois" }) {
            val pas = size.width / 12f
            val largeur = pas - 6.dp.toPx()
            parMois.forEachIndexed { i, v ->
                val h = v.toFloat() / max * size.height
                if (h > 0f) {
                    drawRoundRect(
                        if (i == haut) accent else accent.copy(alpha = 0.4f),
                        topLeft = Offset(i * pas + 3.dp.toPx(), size.height - h),
                        size = Size(largeur, h),
                        cornerRadius = CornerRadius(3.dp.toPx()),
                    )
                }
            }
            drawLine(rail, Offset(0f, size.height), Offset(size.width, size.height), strokeWidth = 1.dp.toPx())
        }
        Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
            INITIALES_MOIS.forEach { Text(it, style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center) }
        }
    }
}
