package com.moziik.app.ui.social

import com.moziik.app.ui.composants.entree
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.R
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.donnees.social.ActiviteAmi
import com.moziik.app.donnees.social.Blend
import com.moziik.app.donnees.social.EtatSocial
import com.moziik.app.donnees.social.Membre
import com.moziik.app.donnees.social.ProfilMembre
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Avatar
import com.moziik.app.ui.composants.CarteCollection
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LigneTitre
import com.moziik.app.ui.composants.instantIso
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.fiches.BarreCollante
import com.moziik.app.ui.fiches.BoutonFiche
import com.moziik.app.ui.fiches.ContenuFiche
import com.moziik.app.ui.fiches.EnTeteFiche
import com.moziik.app.ui.fiches.ModeleFiche
import com.moziik.app.ui.fiches.SectionFiche
import com.moziik.app.ui.fiches.nombre
import com.moziik.app.ui.menus.Interrupteur
import com.moziik.app.ui.menus.LocalMenus
import com.moziik.app.ui.navigation
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/*
 * Les écrans sociaux du site, dans l'application : le profil d'un membre
 * (/membre/<nom>), l'activité des amis (/amis) et le Blend (/blend/<nom>).
 * Mêmes données, mêmes règles : on ne voit l'écoute que de ceux qui la
 * partagent, et le Blend ne se fait qu'entre deux membres qui se suivent.
 */

/** Une écoute de moins de huit minutes est sans doute encore en cours. */
private const val EN_COURS_MS = 8 * 60_000L

private fun ilYa(iso: String, maintenant: Long = System.currentTimeMillis()): String {
    val ecart = maintenant - (instantIso(iso)?.time ?: return "")
    if (ecart < EN_COURS_MS) return "En ce moment"
    val minutes = ecart / 60_000
    return when {
        minutes < 60 -> "il y a $minutes min"
        minutes < 24 * 60 -> "il y a ${minutes / 60} h"
        minutes < 48 * 60 -> "hier"
        else -> "il y a ${minutes / (24 * 60)} j"
    }
}

/** Une photo de membre qui remplit la place qu'on lui donne (en-tête de fiche). */
@Composable
private fun AvatarPlein(m: Membre) {
    BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Avatar(m.name, m.avatarUrl, taille = minOf(maxWidth, maxHeight))
    }
}

// ------------------------------------------------------------------ profil

@Composable
fun EcranMembre(username: String, onRetour: () -> Unit) {
    val c = conteneur()
    val modele: ModeleFiche<ProfilMembre> = viewModel(key = "membre-$username") { ModeleFiche { c.social.profil(username) } }
    val etat by modele.etat.collectAsStateWithLifecycle()
    ContenuFiche(etat, modele::recharger) { profil -> CorpsMembre(profil, username, onRetour) }
}

