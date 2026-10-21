package com.moziik.app.ui.fiches

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.Paroles
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.donnees.session.appel
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LigneTitre
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.duree
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.lecteur.BadgeParoles
import com.moziik.app.ui.menus.LocalMenus
import com.moziik.app.ui.navigation
import com.moziik.app.ui.partager
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

data class DonneesTitre(val titre: Titre, val similaires: List<Titre>, val paroles: Paroles?)

/**
 * La fiche titre (D10) : pochette, artiste et album, écouter, j'aime,
 * partager, les paroles telles quelles et les titres proches.
 */
@Composable
fun FicheTitre(id: String, onRetour: () -> Unit) {
    val c = conteneur()
    val modele: ModeleFiche<DonneesTitre> = viewModel {
        ModeleFiche {
            coroutineScope {
                val similaires = async { runCatching { c.catalogue.similaires(id) }.getOrDefault(emptyList()) }
                val paroles = async { runCatching { c.catalogue.paroles(id) }.getOrNull() }
                DonneesTitre(c.catalogue.titre(id), similaires.await(), paroles.await())
            }
        }
    }
    val etat by modele.etat.collectAsStateWithLifecycle()
    ContenuFiche(etat, modele::recharger) { donnees -> CorpsTitre(donnees, onRetour) }
}

@Composable
private fun CorpsTitre(donnees: DonneesTitre, onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val menus = LocalMenus.current
    val contexte = LocalContext.current
    val portee = rememberCoroutineScope()
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    val session by c.session.etat.collectAsStateWithLifecycle()
    val connecte = session is EtatSession.Connecte
    val titre = donnees.titre
    var aime by remember(titre.id) { mutableStateOf(false) }
    var aimes by remember(titre.id) { mutableStateOf(titre.likesCount) }
    LaunchedEffect(titre.id, connecte) {
        aime = connecte && appel { c.reseau.api.aime(titre.id).liked }.getOrDefault(false)
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 32.dp)) {
        item(key = "retour") { BarreRetour(onRetour) }
        item(key = "entete") {
            EnTeteFiche(
                pochette = titre.coverUrl,
                banniere = titre.coverUrl,
                type = "Titre",
                titre = titre.title,
                sousTitre = { LienArtiste(titre.artist?.stageName, titre.artist?.verified == true, titre.artist?.id?.let { a -> { nav.artiste(a) } }) },
                pastilles = listOfNotNull(
                    titre.genre,
                    annee(titre.releaseDate),
                    duree(titre.duration),
                    nombre(titre.playsCount, "écoute"),
                    "$aimes j'aime",
                ),
            ) {
                BoutonFiche(R.drawable.lucide_play_plein, "Écouter", onClick = { c.lecteur.lire(listOf(titre), 0, titre.title) }, principal = true)
                BoutonFiche(
                    if (aime) R.drawable.lucide_heart_plein else R.drawable.lucide_heart,
                    if (aime) "Aimé" else "J'aime",
                    actif = aime,
                    onClick = {
                        if (!connecte) {
                            c.alertes.signaler(AlerteLecture.Message("Connecte-toi pour aimer un son."))
                            return@BoutonFiche
                        }
                        val avant = aime
                        aime = !avant
                        portee.launch {
                            appel { c.reseau.api.basculerAime(titre.id) }
                                .onSuccess {
                                    aime = it.liked
                                    menus.bibliothequeChangee()
                                    if (it.liked != avant) aimes += if (it.liked) 1 else -1
                                }
                                .onFailure {
                                    aime = avant
                                    c.alertes.signaler(AlerteLecture.Message(messageErreur(it)))
                                }
                        }
                    },
                )
                BoutonFiche(
                    R.drawable.lucide_share_2, null,
                    onClick = {
                        partager(contexte, "son/${titre.id}", titre.title)
                        // Compté côté site, sans attendre ni signaler d'échec : le partage a eu lieu.
                        portee.launch { appel { c.reseau.api.partage(titre.id) } }
                    },
                    description = "Partager",
                )
            }
        }
        titre.album?.takeIf { it.title != null }?.let { album ->
            item(key = "album") {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(start = 16.dp, end = 16.dp, top = 24.dp)
                        .clip(RoundedCornerShape(p.rayon.dp))
                        .border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(p.rayon.dp))
                        .background(p.surface.compose)
                        .clickable(role = Role.Button) { nav.album(album.id) }
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Pochette(album.coverUrl, Modifier.size(48.dp), RoundedCornerShape(8.dp))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Extrait de", style = Texte.secondaire, color = p.encreAttenuee.compose)
                        Text(album.title.orEmpty(), style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Icone(R.drawable.lucide_disc_3, description = null, teinte = p.encreAttenuee.compose, taille = 18.dp)
                }
            }
        }
        val paroles = donnees.paroles
        if (paroles != null && !paroles.vides) {
            item(key = "paroles") {
                SectionFiche("Paroles") {
                    Column(Modifier.padding(horizontal = 16.dp)) {
                        BadgeParoles(paroles.synchronisees)
                        Spacer(Modifier.size(12.dp))
                        Text(
                            paroles.lignes.joinToString("\n") { it.texte }.trim(),
                            style = Texte.corps.copy(lineHeight = Texte.corps.lineHeight * 1.2f),
                            color = p.encre.compose,
                        )
                        paroles.credits?.let {
                            Spacer(Modifier.size(12.dp))
                            Text("Transcription : $it", style = Texte.secondaire, color = p.encreAttenuee.compose)
                        }
                    }
                }
            }
        }
        if (donnees.similaires.isNotEmpty()) {
            item(key = "similaires") { SectionFiche("Titres similaires") {} }
            itemsIndexed(donnees.similaires, key = { _, t -> "similaire-${t.id}" }) { i, t ->
                LigneTitre(
                    t, null, t.id == lecture.courant?.id, lecture.enLecture,
                    onClick = { c.lecteur.lire(donnees.similaires, i, "Proche de « ${titre.title} »") },
                    modifier = Modifier.padding(horizontal = 12.dp),
                    onAppuiLong = { menus.titre(t) },
                )
            }
        }
    }
}
