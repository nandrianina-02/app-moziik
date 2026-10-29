@file:OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)

package com.moziik.app.ui.lecteur

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.Player
import com.moziik.app.R
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.donnees.session.appel
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.lecteur.EtatLecteur
import com.moziik.app.lecteur.TitreLu
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.NomArtiste
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.duree
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.menus.LocalMenus
import com.moziik.app.ui.navigation
import kotlinx.coroutines.launch
import com.moziik.app.ui.horsligne.PastilleTelechargement
import com.moziik.app.lecteur.versTitre
import com.moziik.app.ui.fiches.BlocCommentaires
import com.moziik.app.donnees.horsligne.ActionGardee
import com.moziik.app.lecteur.Veille
import com.moziik.app.ui.composants.rememberTeintePochette
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.ui.graphics.Brush
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import com.moziik.app.ui.menus.Feuille
import com.moziik.app.lecteur.NiveauBass
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.ui.zIndex
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import com.moziik.app.lecteur.PUISSANCE_MAX
import com.moziik.app.donnees.ensemble.EtatEnsemble
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.ChampTexte
import com.moziik.app.ui.partager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalConfiguration

/**
 * Le lecteur plein écran, en deux étages (FullPlayerPage.tsx, mise en page
 * téléphone).
 *
 * Le premier tient sur l'écran sans défiler : pochette, titre, j'aime,
 * progression, commandes. Glissé vers le bas, il rend le mini-lecteur ;
 * glissé vers le haut, il ouvre le second étage, une pleine page où
 * paroles, file d'attente et avis se suivent et se changent en glissant
 * de côté. Le titre et l'artiste ouvrent leur fiche.
 */
