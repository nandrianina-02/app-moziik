@file:OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)

package com.moziik.app.ui.decouvrir

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.EntreeClassement
import com.moziik.app.donnees.catalogue.ReponseRadio
import com.moziik.app.donnees.catalogue.STATIONS
import com.moziik.app.donnees.catalogue.STATION_GENERALE
import com.moziik.app.donnees.catalogue.StationRadio
import com.moziik.app.donnees.catalogue.resoudreStation
import com.moziik.app.donnees.catalogue.stationDeGenre
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.Lancement
import com.moziik.app.ui.accueil.CarteBandeSon
import com.moziik.app.ui.composants.CarteArtiste
import com.moziik.app.ui.composants.CarteCollection
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.EnTeteSection
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.Puce
import com.moziik.app.ui.composants.pressable
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.fiches.BarreRetour
import com.moziik.app.ui.fiches.EtatFiche
import com.moziik.app.ui.fiches.ModeleFiche
import com.moziik.app.ui.navigation
import com.moziik.app.ui.rememberLancement
import androidx.compose.foundation.lazy.rememberLazyListState
import com.moziik.app.ui.fiches.BarreCollante

/** Les pictogrammes des stations, ceux de la page Radio du site. */
private val ICONES = mapOf(
    "tendances" to R.drawable.lucide_flame,
    "favoris" to R.drawable.lucide_heart,
    "nouveautes" to R.drawable.lucide_sparkles,
    "afro" to R.drawable.lucide_mic_vocal,
    "rock" to R.drawable.lucide_guitar,
    "instrumental" to R.drawable.lucide_piano,
    "jazz" to R.drawable.lucide_music_2,
    "gospel" to R.drawable.lucide_sparkles,
)

/**
 * La radio (D13) : lancer tout le catalogue au hasard, sa bande son, les
 * stations nommées et de genre, puis ce qui s'écoute en ce moment.
 * `/radio?station=<clé>` lance la station à l'ouverture.
 */
