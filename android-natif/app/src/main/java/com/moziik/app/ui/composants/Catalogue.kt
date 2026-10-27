package com.moziik.app.ui.composants

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.moziik.app.BuildConfig
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.reseau.adresseMedia
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Mouvement
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.horsligne.PastilleTelechargement
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.foundation.layout.fillMaxHeight

/** « 48 », « 1,93 k », « 64,3 k », « 1,2 M » : un compteur lisible sous une carte. */
fun nombreCourt(n: Int): String {
    fun format(v: Double, decimales: Int, unite: String) =
        String.format(java.util.Locale.FRANCE, "%.${decimales}f", v).trimEnd('0').trimEnd(',') + " " + unite
    return when {
        n < 1_000 -> n.toString()
        n < 10_000 -> format(n / 1_000.0, 2, "k")
        n < 1_000_000 -> format(n / 1_000.0, 1, "k")
        else -> format(n / 1_000_000.0, 1, "M")
    }
}

/** « 3:07 » : durée d'un titre, comme formatTime du site. */
fun duree(secondes: Double): String {
    val total = secondes.toInt().coerceAtLeast(0)
    return "${total / 60}:${(total % 60).toString().padStart(2, '0')}"
}

/**
 * Une pochette ou une photo. Sans image (ou en attendant), la surface et
 * une note de musique : jamais un carré vide (SafeImage du site). La note
 * est dessinée sous l'image, qui la recouvre une fois chargée : une
 * sous-composition par pochette ralentissait le défilement des listes.
 */