@Composable
fun LecteurPleinEcran(etat: EtatLecteur, tiroir: EtatTiroir) {
    val c = conteneur()
    val lecteur = c.lecteur
    val p = LocalPalette.current
    val courant = etat.courant ?: return
    val avancement by rememberAvancement(lecteur, courant.id)
    val nav = navigation()
    val portee = rememberCoroutineScope()
    // Le fond prend la teinte de la pochette, en haut, et rejoint le fond du thème : chaque titre a son ambiance.
    val teinte = rememberTeintePochette(courant.pochette)
    val haut by animateColorAsState(teinte?.copy(alpha = if (p.sombre) 0.75f else 0.22f) ?: p.base.compose, tween(400), label = "teinte")
    var veilleOuverte by remember { mutableStateOf(false) }
    var vitesseOuverte by remember { mutableStateOf(false) }
    var bassesOuvert by remember { mutableStateOf(false) }
    var ensembleOuvert by remember { mutableStateOf(false) }

    // Le second étage est un tiroir dans le tiroir : il suit le doigt de la même façon.
    val hauteur = with(LocalDensity.current) { LocalConfiguration.current.screenHeightDp.dp.toPx() }
    val panneau = remember(hauteur) { EtatTiroir(portee, 0f, hauteur) }
    DisposableEffect(panneau) {
        tiroir.interieur = panneau
        onDispose { if (tiroir.interieur === panneau) tiroir.interieur = null }
    }
    var pageVoulue by rememberSaveable { mutableStateOf(OngletLecteur.PAROLES.ordinal) }

    // Un seul geste vertical pour le premier étage : vers le bas il referme le lecteur, vers le haut il ouvre les pages.
    val geste = rememberDraggableState { d ->
        if (panneau.ouverture > 0f || (d < 0f && tiroir.ouverture >= 1f)) panneau.glisser(d) else tiroir.glisser(d)
    }

    Box(Modifier.fillMaxSize()) {
        // Couvert entièrement, le premier étage n'a plus à être dessiné ni à recevoir les touchers.
        if (panneau.ouverture < 1f) {
            Column(
                Modifier
                    .fillMaxSize()
                    .background(p.base.compose)
                    .background(Brush.verticalGradient(0f to haut, 0.55f to p.base.compose))
                    .draggable(
                        geste,
                        Orientation.Vertical,
                        onDragStopped = { v -> if (panneau.ouverture > 0f) panneau.relacher(v) else tiroir.relacher(v) },
                    ),
            ) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(40.dp).clip(CircleShape).clickable(role = Role.Button, onClick = tiroir::fermer),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icone(R.drawable.lucide_chevron_down, description = "Fermer le lecteur", teinte = p.encreAttenuee.compose, taille = 22.dp)
                    }
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("EN COURS DE LECTURE", style = Texte.surtitre, color = p.encreAttenuee.compose)
                        courant.source?.let {
                            Text(it, style = Texte.secondaire.copy(fontSize = 11.sp), color = p.encreAttenuee.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    Spacer(Modifier.width(40.dp))
                }

                // La pochette prend la place qui reste : sur un petit écran elle rétrécit, rien ne défile.
                Box(
                    Modifier.weight(1f).fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp).glissementDeTitre(courant.id, lecteur),
                    contentAlignment = Alignment.Center,
                ) {
                    Pochette(courant.pochette, Modifier.widthIn(max = 420.dp).aspectRatio(1f), description = "Pochette de ${courant.titre}")
                }

                Column(Modifier.padding(horizontal = 24.dp)) {
                    Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                courant.titre,
                                style = Texte.titreLecteur,
                                color = p.encre.compose,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.clip(RoundedCornerShape(6.dp)).clickable(role = Role.Button, onClickLabel = "Voir la fiche du titre") { nav.titre(courant.id) },
                            )
                            Spacer(Modifier.height(2.dp))
                            NomArtiste(
                                courant.artiste, courant.verifie, taille = 14.dp,
                                modifier = courant.artisteId?.let { a ->
                                    Modifier.clip(RoundedCornerShape(6.dp)).clickable(role = Role.Button, onClickLabel = "Voir l'artiste") { nav.artiste(a) }
                                } ?: Modifier,
                            )
                        }
                        PastilleTelechargement(courant.versTitre(), taille = 34.dp)
                        Spacer(Modifier.width(4.dp))
                        BoutonAime(courant)
                    }
                    Column(Modifier.padding(top = 12.dp)) {
                        BarreProgression(avancement, lecteur::deplacer)
                        Row(Modifier.fillMaxWidth()) {
                            Text(temps(avancement.positionMs), style = Texte.secondaire.copy(fontFeatureSettings = "tnum"), color = p.encreAttenuee.compose)
                            Spacer(Modifier.weight(1f))
                            Text(temps(avancement.dureeMs), style = Texte.secondaire.copy(fontFeatureSettings = "tnum"), color = p.encreAttenuee.compose)
                        }
                    }
                    Transport(etat)
                    OptionsLecture(onVeille = { veilleOuverte = true }, onVitesse = { vitesseOuverte = true }, onBasses = { bassesOuvert = true }, onEnsemble = { ensembleOuvert = true })
                }

                SeuilPages { o ->
                    pageVoulue = o.ordinal
                    panneau.ouvrir()
                }
            }
        }

        if (panneau.ouvert) {
            Box(
                Modifier
                    .fillMaxSize()
                    .graphicsLayer { translationY = (1f - panneau.ouverture) * size.height }
                    .background(p.base.compose)
                    .nestedScroll(panneau.defilement),
            ) {
                PagesLecteur(etat, courant, avancement, panneau, pageVoulue) { pageVoulue = it }
            }
        }
    }
    if (veilleOuverte) ChoixVeille { veilleOuverte = false }
    if (vitesseOuverte) ChoixVitesse { vitesseOuverte = false }
    if (bassesOuvert) ChoixBasses { bassesOuvert = false }
    if (ensembleOuvert) ChoixEnsemble { ensembleOuvert = false }
}

/**
 * Le bas du premier étage : une poignée qui dit qu'on peut monter, et les
 * trois pages, à toucher pour ouvrir directement la bonne.
 */
@Composable
private fun SeuilPages(onOuvrir: (OngletLecteur) -> Unit) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(width = 36.dp, height = 4.dp).clip(CircleShape).background(p.bordure.compose))
        Row(Modifier.fillMaxWidth().padding(top = 6.dp, start = 12.dp, end = 12.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
            OngletLecteur.entries.forEach { o ->
                Row(
                    Modifier.clip(CircleShape).clickable(role = Role.Button, onClickLabel = "Ouvrir ${o.libelle}") { onOuvrir(o) }.padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icone(o.icone, description = null, teinte = p.encreAttenuee.compose, taille = 15.dp)
                    Spacer(Modifier.width(6.dp))
                    Text(o.libelle, style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.encreAttenuee.compose)
                }
            }
        }
    }
}

/**
 * Le second étage : un en-tête compact qui garde le titre et la lecture
 * sous la main, les onglets, et les trois pages côte à côte, qu'on change
 * en glissant de côté. Tirer l'en-tête vers le bas, ou une liste déjà en
 * haut, ramène au premier étage.
 */
