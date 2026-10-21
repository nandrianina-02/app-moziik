package com.moziik.app.ui.recherche

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.Cible
import com.moziik.app.donnees.catalogue.Resultat
import com.moziik.app.donnees.catalogue.SectionResultats
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.lecteur.EtatLecteur
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.Lancement
import com.moziik.app.ui.composants.CarteArtiste
import com.moziik.app.ui.composants.CarteCollection
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.EnTeteSection
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LigneTitre
import com.moziik.app.ui.composants.MessageErreur
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.apparitionUneFois
import com.moziik.app.ui.composants.pressable
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.rememberLancement

/**
 * La recherche (app/recherche/page.tsx) : un champ, les filtres par type,
 * le meilleur résultat puis les sections. Avant toute saisie, les
 * dernières recherches et les titres populaires du mois.
 */
@Composable
fun EcranRecherche(termeDemande: String?, onTermeConsomme: () -> Unit) {
    val c = conteneur()
    val modele: ModeleRecherche = viewModel { ModeleRecherche(c.catalogue, c.historiqueRecherche) }
    val terme by modele.terme.collectAsStateWithLifecycle()
    val type by modele.type.collectAsStateWithLifecycle()
    val etat by modele.etat.collectAsStateWithLifecycle()
    val populaires by modele.populaires.collectAsStateWithLifecycle()
    val recentes by c.historiqueRecherche.termes.collectAsStateWithLifecycle()
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    val lancement = rememberLancement()
    val clavier = LocalSoftwareKeyboardController.current
    val p = LocalPalette.current

    // Arrivée depuis un lien de l'accueil (« /recherche?q=chill »).
    LaunchedEffect(termeDemande) {
        if (termeDemande != null) {
            modele.saisir(termeDemande)
            onTermeConsomme()
        }
    }

    val liste = rememberLazyListState()
    // Faire défiler les résultats range le clavier : il cachait la moitié de l'écran.
    LaunchedEffect(liste) {
        snapshotFlow { liste.isScrollInProgress }.collect { if (it) clavier?.hide() }
    }
    val vus = remember { mutableSetOf<Any>() }
    val actif = terme.trim().length >= 2

    Column(Modifier.fillMaxSize()) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp)) {
            Text("Recherche", style = Texte.titreFiche, color = p.encre.compose)
            Spacer(Modifier.height(16.dp))
            ChampRecherche(
                valeur = terme,
                onChange = modele::saisir,
                chargement = etat.chargement,
                onValider = {
                    clavier?.hide()
                    modele.retenir(terme)
                },
            )
        }
        if (actif) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(TypeRecherche.entries) { t -> Filtre(t.libelle, t == type) { modele.choisir(t) } }
            }
        } else {
            Spacer(Modifier.height(16.dp))
        }

        LazyColumn(Modifier.fillMaxSize(), state = liste, contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp)) {
            if (!actif) {
                etatParDefaut(recentes, populaires, lecture, lancement, modele::saisir, c.historiqueRecherche::retirer, c.historiqueRecherche::effacer)
                return@LazyColumn
            }
            etat.erreur?.let { message -> item(key = "erreur") { MessageErreur(message, Modifier.padding(bottom = 16.dp)) } }
            val resultats = etat.resultats
            if (resultats == null) {
                if (etat.chargement) item(key = "attente") { Attente() }
                return@LazyColumn
            }
            if (resultats.vide) {
                item(key = "vide") { AucunResultat(terme.trim()) }
                return@LazyColumn
            }
            if (resultats.approximatif) {
                item(key = "approximatif") {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(bottom = 16.dp)
                            .clip(RoundedCornerShape(p.rayon.dp))
                            .border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(p.rayon.dp))
                            .background(p.surface.compose)
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                    ) {
                        Icone(R.drawable.lucide_sparkles, description = null, teinte = p.accent.compose, taille = 15.dp, modifier = Modifier.padding(top = 2.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Aucun résultat exact : voici ce qui s'en approche le plus.", style = Texte.corps, color = p.encreAttenuee.compose)
                    }
                }
            }
            val source = "« ${terme.trim()} »"
            resultats.meilleur?.let { meilleur ->
                item(key = "meilleur") {
                    Column(Modifier.padding(bottom = 28.dp).apparitionUneFois("meilleur-${terme.trim()}", 0, vus)) {
                        EnTeteSection("Meilleur résultat")
                        MeilleurResultat(meilleur, lancement, source)
                    }
                }
            }
            resultats.sections.forEachIndexed { rang, section ->
                item(key = "section-${section.cle}") {
                    Column(Modifier.padding(bottom = 28.dp).apparitionUneFois("${terme.trim()}-$type-${section.cle}", minOf(rang + 1, 6), vus)) {
                        EnTeteSection(section.titre, "${section.total} résultat${if (section.total > 1) "s" else ""}")
                        BlocResultats(section, type != TypeRecherche.TOUT, lecture, lancement, source)
                    }
                }
            }
            val chargees = resultats.sections.sumOf { it.resultats.size }
            if (type != TypeRecherche.TOUT && chargees < resultats.sections.sumOf { it.total }) {
                item(key = "suite") {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Row(
                            Modifier
                                .clip(CircleShape)
                                .border(BorderStroke(1.dp, p.bordure.compose), CircleShape)
                                .clickable(role = Role.Button, enabled = !etat.chargementSuite, onClick = modele::suite)
                                .padding(horizontal = 20.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (etat.chargementSuite) {
                                Egaliseur(hauteur = 12.dp, libelle = "Chargement")
                                Spacer(Modifier.width(8.dp))
                            }
                            Text("Afficher plus", style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encreAttenuee.compose)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChampRecherche(valeur: String, onChange: (String) -> Unit, chargement: Boolean, onValider: () -> Unit) {
    val p = LocalPalette.current
    val interactions = remember { MutableInteractionSource() }
    val actif by interactions.collectIsFocusedAsState()
    val forme = RoundedCornerShape(p.rayon.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .height(48.dp)
            .clip(forme)
            .background(p.surface.compose)
            .border(BorderStroke(1.dp, if (actif) p.accent.compose else p.bordure.compose), forme)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icone(R.drawable.lucide_search, description = null, teinte = p.encreAttenuee.compose, taille = 18.dp)
        Spacer(Modifier.width(10.dp))
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (valeur.isEmpty()) {
                Text(
                    "Rechercher un titre, un artiste, un album…",
                    style = Texte.corps,
                    color = p.encreAttenuee.compose,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            BasicTextField(
                value = valeur,
                onValueChange = onChange,
                singleLine = true,
                textStyle = Texte.corps.copy(color = p.encre.compose),
                cursorBrush = SolidColor(p.accent.compose),
                interactionSource = interactions,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { onValider() }),
                modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Rechercher" },
            )
        }
        when {
            chargement -> Egaliseur(hauteur = 12.dp, libelle = "Recherche en cours")
            valeur.isNotEmpty() -> Box(
                Modifier.size(32.dp).clip(CircleShape).clickable(role = Role.Button) { onChange("") },
                contentAlignment = Alignment.Center,
            ) {
                Icone(R.drawable.lucide_x, description = "Effacer la recherche", teinte = p.encreAttenuee.compose, taille = 16.dp)
            }
        }
    }
}

@Composable
private fun Filtre(libelle: String, actif: Boolean, onClick: () -> Unit) {
    val p = LocalPalette.current
    Text(
        libelle,
        style = Texte.secondaire.copy(fontWeight = FontWeight.Medium),
        color = if (actif) p.base.compose else p.encreAttenuee.compose,
        modifier = Modifier
            .clip(CircleShape)
            .background(if (actif) p.accent.compose else p.base.compose)
            .border(BorderStroke(1.dp, if (actif) p.accent.compose else p.bordure.compose), CircleShape)
            .clickable(role = Role.Tab, onClick = onClick)
            .semantics { selected = actif }
            .padding(horizontal = 14.dp, vertical = 7.dp),
    )
}

@Composable
private fun Attente() {
    Box(Modifier.fillMaxWidth().padding(top = 48.dp), contentAlignment = Alignment.Center) {
        Egaliseur(hauteur = 20.dp, libelle = "Recherche en cours")
    }
}

@Composable
private fun AucunResultat(terme: String) {
    val p = LocalPalette.current
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(p.rayon.dp))
            .border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(p.rayon.dp))
            .padding(horizontal = 16.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icone(R.drawable.lucide_search_x, description = null, teinte = p.encreAttenuee.compose, taille = 28.dp)
        Spacer(Modifier.height(12.dp))
        Text("Aucun résultat pour « $terme »", style = Texte.marque, color = p.encre.compose, textAlign = TextAlign.Center)
        Spacer(Modifier.height(4.dp))
        Text("Vérifie l'orthographe, ou essaie le nom d'un artiste ou d'un genre.", style = Texte.corps, color = p.encreAttenuee.compose, textAlign = TextAlign.Center)
    }
}

/** Avant toute saisie : dernières recherches de l'appareil et titres populaires du mois (D7). */
private fun androidx.compose.foundation.lazy.LazyListScope.etatParDefaut(
    recentes: List<String>,
    populaires: List<Titre>,
    lecture: EtatLecteur,
    lancement: Lancement,
    onChoisir: (String) -> Unit,
    onRetirer: (String) -> Unit,
    onEffacer: () -> Unit,
) {
    item(key = "recentes-titre") {
        val p = LocalPalette.current
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            EnTeteSection("Dernières recherches", modifier = Modifier.weight(1f))
            if (recentes.isNotEmpty()) {
                Text(
                    "Effacer",
                    style = Texte.secondaire.copy(fontWeight = FontWeight.Medium),
                    color = p.accent.compose,
                    modifier = Modifier.clip(RoundedCornerShape(4.dp)).clickable(role = Role.Button, onClick = onEffacer).padding(4.dp),
                )
            }
        }
    }
    if (recentes.isEmpty()) {
        item(key = "recentes-vide") {
            Text("Tes recherches récentes apparaîtront ici.", style = Texte.corps, color = LocalPalette.current.encreAttenuee.compose)
        }
    }
    items(recentes, key = { "recente-$it" }) { terme ->
        val p = LocalPalette.current
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .clickable(role = Role.Button) { onChoisir(terme) }
                .padding(vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(36.dp).clip(CircleShape).background(p.surface.compose), contentAlignment = Alignment.Center) {
                Icone(R.drawable.lucide_history, description = null, teinte = p.encreAttenuee.compose, taille = 16.dp)
            }
            Spacer(Modifier.width(12.dp))
            Text(terme, style = Texte.corps, color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Box(
                Modifier.size(32.dp).clip(CircleShape).clickable(role = Role.Button) { onRetirer(terme) },
                contentAlignment = Alignment.Center,
            ) {
                Icone(R.drawable.lucide_x, description = "Retirer de l'historique", teinte = p.encreAttenuee.compose, taille = 14.dp)
            }
        }
    }
    if (populaires.isNotEmpty()) {
        item(key = "populaires-titre") { EnTeteSection("Suggestions populaires", "Les titres les plus écoutés ce mois-ci", Modifier.padding(top = 28.dp)) }
        itemsIndexed(populaires, key = { _, t -> "populaire-${t.id}" }) { i, titre ->
            LigneTitre(titre, i + 1, titre.id == lecture.courant?.id, lecture.enLecture, onClick = { lancement.titres(populaires, i, "Suggestions populaires") })
        }
    }
}

private fun ouvrir(resultat: Resultat, lancement: Lancement, liste: List<Titre>, source: String) {
    when (resultat) {
        is Resultat.DeTitre -> {
            val position = liste.indexOfFirst { it.id == resultat.titre.id }
            if (position >= 0) lancement.titres(liste, position, source) else lancement.titres(listOf(resultat.titre), 0, source)
        }
        is Resultat.DArtiste -> lancement.cible("artiste-${resultat.artiste.id}", Cible.DArtiste(resultat.artiste.id))
        is Resultat.DAlbum -> lancement.cible("album-${resultat.album.id}", Cible.DAlbum(resultat.album.id))
        is Resultat.DePlaylist -> lancement.cible("playlist-${resultat.playlist.id}", Cible.DePlaylist(resultat.playlist.id))
        is Resultat.DeGenre -> lancement.cible("genre-${resultat.nom}", Cible.DeGenre(resultat.nom))
    }
}

private fun cleDe(resultat: Resultat): String = when (resultat) {
    is Resultat.DeTitre -> "titre-${resultat.titre.id}"
    is Resultat.DArtiste -> "artiste-${resultat.artiste.id}"
    is Resultat.DAlbum -> "album-${resultat.album.id}"
    is Resultat.DePlaylist -> "playlist-${resultat.playlist.id}"
    is Resultat.DeGenre -> "genre-${resultat.nom}"
}

private data class Vue(val titre: String, val ligne: String, val image: String?, val forme: Shape)

/** Le meilleur résultat (TopResult.tsx) : plus grand, avec son type et un bouton de lecture. */
@Composable
private fun MeilleurResultat(resultat: Resultat, lancement: Lancement, source: String) {
    val p = LocalPalette.current
    val carre = RoundedCornerShape(8.dp)
    val vue = when (resultat) {
        is Resultat.DeTitre -> Vue(resultat.titre.title, "Titre · ${resultat.titre.artist?.stageName ?: "Artiste supprimé"}", resultat.titre.coverUrl, carre)
        is Resultat.DArtiste -> Vue(resultat.artiste.stageName, "Artiste", resultat.artiste.coverUrl, CircleShape)
        is Resultat.DAlbum -> Vue(resultat.album.title, "Album · ${resultat.album.artist?.stageName.orEmpty()}".trimEnd(' ', '·'), resultat.album.coverUrl, carre)
        is Resultat.DePlaylist -> Vue(resultat.playlist.title, "Playlist", resultat.playlist.coverUrl, carre)
        is Resultat.DeGenre -> Vue(resultat.nom, "Genre · ${resultat.nombre} titre${if (resultat.nombre > 1) "s" else ""}", null, carre)
    }
    val chargement = lancement.enCours == cleDe(resultat)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(p.rayon.dp))
            .border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(p.rayon.dp))
            .background(p.surface.compose)
            .pressable { ouvrir(resultat, lancement, emptyList(), source) }
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Pochette(vue.image, Modifier.size(72.dp), vue.forme)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(vue.titre, style = Texte.titreSection, color = p.encre.compose, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(2.dp))
            Text(vue.ligne, style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(12.dp))
        Box(Modifier.size(44.dp).clip(CircleShape).background(p.accent.compose), contentAlignment = Alignment.Center) {
            if (chargement) {
                Egaliseur(hauteur = 14.dp, libelle = "Chargement", couleur = p.base.compose)
            } else {
                Icone(R.drawable.lucide_play_plein, description = "Écouter", teinte = p.base.compose, taille = 16.dp, modifier = Modifier.padding(start = 2.dp))
            }
        }
    }
}

