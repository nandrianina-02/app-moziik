package com.moziik.app.ui.notifications

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.moziik.app.BuildConfig
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.cibleDe
import com.moziik.app.donnees.notifications.Avis
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LogoMoziik
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.apparitionUneFois
import com.moziik.app.ui.composants.dateCourte
import com.moziik.app.ui.composants.instantIso
import com.moziik.app.ui.composants.pressable
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.fiches.BarreRetour
import com.moziik.app.ui.menus.Confirmation
import com.moziik.app.ui.navigation
import kotlinx.coroutines.launch
import java.util.Calendar
import com.moziik.app.donnees.notifications.AnnonceTexte
import com.moziik.app.ui.menus.Feuille
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import com.moziik.app.ui.composants.SqueletteListe

/** Le pictogramme d'une notification sans image, par type (NotificationItem.tsx). */
private fun iconeDe(type: String): Int = when (type) {
    "new_song" -> R.drawable.lucide_music_2
    "new_follower" -> R.drawable.lucide_user_plus
    "like" -> R.drawable.lucide_heart
    "comment" -> R.drawable.lucide_message_circle
    "event" -> R.drawable.lucide_calendar_days
    "payment" -> R.drawable.lucide_crown
    "message" -> R.drawable.lucide_messages_square
    "system" -> R.drawable.lucide_megaphone
    else -> R.drawable.lucide_bell
}

/** Aujourd'hui, Hier, Cette semaine, Plus tôt : les repères d'une boîte de réception. */
private fun groupeDe(iso: String?, maintenant: Calendar): String {
    val date = instantIso(iso) ?: return "Plus tôt"
    val jour = Calendar.getInstance().apply { time = date }
    fun memeJour(a: Calendar, b: Calendar) = a.get(Calendar.YEAR) == b.get(Calendar.YEAR) && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR)
    val hier = (maintenant.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, -1) }
    return when {
        memeJour(jour, maintenant) -> "Aujourd'hui"
        memeJour(jour, hier) -> "Hier"
        maintenant.timeInMillis - date.time < 7 * 86_400_000L -> "Cette semaine"
        else -> "Plus tôt"
    }
}