@Composable
private fun PagesLecteur(
    etat: EtatLecteur,
    courant: TitreLu,
    avancement: Avancement,
    panneau: EtatTiroir,
    pageVoulue: Int,
    onPage: (Int) -> Unit,
) {
    val c = conteneur()
    val lecteur = c.lecteur
    val p = LocalPalette.current
    val portee = rememberCoroutineScope()
    val pages = OngletLecteur.entries
    val pager = rememberPagerState(initialPage = pageVoulue) { pages.size }
    // L'onglet touché depuis le premier étage, ou dans la barre : la page suit.
    LaunchedEffect(pageVoulue) { if (pager.currentPage != pageVoulue) pager.animateScrollToPage(pageVoulue) }
    LaunchedEffect(pager.currentPage) { onPage(pager.currentPage) }
    val aSuivre = remember(etat.file, etat.suivants) {
        etat.suivants.mapNotNull { i -> etat.file.getOrNull(i)?.let { IndexedValue(i, it) } }
    }
    // Le titre de la file qu'on déplace (son rang dans « À suivre ») et le chemin parcouru par le doigt.
    var glisse by remember { mutableStateOf<Int?>(null) }
    var decalage by remember { mutableFloatStateOf(0f) }

    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxWidth()
                .draggable(
                    rememberDraggableState { panneau.glisser(it) },
                    Orientation.Vertical,
                    onDragStopped = { v -> panneau.relacher(v) },
                )
                .padding(top = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(Modifier.size(width = 36.dp, height = 4.dp).clip(CircleShape).background(p.bordure.compose))
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Pochette(courant.pochette, Modifier.size(44.dp), RoundedCornerShape(6.dp))
                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                    Text(courant.titre, style = Texte.corpsFort, color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    courant.artiste?.let { Text(it, style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                }
                BoutonLecture(etat, lecteur, taille = 44)
                Box(
                    Modifier.size(40.dp).clip(CircleShape).clickable(role = Role.Button, onClick = panneau::fermer),
                    contentAlignment = Alignment.Center,
                ) {
                    Icone(R.drawable.lucide_chevron_down, description = "Revenir au lecteur", teinte = p.encreAttenuee.compose, taille = 22.dp)
                }
            }
            BarreProgression(avancement, lecteur::deplacer, Modifier.padding(horizontal = 16.dp), epaisseur = 2.dp)
        }
        Onglets(pages[pager.currentPage]) { o -> portee.launch { pager.animateScrollToPage(o.ordinal) } }

        HorizontalPager(pager, Modifier.weight(1f).fillMaxWidth(), key = { pages[it].name }) { i ->
            when (pages[i]) {
                OngletLecteur.PAROLES -> BoxWithConstraints(Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 12.dp)) {
                    PanneauParoles(courant, avancement, lecteur::deplacer, hauteur = maxHeight)
                }
                // Pas d'animation d'entrée ici : le lecteur est en lecture.
                OngletLecteur.AVIS -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 24.dp)) {
                    item(key = "avis-${courant.id}") {
                        BlocCommentaires(
                            courant.id,
                            position = { lecteur.position() / 1000.0 },
                            onAllerA = { s -> lecteur.deplacer((s * 1000).toLong()) },
                        )
                    }
                }
                OngletLecteur.FILE -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 24.dp)) {
                    if (aSuivre.isEmpty()) {
                        item(key = "file-vide") {
                            Text(
                                "Rien après ce titre : la suite se compose seule, avec des titres proches.",
                                style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(vertical = 16.dp),
                            )
                        }
                    } else {
                        item(key = "file-entete") {
                            Row(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    if (etat.aleatoire) "À suivre, en aléatoire" else "À suivre",
                                    style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.encreAttenuee.compose, modifier = Modifier.weight(1f),
                                )
                                Text(
                                    "Vider",
                                    style = Texte.secondaire.copy(fontWeight = FontWeight.Medium),
                                    color = p.accent.compose,
                                    modifier = Modifier.clip(CircleShape).clickable(role = Role.Button) { lecteur.viderLaSuite() }.padding(horizontal = 10.dp, vertical = 6.dp),
                                )
                            }
                        }
                        // En aléatoire, l'ordre affiché n'est pas celui de la file : on retire, on ne déplace pas.
                        val reordonnable = !etat.aleatoire
                        itemsIndexed(aSuivre, key = { _, e -> "suivant-${e.index}-${e.value.id}" }) { rang, element ->
                            LigneFileModifiable(
                                titre = element.value,
                                rang = rang,
                                total = aSuivre.size,
                                glisse = glisse,
                                decalage = decalage,
                                reordonnable = reordonnable,
                                onClick = { lecteur.allerA(element.index) },
                                onRetirer = { lecteur.retirerDeLaFile(element.index) },
                                onDebut = { glisse = rang; decalage = 0f },
                                onGlisser = { decalage += it },
                                onFin = { cible ->
                                    if (cible != rang) lecteur.deplacerDansLaFile(element.index, aSuivre[cible].index)
                                    glisse = null
                                    decalage = 0f
                                },
                                onMonter = { if (rang > 0) lecteur.deplacerDansLaFile(element.index, aSuivre[rang - 1].index) },
                                onDescendre = { if (rang < aSuivre.lastIndex) lecteur.deplacerDansLaFile(element.index, aSuivre[rang + 1].index) },
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Minuterie de veille et vitesse, sous les commandes : deux pastilles qui disent l'état en cours. */
@Composable
private fun OptionsLecture(onVeille: () -> Unit, onVitesse: () -> Unit, onBasses: () -> Unit, onEnsemble: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val veille by c.veille.veille.collectAsStateWithLifecycle()
    val vitesse by c.lecteur.vitesse.collectAsStateWithLifecycle()
    // Les minutes restantes se relisent chaque minute.
    var minute by remember { mutableStateOf(0) }
    LaunchedEffect(veille) {
        while (veille is Veille.A) {
            kotlinx.coroutines.delay(15_000)
            minute++
        }
    }
    val libelleVeille = when (veille) {
        Veille.Aucune -> "Minuterie"
        Veille.FinDuTitre -> "Fin du titre"
        is Veille.A -> "Arrêt dans ${c.veille.minutesRestantes() ?: 0} min".also { minute }
    }
    Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally)) {
        PastilleOption(R.drawable.lucide_timer, libelleVeille, veille != Veille.Aucune, onVeille)
        PastilleOption(R.drawable.lucide_gauge, "Vitesse ${libelleVitesse(vitesse)}", vitesse != 1f, onVitesse)
    }
    val basses by c.reglages.basses.collectAsStateWithLifecycle()
    val niveau = NiveauBass.de(basses)
    Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally)) {
        PastilleOption(R.drawable.lucide_audio_waveform, "Basses : ${niveau.libelle}", niveau != NiveauBass.OFF, onBasses)
    }
    val ensemble by c.ensemble.etat.collectAsStateWithLifecycle()
    Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.Center) {
        PastilleOption(
            R.drawable.lucide_users,
            when (val e = ensemble) {
                EtatEnsemble.Aucun -> "À plusieurs"
                is EtatEnsemble.Hote -> "À plusieurs · ${e.code} · ${e.participants}"
                is EtatEnsemble.Invite -> "Avec ${e.hote}"
            },
            ensemble != EtatEnsemble.Aucun,
            onEnsemble,
        )
    }
}

