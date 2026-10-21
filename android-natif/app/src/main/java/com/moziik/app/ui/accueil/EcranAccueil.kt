package com.moziik.app.ui.accueil

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.BuildConfig
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.CartePourToi
import com.moziik.app.donnees.catalogue.Cible
import com.moziik.app.donnees.catalogue.Diapo
import com.moziik.app.donnees.catalogue.Section
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.catalogue.cibleDe
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.EtatLecteur
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.Lancement
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.CarteArtiste
import com.moziik.app.ui.composants.CarteCollection
import com.moziik.app.ui.composants.CarteTitre
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.EnTeteSection
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LigneTitre
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.apparitionUneFois
import com.moziik.app.ui.composants.pressable
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.navigation
import com.moziik.app.ui.ouvrirLien
import com.moziik.app.ui.rememberLancement
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/** Sous-titres des sections, repris de components/home/sectionMeta.ts. */
private val SOUS_TITRES = mapOf(
    "recently_played" to "Reprenez là où vous vous êtes arrêté",
    "new_releases" to "Les derniers titres ajoutés",
    "recommendations" to "Sélectionnés d'après vos écoutes",
    "genres" to "Choisissez une ambiance",
    "playlists" to "Les playlists les plus écoutées",
    "albums" to "À découvrir en ce moment",
)

private val LIBELLE_SOURCE = mapOf(
    "pinned" to "À la une",
    "new_release" to "Nouvelle sortie",
    "popular" to "Le plus populaire",
    "playlist" to "Playlist tendance",
    "event" to "Évènement à venir",
)

/** Avance automatique de la bannière : assez lente pour laisser lire (HeroCarousel.tsx). */
private const val DELAI_DIAPO_MS = 7_000L

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EcranAccueil() {
    val c = conteneur()
    val modele: ModeleAccueil = viewModel { ModeleAccueil(c.catalogue, c.session) }
    val etat by modele.etat.collectAsStateWithLifecycle()
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    val session by c.session.etat.collectAsStateWithLifecycle()
    val lancement = rememberLancement()
    val contexte = LocalContext.current
    val p = LocalPalette.current
    val vus = remember { mutableSetOf<Any>() }
    val nav = navigation()

    // Un lien des données du site : une fiche, une lecture, la recherche, ou une page externe.
    val suivre: (String, String) -> Unit = { cle, lien ->
        val cible = cibleDe(lien, BuildConfig.SITE)
        if (!nav.suivre(cible)) {
            when (cible) {
                is Cible.Ancre -> etat.sections.filterIsInstance<Section.Titres>().firstOrNull { it.cle == cible.cle }
                    ?.let { lancement.titres(it.titres, 0, it.titre) }
                is Cible.Externe -> ouvrirLien(contexte, cible.adresse, p.base.enArgb().toInt())
                Cible.Inconnue -> Unit
                else -> lancement.cible(cle, cible)
            }
        }
    }

    val rafraichissement = rememberPullToRefreshState()
    PullToRefreshBox(
        isRefreshing = etat.chargement && !etat.vide,
        onRefresh = modele::charger,
        state = rafraichissement,
        modifier = Modifier.fillMaxSize(),
        indicator = {
            PullToRefreshDefaults.Indicator(
                state = rafraichissement,
                isRefreshing = etat.chargement && !etat.vide,
                containerColor = p.surface.compose,
                color = p.accent.compose,
                modifier = Modifier.align(Alignment.TopCenter),
            )
        },
    ) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 32.dp)) {
            item(key = "entete") { EnTeteAccueil() }
            if (etat.reprise) {
                item(key = "reprise") { MentionReprise() }
            }
            when {
                etat.vide && etat.chargement -> item(key = "attente") { SqueletteAccueil() }
                etat.vide && etat.erreur != null -> item(key = "erreur") { ErreurAccueil(etat.erreur.orEmpty(), modele::charger) }
            }
            if (etat.diapos.isNotEmpty()) {
                item(key = "banniere") {
                    Banniere(
                        diapos = etat.diapos,
                        nouveautes = etat.sections.filterIsInstance<Section.Titres>().firstOrNull { it.cle == "new_releases" }?.titres.orEmpty(),
                        lancement = lancement,
                        suivre = suivre,
                        modifier = Modifier.apparitionUneFois("banniere", 0, vus),
                    )
                }
            }
            if (!etat.vide) {
                item(key = "raccourcis") { RaccourcisAccueil(Modifier.apparitionUneFois("raccourcis", 1, vus)) }
                item(key = "bande-son") {
                    val prenom = (session as? EtatSession.Connecte)?.utilisateur?.name?.trim()?.split(Regex("\\s+"))?.firstOrNull()
                    CarteBandeSon(prenom, (session as? EtatSession.Connecte)?.utilisateur?.avatarUrl, lancement, Modifier.apparitionUneFois("bande-son", 1, vus))
                }
            }
            etat.sections.forEachIndexed { rang, section ->
                item(key = "section-$rang-${section.cle}") {
                    // Une colonne : l'en-tête et le contenu d'une section se suivent (une boîte les superposait).
                    Column(Modifier.padding(top = 32.dp).apparitionUneFois("section-$rang-${section.cle}", minOf(rang + 2, 6), vus)) {
                        BlocSection(section, lecture, lancement, suivre)
                    }
                }
            }
        }
    }
}

