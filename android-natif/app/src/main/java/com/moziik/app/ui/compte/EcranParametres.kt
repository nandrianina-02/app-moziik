package com.moziik.app.ui.compte

import android.content.Intent
import android.os.Build
import android.provider.Settings
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.moziik.app.donnees.compte.LIEN_DERNIERE_VERSION
import com.moziik.app.BuildConfig
import com.moziik.app.R
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.apparition
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.menus.Interrupteur
import com.moziik.app.ui.ouvrirLien
import kotlinx.coroutines.launch
import com.moziik.app.ui.bienvenue.ChoixGenres
import com.moziik.app.ui.menus.Feuille
import androidx.compose.foundation.layout.heightIn
import com.moziik.app.lecteur.NiveauBass
import com.moziik.app.ui.lecteur.ChoixBasses

/**
 * Tous les réglages de l'app au même endroit, ouverts par la roue de
 * l'en-tête : lecture, téléchargements, apparence, notifications, compte
 * et version. Un visiteur y accède aussi ; les rubriques du compte
 * n'apparaissent qu'une fois connecté.
 */
@Composable
fun EcranParametres(onRetour: () -> Unit, onOuvrir: (String) -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val contexte = LocalContext.current
    val portee = rememberCoroutineScope()
    val session by c.session.etat.collectAsStateWithLifecycle()
    val qualite by c.reglages.qualite.collectAsStateWithLifecycle()
    val apparence by c.reglages.apparence.collectAsStateWithLifecycle()
    val wifi by c.reglages.wifiSeulement.collectAsStateWithLifecycle()
    val noir by c.reglages.noirProfond.collectAsStateWithLifecycle()
    val autoAimes by c.reglages.autoAimes.collectAsStateWithLifecycle()
    val mixHebdo by c.reglages.mixHebdo.collectAsStateWithLifecycle()
    val reveilActif by c.reglages.reveilActif.collectAsStateWithLifecycle()
    val reveilMinutes by c.reglages.reveilMinutes.collectAsStateWithLifecycle()
    val universSuit by c.reglages.universSuitEcoute.collectAsStateWithLifecycle()
    var choixGenres by remember { mutableStateOf(false) }
    var choixBasses by remember { mutableStateOf(false) }
    var choixFondu by remember { mutableStateOf(false) }
    val fondu by c.reglages.fondu.collectAsStateWithLifecycle()
    val volumeEgal by c.reglages.volumeEgal.collectAsStateWithLifecycle()
    val basses by c.reglages.basses.collectAsStateWithLifecycle()
    val genres by c.reglages.genresPreferes.collectAsStateWithLifecycle()
    var verification by remember { mutableStateOf(false) }
    val connecte = session is EtatSession.Connecte

    PageReglage("Paramètres", onRetour) {
        Section("Lecture", 0) {
            Ligne(
                R.drawable.lucide_headphones, "Qualité et données",
                when (qualite) { "low" -> "Économe, 64 kb/s"; "medium" -> "Standard, 128 kb/s"; else -> "Haute, 320 kb/s" } + " · écoutes récentes",
            ) { onOuvrir(PARAMETRES_LECTURE) }
            Ligne(R.drawable.lucide_audio_waveform, "Bass Boost", NiveauBass.de(basses).libelle) { choixBasses = true }
            Ligne(
                R.drawable.lucide_alarm_clock, "Réveil musical",
                if (reveilActif) "%02d:%02d".format(reveilMinutes / 60, reveilMinutes % 60) else "Désactivé",
            ) { onOuvrir(PARAMETRES_REVEIL) }
            Ligne(R.drawable.lucide_audio_waveform, "Fondu entre les titres", if (fondu == 0) "Aucun" else "$fondu secondes") { choixFondu = true }
            Box(Modifier.padding(vertical = 4.dp)) {
                Interrupteur(volumeEgal, "Volume égal entre les titres") { c.reglages.choisirVolumeEgal(it) }
            }
            Box(Modifier.padding(vertical = 4.dp)) {
                Interrupteur(universSuit, "L'univers suit ce que j'écoute") { c.reglages.choisirUniversSuitEcoute(it) }
            }
            Ligne(
                R.drawable.lucide_tags, "Genres préférés",
                genres.takeIf { it.isNotEmpty() }?.sorted()?.joinToString(", ") ?: "Aucun : l'accueil fait tourner tous les genres",
            ) { choixGenres = true }
        }
        Section("Téléchargements", 1) {
            Box(Modifier.padding(vertical = 4.dp)) {
                Interrupteur(wifi, "Télécharger seulement en Wi-Fi") { c.reglages.choisirWifiSeulement(it) }
            }
            Box(Modifier.padding(vertical = 4.dp)) {
                Interrupteur(autoAimes, "Garder mes titres aimés hors connexion") { c.reglages.choisirAutoAimes(it) }
            }
            Box(Modifier.padding(vertical = 4.dp)) {
                Interrupteur(mixHebdo, "Mix de la semaine hors connexion") { c.reglages.choisirMixHebdo(it) }
            }
            Text(
                "Avec Premium, en Wi-Fi seulement : vos titres aimés se téléchargent d'eux-mêmes, et repartent quand vous ne les aimez plus. Le mix de la semaine garde une trentaine de titres « Pour toi », renouvelés tous les sept jours.",
                style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 2.dp),
            )
        }
        Section("Apparence", 2) {
            Ligne(
                R.drawable.lucide_palette, "Thème",
                when (apparence) { "clair" -> "Clair"; "sombre" -> "Sombre"; "systeme" -> "Comme le téléphone"; else -> "Celui du site" },
            ) { onOuvrir(PARAMETRES_APPARENCE) }
            Box(Modifier.padding(vertical = 4.dp)) {
                Interrupteur(noir, "Noir profond en mode sombre") { c.reglages.choisirNoirProfond(it) }
            }
        }
        Section("Notifications", 3) {
            Ligne(R.drawable.lucide_bell, "Notifications du téléphone", "Annonces, messages, téléchargements") {
                // Les canaux se règlent dans Android : un réglage maison ferait doublon avec celui du système.
                val intention = if (Build.VERSION.SDK_INT >= 26) {
                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, contexte.packageName)
                } else {
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:${contexte.packageName}"))
                }
                runCatching { contexte.startActivity(intention.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            }
        }
        if (connecte) {
            Section("Compte", 4) {
                Ligne(R.drawable.lucide_user_round_pen, "Profil", "Nom affiché, nom d'utilisateur") { onOuvrir("compte/profil") }
                Ligne(R.drawable.lucide_sliders_horizontal, "Préférences", "Univers musical, mode d'écoute") { onOuvrir("compte/preferences") }
                Ligne(R.drawable.lucide_crown, "Abonnement", "Premium, échéance, avantages") { onOuvrir("compte/abonnement") }
                Ligne(R.drawable.lucide_shield, "Sécurité", "Mot de passe, appareils connectés") { onOuvrir("compte/securite") }
            }
        }
        Section("À propos", 5) {
            Ligne(
                R.drawable.lucide_info, "Version ${BuildConfig.VERSION_NAME}",
                if (verification) "Recherche d'une mise à jour…" else "Rechercher une mise à jour",
                enCours = verification,
            ) {
                if (verification) return@Ligne
                verification = true
                portee.launch {
                    val nouvelle = runCatching { c.miseAJour.disponible() }.getOrNull()
                    verification = false
                    if (nouvelle == null) {
                        c.alertes.signaler(AlerteLecture.Message("Moziik est à jour.", succes = true))
                    } else {
                        ouvrirLien(contexte, nouvelle.adresse, p.base.compose.toArgb())
                    }
                }
            }
            // Le lien de la dernière version publiée : il ne change jamais et ne demande aucun compte.
            Ligne(R.drawable.lucide_share_2, "Partager l'application", "Le lien de téléchargement de Moziik") {
                val envoi = Intent(Intent.ACTION_SEND).setType("text/plain")
                    .putExtra(Intent.EXTRA_TEXT, "Écoute Moziik sur Android :
$LIEN_DERNIERE_VERSION")
                runCatching { contexte.startActivity(Intent.createChooser(envoi, "Partager").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            }
            Ligne(R.drawable.lucide_shield, "Confidentialité", "Vos données, ce qu'on en fait, vos droits") {
                ouvrirLien(contexte, "${BuildConfig.SITE}confidentialite", p.base.compose.toArgb())
            }
            Ligne(R.drawable.lucide_file_text, "Mentions légales", "Sur le site de Moziik") {
                ouvrirLien(contexte, "${BuildConfig.SITE}mentions-legales", p.base.compose.toArgb())
            }
        }
    }
    if (choixBasses) ChoixBasses { choixBasses = false }
    if (choixFondu) {
        Feuille({ choixFondu = false }) {
            Text("Fondu entre les titres", style = Texte.titreSection, color = p.encre.compose, modifier = Modifier.padding(start = 20.dp, bottom = 2.dp))
            Text(
                "La fin d'un titre s'efface pendant que le suivant arrive. Jamais entre deux titres du même album, qui s'enchaînent sans blanc.",
                style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 8.dp),
            )
            listOf(0, 2, 4, 6, 8).forEach { s ->
                Row(
                    Modifier.fillMaxWidth().clickable(role = Role.RadioButton) {
                        c.reglages.choisirFondu(s)
                        choixFondu = false
                    }.padding(horizontal = 20.dp, vertical = 13.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(if (s == 0) "Aucun" else "$s secondes", style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = if (s == fondu) p.accent.compose else p.encre.compose, modifier = Modifier.weight(1f))
                    if (s == fondu) Icone(R.drawable.lucide_check, description = "Choisi", teinte = p.accent.compose, taille = 18.dp)
                }
            }
        }
    }
    if (choixGenres) {
        Feuille({
            choixGenres = false
            // L'accueil se recompose avec les genres retenus.
            c.catalogue.preferencesChangees()
        }) {
            Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 8.dp)) {
                Text("Genres préférés", style = Texte.titreSection, color = p.encre.compose)
                Text("Jusqu'à cinq. Leurs sélections passent en tête de l'accueil.", style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 2.dp, bottom = 14.dp))
                ChoixGenres(genres, { c.reglages.choisirGenres(it) }, Modifier.heightIn(max = 360.dp))
            }
        }
    }
}

/** Routes des réglages ouverts depuis Paramètres, hors de l'onglet Compte. */
const val PARAMETRES_LECTURE = "parametres/lecture"
const val PARAMETRES_APPARENCE = "parametres/apparence"
const val PARAMETRES_REVEIL = "parametres/reveil"

@Composable
private fun Section(titre: String, rang: Int, contenu: @Composable () -> Unit) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxWidth().padding(top = 18.dp).apparition(rang)) {
        Text(titre.uppercase(), style = Texte.surtitre, color = p.encreAttenuee.compose, modifier = Modifier.padding(bottom = 6.dp))
        contenu()
    }
}

@Composable
private fun Ligne(icone: Int, titre: String, detail: String, enCours: Boolean = false, onClick: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable(role = Role.Button, onClick = onClick).padding(vertical = 10.dp, horizontal = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(p.accent.compose.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) {
            Icone(icone, description = null, teinte = p.accent.compose, taille = 18.dp)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(titre, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose)
            Text(detail, style = Texte.secondaire, color = p.encreAttenuee.compose)
        }
        if (enCours) Egaliseur(hauteur = 12.dp) else Icone(R.drawable.lucide_chevron_right, description = null, teinte = p.encreAttenuee.compose, taille = 18.dp)
    }
}
