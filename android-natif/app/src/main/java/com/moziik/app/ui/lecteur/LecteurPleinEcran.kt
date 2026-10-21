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

/**
 * Le lecteur plein écran (FullPlayerPage.tsx, mise en page téléphone) :
 * pochette, titre, j'aime, progression, transport, puis deux onglets,
 * les paroles et la suite de la file. Le titre et l'artiste ouvrent leur
 * fiche.
 */
@Composable
fun LecteurPleinEcran(etat: EtatLecteur, onFermer: () -> Unit) {
    val c = conteneur()
    val lecteur = c.lecteur
    val p = LocalPalette.current
    val courant = etat.courant ?: return
    val avancement by rememberAvancement(lecteur, courant.id)
    val nav = navigation()
    val aSuivre = remember(etat.file, etat.suivants) {
        etat.suivants.mapNotNull { i -> etat.file.getOrNull(i)?.let { IndexedValue(i, it) } }
    }
    var onglet by rememberSaveable { mutableStateOf(OngletLecteur.PAROLES) }

    Column(
        Modifier
            .fillMaxSize()
            .background(p.base.compose)
            .windowInsetsPadding(WindowInsets.statusBars)
            .windowInsetsPadding(WindowInsets.navigationBars),
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(40.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onFermer),
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

        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 24.dp, end = 24.dp, top = 12.dp, bottom = 32.dp)) {
            item(key = "pochette") {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Pochette(courant.pochette, Modifier.widthIn(max = 320.dp).fillMaxWidth().aspectRatio(1f), description = "Pochette de ${courant.titre}")
                }
            }
            item(key = "titre") {
                Row(Modifier.fillMaxWidth().padding(top = 24.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            courant.titre,
                            style = Texte.titreLecteur,
                            color = p.encre.compose,
                            maxLines = 2,
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
                    BoutonAime(courant)
                }
            }
            item(key = "progression") {
                Column(Modifier.padding(top = 16.dp)) {
                    BarreProgression(avancement, lecteur::deplacer)
                    Row(Modifier.fillMaxWidth()) {
                        Text(temps(avancement.positionMs), style = Texte.secondaire.copy(fontFeatureSettings = "tnum"), color = p.encreAttenuee.compose)
                        Spacer(Modifier.weight(1f))
                        Text(temps(avancement.dureeMs), style = Texte.secondaire.copy(fontFeatureSettings = "tnum"), color = p.encreAttenuee.compose)
                    }
                }
            }
            item(key = "transport") { Transport(etat) }
            item(key = "onglets") { Onglets(onglet) { onglet = it } }
            when (onglet) {
                OngletLecteur.PAROLES -> item(key = "paroles") {
                    PanneauParoles(courant, avancement, lecteur::deplacer, hauteur = 420.dp)
                }
                OngletLecteur.FILE -> if (aSuivre.isEmpty()) {
                    item(key = "file-vide") {
                        Text(
                            "Rien après ce titre : la suite se compose seule, avec des titres proches.",
                            style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.padding(vertical = 16.dp),
                        )
                    }
                } else {
                    itemsIndexed(aSuivre, key = { _, e -> "suivant-${e.index}-${e.value.id}" }) { _, element ->
                        LigneFile(element.value) { lecteur.allerA(element.index) }
                    }
                }
            }
        }
    }
}

private enum class OngletLecteur(val libelle: String, val icone: Int) {
    PAROLES("Paroles", R.drawable.lucide_mic_vocal),
    FILE("À suivre", R.drawable.lucide_list_music),
}

/** Les onglets du lecteur, soulignés à l'accent comme ceux du site. */
@Composable
private fun Onglets(actif: OngletLecteur, onChoisir: (OngletLecteur) -> Unit) {
    val p = LocalPalette.current
    val filet = p.bordure.compose
    Row(
        Modifier
            .fillMaxWidth()
            .padding(top = 28.dp, bottom = 12.dp)
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
private fun BoutonAime(courant: TitreLu) {
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
            .size(44.dp)
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
                            aime = avant
                            c.alertes.signaler(AlerteLecture.Message(messageErreur(it)))
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
            taille = 22.dp,
        )
    }
}

@Composable
private fun LigneFile(titre: TitreLu, onClick: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable(role = Role.Button, onClick = onClick)
            .padding(vertical = 6.dp),
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
    }
}