@Composable
fun Pochette(adresse: String?, modifier: Modifier = Modifier, forme: Shape = RoundedCornerShape(LocalPalette.current.rayon.dp), description: String? = null) {
    val p = LocalPalette.current
    val complete = remember(adresse) { adresseMedia(adresse, BuildConfig.SITE) ?: adresse?.takeIf { it.startsWith("http") } }
    Box(modifier.clip(forme).background(p.surface.compose), contentAlignment = Alignment.Center) {
        Icone(R.drawable.lucide_music_2, description = null, teinte = p.encreAttenuee.compose.copy(alpha = 0.6f), taille = 22.dp)
        if (complete != null) {
            AsyncImage(
                model = complete,
                contentDescription = description,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

/** Le nom d'un artiste et son badge vérifié, ou « Artiste supprimé ». */
@Composable
fun NomArtiste(nom: String?, verifie: Boolean, modifier: Modifier = Modifier, taille: Dp = 11.dp, couleur: Color = LocalPalette.current.encreAttenuee.compose) {
    val p = LocalPalette.current
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Text(
            nom ?: "Artiste supprimé",
            style = Texte.secondaire,
            color = couleur,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )
        if (verifie) {
            Spacer(Modifier.width(4.dp))
            Icone(R.drawable.lucide_badge_check, description = "Artiste vérifié", teinte = p.verifie.compose, taille = taille)
        }
    }
}

/** Appui sur un élément pressable : échelle 0,97 en 140 ms, comme la classe .pressable du site. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun Modifier.pressable(role: Role = Role.Button, onLongClick: (() -> Unit)? = null, onClick: () -> Unit): Modifier {
    val interactions = remember { MutableInteractionSource() }
    val appuye by interactions.collectIsPressedAsState()
    val echelle by animateFloatAsState(if (appuye) 0.97f else 1f, tween(Mouvement.APPUI), label = "appui")
    return this
        .graphicsLayer { scaleX = echelle; scaleY = echelle }
        .combinedClickable(interactionSource = interactions, indication = null, role = role, onLongClick = onLongClick, onClick = onClick)
}

/** En-tête de section, unifié comme SectionHeader.tsx : titre en Sora, sous-titre discret, « Voir tout » à droite. */
@Composable
fun EnTeteSection(titre: String, sousTitre: String? = null, modifier: Modifier = Modifier, icone: Int? = null, onVoirTout: (() -> Unit)? = null) {
    val p = LocalPalette.current
    Row(modifier.fillMaxWidth().padding(bottom = 12.dp), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (icone != null) {
                    Icone(icone, description = null, teinte = p.accent.compose, taille = 16.dp)
                    Spacer(Modifier.width(8.dp))
                }
                Text(titre, style = Texte.titreSection, color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (sousTitre != null) {
                Text(sousTitre, style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        if (onVoirTout != null) {
            Row(
                Modifier.clip(RoundedCornerShape(6.dp)).pressable(onClick = onVoirTout).padding(start = 8.dp, top = 4.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Voir tout", style = Texte.secondaire.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Medium), color = p.encreAttenuee.compose)
                Icone(R.drawable.lucide_chevron_right, description = null, teinte = p.encreAttenuee.compose, taille = 14.dp)
            }
        }
    }
}

/** Une pastille de filtre (type, période, genre) : pleine à l'accent quand elle est choisie. */
@Composable
fun Puce(libelle: String, actif: Boolean, onClick: () -> Unit) {
    val p = LocalPalette.current
    Text(
        libelle,
        style = Texte.secondaire.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Medium),
        color = if (actif) p.base.compose else p.encreAttenuee.compose,
        modifier = Modifier
            .clip(CircleShape)
            .background(if (actif) p.accent.compose else p.base.compose)
            .border(androidx.compose.foundation.BorderStroke(1.dp, if (actif) p.accent.compose else p.bordure.compose), CircleShape)
            .pressable(role = Role.Tab, onClick = onClick)
            .semantics { selected = actif }
            .padding(horizontal = 14.dp, vertical = 7.dp),
    )
}

/**
 * La carte d'un titre (SongCard.tsx) : pochette carrée avec sa durée, le
 * bouton de lecture posé dessus et la pastille de téléchargement en bas à
 * gauche ; titre, artiste et compteurs dessous. Le titre en cours passe à
 * l'accent.
 */
@Composable
fun CarteTitre(
    titre: Titre,
    enCours: Boolean,
    enLecture: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onAppuiLong: (() -> Unit)? = null,
    compteurs: Boolean = true,
) {
    val p = LocalPalette.current
    Column(modifier.pressable(onLongClick = onAppuiLong, onClick = onClick)) {
        Box(Modifier.fillMaxWidth().aspectRatio(1f)) {
            Pochette(titre.coverUrl, Modifier.fillMaxSize(), description = null)
            Text(
                duree(titre.duration),
                style = Texte.secondaire.copy(fontSize = 11.sp),
                color = Color.White,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(8.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.6f))
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            )
            Box(
                Modifier.align(Alignment.BottomEnd).padding(8.dp).size(36.dp).clip(CircleShape).background(p.accent.compose),
                contentAlignment = Alignment.Center,
            ) {
                if (enCours && enLecture) {
                    Egaliseur(hauteur = 14.dp, libelle = "En cours de lecture", couleur = p.base.compose)
                } else {
                    Icone(R.drawable.lucide_play_plein, description = null, teinte = p.base.compose, taille = 14.dp, modifier = Modifier.padding(start = 2.dp))
                }
            }
            PastilleTelechargement(titre, Modifier.align(Alignment.BottomStart).padding(8.dp))
        }
        Spacer(Modifier.height(8.dp))
        Text(
            titre.title,
            style = Texte.corps.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Medium),
            color = if (enCours) p.accent.compose else p.encre.compose,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        NomArtiste(titre.artist?.stageName, titre.artist?.verified == true)
        if (compteurs) Compteurs(titre.playsCount, titre.likesCount, Modifier.padding(top = 4.dp))
    }
}

/** Écoutes et j'aime d'un titre ou d'une collection, sous sa carte : la popularité se lit sans ouvrir la fiche. */
@Composable
fun Compteurs(ecoutes: Int, aimes: Int?, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    val style = Texte.secondaire.copy(fontSize = 11.sp, fontFeatureSettings = "tnum")
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Icone(R.drawable.lucide_headphones, description = "Écoutes", teinte = p.encreAttenuee.compose, taille = 12.dp)
        Spacer(Modifier.width(4.dp))
        Text(nombreCourt(ecoutes), style = style, color = p.encreAttenuee.compose)
        if (aimes != null) {
            Spacer(Modifier.width(10.dp))
            Icone(R.drawable.lucide_heart, description = "J'aime", teinte = p.encreAttenuee.compose, taille = 12.dp)
            Spacer(Modifier.width(4.dp))
            Text(nombreCourt(aimes), style = style, color = p.encreAttenuee.compose)
        }
    }
}

/**
 * Une ligne de titre numérotée (TrendingList.tsx) : rang en chiffres fixes,
 * pochette, titre, artiste, et l'état de lecture à droite. L'appui long
 * ouvre la fiche du titre, comme le menu contextuel du site.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun LigneTitre(
    titre: Titre,
    rang: Int?,
    enCours: Boolean,
    enLecture: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onAppuiLong: (() -> Unit)? = null,
    /** Sans la durée : les listes de l'accueil laissent la place à la pastille et au menu. */
    avecDuree: Boolean = true,
) {
    val p = LocalPalette.current
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .combinedClickable(role = Role.Button, onLongClick = onAppuiLong, onLongClickLabel = onAppuiLong?.let { "Plus d'options" }, onClick = onClick)
            .padding(horizontal = 4.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (rang != null) {
            Text(
                rang.toString().padStart(2, '0'),
                style = Texte.secondaire.copy(fontFeatureSettings = "tnum"),
                color = if (enCours) p.accent.compose else p.encreAttenuee.compose,
                modifier = Modifier.width(26.dp),
            )
        }
        Pochette(titre.coverUrl, Modifier.size(44.dp), RoundedCornerShape(8.dp))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                titre.title,
                style = Texte.corps.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Medium),
                color = if (enCours) p.accent.compose else p.encre.compose,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            NomArtiste(titre.artist?.stageName, titre.artist?.verified == true)
            // Une longue écoute laissée en cours : où l'on s'est arrêté.
            val positions by com.moziik.app.ui.conteneur().positionsLongues.positions.collectAsStateWithLifecycle()
            positions.firstOrNull { it.id == titre.id }?.let { pos ->
                Box(Modifier.padding(top = 4.dp).fillMaxWidth(0.6f).height(2.dp).clip(RoundedCornerShape(1.dp)).background(p.bordure.compose)) {
                    Box(Modifier.fillMaxWidth((pos.positionMs.toFloat() / pos.dureeMs).coerceIn(0.02f, 1f)).fillMaxHeight().background(p.accent.compose))
                }
            }
        }
        Spacer(Modifier.width(8.dp))
        if (enCours && enLecture) {
            Egaliseur(hauteur = 12.dp, libelle = "En cours de lecture", modifier = Modifier.padding(end = 8.dp))
        } else if (avecDuree) {
            Text(duree(titre.duration), style = Texte.secondaire.copy(fontFeatureSettings = "tnum"), color = p.encreAttenuee.compose, modifier = Modifier.padding(end = 8.dp))
        }
        PastilleTelechargement(titre, taille = 28.dp)
        if (onAppuiLong != null) {
            // Le même menu que l'appui long, pour qui ne connaît pas ce geste.
            Box(
                Modifier.size(36.dp).clip(CircleShape).pressable(onClick = onAppuiLong),
                contentAlignment = Alignment.Center,
            ) {
                Icone(R.drawable.lucide_ellipsis_vertical, description = "Plus d'options", teinte = p.encreAttenuee.compose, taille = 18.dp)
            }
        } else {
            Spacer(Modifier.width(4.dp))
        }
    }
}

/** Album, playlist ou élément de collection : pochette carrée, titre, ligne secondaire. */
@Composable
fun CarteCollection(
    titre: String,
    sousTitre: String?,
    pochette: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    verifie: Boolean = false,
    chargement: Boolean = false,
    /** Le type de collection, en pictogramme sur la pochette (album, playlist). */
    badge: Int? = null,
    /** La pastille de téléchargement du lot, en bas à gauche de la pochette. */
    pastille: (@Composable () -> Unit)? = null,
) {
    val p = LocalPalette.current
    Column(modifier.pressable(onClick = onClick)) {
        Box(Modifier.fillMaxWidth().aspectRatio(1f), contentAlignment = Alignment.Center) {
            Pochette(pochette, Modifier.fillMaxSize())
            if (chargement) {
                Box(Modifier.size(40.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.55f)), contentAlignment = Alignment.Center) {
                    Egaliseur(hauteur = 14.dp, libelle = "Chargement", couleur = Color.White)
                }
            }
            if (badge != null) {
                Box(
                    Modifier.align(Alignment.BottomEnd).padding(8.dp).size(30.dp).clip(RoundedCornerShape(8.dp)).background(Color.Black.copy(alpha = 0.45f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icone(badge, description = null, teinte = Color.White, taille = 16.dp)
                }
            }
            if (pastille != null) Box(Modifier.align(Alignment.BottomStart).padding(8.dp)) { pastille() }
        }
        Spacer(Modifier.height(8.dp))
        Text(
            titre,
            style = Texte.corps.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Medium),
            color = p.encre.compose,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (sousTitre != null) NomArtiste(sousTitre, verifie)
    }
}

/** Un artiste : photo ronde, nom centré (ArtistRow de SectionBlock.tsx). */
@Composable
fun CarteArtiste(nom: String, photo: String?, verifie: Boolean, ligne: String?, onClick: () -> Unit, modifier: Modifier = Modifier, chargement: Boolean = false) {
    val p = LocalPalette.current
    Column(modifier.pressable(onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.fillMaxWidth().aspectRatio(1f), contentAlignment = Alignment.Center) {
            Pochette(photo, Modifier.fillMaxSize(), CircleShape)
            if (chargement) Egaliseur(hauteur = 14.dp, libelle = "Chargement", couleur = Color.White)
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
            Text(
                nom,
                style = Texte.secondaire.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Medium),
                color = p.encre.compose,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false),
            )
            if (verifie) {
                Spacer(Modifier.width(3.dp))
                Icone(R.drawable.lucide_badge_check, description = "Artiste vérifié", teinte = p.verifie.compose, taille = 11.dp)
            }
        }
        if (ligne != null) Text(ligne, style = Texte.secondaire.copy(fontSize = 11.sp), color = p.encreAttenuee.compose, maxLines = 1)
    }
}