/**
 * Les notifications du compte (H, NotificationsDrawer.tsx), en page :
 * groupées par jour, les non lues marquées d'un point. Ouvrir une
 * notification la marque lue et suit son lien ; un appui long la
 * supprime. Rafraîchie en tirant vers le bas, complétée en bas de liste.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EcranNotifications(onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val portee = rememberCoroutineScope()
    val liste by c.notifications.liste.collectAsStateWithLifecycle()
    val encore by c.notifications.encore.collectAsStateWithLifecycle()
    val nonLues by c.notifications.nonLues.collectAsStateWithLifecycle()
    var rafraichit by remember { mutableStateOf(false) }
    var erreur by remember { mutableStateOf<String?>(null) }
    var suiteEnCours by remember { mutableStateOf(false) }
    var aSupprimer by remember { mutableStateOf<Avis?>(null) }
    var vidage by remember { mutableStateOf(false) }
    val vus = remember { mutableSetOf<Any>() }
    val etatListe = rememberLazyListState()

    LaunchedEffect(Unit) {
        c.notifications.actualiser().onFailure { erreur = messageErreur(it) }
    }
    // Près du bas : la page suivante, une seule demande à la fois.
    val presDuBas by remember {
        derivedStateOf {
            val dernier = etatListe.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            dernier >= etatListe.layoutInfo.totalItemsCount - 3
        }
    }
    LaunchedEffect(presDuBas, encore, liste?.size) {
        if (presDuBas && encore && !suiteEnCours) {
            suiteEnCours = true
            c.notifications.suite()
            suiteEnCours = false
        }
    }

    var annonce by remember { mutableStateOf<Avis?>(null) }
    val contexte = androidx.compose.ui.platform.LocalContext.current
    // Un lien d'annonce : une page du site s'ouvre dans l'app, une adresse externe dans le navigateur.
    val suivreLien: (String) -> Unit = { lien ->
        val cible = cibleDe(lien, BuildConfig.SITE)
        if (!nav.suivre(cible) && cible is com.moziik.app.donnees.catalogue.Cible.Externe) {
            com.moziik.app.ui.ouvrirLien(contexte, cible.adresse, p.base.enArgb().toInt())
        }
    }
    val ouvrir: (Avis) -> Unit = { avis ->
        if (!avis.read) portee.launch { c.notifications.marquerLue(avis.id) }
        // Une annonce se lit en entier, mise en forme ; son lien s'ouvre de là.
        if (avis.riche) annonce = avis else avis.link?.let(suivreLien)
    }

    PullToRefreshBox(
        isRefreshing = rafraichit,
        onRefresh = {
            rafraichit = true
            portee.launch {
                c.notifications.actualiser().onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                rafraichit = false
            }
        },
        modifier = Modifier.fillMaxSize(),
    ) {
        LazyColumn(Modifier.fillMaxSize(), state = etatListe, contentPadding = PaddingValues(bottom = 32.dp)) {
            item(key = "retour") { BarreRetour(onRetour) }
            item(key = "titre") {
                Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Notifications", style = Texte.titreFiche, color = p.encre.compose)
                        if (nonLues > 0) {
                            Text("$nonLues non lue${if (nonLues > 1) "s" else ""}", style = Texte.secondaire, color = p.encreAttenuee.compose)
                        }
                    }
                    if (nonLues > 0) {
                        Action(R.drawable.lucide_check_check, "Tout marquer comme lu") {
                            portee.launch { c.notifications.toutMarquerLu().onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) } }
                        }
                    }
                    if (!liste.isNullOrEmpty()) Action(R.drawable.lucide_trash_2, "Tout supprimer") { vidage = true }
                }
            }
            val elements = liste
            when {
                elements == null && erreur != null -> item(key = "erreur") { Vide(R.drawable.lucide_circle_alert, erreur.orEmpty()) }
                elements == null -> item(key = "attente") {
                    SqueletteListe(6, Modifier.padding(top = 8.dp), cote = 40.dp, rond = true)
                }
                elements.isEmpty() -> item(key = "vide") {
                    Vide(R.drawable.lucide_bell, "Aucune notification pour le moment. Les nouveautés de tes artistes et les réactions à tes sons arriveront ici.")
                }
                else -> {
                    val maintenant = Calendar.getInstance()
                    val rangs = elements.withIndex().associate { it.value.id to it.index }
                    elements.groupBy { groupeDe(it.createdAt, maintenant) }.forEach { (groupe, avis) ->
                        item(key = "groupe-$groupe") {
                            Text(
                                groupe,
                                style = Texte.secondaire.copy(fontWeight = FontWeight.SemiBold),
                                color = p.encreAttenuee.compose,
                                modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp),
                            )
                        }
                        items(avis, key = { it.id }) { a ->
                            LigneAvis(
                                a,
                                Modifier.apparitionUneFois(a.id, minOf(rangs[a.id] ?: 0, 6), vus),
                                onClick = { ouvrir(a) },
                                onAppuiLong = { aSupprimer = a },
                            )
                        }
                    }
                    if (encore) {
                        item(key = "suite") {
                            Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 16.dp, libelle = "Chargement") }
                        }
                    }
                }
            }
        }
    }

    annonce?.let { a ->
        Feuille({ annonce = null }) {
            Column(Modifier.heightIn(max = 560.dp).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(36.dp).clip(CircleShape).background(p.accent.compose.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                        Icone(R.drawable.lucide_megaphone, description = null, teinte = p.accent.compose, taille = 18.dp)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Annonce de Moziik", style = Texte.secondaire, color = p.encreAttenuee.compose)
                        Text(a.title, style = Texte.corpsFort, color = p.encre.compose)
                    }
                }
                Spacer(Modifier.height(14.dp))
                TexteAnnonce(a.message, onLien = { lien ->
                    annonce = null
                    suivreLien(lien)
                })
                a.link?.takeIf { it.isNotBlank() }?.let { lien ->
                    Spacer(Modifier.height(18.dp))
                    com.moziik.app.ui.composants.BoutonPrincipal("Ouvrir", {
                        annonce = null
                        suivreLien(lien)
                    }, Modifier.fillMaxWidth())
                }
                Spacer(Modifier.height(8.dp))
            }
        }
    }

    aSupprimer?.let { a ->
        Confirmation(
            titre = "Supprimer cette notification ?",
            texte = "« ${a.title} » disparaîtra de ta liste.",
            action = "Supprimer",
            onConfirmer = {
                aSupprimer = null
                portee.launch { c.notifications.supprimer(a.id).onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) } }
            },
            onFermer = { aSupprimer = null },
        )
    }
    if (vidage) {
        Confirmation(
            titre = "Tout supprimer ?",
            texte = "Toutes tes notifications seront effacées, sur le site comme dans l'app.",
            action = "Supprimer",
            onConfirmer = {
                vidage = false
                portee.launch { c.notifications.toutSupprimer().onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) } }
            },
            onFermer = { vidage = false },
        )
    }
}

@Composable
private fun Action(icone: Int, description: String, onClick: () -> Unit) {
    val p = LocalPalette.current
    Box(
        Modifier.size(40.dp).clip(CircleShape).pressable(onClick = onClick).semantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        Icone(icone, description = null, teinte = p.encreAttenuee.compose, taille = 19.dp)
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun LigneAvis(a: Avis, modifier: Modifier, onClick: () -> Unit, onAppuiLong: () -> Unit) {
    val p = LocalPalette.current
    Row(
        modifier
            .fillMaxWidth()
            .background(if (a.read) p.base.compose else p.accent.compose.copy(alpha = 0.06f))
            .combinedClickable(role = Role.Button, onLongClick = onAppuiLong, onLongClickLabel = "Supprimer", onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(Modifier.size(44.dp)) {
            if (a.imageUrl != null) {
                Pochette(a.imageUrl, Modifier.fillMaxSize(), if (a.type == "new_follower") CircleShape else RoundedCornerShape(8.dp))
            } else {
                Box(Modifier.fillMaxSize().clip(CircleShape).background(p.accent.compose.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                    Icone(iconeDe(a.type), description = null, teinte = p.accent.compose, taille = 20.dp)
                }
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    a.title,
                    style = Texte.corps.copy(fontWeight = if (a.read) FontWeight.Medium else FontWeight.SemiBold),
                    color = p.encre.compose,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                Text(dateCourte(a.createdAt), style = Texte.secondaire, color = p.encreAttenuee.compose)
            }
            if (a.message.isNotBlank()) {
                Spacer(Modifier.height(2.dp))
                Text(
                    if (a.riche) AnnonceTexte.texteBrut(a.message) else a.message,
                    style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 2, overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (!a.read) {
            Spacer(Modifier.width(10.dp))
            Box(
                Modifier.padding(top = 6.dp).size(8.dp).clip(CircleShape).background(p.accent.compose).semantics { contentDescription = "Non lue" },
            )
        }
    }
}

@Composable
private fun Vide(icone: Int, texte: String) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 64.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(52.dp).clip(CircleShape).background(p.accent.compose.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
            Icone(icone, description = null, teinte = p.accent.compose, taille = 24.dp)
        }
        Spacer(Modifier.height(14.dp))
        Text(texte, style = Texte.corps, color = p.encreAttenuee.compose, textAlign = TextAlign.Center)
    }
}
