package com.moziik.app.ui.compte

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.moziik.app.R
import com.moziik.app.donnees.compte.Bilan
import com.moziik.app.donnees.compte.dureeLisible
import com.moziik.app.donnees.compte.moisLePlusEcoute
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.partagerBilanEnImage
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

/** Chaque écran reste sept secondes, comme sur le site (app/bilan/page.tsx). */
private const val DUREE_ECRAN_MS = 7_000

private val chiffres: NumberFormat = NumberFormat.getIntegerInstance(Locale.FRANCE)

private enum class Ecran { Intro, Minutes, Titre, Artiste, Genres, Mois, Resume }

/** Le texte joint à l'image partagée : il passe aussi dans une messagerie sans aperçu. */
fun resumeDuBilan(b: Bilan): String {
    val (duree, unite) = dureeLisible(b.minutes)
    return buildString {
        append("Mon année ${b.annee} sur Moziik : ${chiffres.format(duree)} $unite d'écoute")
        b.topTitres.firstOrNull()?.let { append(", et en tête « ${it.title} »") }
        b.topArtistes.firstOrNull()?.let { append(" — mon artiste : ${it.stageName}") }
        append(".")
    }
}

/**
 * Le bilan raconté écran par écran, à la manière du site : barres de
 * progression, appui à droite pour avancer, à gauche pour revenir, appui
 * long pour mettre en pause. La page qui défile reste la référence ; ceci
 * est la version à regarder, et à partager à la fin.
 */