/**
 * L'écoute à plusieurs : lancer une session et partager son code, ou en
 * rejoindre une. Chacun écoute sur son téléphone, l'invité suit l'hôte.
 */
@Composable
internal fun ChoixEnsemble(onFermer: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val contexte = LocalContext.current
    val portee = rememberCoroutineScope()
    val ensemble by c.ensemble.etat.collectAsStateWithLifecycle()
    val session by c.session.etat.collectAsStateWithLifecycle()
    var code by remember { mutableStateOf("") }
    var enCours by remember { mutableStateOf(false) }
    var erreur by remember { mutableStateOf<String?>(null) }
    Feuille(onFermer) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 8.dp)) {
            Text("Écouter à plusieurs", style = Texte.titreSection, color = p.encre.compose)
            when (val e = ensemble) {
                EtatEnsemble.Aucun -> {
                    Text(
                        "Lancez une écoute et partagez son code : vos amis entendent la même musique au même moment, chacun sur son téléphone.",
                        style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 4.dp, bottom = 16.dp),
                    )
                    if (session !is com.moziik.app.donnees.session.EtatSession.Connecte) {
                        Text("Connectez-vous pour écouter à plusieurs.", style = Texte.corps, color = p.encreAttenuee.compose)
                    } else {
                        BoutonPrincipal("Lancer une écoute", {
                            enCours = true
                            erreur = null
                            portee.launch {
                                c.ensemble.ouvrir().onFailure { erreur = com.moziik.app.donnees.reseau.messageErreur(it) }
                                enCours = false
                            }
                        }, enCours = enCours)
                        Text("ou rejoindre avec un code", style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 18.dp, bottom = 8.dp))
                        ChampTexte(
                            valeur = code,
                            onChange = { code = it.uppercase().filter { ch -> ch.isLetterOrDigit() }.take(6) },
                            libelle = "Code à six caractères",
                            icone = R.drawable.lucide_users,
                        )
                        Spacer(Modifier.height(10.dp))
                        BoutonPrincipal("Rejoindre", {
                            enCours = true
                            erreur = null
                            portee.launch {
                                c.ensemble.rejoindre(code).onFailure { erreur = if (it is com.moziik.app.donnees.reseau.ErreurApi && it.statut == 404) "Code inconnu ou écoute terminée." else com.moziik.app.donnees.reseau.messageErreur(it) }
                                enCours = false
                            }
                        }, actif = code.length == 6, enCours = enCours)
                    }
                }
                is EtatEnsemble.Hote -> {
                    Text("Votre code", style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 12.dp))
                    Text(e.code, style = Texte.titreFiche.copy(fontSize = 40.sp, letterSpacing = 6.sp), color = p.accent.compose)
                    Text(
                        if (e.participants == 0) "Personne n'a encore rejoint." else "${e.participants} personne${if (e.participants > 1) "s" else ""} vous écoute${if (e.participants > 1) "nt" else ""}.",
                        style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(bottom = 16.dp),
                    )
                    BoutonPrincipal("Partager le code", {
                        partager(contexte, "", "Écoute avec moi sur Moziik : dans le lecteur, touche « À plusieurs » et entre le code ${e.code}.")
                    })
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "Arrêter l'écoute à plusieurs",
                        style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.danger.compose,
                        modifier = Modifier.clip(CircleShape).clickable(role = Role.Button) { c.ensemble.quitter() }.padding(vertical = 8.dp),
                    )
                }
                is EtatEnsemble.Invite -> {
                    Text(
                        "Vous écoutez avec ${e.hote}. Sa musique, sa position, ses pauses : votre lecteur suit le sien.",
                        style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 8.dp, bottom = 16.dp),
                    )
                    Text(
                        "Quitter l'écoute",
                        style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.danger.compose,
                        modifier = Modifier.clip(CircleShape).clickable(role = Role.Button) { c.ensemble.quitter() }.padding(vertical = 8.dp),
                    )
                }
            }
            erreur?.let { Text(it, style = Texte.secondaire, color = p.danger.compose, modifier = Modifier.padding(top = 10.dp)) }
        }
    }
}