@Composable
private fun CorpsMembre(profil: ProfilMembre, username: String, onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val portee = rememberCoroutineScope()
    val session by c.session.etat.collectAsStateWithLifecycle()
    var liens by remember(profil) { mutableStateOf(profil.social) }
    var envoi by remember { mutableStateOf(false) }
    val liste = rememberLazyListState()
    val m = profil.user

    fun basculer() {
        if (session !is EtatSession.Connecte) {
            c.alertes.signaler(AlerteLecture.Message("Connecte-toi pour suivre ce membre."))
            return
        }
        envoi = true
        val suivre = !liens.suivi
        portee.launch {
            runCatching { c.social.suivre(username, suivre) }
                // Ne plus suivre défait aussi le lien mutuel ; le rétablir attend une relecture du profil.
                .onSuccess { r -> liens = liens.copy(suivi = r.suivi, abonnes = r.abonnes, mutuel = if (r.suivi) liens.mutuel else false) }
                .onFailure { c.alertes.signaler(AlerteLecture.Message("L'action n'a pas abouti. Réessaie.")) }
            envoi = false
        }
    }

    LazyColumn(Modifier.fillMaxSize(), state = liste, contentPadding = PaddingValues(bottom = 32.dp)) {
        item(key = "retour") { BarreCollante(onRetour, m.name, liste) }
        item(key = "entete") {
            EnTeteFiche(
                pochette = null,
                banniere = null,
                type = "Profil",
                titre = m.name,
                forme = CircleShape,
                sousTitre = m.username?.let { { Text("@$it", style = Texte.corps, color = p.encreAttenuee.compose) } },
                pastilles = listOf(nombre(liens.abonnes, "abonné"), nombre(liens.abonnements, "abonnement")),
                pochetteDessinee = { AvatarPlein(m) },
            ) {
                if (!liens.estMoi) {
                    BoutonFiche(
                        if (liens.suivi) R.drawable.lucide_user_check else R.drawable.lucide_user_plus,
                        if (liens.suivi) "Abonné" else "Suivre",
                        onClick = ::basculer,
                        principal = !liens.suivi,
                        chargement = envoi,
                    )
                }
                if (liens.mutuel) BoutonFiche(R.drawable.lucide_blend, "Blend", onClick = { nav.blend(username) })
                profil.artist?.let { a -> BoutonFiche(R.drawable.lucide_mic_vocal, null, onClick = { nav.artiste(a.id) }, description = "Page artiste") }
            }
        }
        item(key = "playlists") {
            SectionFiche("Playlists publiques") {
                if (profil.playlists.isEmpty()) {
                    Text(
                        "Aucune playlist publiée pour l'instant.",
                        style = Texte.secondaire, color = p.encreAttenuee.compose,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
            }
        }
        items(profil.playlists.chunked(2), key = { ligne -> "pl-" + ligne.first().id }) { ligne ->
            Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                ligne.forEach { pl ->
                    CarteCollection(pl.title, nombre(pl.songsCount, "titre"), pl.coverUrl, { nav.playlist(pl.id) }, Modifier.weight(1f), badge = R.drawable.lucide_list_music)
                }
                if (ligne.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

// ------------------------------------------------------------------- amis

/**
 * L'activité des amis, relue chaque minute tant que l'écran est ouvert :
 * c'est l'ordre de grandeur d'un titre, inutile d'interroger plus souvent.
 */
@Composable
fun EcranAmis(onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val portee = rememberCoroutineScope()
    val session by c.session.etat.collectAsStateWithLifecycle()
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    var activite by remember { mutableStateOf<List<ActiviteAmi>?>(null) }
    var social by remember { mutableStateOf<EtatSocial?>(null) }
    var echec by remember { mutableStateOf(false) }
    var essai by remember { mutableIntStateOf(0) }
    val liste = rememberLazyListState()
    val connecte = session is EtatSession.Connecte

    LaunchedEffect(connecte, essai) {
        if (!connecte) return@LaunchedEffect
        while (true) {
            runCatching { c.social.activite() to c.social.etat() }
                .onSuccess { (a, s) ->
                    activite = a
                    social = s
                    echec = false
                }
                .onFailure { echec = activite == null }
            delay(60_000)
        }
    }

    LazyColumn(Modifier.fillMaxSize(), state = liste, contentPadding = PaddingValues(bottom = 32.dp)) {
        item(key = "retour") { BarreCollante(onRetour, "Amis", liste) }
        item(key = "titre") {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text("Activité des amis", style = Texte.titreFiche, color = p.encre.compose)
                Spacer(Modifier.height(4.dp))
                Text(
                    "Ce que les membres que tu suis écoutent en ce moment, ou ont écouté en dernier.",
                    style = Texte.secondaire, color = p.encreAttenuee.compose,
                )
            }
        }
        if (!connecte) {
            item(key = "anonyme") { Vide("Connecte-toi pour suivre des membres et voir ce qu'ils écoutent.") }
            return@LazyColumn
        }
        social?.let { s ->
            item(key = "partage") {
                Column(Modifier.padding(horizontal = 16.dp)) {
                    Interrupteur(s.partageEcoute, "Partager mon activité d'écoute") { actif ->
                        social = s.copy(partageEcoute = actif)
                        portee.launch {
                            runCatching { c.social.partager(actif) }.onFailure {
                                social = s
                                c.alertes.signaler(AlerteLecture.Message("Le réglage n'a pas été enregistré."))
                            }
                        }
                    }
                    Text(
                        if (s.partageEcoute) "Tes abonnés voient ce que tu écoutes." else "Personne ne voit ce que tu écoutes, et le Blend n'est pas possible.",
                        style = Texte.secondaire, color = p.encreAttenuee.compose,
                    )
                    Spacer(Modifier.height(12.dp))
                    HorizontalDivider(color = p.bordure.compose)
                }
            }
        }
        when {
            echec -> item(key = "echec") {
                Column(Modifier.padding(16.dp)) {
                    Text("L'activité n'a pas pu être chargée.", style = Texte.corps, color = p.encreAttenuee.compose)
                    Text(
                        "Réessayer", style = Texte.corpsFort, color = p.accent.compose,
                        modifier = Modifier.padding(top = 8.dp).clickable(role = Role.Button) { essai++ },
                    )
                }
            }
            activite == null -> items(4) { Box(Modifier.padding(horizontal = 16.dp, vertical = 8.dp).fillMaxWidth().height(52.dp).clip(RoundedCornerShape(8.dp)).background(p.surface.compose)) }
            activite!!.isEmpty() -> item(key = "vide") {
                Vide("Suis des membres depuis leur profil (la recherche les trouve) : leurs écoutes des deux dernières semaines apparaîtront ici, s'ils les partagent.")
            }
            else -> items(activite!!, key = { "ami-" + it.ami.id }) { a ->
                Box(Modifier.animateItem().entree(activite!!.indexOf(a))) { LigneActivite(a, a.titre.id == lecture.courant?.id && lecture.enLecture) }
            }
        }
        social?.abonnements?.takeIf { it.isNotEmpty() }?.let { suivis ->
            item(key = "suivis") { SectionFiche("Tu suis") {} }
            items(suivis, key = { "suivi-" + it.id }) { m ->
                Row(
                    Modifier.fillMaxWidth().clickable(role = Role.Button) { m.username?.let(nav::membre) }.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Avatar(m.name, m.avatarUrl, taille = 40.dp)
                    Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                        Text(m.name, style = Texte.corpsFort, color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(if (m.mutuel) "Vous vous suivez" else "@${m.username.orEmpty()}", style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1)
                    }
                    if (m.mutuel && m.username != null) {
                        Box(
                            Modifier.size(40.dp).clip(CircleShape).clickable(role = Role.Button, onClickLabel = "Blend avec ${m.name}") { nav.blend(m.username) },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icone(R.drawable.lucide_blend, description = "Blend avec ${m.name}", teinte = p.encreAttenuee.compose, taille = 18.dp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LigneActivite(a: ActiviteAmi, joue: Boolean) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val menus = LocalMenus.current
    val enCours = ilYa(a.ecouteLe) == "En ce moment"
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(role = Role.Button, onClickLabel = "Écouter ${a.titre.title}") { c.lecteur.lire(listOf(a.titre), 0, "Écouté par ${a.ami.name}") }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.clip(CircleShape).clickable(role = Role.Button, onClickLabel = "Profil de ${a.ami.name}") { a.ami.username?.let(nav::membre) }) {
            Avatar(a.ami.name, a.ami.avatarUrl, taille = 48.dp)
            if (enCours) {
                Box(Modifier.align(Alignment.BottomEnd).size(13.dp).clip(CircleShape).background(p.base.compose).padding(2.dp).clip(CircleShape).background(p.accent.compose))
            }
        }
        Column(Modifier.weight(1f).padding(start = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(a.ami.name, style = Texte.corpsFort, color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                Spacer(Modifier.width(8.dp))
                Text(ilYa(a.ecouteLe), style = Texte.secondaire, color = if (enCours) p.accent.compose else p.encreAttenuee.compose)
            }
            Text(
                a.titre.title + (a.titre.artist?.stageName?.let { " · $it" } ?: ""),
                style = Texte.secondaire,
                color = if (joue) p.accent.compose else p.encreAttenuee.compose,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
        Box(
            Modifier.size(40.dp).clip(CircleShape).clickable(role = Role.Button, onClickLabel = "Plus d'options") { menus.titre(a.titre) },
            contentAlignment = Alignment.Center,
        ) {
            Icone(R.drawable.lucide_ellipsis_vertical, description = "Plus d'options", teinte = p.encreAttenuee.compose, taille = 18.dp)
        }
    }
}

@Composable
private fun Vide(texte: String) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 28.dp)) {
        Icone(R.drawable.lucide_headphones, description = null, teinte = p.encreAttenuee.compose, taille = 24.dp)
        Spacer(Modifier.height(10.dp))
        Text(texte, style = Texte.corps, color = p.encreAttenuee.compose)
    }
}

// ------------------------------------------------------------------ blend

@Composable
fun EcranBlend(username: String, onRetour: () -> Unit) {
    val c = conteneur()
    val modele: ModeleFiche<Blend> = viewModel(key = "blend-$username") { ModeleFiche { c.social.blend(username) } }
    val etat by modele.etat.collectAsStateWithLifecycle()
    ContenuFiche(etat, modele::recharger) { blend -> CorpsBlend(blend, onRetour) }
}

@Composable
private fun CorpsBlend(blend: Blend, onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val menus = LocalMenus.current
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    val liste = rememberLazyListState()
    val titres = blend.titres.map { it.titre }
    val source = "Blend avec ${blend.ami.name}"
    val communs = blend.titres.count { it.pour == "deux" }
    val prenom = { m: Membre -> m.name.substringBefore(' ') }

    LazyColumn(Modifier.fillMaxSize(), state = liste, contentPadding = PaddingValues(bottom = 32.dp)) {
        item(key = "retour") { BarreCollante(onRetour, "Blend", liste) }
        item(key = "entete") {
            EnTeteFiche(
                pochette = null,
                banniere = blend.ami.avatarUrl,
                type = "Blend",
                titre = "${prenom(blend.moi)} et ${prenom(blend.ami)}",
                sousTitre = {
                    Text(
                        if (titres.isEmpty()) "Pas encore assez d'écoutes de part et d'autre pour composer ce Blend."
                        else "${blend.correspondance} % d'artistes en commun" +
                            (if (communs > 0) ", et ${nombre(communs, "titre")} que vous écoutez tous les deux." else "."),
                        style = Texte.corps, color = p.encreAttenuee.compose,
                    )
                },
                pastilles = listOf(nombre(titres.size, "titre")),
                pochetteDessinee = {
                    BoxWithConstraints(Modifier.fillMaxSize().background(p.surface.compose), contentAlignment = Alignment.Center) {
                        val taille = maxWidth * 0.46f
                        // Les deux photos se chevauchent d'un quart : deux goûts mêlés.
                        Avatar(blend.moi.name, blend.moi.avatarUrl, Modifier.offset(x = -taille * 0.38f).border(3.dp, p.surface.compose, CircleShape), taille = taille)
                        Avatar(blend.ami.name, blend.ami.avatarUrl, Modifier.offset(x = taille * 0.38f).border(3.dp, p.surface.compose, CircleShape), taille = taille)
                    }
                },
            ) {
                if (titres.isNotEmpty()) {
                    BoutonFiche(R.drawable.lucide_play_plein, "Tout écouter", onClick = { c.lecteur.lire(titres, 0, source) }, principal = true)
                    BoutonFiche(R.drawable.lucide_shuffle, null, onClick = { c.lecteur.lire(titres.shuffled(), 0, source) }, description = "Lecture aléatoire")
                }
                blend.ami.username?.let { u -> BoutonFiche(R.drawable.lucide_user, null, onClick = { nav.membre(u) }, description = "Profil de ${blend.ami.name}") }
            }
        }
        if (titres.isNotEmpty()) item(key = "titres") { SectionFiche("Titres") {} }
        itemsIndexed(blend.titres, key = { i, l -> "blend-$i-${l.titre.id}" }) { i, ligne ->
            Row(Modifier.padding(start = 12.dp).entree(i), verticalAlignment = Alignment.CenterVertically) {
                // De qui vient le titre : un avatar, ou les deux superposés.
                Box(Modifier.width(34.dp)) {
                    if (ligne.pour != "b") Avatar(blend.moi.name, blend.moi.avatarUrl, taille = 20.dp)
                    if (ligne.pour != "a") {
                        Avatar(
                            blend.ami.name, blend.ami.avatarUrl,
                            Modifier.offset(x = if (ligne.pour == "deux") 12.dp else 0.dp).border(2.dp, p.base.compose, CircleShape),
                            taille = 20.dp,
                        )
                    }
                }
                LigneTitre(
                    ligne.titre, null, ligne.titre.id == lecture.courant?.id, lecture.enLecture,
                    onClick = { c.lecteur.lire(titres, i, source) },
                    modifier = Modifier.weight(1f).padding(end = 12.dp),
                    onAppuiLong = { menus.titre(ligne.titre, source) },
                )
            }
        }
    }
}