@Composable
fun HistoireBilan(b: Bilan, onFermer: () -> Unit) {
    val p = LocalPalette.current
    val c = conteneur()
    val contexte = LocalContext.current
    val ecrans = remember(b) {
        listOfNotNull(
            Ecran.Intro,
            Ecran.Minutes,
            Ecran.Titre.takeIf { b.topTitres.isNotEmpty() },
            Ecran.Artiste.takeIf { b.topArtistes.isNotEmpty() },
            Ecran.Genres.takeIf { b.topGenres.isNotEmpty() },
            Ecran.Mois.takeIf { b.parMois.size == 12 && b.parMois.any { it > 0 } },
            Ecran.Resume,
        )
    }
    var index by remember { mutableIntStateOf(0) }
    var enPause by remember { mutableStateOf(false) }
    val avance = remember { Animatable(0f) }
    // L'écran dont la barre est en cours : une pause la fige, une reprise repart d'où elle était.
    val anime = remember { intArrayOf(-1) }

    LaunchedEffect(index, enPause) {
        if (anime[0] != index) {
            avance.snapTo(0f)
            anime[0] = index
        }
        if (enPause) return@LaunchedEffect
        val reste = ((1f - avance.value) * DUREE_ECRAN_MS).toInt().coerceAtLeast(1)
        avance.animateTo(1f, tween(reste, easing = LinearEasing))
        if (index < ecrans.lastIndex) index++
    }

    Dialog(onDismissRequest = onFermer, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(
            Modifier
                .fillMaxSize()
                .background(p.base.compose)
                .systemBarsPadding()
                .pointerInput(ecrans.size) {
                    detectTapGestures(
                        onPress = {
                            enPause = true
                            tryAwaitRelease()
                            enPause = false
                        },
                        onTap = { position ->
                            if (position.x < size.width / 3f) index = (index - 1).coerceAtLeast(0)
                            else if (index < ecrans.lastIndex) index++
                        },
                    )
                },
        ) {
            Column(Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 12.dp)) {
                // Une barre par écran : pleine, en cours, ou vide.
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    ecrans.indices.forEach { i ->
                        val rempli = when {
                            i < index -> 1f
                            i == index -> avance.value
                            else -> 0f
                        }
                        Box(Modifier.weight(1f).height(3.dp).clip(CircleShape).background(p.bordure.compose)) {
                            Box(Modifier.fillMaxHeight().fillMaxWidth(rempli).background(p.encre.compose))
                        }
                    }
                }
                Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("TON ANNÉE ${b.annee}", style = Texte.surtitre, color = p.encreAttenuee.compose, modifier = Modifier.weight(1f))
                    Box(
                        Modifier.size(40.dp).clip(CircleShape).clickable(role = Role.Button, onClickLabel = "Fermer", onClick = onFermer),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icone(R.drawable.lucide_x, description = "Fermer", teinte = p.encre.compose, taille = 20.dp)
                    }
                }
                AnimatedContent(
                    targetState = ecrans[index],
                    transitionSpec = { (fadeIn(tween(300)) + slideInVertically(tween(300)) { it / 24 }) togetherWith fadeOut(tween(150)) },
                    label = "bilan",
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                ) { ecran ->
                    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center) {
                        when (ecran) {
                            Ecran.Intro -> {
                                Text("Ton année", style = Texte.titreFiche.copy(fontSize = 44.sp, lineHeight = 48.sp), color = p.encre.compose)
                                Text("en musique.", style = Texte.titreFiche.copy(fontSize = 44.sp, lineHeight = 48.sp), color = p.accent.compose)
                                Spacer(Modifier.height(16.dp))
                                Text("Appuie à droite pour avancer, à gauche pour revenir, longuement pour mettre en pause.", style = Texte.corps, color = p.encreAttenuee.compose)
                            }
                            Ecran.Minutes -> {
                                val (duree, unite) = dureeLisible(b.minutes)
                                Text("Tu as écouté", style = Texte.titreSection, color = p.encreAttenuee.compose)
                                Text(chiffres.format(duree), style = Texte.titreFiche.copy(fontSize = 84.sp, lineHeight = 88.sp), color = p.accent.compose)
                                Text("$unite de musique", style = Texte.titreFiche, color = p.encre.compose)
                                Spacer(Modifier.height(12.dp))
                                Text(
                                    "${chiffres.format(b.ecoutes)} écoutes, ${chiffres.format(b.titresDifferents)} titres et ${chiffres.format(b.artistesDifferents)} artistes, en ${chiffres.format(b.joursActifs)} jours.",
                                    style = Texte.corps, color = p.encreAttenuee.compose,
                                )
                            }
                            Ecran.Titre -> b.topTitres.first().let { t ->
                                Text("Ton titre de l'année", style = Texte.titreSection, color = p.encreAttenuee.compose)
                                Spacer(Modifier.height(16.dp))
                                Pochette(t.coverUrl, Modifier.size(220.dp))
                                Spacer(Modifier.height(16.dp))
                                Text(t.title, style = Texte.titreFiche, color = p.encre.compose, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                t.artist?.stageName?.let { Text(it, style = Texte.corps, color = p.encreAttenuee.compose) }
                                Text("${chiffres.format(t.ecoutes)} écoutes", style = Texte.corpsFort, color = p.accent.compose, modifier = Modifier.padding(top = 8.dp))
                            }
                            Ecran.Artiste -> b.topArtistes.first().let { a ->
                                Text("Ton artiste de l'année", style = Texte.titreSection, color = p.encreAttenuee.compose)
                                Spacer(Modifier.height(16.dp))
                                Pochette(a.coverUrl, Modifier.size(200.dp), forme = CircleShape)
                                Spacer(Modifier.height(16.dp))
                                Text(a.stageName, style = Texte.titreFiche.copy(fontSize = 34.sp, lineHeight = 38.sp), color = p.encre.compose)
                                Text("${chiffres.format(a.ecoutes)} écoutes", style = Texte.corpsFort, color = p.accent.compose, modifier = Modifier.padding(top = 8.dp))
                            }
                            Ecran.Genres -> {
                                Text("Tes genres", style = Texte.titreSection, color = p.encreAttenuee.compose)
                                Spacer(Modifier.height(12.dp))
                                b.topGenres.forEachIndexed { i, g ->
                                    Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Text("${i + 1}", style = Texte.titreSection, color = p.encreAttenuee.compose, modifier = Modifier.width(32.dp))
                                        Text(
                                            g.genre,
                                            style = Texte.titreFiche.copy(fontSize = if (i == 0) 36.sp else 26.sp, lineHeight = if (i == 0) 40.sp else 30.sp),
                                            color = if (i == 0) p.accent.compose else p.encre.compose,
                                        )
                                    }
                                }
                            }
                            Ecran.Mois -> {
                                Text("Ton mois le plus actif", style = Texte.titreSection, color = p.encreAttenuee.compose)
                                moisLePlusEcoute(b.parMois)?.let {
                                    Text(it.replaceFirstChar { l -> l.uppercase() }, style = Texte.titreFiche.copy(fontSize = 52.sp, lineHeight = 56.sp), color = p.accent.compose)
                                }
                                Spacer(Modifier.height(24.dp))
                                Mois(b.parMois)
                            }
                            Ecran.Resume -> {
                                val (duree, unite) = dureeLisible(b.minutes)
                                Text("Ton année ${b.annee}", style = Texte.titreFiche.copy(fontSize = 34.sp, lineHeight = 38.sp), color = p.encre.compose)
                                Spacer(Modifier.height(20.dp))
                                LigneResume("Écoute", "${chiffres.format(duree)} $unite")
                                b.topTitres.firstOrNull()?.let { LigneResume("Titre", it.title) }
                                b.topArtistes.firstOrNull()?.let { LigneResume("Artiste", it.stageName) }
                                b.topGenres.firstOrNull()?.let { LigneResume("Genre", it.genre) }
                                Spacer(Modifier.height(28.dp))
                                Row(
                                    Modifier.clip(CircleShape).background(p.accent.compose)
                                        .clickable(role = Role.Button) { c.portee.launch { partagerBilanEnImage(contexte, b, resumeDuBilan(b), p.accent.compose) } }
                                        .padding(horizontal = 20.dp, vertical = 12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Icone(R.drawable.lucide_share_2, description = null, teinte = p.base.compose, taille = 16.dp)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Partager en image", style = Texte.corpsFort, color = p.base.compose)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LigneResume(libelle: String, valeur: String) {
    val p = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(libelle.uppercase(), style = Texte.surtitre, color = p.encreAttenuee.compose, modifier = Modifier.width(88.dp))
        Text(valeur, style = Texte.titreSection.copy(fontWeight = FontWeight.SemiBold), color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