@Composable
fun EcranRadio(station: String?, onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val lancement = rememberLancement()
    val modele: ModeleFiche<ReponseRadio> = viewModel { ModeleFiche { c.catalogue.radio() } }
    val etat by modele.etat.collectAsStateWithLifecycle()
    val session by c.session.etat.collectAsStateWithLifecycle()

    // Une seule fois par ouverture : revenir sur l'écran ne relance pas la station.
    var demandeTraitee by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(station) {
        if (demandeTraitee || station.isNullOrBlank()) return@LaunchedEffect
        demandeTraitee = true
        val trouvee = resoudreStation(station)
        if (trouvee != null) lancement.stationRadio(trouvee) else c.alertes.signaler(AlerteLecture.Message("Cette station n'existe pas."))
    }

    val liste = rememberLazyListState()
    LazyColumn(Modifier.fillMaxSize(), state = liste, contentPadding = PaddingValues(bottom = 32.dp)) {
        stickyHeader(key = "retour") { BarreCollante(onRetour, "Radio Moziik", liste) }
        item(key = "entete") {
            Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp)) {
                Text("Radio Moziik", style = Texte.titreFiche, color = p.encre.compose)
                Spacer(Modifier.height(6.dp))
                Text(
                    "Une sélection aléatoire et continue parmi tous les sons publiés sur la plateforme. Parfait pour découvrir de nouveaux artistes.",
                    style = Texte.corps, color = p.encreAttenuee.compose,
                )
                Spacer(Modifier.height(16.dp))
                Row(
                    Modifier
                        .clip(CircleShape)
                        .background(p.accent.compose)
                        .pressable { lancement.stationRadio(STATION_GENERALE) }
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (lancement.enCours == STATION_GENERALE.cle) {
                        Egaliseur(hauteur = 14.dp, libelle = "Chargement", couleur = p.base.compose)
                    } else {
                        Icone(R.drawable.lucide_radio, description = null, teinte = p.base.compose, taille = 16.dp)
                    }
                    Spacer(Modifier.width(8.dp))
                    Text("Lancer la radio", style = Texte.corpsFort, color = p.base.compose)
                }
            }
        }
        item(key = "bande-son") {
            val connecte = session as? EtatSession.Connecte
            Box(Modifier.padding(horizontal = 16.dp)) {
                CarteBandeSon(connecte?.utilisateur?.name?.trim()?.split(Regex("\\s+"))?.firstOrNull(), connecte?.utilisateur?.avatarUrl, lancement)
            }
        }
        item(key = "stations") {
            Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 28.dp)) {
                EnTeteSection("Stations rapides")
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    STATIONS.chunked(2).forEach { paire ->
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            paire.forEach { s -> TuileStation(s, lancement, Modifier.weight(1f)) }
                        }
                    }
                }
            }
        }
        when (val e = etat) {
            EtatFiche.Chargement -> item(key = "attente") {
                Box(Modifier.fillMaxWidth().padding(top = 32.dp), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 18.dp) }
            }
            // Les blocs du bas complètent la page : sans eux, la radio reste utilisable.
            is EtatFiche.Erreur -> Unit
            is EtatFiche.Prete -> {
                val radio = e.donnees
                if (radio.topToday.isNotEmpty()) {
                    item(key = "jour") {
                        Column(Modifier.padding(top = 28.dp)) {
                            EnTeteSection("Les plus écoutés aujourd'hui", modifier = Modifier.padding(horizontal = 16.dp))
                            LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                items(radio.topToday, key = { it.id }) { t ->
                                    CarteCollection(t.libelle, t.artistName, t.image, onClick = { nav.titre(t.id) }, modifier = Modifier.width(128.dp), verifie = t.verified)
                                }
                            }
                        }
                    }
                }
                if (radio.trending.isNotEmpty()) {
                    item(key = "tendances") {
                        Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 28.dp)) {
                            EnTeteSection("Tendances", "En progression sur sept jours", icone = R.drawable.lucide_trending_up)
                            radio.trending.forEach { t -> LigneTendance(t) { nav.titre(t.id) } }
                        }
                    }
                }
                if (radio.genres.isNotEmpty()) {
                    item(key = "genres") {
                        Column(Modifier.padding(top = 28.dp)) {
                            EnTeteSection("Genres populaires", modifier = Modifier.padding(horizontal = 16.dp))
                            LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                items(radio.genres, key = { it.genre }) { g ->
                                    val s = stationDeGenre(g.genre)
                                    Puce(if (lancement.enCours == s.cle) "${g.genre}…" else g.genre, actif = false) { lancement.stationRadio(s) }
                                }
                            }
                        }
                    }
                }
                if (radio.recommendedArtists.isNotEmpty()) {
                    item(key = "artistes") {
                        Column(Modifier.padding(top = 28.dp)) {
                            EnTeteSection("Artistes recommandés", modifier = Modifier.padding(horizontal = 16.dp))
                            LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                items(radio.recommendedArtists, key = { it.id }) { a ->
                                    CarteArtiste(a.stageName, a.coverUrl, a.verified, null, onClick = { nav.artiste(a.id) }, modifier = Modifier.width(96.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Une station : un aplat fixe, son pictogramme, son nom et ce qu'on y entend. */
@Composable
private fun TuileStation(station: StationRadio, lancement: Lancement, modifier: Modifier) {
    val p = LocalPalette.current
    Column(
        modifier
            .aspectRatio(4f / 3f)
            .clip(RoundedCornerShape(p.rayon.dp))
            .background(Color(station.couleur))
            .pressable { lancement.stationRadio(station) }
            .padding(14.dp),
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        if (lancement.enCours == station.cle) {
            Egaliseur(hauteur = 18.dp, libelle = "Chargement", couleur = Color.White)
        } else {
            Icone(ICONES[station.cle] ?: R.drawable.lucide_music_2, description = null, teinte = Color.White, taille = 20.dp)
        }
        Column {
            Text(station.libelle, style = Texte.corpsFort, color = Color.White)
            Text(station.description, style = Texte.secondaire.copy(fontSize = 11.sp), color = Color.White.copy(alpha = 0.8f), maxLines = 2)
        }
    }
}

@Composable
private fun LigneTendance(t: EntreeClassement, onClick: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).pressable(onClick = onClick).padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Pochette(t.image, Modifier.width(44.dp).aspectRatio(1f), RoundedCornerShape(8.dp))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(t.libelle, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1)
            t.artistName?.let { Text(it, style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1) }
        }
        t.evolution?.takeIf { it > 0 }?.let {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icone(R.drawable.lucide_trending_up, description = null, teinte = p.verifie.compose, taille = 12.dp)
                Spacer(Modifier.width(3.dp))
                Text("+$it", style = Texte.secondaire, color = p.verifie.compose, textAlign = TextAlign.End)
            }
        }
    }
}