/**
 * Le Bass Boost, les cinq niveaux du site. Le changement s'entend aussitôt,
 * sans couper le morceau : on compare en écoutant.
 */
@Composable
internal fun ChoixBasses(onFermer: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val basses by c.reglages.basses.collectAsStateWithLifecycle()
    Feuille(onFermer) {
        Text("Bass Boost", style = Texte.titreSection, color = p.encre.compose, modifier = Modifier.padding(start = 20.dp, bottom = 2.dp))
        Text(
            "Plus profond que sur le site : sous-grave et harmoniques en plus. La voix reste nette, et le son est limité juste sous le maximum : il ne sature jamais, même au plus fort.",
            style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 8.dp),
        )
        NiveauBass.entries.forEach { n ->
            Row(
                Modifier.fillMaxWidth().clickable(role = Role.RadioButton) { c.reglages.choisirBasses(n.cle) }.padding(horizontal = 20.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Des barres de hauteur croissante : le niveau se lit d'un coup d'oeil.
                if (n == NiveauBass.PERSO) {
                    Box(Modifier.width(30.dp), contentAlignment = Alignment.CenterStart) {
                        Icone(R.drawable.lucide_sliders_horizontal, description = null, teinte = if (n.cle == basses) p.accent.compose else p.encreAttenuee.compose, taille = 18.dp)
                    }
                } else {
                    Row(Modifier.width(30.dp).height(18.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.Bottom) {
                        repeat(5) { i ->
                            Box(
                                Modifier.width(4.dp).fillMaxHeight((i + 1) / 5f).clip(RoundedCornerShape(1.dp))
                                    .background(if (i < n.ordinal) p.accent.compose else p.bordure.compose),
                            )
                        }
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(n.libelle, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = if (n.cle == basses) p.accent.compose else p.encre.compose)
                    Text(n.description, style = Texte.secondaire, color = p.encreAttenuee.compose)
                }
                if (n.cle == basses) Icone(R.drawable.lucide_check, description = "Choisi", teinte = p.accent.compose, taille = 18.dp)
            }
        }
        if (basses == NiveauBass.PERSO.cle) ReglagePerso()
    }
}

/** Les deux curseurs du niveau Personnalisé ; le son suit pendant qu'on glisse. */
@Composable
private fun ReglagePerso() {
    val c = conteneur()
    val p = LocalPalette.current
    val puissance by c.reglages.bassesPuissance.collectAsStateWithLifecycle()
    val harmoniques by c.reglages.bassesHarmoniques.collectAsStateWithLifecycle()
    val couleurs = SliderDefaults.colors(
        thumbColor = p.accent.compose,
        activeTrackColor = p.accent.compose,
        inactiveTrackColor = p.bordure.compose,
    )
    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Puissance du grave", style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, modifier = Modifier.weight(1f))
            Text("+${puissance.toInt()} dB", style = Texte.secondaire.copy(fontFeatureSettings = "tnum"), color = p.encreAttenuee.compose)
        }
        Slider(
            value = puissance,
            onValueChange = { c.reglages.choisirBassesPerso(it, harmoniques) },
            valueRange = 0f..PUISSANCE_MAX.toFloat(),
            colors = couleurs,
            modifier = Modifier.semantics { contentDescription = "Puissance du grave" },
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Harmoniques", style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, modifier = Modifier.weight(1f))
            Text("${(harmoniques * 100).toInt()} %", style = Texte.secondaire.copy(fontFeatureSettings = "tnum"), color = p.encreAttenuee.compose)
        }
        Slider(
            value = harmoniques,
            onValueChange = { c.reglages.choisirBassesPerso(puissance, it) },
            colors = couleurs,
            modifier = Modifier.semantics { contentDescription = "Harmoniques de basse" },
        )
        Text(
            "Les harmoniques font entendre le grave sur le haut-parleur du téléphone et les petits écouteurs, qui ne descendent pas jusqu'à lui.",
            style = Texte.secondaire, color = p.encreAttenuee.compose,
        )
    }
}

