package com.moziik.app.ui.compte

import androidx.annotation.DrawableRes
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.moziik.app.BuildConfig
import com.moziik.app.R
import com.moziik.app.donnees.reseau.Profil
import com.moziik.app.donnees.reseau.adresseMedia
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.MessageErreur
import com.moziik.app.ui.composants.apparition
import com.moziik.app.ui.conteneur

/** Mon compte (B8 de la spécification) : l'identité du compte, ses compteurs, la déconnexion. */
@Composable
fun EcranMonCompte() {
    val c = conteneur()
    val modele: CompteModele = viewModel { CompteModele(c.reseau.api, c.session) }
    val profil by modele.profil.collectAsStateWithLifecycle()
    val deconnexion by modele.deconnexion.collectAsStateWithLifecycle()

    Crossfade(profil, animationSpec = tween(200), label = "profil") { etat ->
        when (etat) {
            EtatProfil.Chargement -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 20.dp) }
            is EtatProfil.Echec -> Column(
                Modifier.fillMaxSize().padding(32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                MessageErreur(etat.message)
                Spacer(Modifier.height(16.dp))
                BoutonPrincipal("Réessayer", modele::charger)
            }
            is EtatProfil.Pret -> FicheCompte(etat.profil, deconnexion, modele::seDeconnecter)
        }
    }
}

@Composable
private fun FicheCompte(profil: Profil, deconnexionEnCours: Boolean, onDeconnexion: () -> Unit) {
    val p = LocalPalette.current
    val u = profil.user
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Avatar(u.name, adresseMedia(u.avatarUrl, BuildConfig.SITE), Modifier.apparition(0))
        Spacer(Modifier.height(14.dp))
        Text(u.name, style = Texte.titreFiche, color = p.encre.compose, textAlign = TextAlign.Center, modifier = Modifier.apparition(1))
        u.username?.let { Text("@$it", style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.apparition(1)) }
        Text(u.email, style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 2.dp).apparition(2))
        if (!u.emailVerified) {
            Text(
                "Adresse email pas encore confirmée",
                style = Texte.secondaire,
                color = p.alerte.compose,
                modifier = Modifier.padding(top = 8.dp)
                    .clip(RoundedCornerShape(50))
                    .background(p.alerte.compose.copy(alpha = 0.12f))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            )
        }

        Spacer(Modifier.height(28.dp))
        val s = profil.stats
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Compteur(R.drawable.lucide_heart, s.likedSongsCount, "Titres aimés", Modifier.weight(1f).apparition(3))
            Compteur(R.drawable.lucide_list_music, s.playlistsCount, "Playlists", Modifier.weight(1f).apparition(4))
        }
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Compteur(R.drawable.lucide_users, s.followedArtistsCount, "Artistes suivis", Modifier.weight(1f).apparition(5))
            Compteur(R.drawable.lucide_disc_3, s.savedAlbumsCount, "Albums", Modifier.weight(1f).apparition(6))
        }

        Spacer(Modifier.height(32.dp))
        BoutonDeconnexion(deconnexionEnCours, onDeconnexion, Modifier.apparition(7))
    }
}

@Composable
private fun Avatar(nom: String, adresse: String?, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    Box(
        modifier.size(96.dp).clip(CircleShape).background(p.accent.compose.copy(alpha = 0.15f)),
        contentAlignment = Alignment.Center,
    ) {
        // Les initiales restent dessous : visibles le temps du chargement, ou si la photo manque.
        Text(initiales(nom), style = Texte.titreFiche, color = p.accent.compose)
        if (adresse != null) {
            AsyncImage(model = adresse, contentDescription = "Photo de profil", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        }
    }
}

/** « Ana Rakoto » donne « AR » ; un seul mot, sa première lettre. */
fun initiales(nom: String): String =
    nom.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.take(2).joinToString("") { it.first().uppercase() }.ifEmpty { "?" }

@Composable
private fun Compteur(@DrawableRes icone: Int, valeur: Int, libelle: String, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    val forme = RoundedCornerShape(p.rayon.dp)
    Column(
        modifier
            .clip(forme)
            .background(p.surface.compose)
            .border(BorderStroke(1.dp, p.bordure.compose), forme)
            .padding(16.dp),
    ) {
        Icone(icone, description = null, teinte = p.accent.compose, taille = 18.dp)
        Spacer(Modifier.height(10.dp))
        Text(valeur.toString(), style = Texte.titreSection, color = p.encre.compose)
        Text(libelle, style = Texte.secondaire, color = p.encreAttenuee.compose)
    }
}

@Composable
private fun BoutonDeconnexion(enCours: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    val forme = RoundedCornerShape(p.rayon.dp)
    Row(
        modifier
            .fillMaxWidth()
            .height(46.dp)
            .clip(forme)
            .border(BorderStroke(1.dp, p.bordure.compose), forme)
            .clickable(enabled = !enCours, role = Role.Button, onClick = onClick),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (enCours) {
            Egaliseur(hauteur = 16.dp, libelle = "Déconnexion en cours")
        } else {
            Icone(R.drawable.lucide_log_out, description = null, teinte = p.danger.compose, taille = 18.dp)
            Spacer(Modifier.width(8.dp))
            Text("Se déconnecter", style = Texte.corpsFort, color = p.danger.compose)
        }
    }
}