/** Un seul onglet ici : « Chart » rejoindra l'en-tête avec l'écran Classements (AccueilEntete.tsx). */
@Composable
private fun EnTeteAccueil() {
    val p = LocalPalette.current
    val nav = navigation()
    Row(Modifier.padding(top = 8.dp, bottom = 16.dp), verticalAlignment = Alignment.Top) {
        Column(Modifier.width(IntrinsicSize.Max)) {
            Text("Pour toi", style = Texte.titreFiche, color = p.accent.compose)
            Spacer(Modifier.height(6.dp))
            Box(Modifier.fillMaxWidth().height(3.dp).clip(CircleShape).background(p.accent.compose))
        }
        Box(Modifier.padding(horizontal = 12.dp, vertical = 4.dp).width(1.dp).height(24.dp).background(p.bordure.compose))
        Text(
            "Chart",
            style = Texte.titreFiche,
            color = p.encreAttenuee.compose,
            modifier = Modifier.clip(RoundedCornerShape(6.dp)).pressable(role = Role.Tab) { nav.classements() },
        )
    }
}

/**
 * Quatre portes d'entrée sous la bannière (RaccourcisAccueil.tsx) : l'accès
 * direct quand on sait déjà ce qu'on cherche. Chacune mène à un écran qui
 * existe.
 */
@Composable
private fun RaccourcisAccueil(modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    val nav = navigation()
    val raccourcis: List<Triple<String, Int, () -> Unit>> = listOf(
        Triple("Artistes", R.drawable.lucide_mic_vocal) { nav.classements("artists") },
        Triple("Genres", R.drawable.lucide_tags) { nav.titres() },
        Triple("Ambiances", R.drawable.lucide_radio) { nav.radio() },
        Triple("Évènements", R.drawable.lucide_calendar_days) { nav.evenements() },
    )
    Row(modifier.fillMaxWidth().padding(top = 24.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        raccourcis.forEach { (libelle, icone, action) ->
            Column(
                Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).pressable(onClick = action).padding(vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(Modifier.size(56.dp).clip(CircleShape).background(p.accent.compose), contentAlignment = Alignment.Center) {
                    Icone(icone, description = null, teinte = p.base.compose, taille = 24.dp)
                }
                Spacer(Modifier.height(8.dp))
                Text(libelle, style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1)
            }
        }
    }
}

@Composable
private fun MentionReprise() {
    val p = LocalPalette.current
    val transition = rememberInfiniteTransition(label = "reprise")
    val opacite by transition.animateFloat(0.3f, 1f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "point")
    Row(Modifier.padding(bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(6.dp).alpha(opacite).clip(CircleShape).background(p.accent.compose))
        Spacer(Modifier.width(8.dp))
        Text("Affichage de votre dernière visite — mise à jour en cours…", style = Texte.secondaire, color = p.encreAttenuee.compose)
    }
}

/** La place de la bannière et de deux rangées, pendant le tout premier chargement. */
@Composable
private fun SqueletteAccueil() {
    val p = LocalPalette.current
    val transition = rememberInfiniteTransition(label = "squelette")
    val opacite by transition.animateFloat(0.5f, 1f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "pulsation")
    val forme = RoundedCornerShape(p.rayon.dp)
    Column(Modifier.alpha(opacite)) {
        Box(Modifier.fillMaxWidth().height(340.dp).clip(forme).background(p.surface.compose))
        repeat(2) {
            Spacer(Modifier.height(32.dp))
            Box(Modifier.width(160.dp).height(18.dp).clip(RoundedCornerShape(4.dp)).background(p.surface.compose))
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                repeat(3) { Box(Modifier.size(140.dp).clip(forme).background(p.surface.compose)) }
            }
        }
    }
}

