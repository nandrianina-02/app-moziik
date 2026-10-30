package com.moziik.app.ui.horsligne

import com.moziik.app.ui.composants.entree
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.moziik.app.R
import com.moziik.app.donnees.Conteneur
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.horsligne.Refus
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.lecteur.EtatLecteur
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.Navigation
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LienTexte
import com.moziik.app.ui.composants.LigneTitre
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.fiches.BoutonFiche
import com.moziik.app.ui.menus.Confirmation
import com.moziik.app.ui.menus.Interrupteur
import com.moziik.app.ui.menus.LocalMenus
import com.moziik.app.ui.navigation
import kotlinx.coroutines.launch
import java.util.Locale

/** La réponse de l'écran à un téléchargement refusé : un visiteur se connecte, un membre découvre Premium (6.1). */
fun reagirAuRefus(refus: Refus?, c: Conteneur, nav: Navigation) {
    when (refus) {
        Refus.Compte -> c.alertes.signaler(AlerteLecture.Message("Connecte-toi pour télécharger des titres."))
        Refus.Premium -> {
            c.alertes.signaler(AlerteLecture.Message("Le téléchargement est réservé aux abonnés Premium."))
            nav.abonnement()
        }
        null -> Unit
    }
}

/** « 12,4 Mo », « 1,2 Go » : la place prise, lisible d'un coup d'oeil. */
fun taille(octets: Long): String {
    val mo = octets / 1_048_576.0
    return when {
        mo >= 1024 -> String.format(Locale.FRANCE, "%.1f Go", mo / 1024)
        mo >= 10 -> String.format(Locale.FRANCE, "%.0f Mo", mo)
        else -> String.format(Locale.FRANCE, "%.1f Mo", mo)
    }
}

/**
 * Le bouton « Télécharger » d'un album ou d'une playlist (G1) : il montre
 * l'avancement du lot, et, tout étant là, propose de le retirer.
 */
@Composable
fun BoutonTelechargerLot(titres: List<Titre>, source: String, nom: String, albumId: String? = null) {
    val c = conteneur()
    val nav = navigation()
    val portee = rememberCoroutineScope()
    val presents by c.horsLigne.telechargements.titres.collectAsStateWithLifecycle()
    val attente by c.horsLigne.attente.collectAsStateWithLifecycle()
    var retrait by remember { mutableStateOf(false) }
    val publies = titres.filter { it.publie }
    if (publies.isEmpty()) return
    val ids = presents.map { it.id }.toSet()
    val faits = publies.count { it.id in ids }
    val enCours = publies.any { it.id in attente }
    when {
        enCours -> BoutonFiche(R.drawable.lucide_download, "$faits / ${publies.size}", onClick = {}, actif = true, description = "Téléchargement en cours")
        faits == publies.size -> BoutonFiche(R.drawable.lucide_circle_check, "Téléchargé", onClick = { retrait = true }, actif = true)
        else -> BoutonFiche(R.drawable.lucide_download, null, description = "Télécharger", onClick = {
            portee.launch { reagirAuRefus(c.horsLigne.telechargerLot(publies, source, nom, albumId), c, nav) }
        })
    }
    if (retrait) {
        Confirmation(
            titre = "Retirer les téléchargements ?",
            texte = "Les titres de « $nom » ne seront plus disponibles hors connexion.",
            action = "Retirer",
            onConfirmer = {
                c.horsLigne.retirerLot(publies)
                retrait = false
            },
            onFermer = { retrait = false },
        )
    }
}

/** Le bouton hors connexion d'un titre (fiche titre) : télécharger, annuler, ou retirer. */
@Composable
fun BoutonTelechargerTitre(titre: Titre) {
    if (!titre.publie) return
    val c = conteneur()
    val nav = navigation()
    val portee = rememberCoroutineScope()
    val presents by c.horsLigne.telechargements.titres.collectAsStateWithLifecycle()
    val attente by c.horsLigne.attente.collectAsStateWithLifecycle()
    val telecharge = presents.any { it.id == titre.id }
    val enAttente = titre.id in attente
    BoutonFiche(
        if (telecharge) R.drawable.lucide_circle_check else R.drawable.lucide_download,
        null,
        actif = telecharge || enAttente,
        chargement = enAttente,
        description = when {
            telecharge -> "Retirer des téléchargements"
            enAttente -> "Annuler le téléchargement"
            else -> "Télécharger"
        },
        onClick = { portee.launch { reagirAuRefus(c.horsLigne.basculer(titre), c, nav) } },
    )
}

/**
 * L'onglet Téléchargements de Ma zone (G2) : place prise, réglages, file
 * en cours et titres gardés. `titres` : les téléchargements déjà prêts pour
 * le lecteur (pochettes locales).
 */
fun LazyListScope.listeTelechargements(titres: List<Titre>, lecture: EtatLecteur) {
    item(key = "tel-entete") { EnTeteTelechargements() }
    if (titres.isEmpty()) item(key = "tel-vide") { AucunTelechargement() }
    itemsIndexed(titres, key = { _, t -> "tel-${t.id}" }) { i, t ->
        val c = conteneur()
        val menus = LocalMenus.current
        LigneTitre(
            t, null, t.id == lecture.courant?.id, lecture.enLecture,
            onClick = { c.lecteur.lire(titres, i, "Téléchargements") },
            modifier = Modifier.animateItem().entree(i),
            onAppuiLong = { menus.titre(t, "Téléchargements") },
        )
    }
}