private fun libelleVitesse(v: Float): String = (if (v % 1f == 0f) "${v.toInt()}" else "$v".replace('.', ',')) + "x"

@Composable
private fun PastilleOption(icone: Int, libelle: String, actif: Boolean, onClick: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier
            .clip(CircleShape)
            .border(BorderStroke(1.dp, if (actif) p.accent.compose else p.bordure.compose), CircleShape)
            .background(if (actif) p.accent.compose.copy(alpha = 0.12f) else androidx.compose.ui.graphics.Color.Transparent)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icone(icone, description = null, teinte = if (actif) p.accent.compose else p.encreAttenuee.compose, taille = 15.dp)
        Spacer(Modifier.width(6.dp))
        Text(libelle, style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = if (actif) p.accent.compose else p.encre.compose)
    }
}

/** Le choix de la minuterie : durées courantes, ou la fin du titre en cours. */
@Composable
private fun ChoixVeille(onFermer: () -> Unit) {
    val c = conteneur()
    val veille by c.veille.veille.collectAsStateWithLifecycle()
    Feuille(onFermer) {
        Text("Arrêter la lecture", style = Texte.titreSection, color = LocalPalette.current.encre.compose, modifier = Modifier.padding(start = 20.dp, bottom = 8.dp))
        listOf(15, 30, 45, 60, 90).forEach { m ->
            LigneChoix("Dans $m minutes", false) {
                c.veille.dans(m)
                onFermer()
            }
        }
        LigneChoix("À la fin du titre", veille == Veille.FinDuTitre) {
            c.veille.finDuTitre()
            onFermer()
        }
        if (veille != Veille.Aucune) {
            LigneChoix("Désactiver la minuterie", false) {
                c.veille.annuler()
                onFermer()
            }
        }
    }
}

/** La vitesse de lecture : utile surtout pour les podcasts et les émissions parlées. */
@Composable
private fun ChoixVitesse(onFermer: () -> Unit) {
    val c = conteneur()
    val vitesse by c.lecteur.vitesse.collectAsStateWithLifecycle()
    Feuille(onFermer) {
        Text("Vitesse de lecture", style = Texte.titreSection, color = LocalPalette.current.encre.compose, modifier = Modifier.padding(start = 20.dp, bottom = 8.dp))
        listOf(0.75f, 1f, 1.25f, 1.5f, 2f).forEach { v ->
            LigneChoix(if (v == 1f) "Normale (1x)" else libelleVitesse(v), vitesse == v) {
                c.lecteur.choisirVitesse(v)
                onFermer()
            }
        }
    }
}

@Composable
private fun LigneChoix(libelle: String, actif: Boolean, onClick: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onClick).padding(horizontal = 20.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(libelle, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = if (actif) p.accent.compose else p.encre.compose, modifier = Modifier.weight(1f))
        if (actif) Icone(R.drawable.lucide_check, description = "Choisi", teinte = p.accent.compose, taille = 18.dp)
    }
}

private enum class OngletLecteur(val libelle: String, val icone: Int) {
    PAROLES("Paroles", R.drawable.lucide_mic_vocal),
    FILE("À suivre", R.drawable.lucide_list_music),
    AVIS("Avis", R.drawable.lucide_message_circle),
}