@Composable
private fun ErreurAccueil(message: String, onReessayer: () -> Unit) {
    val p = LocalPalette.current
    Column(
        Modifier.fillMaxWidth().padding(top = 48.dp, start = 16.dp, end = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icone(R.drawable.lucide_circle_alert, description = null, teinte = p.encreAttenuee.compose, taille = 32.dp)
        Spacer(Modifier.height(12.dp))
        Text("Impossible de charger la page d'accueil.", style = Texte.titreSection, color = p.encre.compose)
        Spacer(Modifier.height(6.dp))
        Text(message, style = Texte.corps, color = p.encreAttenuee.compose)
        Spacer(Modifier.height(20.dp))
        BoutonPrincipal("Réessayer", onReessayer, Modifier.width(180.dp))
    }
}

private fun dateEvenement(iso: String?): String? = iso?.let {
    runCatching {
        val lecture = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
        SimpleDateFormat("d MMMM yyyy", Locale.FRANCE).format(lecture.parse(it.take(19))!!)
    }.getOrNull()
}

/**
 * La bannière défilante (HeroCarousel.tsx) : musique et évènements mêlés,
 * dans l'ordre de l'administration. L'avance automatique s'arrête dès que
 * le doigt la touche, et ne reprend pas.
 */
@Composable
private fun Banniere(diapos: List<Diapo>, nouveautes: List<Titre>, lancement: Lancement, suivre: (String, String) -> Unit, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    val pages = rememberPagerState { diapos.size }
    val glisse by pages.interactionSource.collectIsDraggedAsState()
    var auto by rememberSaveable { mutableStateOf(true) }
    LaunchedEffect(glisse) { if (glisse) auto = false }
    LaunchedEffect(auto, diapos.size) {
        while (auto && diapos.size > 1) {
            delay(DELAI_DIAPO_MS)
            if (auto) pages.animateScrollToPage((pages.currentPage + 1) % diapos.size)
        }
    }
    val forme = RoundedCornerShape(p.rayon.dp)
    Box(modifier.fillMaxWidth().height(340.dp).clip(forme).border(BorderStroke(1.dp, p.bordure.compose), forme)) {
        HorizontalPager(pages, Modifier.fillMaxSize(), key = { it }) { i ->
            DiapoBanniere(diapos[i], nouveautes, lancement, suivre)
        }
        if (diapos.size > 1) {
            Row(Modifier.align(Alignment.BottomCenter).padding(bottom = 14.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                repeat(diapos.size) { i ->
                    val active = i == pages.currentPage
                    Box(
                        Modifier
                            .height(6.dp)
                            .width(if (active) 20.dp else 6.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = if (active) 1f else 0.45f)),
                    )
                }
            }
        }
    }
}

@Composable
private fun DiapoBanniere(diapo: Diapo, nouveautes: List<Titre>, lancement: Lancement, suivre: (String, String) -> Unit) {
    val p = LocalPalette.current
    val evenement = diapo.event
    val (titre, sousTitre, image) = when {
        diapo.song != null -> Triple(diapo.song.title, diapo.song.artist?.stageName, diapo.song.coverUrl)
        diapo.album != null -> Triple(diapo.album.title, diapo.album.artist?.stageName, diapo.album.coverUrl)
        diapo.artist != null -> Triple(diapo.artist.stageName, null, diapo.artist.coverUrl)
        diapo.playlist != null -> Triple(diapo.playlist.title, null, diapo.playlist.coverUrl)
        evenement != null -> Triple(evenement.title, listOfNotNull(evenement.location, dateEvenement(evenement.date)).joinToString(" · ").ifEmpty { null }, evenement.coverUrl)
        diapo.custom != null -> Triple(diapo.custom.title, diapo.custom.subtitle, diapo.custom.coverUrl)
        else -> Triple("", null, null)
    }
    val nav = navigation()
    val fiche: (() -> Unit)? = when {
        diapo.song != null -> ({ nav.titre(diapo.song.id) })
        diapo.album != null -> ({ nav.album(diapo.album.id) })
        diapo.artist != null -> ({ nav.artiste(diapo.artist.id) })
        diapo.playlist != null -> ({ nav.playlist(diapo.playlist.id) })
        else -> null
    }
    // Les évènements attendent leur écran : leur diapositive informe, sans bouton qui ne mènerait nulle part.
    val action: (() -> Unit)? = when {
        diapo.song != null -> {
            val position = nouveautes.indexOfFirst { it.id == diapo.song.id }
            ({ if (position >= 0) lancement.titres(nouveautes, position, "Accueil") else lancement.titres(listOf(diapo.song), 0, "Accueil") })
        }
        diapo.album != null -> ({ lancement.cible("diapo-${diapo.album.id}", Cible.DAlbum(diapo.album.id)) })
        diapo.artist != null -> ({ lancement.cible("diapo-${diapo.artist.id}", Cible.DArtiste(diapo.artist.id)) })
        diapo.playlist != null -> ({ lancement.cible("diapo-${diapo.playlist.id}", Cible.DePlaylist(diapo.playlist.id)) })
        diapo.custom != null -> cibleDe(diapo.custom.href, BuildConfig.SITE).takeIf { it != Cible.Inconnue }?.let { { suivre("diapo-${diapo.custom.href}", diapo.custom.href) } }
        else -> null
    }
    Box(Modifier.fillMaxSize()) {
        Pochette(image, Modifier.fillMaxSize(), RoundedCornerShape(0.dp))
        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(0f to Color.Black.copy(alpha = 0.2f), 0.45f to Color.Black.copy(alpha = 0.6f), 1f to Color.Black.copy(alpha = 0.9f)),
            ),
        )
        Column(Modifier.align(Alignment.BottomStart).padding(start = 20.dp, end = 20.dp, bottom = 40.dp)) {
            LIBELLE_SOURCE[diapo.source]?.let {
                Text(
                    it,
                    style = Texte.secondaire.copy(fontWeight = FontWeight.Medium),
                    color = Color.White,
                    modifier = Modifier.clip(CircleShape).background(Color.White.copy(alpha = 0.15f)).padding(horizontal = 12.dp, vertical = 4.dp),
                )
                Spacer(Modifier.height(12.dp))
            }
            Text(titre, style = Texte.titreFiche, color = Color.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (sousTitre != null) {
                Spacer(Modifier.height(4.dp))
                Text(sousTitre, style = Texte.corps, color = Color.White.copy(alpha = 0.75f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (action != null) {
                Spacer(Modifier.height(16.dp))
                val chargement = lancement.enCours?.startsWith("diapo-") == true
                Row(
                    Modifier
                        .clip(CircleShape)
                        .background(p.accent.compose)
                        .pressable(onClick = action)
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (chargement) {
                        Egaliseur(hauteur = 14.dp, libelle = "Chargement", couleur = p.base.compose)
                    } else {
                        Icone(R.drawable.lucide_play_plein, description = null, teinte = p.base.compose, taille = 14.dp)
                    }
                    Spacer(Modifier.width(8.dp))
                    Text(if (diapo.custom != null) "Découvrir" else "Écouter maintenant", style = Texte.corpsFort, color = p.base.compose)
                }
                if (fiche != null) {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "Voir la fiche",
                        style = Texte.corpsFort,
                        color = Color.White,
                        modifier = Modifier
                            .clip(CircleShape)
                            .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.25f)), CircleShape)
                            .pressable(onClick = fiche)
                            .padding(horizontal = 20.dp, vertical = 10.dp),
                    )
                }
            }
        }
    }
}