@Composable
private fun EnTeteTelechargements() {
    val c = conteneur()
    val p = LocalPalette.current
    val hors = c.horsLigne
    val titres by hors.telechargements.titres.collectAsStateWithLifecycle()
    val attente by hors.attente.collectAsStateWithLifecycle()
    val enCours by hors.telechargements.enCours.collectAsStateWithLifecycle()
    val wifi by c.reglages.wifiSeulement.collectAsStateWithLifecycle()
    val horsReseau by hors.horsReseau.collectAsStateWithLifecycle()
    var vidage by remember { mutableStateOf(false) }
    // Relu quand la liste change : un parcours du dossier, pas à chaque recomposition.
    val utilise = remember(titres, enCours.keys) { hors.telechargements.espaceUtilise() }
    val libre = remember(titres) { hors.telechargements.espaceLibre() }

    Column(Modifier.padding(bottom = 8.dp)) {
        if (horsReseau) {
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(p.rayon.dp)).background(p.surface.compose).padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icone(R.drawable.lucide_wifi_off, description = null, teinte = p.encreAttenuee.compose, taille = 18.dp)
                Spacer(Modifier.width(10.dp))
                Column {
                    Text("Mode hors-ligne", style = Texte.corpsFort, color = p.encre.compose)
                    Text("Synchronisation au retour du réseau.", style = Texte.secondaire, color = p.encreAttenuee.compose)
                }
            }
            Spacer(Modifier.height(14.dp))
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icone(R.drawable.lucide_hard_drive, description = null, teinte = p.encreAttenuee.compose, taille = 18.dp)
            Spacer(Modifier.width(10.dp))
            Text(
                "${titres.size} titre${if (titres.size > 1) "s" else ""} · ${taille(utilise)} utilisés · ${taille(libre)} libres",
                style = Texte.secondaire, color = p.encreAttenuee.compose,
            )
        }
        Spacer(Modifier.height(10.dp))
        Interrupteur(wifi, "Télécharger en Wi-Fi seulement") {
            c.reglages.choisirWifiSeulement(it)
            hors.reprendre()
        }
        if (titres.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            BoutonPrincipal("Tout écouter", { c.lecteur.lire(titres.map(hors.telechargements::versTitre), 0, "Téléchargements") })
            Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                LienTexte("Nettoyer", {
                    val n = hors.telechargements.nettoyer()
                    c.alertes.signaler(
                        AlerteLecture.Message(
                            if (n == 0) "Aucun titre non écouté depuis 90 jours."
                            else "$n titre${if (n > 1) "s" else ""} non écouté${if (n > 1) "s" else ""} depuis 90 jours retiré${if (n > 1) "s" else ""}.",
                            succes = true,
                        ),
                    )
                })
                LienTexte("Tout supprimer", { vidage = true })
            }
        }
        if (attente.isNotEmpty()) {
            Spacer(Modifier.height(16.dp))
            Text("En attente", style = Texte.corpsFort, color = p.encre.compose)
            Spacer(Modifier.height(6.dp))
            val avancement = enCours.values.firstOrNull()
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icone(R.drawable.lucide_download, description = null, teinte = p.accent.compose, taille = 16.dp)
                Spacer(Modifier.width(8.dp))
                Text(
                    "${attente.size} titre${if (attente.size > 1) "s" else ""}" +
                        (avancement?.let { " · ${(it * 100).toInt()} % du titre en cours" } ?: if (horsReseau) " · reprise à la reconnexion" else ""),
                    style = Texte.secondaire, color = p.encreAttenuee.compose,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
            if (avancement != null) {
                Spacer(Modifier.height(8.dp))
                Box(Modifier.fillMaxWidth().height(3.dp).clip(CircleShape).background(p.bordure.compose)) {
                    Box(Modifier.fillMaxWidth(avancement.coerceIn(0f, 1f)).height(3.dp).background(p.accent.compose))
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        HorizontalDivider(color = p.bordure.compose)
    }
    if (vidage) {
        Confirmation(
            titre = "Tout supprimer ?",
            texte = "Les ${titres.size} titres téléchargés seront effacés de ce téléphone.",
            action = "Supprimer",
            onConfirmer = {
                hors.telechargements.toutSupprimer()
                vidage = false
            },
            onFermer = { vidage = false },
        )
    }
}

@Composable
private fun AucunTelechargement() {
    val p = LocalPalette.current
    Column(Modifier.fillMaxWidth().padding(vertical = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(48.dp).clip(CircleShape).background(p.accent.compose.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
            Icone(R.drawable.lucide_download, description = null, teinte = p.accent.compose, taille = 22.dp)
        }
        Spacer(Modifier.height(12.dp))
        Text("Aucun titre téléchargé", style = Texte.corpsFort, color = p.encre.compose)
        Spacer(Modifier.height(4.dp))
        Text(
            "Avec Premium, garde un titre, un album ou une playlist sur ton téléphone et écoute-les sans réseau.",
            style = Texte.secondaire, color = p.encreAttenuee.compose,
            textAlign = TextAlign.Center,
        )
    }
}
