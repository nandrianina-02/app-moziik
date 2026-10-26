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
import com.moziik.app.ui.composants.LogoMoziik

/** Mon compte (B8 de la spécification) : l'identité du compte, ses compteurs, la déconnexion. */
@Composable
fun EcranMonCompte(onOuvrir: (String) -> Unit) {
    val c = conteneur()
    val modele: CompteModele = viewModel { CompteModele(c.reseau.api, c.session) }
    val profil by modele.profil.collectAsStateWithLifecycle()
    val deconnexion by modele.deconnexion.collectAsStateWithLifecycle()

    Crossfade(profil, animationSpec = tween(200), label = "profil") { etat ->
        when (etat) {
            EtatProfil.Chargement -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { LogoMoziik(hauteur = 30.dp, boucle = true) }
            is EtatProfil.Echec -> Column(
                Modifier.fillMaxSize().padding(32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                MessageErreur(etat.message)
                Spacer(Modifier.height(16.dp))
                BoutonPrincipal("Réessayer", modele::charger)
            }
            is EtatProfil.Pret -> FicheCompte(etat.profil, deconnexion, modele::seDeconnecter, onOuvrir)
        }
    }
}

@Composable
private fun FicheCompte(profil: Profil, deconnexionEnCours: Boolean, onDeconnexion: () -> Unit, onOuvrir: (String) -> Unit) {
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

        Spacer(Modifier.height(24.dp))
        Column(Modifier.fillMaxWidth().apparition(7)) {
            // L'espace artiste en tête pour un compte artiste : c'est la rubrique qu'il ouvre le plus.
            val rubriques = if (u.role == "artist") listOf(ESPACE_ARTISTE) + RUBRIQUES else RUBRIQUES
            rubriques.forEach { (route, icone, titre, detail) -> LigneRubrique(icone, titre, detail) { onOuvrir(route) } }
        }

        Spacer(Modifier.height(24.dp))
        BoutonDeconnexion(deconnexionEnCours, onDeconnexion, Modifier.apparition(8))
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

private data class Rubrique(val route: String, val icone: Int, val titre: String, val detail: String)

private val ESPACE_ARTISTE = Rubrique("compte/artiste", R.drawable.lucide_chart_column, "Espace artiste", "Écoutes, auditeurs, titres les plus écoutés")

/** Les rubriques du compte, dans l'ordre où on les cherche. */
private val RUBRIQUES = listOf(
    Rubrique("compte/bilan", R.drawable.lucide_calendar_days, "Ton année", "Tes titres, artistes et genres de l'année"),
    Rubrique("compte/profil", R.drawable.lucide_user_round_pen, "Profil", "Nom affiché, nom d'utilisateur"),
    Rubrique("compte/preferences", R.drawable.lucide_sliders_horizontal, "Préférences", "Univers musical, mode d'écoute"),
    Rubrique("compte/lecture", R.drawable.lucide_headphones, "Lecture", "Qualité d'écoute, économie de données"),
    Rubrique("compte/apparence", R.drawable.lucide_palette, "Apparence", "Clair, sombre, comme le téléphone"),
    Rubrique("compte/abonnement", R.drawable.lucide_crown, "Abonnement", "Premium, échéance, avantages"),
    Rubrique("compte/securite", R.drawable.lucide_shield, "Sécurité", "Mot de passe, appareils connectés"),
)

@Composable
private fun LigneRubrique(icone: Int, titre: String, detail: String, onClick: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable(role = Role.Button, onClick = onClick).padding(vertical = 12.dp, horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(38.dp).clip(RoundedCornerShape(10.dp)).background(p.accent.compose.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) {
            Icone(icone, description = null, teinte = p.accent.compose, taille = 18.dp)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(titre, style = Texte.corps.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Medium), color = p.encre.compose)
            Text(detail, style = Texte.secondaire, color = p.encreAttenuee.compose)
        }
        Icone(R.drawable.lucide_chevron_right, description = null, teinte = p.encreAttenuee.compose, taille = 18.dp)
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