/**
 * « Ma bande son » (CarteBandeSon.tsx) : la compilation de la personne,
 * lancée d'un geste depuis la station. Un visiteur a une sélection
 * générique : on change le texte, pas le bouton.
 */
@Composable
internal fun CarteBandeSon(prenom: String?, avatar: String?, lancement: Lancement, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    val connecte = prenom != null
    val chargement = lancement.enCours == "station"
    Box(modifier.padding(top = if (connecte) 60.dp else 24.dp)) {
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(p.rayon.dp))
                .background(p.accent.compose)
                .padding(start = 20.dp, end = 20.dp, top = if (connecte) 44.dp else 24.dp, bottom = 20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("Ma bande son", style = Texte.titreSection.copy(fontSize = 20.sp), color = p.base.compose)
                Spacer(Modifier.height(4.dp))
                Text(
                    (if (prenom.isNullOrEmpty()) "" else "Bonjour $prenom ! ") +
                        if (connecte) "Voici une compilation créée pour toi." else "Une sélection pour découvrir le catalogue.",
                    style = Texte.corps,
                    color = p.base.compose.copy(alpha = 0.9f),
                )
            }
            Spacer(Modifier.width(16.dp))
            Box(
                Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .border(BorderStroke(2.dp, p.base.compose), CircleShape)
                    .pressable { lancement.station() }
                    .semantics { contentDescription = "Écouter ma bande son" },
                contentAlignment = Alignment.Center,
            ) {
                if (chargement) {
                    Egaliseur(hauteur = 20.dp, libelle = "Chargement", couleur = p.base.compose)
                } else {
                    Icone(R.drawable.lucide_headphones, description = null, teinte = p.base.compose, taille = 30.dp)
                    Box(Modifier.size(26.dp).clip(CircleShape).background(p.base.compose), contentAlignment = Alignment.Center) {
                        Icone(R.drawable.lucide_play_plein, description = null, teinte = p.accent.compose, taille = 12.dp, modifier = Modifier.padding(start = 2.dp))
                    }
                }
            }
        }
        if (connecte) {
            // La photo en débord : elle personnalise la carte au premier coup d'œil.
            Box(
                Modifier
                    .offset(x = 20.dp, y = (-36).dp)
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(p.base.compose)
                    .padding(4.dp),
            ) {
                if (avatar != null) {
                    Pochette(avatar, Modifier.fillMaxSize(), CircleShape)
                } else {
                    Box(Modifier.fillMaxSize().clip(CircleShape).background(p.surface.compose), contentAlignment = Alignment.Center) {
                        Text(prenom.orEmpty().take(1).uppercase().ifEmpty { "?" }, style = Texte.titreSection, color = p.encreAttenuee.compose)
                    }
                }
            }
        }
    }
}

