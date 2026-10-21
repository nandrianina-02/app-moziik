package com.moziik.app.ui.lecteur

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moziik.app.R
import com.moziik.app.lecteur.EtatLecteur
import com.moziik.app.lecteur.Lecteur
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.NomArtiste
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.rememberTeintePochette
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import com.moziik.app.ui.horsligne.PastilleTelechargement
import com.moziik.app.lecteur.versTitre

/**
 * Le mini-lecteur, au-dessus de la barre du bas, sur tous les écrans
 * (MiniPlayerBar.tsx, version téléphone) : pochette et titre qui ouvrent le
 * plein écran, Suivant, Lecture, et la progression sur sa propre ligne.
 */
@Composable
fun MiniLecteur(etat: EtatLecteur, lecteur: Lecteur, onOuvrir: () -> Unit) {
    val p = LocalPalette.current
    val courant = etat.courant ?: return
    val avancement by rememberAvancement(lecteur, courant.id)
    val filet = p.bordure.compose
    // La teinte de la pochette n'est lisible qu'avec un texte clair : en mode clair, la surface reste.
    val teinte = rememberTeintePochette(courant.pochette).takeIf { p.sombre }
    val fond by animateColorAsState(teinte ?: p.surface.compose, tween(300), label = "fond")
    Column(
        Modifier
            .fillMaxWidth()
            .background(fond)
            .drawBehind { drawLine(filet, Offset.Zero, Offset(size.width, 0f), 1.dp.toPx()) },
    ) {
        Row(Modifier.padding(start = 12.dp, end = 12.dp, top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(role = Role.Button, onClickLabel = "Ouvrir le lecteur", onClick = onOuvrir),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Pochette(courant.pochette, Modifier.size(44.dp), RoundedCornerShape(8.dp))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(courant.titre, style = Texte.corpsFort, color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    NomArtiste(courant.artiste, courant.verifie, taille = 12.dp)
                }
            }
            Spacer(Modifier.width(4.dp))
            // J'aime et téléchargement sans ouvrir le plein écran : les deux gestes les plus fréquents sur un titre qu'on découvre.
            BoutonAime(courant, taille = 36.dp, icone = 20.dp)
            PastilleTelechargement(courant.versTitre(), taille = 28.dp)
            Spacer(Modifier.width(4.dp))
            Box(
                Modifier.size(40.dp).clip(CircleShape).clickable(role = Role.Button, onClick = lecteur::suivant),
                contentAlignment = Alignment.Center,
            ) {
                Icone(R.drawable.lucide_skip_forward_plein, description = "Suivant", teinte = p.encre.compose, taille = 20.dp)
            }
            Spacer(Modifier.width(6.dp))
            BoutonLecture(etat, lecteur, taille = 44)
        }
        Row(Modifier.padding(start = 12.dp, end = 12.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(temps(avancement.positionMs), style = Texte.secondaire.copy(fontSize = 10.sp, fontFeatureSettings = "tnum"), color = p.encreAttenuee.compose, modifier = Modifier.width(34.dp))
            BarreProgression(avancement, lecteur::deplacer, Modifier.weight(1f), epaisseur = 3.dp)
            Text(
                temps(avancement.dureeMs),
                style = Texte.secondaire.copy(fontSize = 10.sp, fontFeatureSettings = "tnum"),
                color = p.encreAttenuee.compose,
                modifier = Modifier.width(34.dp).padding(start = 6.dp),
            )
        }
    }
}

/** Le bouton Lecture/Pause, rond, à l'accent ; l'égaliseur pendant que le son arrive. */
@Composable
fun BoutonLecture(etat: EtatLecteur, lecteur: Lecteur, taille: Int) {
    val p = LocalPalette.current
    val libelle = if (etat.enLecture) "Pause" else "Lecture"
    Box(
        Modifier
            .size(taille.dp)
            .clip(CircleShape)
            .background(p.accent.compose)
            .clickable(role = Role.Button, onClick = lecteur::basculer)
            .semantics { contentDescription = libelle },
        contentAlignment = Alignment.Center,
    ) {
        when {
            etat.attente -> Egaliseur(hauteur = (taille * 0.36f).dp, libelle = "Chargement du son", couleur = p.base.compose)
            etat.enLecture -> Icone(R.drawable.lucide_pause_plein, description = null, teinte = p.base.compose, taille = (taille * 0.42f).dp)
            else -> Icone(R.drawable.lucide_play_plein, description = null, teinte = p.base.compose, taille = (taille * 0.42f).dp, modifier = Modifier.padding(start = 2.dp))
        }
    }
}
