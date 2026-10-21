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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
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
import kotlinx.coroutines.launch

/**
 * Le lecteur plein écran (FullPlayerPage.tsx, mise en page téléphone) :
 * pochette, titre, j'aime, progression, transport, puis la suite de la
 * file. Les onglets Paroles, Infos, Crédits et Avis viendront avec les
 * fiches titre.
 */
@Composable
fun LecteurPleinEcran(etat: EtatLecteur, onFermer: () -> Unit) {
    val c = conteneur()
    val lecteur = c.lecteur
    val p = LocalPalette.current
    val courant = etat.courant ?: return
    val avancement by rememberAvancement(lecteur, courant.id)
    val aSuivre = remember(etat.file, etat.suivants) {
        etat.suivants.mapNotNull { i -> etat.file.getOrNull(i)?.let { IndexedValue(i, it) } }
    }

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
                        Text(courant.titre, style = Texte.titreLecteur, color = p.encre.compose, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Spacer(Modifier.height(2.dp))
                        NomArtiste(courant.artiste, courant.verifie, taille = 14.dp)
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
            if (aSuivre.isNotEmpty()) {
                item(key = "a-suivre") {
                    Row(Modifier.padding(top = 36.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icone(R.drawable.lucide_list_music, description = null, teinte = p.accent.compose, taille = 16.dp)
                        Spacer(Modifier.width(8.dp))
                        Text("À suivre", style = Texte.titreSection, color = p.encre.compose)
                    }
                }
                itemsIndexed(aSuivre, key = { _, e -> "suivant-${e.index}-${e.value.id}" }) { _, element ->
                    LigneFile(element.value) { lecteur.allerA(element.index) }
                }
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
                        .onSuccess { aime = it.liked }
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