@Composable
private fun BlocSection(section: Section, lecture: EtatLecteur, lancement: Lancement, suivre: (String, String) -> Unit) {
    val p = LocalPalette.current
    val nav = navigation()
    val enCours = lecture.courant?.id
    when (section) {
        is Section.PourToi -> {
            EnTeteSection(section.titre)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                items(section.cartes, key = { it.id }) { carte -> CartePourToiVue(carte) { suivre("pour-toi-${carte.id}", carte.linkHref) } }
            }
        }
        is Section.Titres -> if (section.cle == "top_tracks") {
            // Le palmarès en classement numéroté, comme la colonne latérale du site.
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(p.rayon.dp))
                    .border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(p.rayon.dp))
                    .background(p.surface.compose)
                    .padding(12.dp),
            ) {
                EnTeteSection(section.titre, icone = R.drawable.lucide_trending_up, onVoirTout = { nav.classements() })
                section.titres.forEachIndexed { i, titre ->
                    LigneTitre(
                        titre, i + 1, titre.id == enCours, lecture.enLecture,
                        onClick = { lancement.titres(section.titres, i, section.titre) },
                        onAppuiLong = { nav.titre(titre.id) },
                    )
                }
            }
        } else {
            EnTeteSection(section.titre, SOUS_TITRES[section.cle], onVoirTout = if (section.cle == "recently_played") null else ({ nav.titres() }))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                itemsIndexed(section.titres, key = { _, t -> t.id }) { i, titre ->
                    CarteTitre(
                        titre, titre.id == enCours, lecture.enLecture,
                        onClick = { lancement.titres(section.titres, i, section.titre) },
                        modifier = Modifier.width(140.dp),
                        onAppuiLong = { nav.titre(titre.id) },
                    )
                }
            }
        }
        is Section.Genres -> {
            EnTeteSection(section.titre, SOUS_TITRES[section.cle])
            TuilesGenres(section)
        }
        is Section.Albums -> {
            EnTeteSection(section.titre, SOUS_TITRES[section.cle], onVoirTout = { nav.classements("albums") })
            LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                items(section.albums, key = { it.id }) { album ->
                    CarteCollection(
                        album.title, album.artist?.stageName, album.coverUrl,
                        onClick = { nav.album(album.id) },
                        modifier = Modifier.width(140.dp),
                        verifie = album.artist?.verified == true,
                    )
                }
            }
        }
        is Section.Playlists -> {
            EnTeteSection(section.titre, SOUS_TITRES[section.cle])
            LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                items(section.playlists, key = { it.id }) { playlist ->
                    CarteCollection(
                        playlist.title, playlist.songsCount?.let { "$it titre${if (it > 1) "s" else ""}" }, playlist.coverUrl,
                        onClick = { nav.playlist(playlist.id) },
                        modifier = Modifier.width(140.dp),
                    )
                }
            }
        }
        is Section.Artistes -> {
            EnTeteSection(section.titre)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                items(section.artistes, key = { it.id }) { artiste ->
                    CarteArtiste(
                        artiste.stageName, artiste.coverUrl, artiste.verified,
                        artiste.followersCount?.let { "$it abonné${if (it > 1) "s" else ""}" },
                        onClick = { nav.artiste(artiste.id) },
                        modifier = Modifier.width(96.dp),
                    )
                }
            }
        }
        is Section.Evenements -> {
            EnTeteSection(section.titre, icone = R.drawable.lucide_calendar_days, onVoirTout = { nav.evenements() })
            section.evenements.forEach { e ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = 10.dp)
                        .clip(RoundedCornerShape(p.rayon.dp))
                        .border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(p.rayon.dp))
                        .background(p.surface.compose)
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Pochette(e.coverUrl, Modifier.size(44.dp), RoundedCornerShape(8.dp))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(e.title, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        dateEvenement(e.date)?.let { Text(it, style = Texte.secondaire, color = p.encreAttenuee.compose) }
                    }
                }
            }
        }
        is Section.Collection -> {
            EnTeteSection(section.titre)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                items(section.elements, key = { it.href }) { e ->
                    val cle = "collection-${e.href}"
                    CarteCollection(
                        e.title, null, e.coverUrl,
                        onClick = { suivre(cle, e.href) },
                        modifier = Modifier.width(140.dp),
                        chargement = lancement.enCours == cle,
                    )
                }
            }
        }
    }
}