/** Les onglets du lecteur, soulignés à l'accent comme ceux du site. */
@Composable
private fun Onglets(actif: OngletLecteur, onChoisir: (OngletLecteur) -> Unit) {
    val p = LocalPalette.current
    val filet = p.bordure.compose
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp)
            .drawBehind { drawLine(filet, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx()) },
    ) {
        OngletLecteur.entries.forEach { o ->
            val choisi = o == actif
            val couleur = if (choisi) p.accent.compose else p.encreAttenuee.compose
            val accent = p.accent.compose
            Row(
                Modifier
                    .clickable(role = Role.Tab) { onChoisir(o) }
                    .semantics { selected = choisi }
                    .drawBehind {
                        if (choisi) drawLine(accent, Offset(0f, size.height), Offset(size.width, size.height), 2.dp.toPx())
                    }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icone(o.icone, description = null, teinte = couleur, taille = 15.dp)
                Spacer(Modifier.width(6.dp))
                Text(o.libelle, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = couleur)
            }
        }
    }
}

@Composable
private fun Transport(etat: EtatLecteur) {
    val lecteur = conteneur().lecteur
    val p = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().padding(top = 16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Commande(
            R.drawable.lucide_shuffle,
            if (etat.aleatoire) "Désactiver la lecture aléatoire" else "Lecture aléatoire",
            if (etat.aleatoire) p.accent.compose else p.encreAttenuee.compose,
            lecteur::basculerAleatoire,
        )
        Commande(R.drawable.lucide_skip_back_plein, "Précédent", p.encre.compose, lecteur::precedent, taille = 26)
        BoutonLecture(etat, lecteur, taille = 68)
        Commande(R.drawable.lucide_skip_forward_plein, "Suivant", p.encre.compose, lecteur::suivant, taille = 26)
        Commande(
            if (etat.repetition == Player.REPEAT_MODE_ONE) R.drawable.lucide_repeat_1 else R.drawable.lucide_repeat,
            when (etat.repetition) {
                Player.REPEAT_MODE_ALL -> "Répéter la file"
                Player.REPEAT_MODE_ONE -> "Répéter le titre"
                else -> "Répétition désactivée"
            },
            if (etat.repetition != Player.REPEAT_MODE_OFF) p.accent.compose else p.encreAttenuee.compose,
            lecteur::basculerRepetition,
        )
    }
}

@Composable
private fun Commande(icone: Int, libelle: String, teinte: androidx.compose.ui.graphics.Color, onClick: () -> Unit, taille: Int = 20) {
    Box(
        Modifier.size(48.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onClick).semantics { contentDescription = libelle },
        contentAlignment = Alignment.Center,
    ) {
        Icone(icone, description = null, teinte = teinte, taille = taille.dp)
    }
}

/**
 * J'aime : relu à chaque titre, basculé tout de suite à l'écran puis
 * confirmé par le site. Un visiteur est invité à se connecter.
 */
@Composable
internal fun BoutonAime(courant: TitreLu, taille: Dp = 44.dp, icone: Dp = 22.dp) {
    val c = conteneur()
    val p = LocalPalette.current
    val session by c.session.etat.collectAsStateWithLifecycle()
    val connecte = session is EtatSession.Connecte
    val menus = LocalMenus.current
    var aime by remember(courant.id) { mutableStateOf(false) }
    val portee = rememberCoroutineScope()
    LaunchedEffect(courant.id, connecte) {
        aime = connecte && appel { c.reseau.api.aime(courant.id).liked }.getOrDefault(false)
    }
    Box(
        Modifier
            .size(taille)
            .clip(CircleShape)
            .clickable(role = Role.Button) {
                if (!connecte) {
                    c.alertes.signaler(AlerteLecture.Message("Connecte-toi pour aimer un son."))
                    return@clickable
                }
                val avant = aime
                aime = !avant
                portee.launch {
                    appel { c.reseau.api.basculerAime(courant.id) }
                        .onSuccess {
                            aime = it.liked
                            menus.bibliothequeChangee()
                        }
                        .onFailure {
                            if (it is java.io.IOException) {
                                c.horsLigne.actions.garder(ActionGardee.Aime(courant.id, !avant))
                                c.alertes.signaler(AlerteLecture.Message("Pas de réseau : ton j'aime sera envoyé au retour de la connexion."))
                            } else {
                                aime = avant
                                c.alertes.signaler(AlerteLecture.Message(messageErreur(it)))
                            }
                        }
                }
            }
            .semantics { contentDescription = if (aime) "Ne plus aimer" else "J'aime" },
        contentAlignment = Alignment.Center,
    ) {
        Icone(
            if (aime) R.drawable.lucide_heart_plein else R.drawable.lucide_heart,
            description = null,
            teinte = if (aime) p.accent.compose else p.encreAttenuee.compose,
            taille = icone,
        )
    }
}

