package com.moziik.app.ui.accueil

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.Section
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.Lancement
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.menus.LocalMenus
import com.moziik.app.ui.navigation
import kotlinx.coroutines.launch
import java.util.Calendar

/*
 * L'en-tête et l'accès rapide de l'accueil, comme sur le site
 * (AccueilEntete.tsx, AccesRapide.tsx) : une salutation, une rangée de
 * puces, puis huit tuiles à reprendre d'un geste.
 */

/** Ce que l'accueil montre : tout, ou une seule sorte de contenu. */
enum class FiltreAccueil(val libelle: String) { TOUT("Tout"), TITRES("Titres"), ALBUMS("Albums"), PLAYLISTS("Playlists") }

/** Les sections gardées par un filtre (« Tout » les garde toutes). */
fun FiltreAccueil.garde(section: Section): Boolean = when (this) {
    FiltreAccueil.TOUT -> true
    FiltreAccueil.TITRES -> section is Section.Titres || section is Section.PourToi
    FiltreAccueil.ALBUMS -> section is Section.Albums
    FiltreAccueil.PLAYLISTS -> section is Section.Playlists || section is Section.Collection
}

private fun salutation(): String {
    val h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    return when {
        h < 5 -> "Bonne nuit"
        h < 12 -> "Bonjour"
        h < 18 -> "Bon après-midi"
        else -> "Bonsoir"
    }
}

@Composable
fun EnTeteSalutation(prenom: String?, filtre: FiltreAccueil, onFiltre: (FiltreAccueil) -> Unit) {
    val p = LocalPalette.current
    val nav = navigation()
    Column(Modifier.padding(top = 8.dp, bottom = 16.dp)) {
        Text(
            salutation() + (prenom?.let { ", $it" } ?: ""),
            style = Texte.titreFiche,
            color = p.encre.compose,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Row(
            Modifier.padding(top = 12.dp).horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            FiltreAccueil.entries.forEach { f ->
                Puce(f.libelle, actif = f == filtre, icone = null) { onFiltre(f) }
            }
            Box(Modifier.padding(horizontal = 2.dp).width(1.dp).height(20.dp).background(p.bordure.compose))
            Puce("Classements", false, R.drawable.lucide_trophy) { nav.classements() }
            Puce("Artistes", false, R.drawable.lucide_mic_vocal) { nav.classements("artists") }
            Puce("Radio", false, R.drawable.lucide_radio) { nav.radio() }
            Puce("Évènements", false, R.drawable.lucide_calendar_days) { nav.evenements() }
            Puce("Blind test", false, R.drawable.lucide_gamepad_2) { nav.blindTest() }
        }
    }
}

@Composable
private fun Puce(libelle: String, actif: Boolean, icone: Int?, onClick: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier
            .clip(CircleShape)
            .background(if (actif) p.encre.compose else p.encre.compose.copy(alpha = 0.08f))
            .combinedClickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icone != null) {
            Icone(icone, description = null, teinte = p.encreAttenuee.compose, taille = 14.dp)
            Spacer(Modifier.width(6.dp))
        }
        Text(
            libelle,
            style = Texte.corps.copy(fontWeight = FontWeight.Medium),
            color = if (actif) p.base.compose else if (icone != null) p.encreAttenuee.compose else p.encre.compose,
            maxLines = 1,
        )
    }
}

/**
 * Huit tuiles : la bande son, les titres aimés, puis les dernières écoutes
 * du compte ; pour un visiteur, les titres du moment. Un appui lance
 * l'écoute, un appui long ouvre le menu du titre.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun GrilleAccesRapide(secours: List<Titre>, lancement: Lancement, modifier: Modifier = Modifier) {
    val c = conteneur()
    val p = LocalPalette.current
    val menus = LocalMenus.current
    val session by c.session.etat.collectAsStateWithLifecycle()
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    val portee = rememberCoroutineScope()
    val connecte = session is EtatSession.Connecte
    val recents by produceState<List<Titre>?>(null, connecte) {
        value = if (connecte) runCatching { c.bibliotheque.recents() }.getOrDefault(emptyList()) else emptyList()
    }
    val titres = (recents?.takeIf { it.isNotEmpty() } ?: secours).take(if (connecte) 6 else 7)
    val source = if (connecte && !recents.isNullOrEmpty()) "Récemment écoutés" else "Accueil"

    data class Tuile(val cle: String, val titre: String, val image: String?, val icone: Int?, val enCours: Boolean, val action: () -> Unit, val appuiLong: (() -> Unit)?)

    val tuiles = buildList {
        add(Tuile("bande-son", if (connecte) "Ma bande son" else "Sélection Moziik", null, R.drawable.lucide_headphones, lancement.enCours == "station", { lancement.station() }, null))
        if (connecte) {
            add(
                Tuile("aimes", "Titres aimés", null, R.drawable.lucide_heart, false, {
                    portee.launch {
                        runCatching { c.bibliotheque.titresAimes() }
                            .onSuccess { if (it.isEmpty()) c.alertes.signaler(AlerteLecture.Message("Aucun titre aimé pour l'instant.")) else c.lecteur.lire(it, 0, "Titres aimés") }
                            .onFailure { c.alertes.signaler(AlerteLecture.Message("Les titres aimés n'ont pas pu être chargés.")) }
                    }
                }, null),
            )
        }
        titres.forEachIndexed { i, t ->
            add(Tuile(t.id, t.title, t.coverUrl, null, lecture.courant?.id == t.id, { c.lecteur.lire(titres, i, source) }, { menus.titre(t, source) }))
        }
    }.take(8)

    if (connecte && recents == null) return
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tuiles.chunked(2).forEach { ligne ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ligne.forEach { t ->
                    Row(
                        Modifier
                            .weight(1f)
                            .height(56.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(p.encre.compose.copy(alpha = 0.07f))
                            .combinedClickable(role = Role.Button, onClick = t.action, onLongClick = t.appuiLong, onLongClickLabel = t.appuiLong?.let { "Plus d'options" }),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (t.icone != null) {
                            Box(Modifier.size(56.dp).background(p.accent.compose), contentAlignment = Alignment.Center) {
                                Icone(t.icone, description = null, teinte = p.base.compose, taille = 22.dp)
                            }
                        } else {
                            Pochette(t.image, Modifier.size(56.dp).fillMaxHeight(), RoundedCornerShape(0.dp))
                        }
                        Text(
                            t.titre,
                            style = Texte.secondaire.copy(fontWeight = FontWeight.SemiBold),
                            color = if (t.enCours) p.accent.compose else p.encre.compose,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f).padding(horizontal = 10.dp),
                        )
                        if (t.enCours && lecture.enLecture) {
                            Egaliseur(hauteur = 12.dp, libelle = "En cours", modifier = Modifier.padding(end = 10.dp))
                        }
                    }
                }
                // Une ligne impaire garde la largeur d'une tuile vide.
                if (ligne.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}