/** Les cartes « Pour vous » (ForYouCarousel.tsx) : image, voile sombre pour la lecture du texte, bouton de lecture. */
@Composable
private fun CartePourToiVue(carte: CartePourToi, onClick: () -> Unit) {
    val p = LocalPalette.current
    Box(Modifier.width(256.dp).height(176.dp).clip(RoundedCornerShape(p.rayon.dp)).pressable(onClick = onClick)) {
        if (carte.coverUrl != null) {
            Pochette(carte.coverUrl, Modifier.fillMaxSize(), RoundedCornerShape(0.dp))
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.1f), Color.Black.copy(alpha = 0.3f), Color.Black.copy(alpha = 0.85f)))))
        } else {
            Box(Modifier.fillMaxSize().background(p.surface.compose))
        }
        Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.SpaceBetween) {
            Column {
                Text(carte.title, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = if (carte.coverUrl != null) Color.White else p.encre.compose)
                carte.badge?.let { Text(it, style = Texte.titreFiche.copy(fontSize = 30.sp, lineHeight = 34.sp), color = if (carte.coverUrl != null) Color.White else p.encre.compose) }
            }
            carte.subtitle?.let {
                Text(
                    it, style = Texte.secondaire, color = if (carte.coverUrl != null) Color.White.copy(alpha = 0.8f) else p.encreAttenuee.compose,
                    maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.fillMaxWidth(0.8f),
                )
            }
        }
        Box(
            Modifier.align(Alignment.BottomEnd).padding(12.dp).size(36.dp).clip(CircleShape).background(p.encre.compose),
            contentAlignment = Alignment.Center,
        ) {
            Icone(R.drawable.lucide_play_plein, description = null, teinte = p.base.compose, taille = 14.dp, modifier = Modifier.padding(start = 2.dp))
        }
    }
}