/** Hauteur fixe d'une ligne de la file : le déplacement au doigt se compte en lignes. */
private val HAUTEUR_LIGNE = 56.dp

/**
 * Une ligne de la file qu'on peut réordonner et retirer : la poignée à
 * droite se glisse (les autres lignes s'écartent pour faire place), un
 * balayage vers la gauche retire le titre. Les deux gestes existent aussi
 * en actions d'accessibilité.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LigneFileModifiable(
    titre: TitreLu,
    rang: Int,
    total: Int,
    glisse: Int?,
    decalage: Float,
    reordonnable: Boolean,
    onClick: () -> Unit,
    onRetirer: () -> Unit,
    onDebut: () -> Unit,
    onGlisser: (Float) -> Unit,
    onFin: (Int) -> Unit,
    onMonter: () -> Unit,
    onDescendre: () -> Unit,
) {
    val p = LocalPalette.current
    val hauteur = with(LocalDensity.current) { HAUTEUR_LIGNE.toPx() }
    val cible = glisse?.let { (it + kotlin.math.round(decalage / hauteur).toInt()).coerceIn(0, total - 1) }
    // Les lignes entre la place d'origine et la place visée s'écartent d'une ligne.
    val ecart = when {
        glisse == null || cible == null || rang == glisse -> 0f
        rang in (glisse + 1)..cible -> -hauteur
        rang in cible until glisse -> hauteur
        else -> 0f
    }
    val ecartAnime by animateFloatAsState(ecart, tween(150), label = "ecart")
    val enGlisse = glisse == rang
    val retrait = rememberSwipeToDismissBoxState(
        confirmValueChange = { v ->
            if (v == SwipeToDismissBoxValue.EndToStart) onRetirer()
            v == SwipeToDismissBoxValue.EndToStart
        },
    )
    SwipeToDismissBox(
        state = retrait,
        enableDismissFromStartToEnd = false,
        enableDismissFromEndToStart = !enGlisse,
        modifier = Modifier
            .zIndex(if (enGlisse) 1f else 0f)
            .graphicsLayer { translationY = if (enGlisse) decalage else ecartAnime }
            .semantics {
                customActions = buildList {
                    add(CustomAccessibilityAction("Retirer de la file") { onRetirer(); true })
                    if (reordonnable && rang > 0) add(CustomAccessibilityAction("Monter") { onMonter(); true })
                    if (reordonnable && rang < total - 1) add(CustomAccessibilityAction("Descendre") { onDescendre(); true })
                }
            },
        backgroundContent = {
            Row(
                Modifier.fillMaxSize().clip(RoundedCornerShape(10.dp)).background(p.danger.compose.copy(alpha = 0.14f)).padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Retirer", style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.danger.compose)
                Spacer(Modifier.width(8.dp))
                Icone(R.drawable.lucide_trash_2, description = null, teinte = p.danger.compose, taille = 16.dp)
            }
        },
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .height(HAUTEUR_LIGNE)
                .clip(RoundedCornerShape(10.dp))
                .background(if (enGlisse) p.surface.compose else p.base.compose)
                .clickable(role = Role.Button, onClick = onClick),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Pochette(titre.pochette, Modifier.size(40.dp), RoundedCornerShape(8.dp))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(titre.titre, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                NomArtiste(titre.artiste, titre.verifie)
            }
            Text(
                duree(titre.dureeSecondes),
                style = Texte.secondaire.copy(fontFeatureSettings = "tnum"),
                color = p.encreAttenuee.compose,
                textAlign = TextAlign.End,
                modifier = Modifier.width(44.dp),
            )
            if (reordonnable) {
                Box(
                    Modifier
                        .size(40.dp)
                        .pointerInput(rang) {
                            detectDragGestures(
                                onDragStart = { onDebut() },
                                onDragEnd = { onFin(cible ?: rang) },
                                onDragCancel = { onFin(rang) },
                                onDrag = { change, ecartDoigt ->
                                    change.consume()
                                    onGlisser(ecartDoigt.y)
                                },
                            )
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Icone(R.drawable.lucide_grip_vertical, description = null, teinte = p.encreAttenuee.compose, taille = 18.dp)
                }
            }
        }
    }
}