@Composable
private fun BlocResultats(section: SectionResultats, enGrille: Boolean, lecture: EtatLecteur, lancement: Lancement, source: String) {
    val titres = section.resultats.filterIsInstance<Resultat.DeTitre>().map { it.titre }
    if (titres.size == section.resultats.size) {
        titres.forEachIndexed { i, titre ->
            LigneTitre(titre, null, titre.id == lecture.courant?.id, lecture.enLecture, onClick = { lancement.titres(titres, i, source) })
        }
        return
    }
    val colonnes = if (section.resultats.firstOrNull() is Resultat.DArtiste) 3 else 2
    if (enGrille) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            section.resultats.chunked(colonnes).forEach { ligne ->
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    ligne.forEach { r -> Vignette(r, lancement, titres, source, Modifier.weight(1f)) }
                    repeat(colonnes - ligne.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    } else {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            items(section.resultats, key = { cleDe(it) }) { r ->
                Vignette(r, lancement, titres, source, Modifier.width(if (r is Resultat.DArtiste) 96.dp else 140.dp))
            }
        }
    }
}

@Composable
private fun Vignette(resultat: Resultat, lancement: Lancement, titres: List<Titre>, source: String, modifier: Modifier) {
    val chargement = lancement.enCours == cleDe(resultat)
    val ouvrir = { ouvrir(resultat, lancement, titres, source) }
    when (resultat) {
        is Resultat.DArtiste -> CarteArtiste(resultat.artiste.stageName, resultat.artiste.coverUrl, resultat.artiste.verified, null, ouvrir, modifier, chargement)
        is Resultat.DAlbum -> CarteCollection(resultat.album.title, resultat.album.artist?.stageName, resultat.album.coverUrl, ouvrir, modifier, resultat.album.artist?.verified == true, chargement)
        is Resultat.DePlaylist -> CarteCollection(resultat.playlist.title, resultat.playlist.owner?.name, resultat.playlist.coverUrl, ouvrir, modifier, chargement = chargement)
        is Resultat.DeGenre -> CarteCollection(resultat.nom, "${resultat.nombre} titre${if (resultat.nombre > 1) "s" else ""}", null, ouvrir, modifier, chargement = chargement)
        is Resultat.DeTitre -> CarteCollection(resultat.titre.title, resultat.titre.artist?.stageName, resultat.titre.coverUrl, ouvrir, modifier, resultat.titre.artist?.verified == true, chargement)
    }
}