/**
 * Les couleurs des tuiles de genre du site (GenreTiles.tsx), attribuées par
 * position : des visuels décoratifs avec du texte blanc, lisibles en clair
 * comme en sombre.
 */
private val DEGRADES_GENRE = listOf(
    Color(0xFFF43F5E) to Color(0xFFDB2777),
    Color(0xFF0EA5E9) to Color(0xFF2563EB),
    Color(0xFFF59E0B) to Color(0xFFEA580C),
    Color(0xFF6366F1) to Color(0xFF7C3AED),
    Color(0xFF10B981) to Color(0xFF0D9488),
    Color(0xFFD946EF) to Color(0xFF9333EA),
    Color(0xFF06B6D4) to Color(0xFF0284C7),
    Color(0xFF84CC16) to Color(0xFF059669),
)

/** Une tuile ouvre les titres du genre, comme sur le site (GenreTiles.tsx). */
@Composable
private fun TuilesGenres(section: Section.Genres) {
    val p = LocalPalette.current
    val nav = navigation()
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        section.genres.chunked(2).forEachIndexed { ligne, paire ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                paire.forEachIndexed { colonne, g ->
                    val (debut, fin) = DEGRADES_GENRE[(ligne * 2 + colonne) % DEGRADES_GENRE.size]
                    Box(
                        Modifier
                            .weight(1f)
                            .aspectRatio(16f / 10f)
                            .clip(RoundedCornerShape(p.rayon.dp))
                            .background(Brush.linearGradient(listOf(debut, fin)))
                            .pressable(role = Role.Button) { nav.titres(g.genre) }
                            .padding(14.dp),
                    ) {
                        Icone(
                            R.drawable.lucide_music_2, description = null, teinte = Color.White.copy(alpha = 0.15f), taille = 72.dp,
                            modifier = Modifier.align(Alignment.BottomEnd).offset(x = 22.dp, y = 26.dp),
                        )
                        Text(g.genre, style = Texte.marque.copy(fontSize = 14.sp), color = Color.White, modifier = Modifier.align(Alignment.TopStart))
                        Text(
                            "${g.count} titre${if (g.count > 1) "s" else ""}",
                            style = Texte.secondaire.copy(fontSize = 11.sp, fontWeight = FontWeight.Medium),
                            color = Color.White.copy(alpha = 0.85f),
                            modifier = Modifier.align(Alignment.BottomStart),
                        )
                    }
                }
                if (paire.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}
