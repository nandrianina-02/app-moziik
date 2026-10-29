@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package com.moziik.app.ui.coquille

import com.moziik.app.ui.selections.EcranSelection
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.NamedNavArgument
import androidx.navigation.navArgument
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.semantics.contentDescription
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.ui.accueil.EcranAccueil
import com.moziik.app.ui.Fiches
import com.moziik.app.ui.LocalNavigation
import com.moziik.app.ui.Navigation
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.bibliotheque.EcranBibliotheque
import com.moziik.app.ui.decouvrir.EcranClassements
import com.moziik.app.ui.menus.HoteMenus
import com.moziik.app.ui.messages.EcranConversation
import com.moziik.app.ui.messages.EcranMessages
import com.moziik.app.ui.menus.LocalMenus
import com.moziik.app.ui.menus.Menus
import com.moziik.app.ui.decouvrir.EcranEvenements
import com.moziik.app.ui.decouvrir.EcranRadio
import com.moziik.app.ui.decouvrir.EcranTitres
import com.moziik.app.ui.fiches.FicheAlbum
import com.moziik.app.ui.fiches.FicheArtiste
import com.moziik.app.ui.fiches.FichePlaylist
import com.moziik.app.ui.fiches.FicheTitre
import com.moziik.app.ui.lecteur.BandeauMessage
import com.moziik.app.ui.lecteur.LecteurPleinEcran
import com.moziik.app.ui.lecteur.MiniLecteur
import com.moziik.app.ui.lecteur.MurQuota
import com.moziik.app.ui.recherche.EcranRecherche
import com.moziik.app.R
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Mouvement
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.ecrans.EcranProvisoire
import com.moziik.app.ui.composants.LogoMoziik
import com.moziik.app.ui.decouvrir.FicheEvenement
import com.moziik.app.ui.notifications.EcranNotifications
import androidx.compose.ui.text.font.FontWeight
import com.moziik.app.ui.lecteur.rememberEtatTiroir
import com.moziik.app.ui.lecteur.glissementDuTiroir
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.nestedScroll
import com.moziik.app.ui.compte.EcranParametres
import com.moziik.app.ui.compte.PARAMETRES_LECTURE
import com.moziik.app.ui.compte.PARAMETRES_APPARENCE
import com.moziik.app.ui.compte.EcranLecture
import com.moziik.app.ui.compte.EcranApparence
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.lerp
import com.moziik.app.ui.LIEN_RECHERCHE
import com.moziik.app.ui.LIEN_TELECHARGEMENTS
import com.moziik.app.ui.LIEN_BANDE_SON
import com.moziik.app.ui.LIEN_MISE_A_JOUR
import com.moziik.app.ui.compte.PARAMETRES_REVEIL
import com.moziik.app.ui.compte.EcranReveil
import com.moziik.app.ui.decouvrir.EcranBlindTest
import androidx.compose.ui.platform.LocalConfiguration

/**
 * La coquille commune à tous les écrans, comme celle du site sur mobile :
 * en-tête de 56 dp, contenu, mini-lecteur, barre de navigation basse à
 * cinq entrées ; le lecteur plein écran se pose par-dessus.
 */
@Composable
fun Coquille(sombre: Boolean, onBasculerMode: () -> Unit) {
    val p = LocalPalette.current
    val c = conteneur()
    val navigation = rememberNavController()
    val entree by navigation.currentBackStackEntryAsState()
    val montee = with(LocalDensity.current) { 6.dp.roundToPx() }
    val lecture by c.lecteur.etat.collectAsStateWithLifecycle()
    val alerte by c.alertes.alerte.collectAsStateWithLifecycle()
    val session by c.session.etat.collectAsStateWithLifecycle()
    // Le lecteur, du mini-lecteur au plein écran : un seul tiroir que le doigt ouvre et referme.
    val tiroir = rememberEtatTiroir()
    // Une conversation occupe tout l'écran : sans en-tête, barre du bas ni mini-lecteur, le clavier a la place.
    val pleinePage = entree?.destination?.route == Fiches.CONVERSATION
    val clavier = WindowInsets.isImeVisible
    val nonLus by c.messagerie.nonLus.collectAsStateWithLifecycle()
    val notificationsNonLues by c.notifications.nonLues.collectAsStateWithLifecycle()
    val horsReseau by c.horsLigne.horsReseau.collectAsStateWithLifecycle()
    val cycle = androidx.lifecycle.compose.LocalLifecycleOwner.current
    // Le compteur de la barre du bas : relu chaque minute tant que l'app est à l'écran (H4).
    LaunchedEffect(session) {
        if (session !is EtatSession.Connecte) {
            c.messagerie.oublierNonLus()
            c.notifications.oublier()
            return@LaunchedEffect
        }
        // La cloche suit le même rythme : le site n'a pas de temps réel (NotificationsProvider.tsx).
        cycle.repeatOnLifecycle(androidx.lifecycle.Lifecycle.State.STARTED) {
            while (true) {
                c.messagerie.actualiserNonLus()
                c.notifications.actualiser()
                kotlinx.coroutines.delay(60_000)
            }
        }
    }
    // Sur une fiche, l'onglet d'où elle a été ouverte reste allumé dans la barre du bas.
    var onglet by rememberSaveable { mutableStateOf(Destination.ACCUEIL) }
    LaunchedEffect(entree) {
        val destination = entree?.destination ?: return@LaunchedEffect
        Destination.entries.firstOrNull { d -> destination.hierarchy.any { it.route == d.route } }?.let { onglet = it }
    }
    // Terme transmis à l'onglet Recherche par un lien de l'accueil (« /recherche?q=… »).
    var termeDemande by rememberSaveable { mutableStateOf<String?>(null) }

    val aller: (Destination) -> Unit = { d ->
        tiroir.fermer()
        navigation.navigate(d.route) {
            // Comme une barre d'onglets : une seule pile, l'état de chaque onglet est gardé.
            popUpTo(navigation.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    // Se connecter lève aussitôt le mur des visiteurs (spécification 5.3).
    LaunchedEffect(session) {
        if (session is EtatSession.Connecte && c.alertes.alerte.value == AlerteLecture.Quota) c.alertes.oublier()
    }

    val navigationFiches = remember(navigation) {
        Navigation(
            navigation,
            onRechercher = { terme ->
                termeDemande = terme
                aller(Destination.RECHERCHE)
            },
            onAvantNavigation = tiroir::fermer,
        )
    }

    val menus = remember { Menus() }

    // L'autorisation de notifier (Android 13), demandée au premier téléchargement seulement.
    val demande = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission(),
    ) { c.horsLigne.autorisationDemandee() }
    val aDemander by c.horsLigne.demandeAutorisation.collectAsStateWithLifecycle()
    // Connecté avec les push actifs : l'autorisation de notifier est proposée une fois (H14).
    LaunchedEffect(session) {
        if (session is EtatSession.Connecte && c.push.actif) c.horsLigne.proposerAutorisation()
    }
    // Une version plus récente publiée sur le site : proposée une fois, au lancement.
    var nouvelle by remember { mutableStateOf<com.moziik.app.donnees.compte.VersionDisponible?>(null) }
    LaunchedEffect(Unit) { nouvelle = c.miseAJour.disponible() }
    val contexteCoquille = androidx.compose.ui.platform.LocalContext.current
    nouvelle?.let { v ->
        com.moziik.app.ui.menus.Confirmation(
            titre = "Nouvelle version de Moziik",
            texte = "La version ${v.version}${v.tailleMo?.let { t -> " (" + String.format(java.util.Locale.FRANCE, "%.1f", t) + " Mo)" }.orEmpty()} est disponible. Elle s'installe par-dessus celle-ci : tes titres téléchargés et ton compte sont gardés.",
            action = "Télécharger",
            onConfirmer = {
                nouvelle = null
                com.moziik.app.ui.ouvrirLien(contexteCoquille, v.adresse, p.base.enArgb().toInt())
            },
            onFermer = {
                c.miseAJour.ignorer(v.version)
                nouvelle = null
            },
        )
    }
    // Une notification touchée : la page dont elle parle, ou la liste des notifications.
    val lienEntrant by c.lienEntrant.collectAsStateWithLifecycle()
    LaunchedEffect(lienEntrant) {
        val lien = lienEntrant ?: return@LaunchedEffect
        c.lienEntrant.value = null
        // Les raccourcis de l'icône de l'app.
        when (lien) {
            LIEN_RECHERCHE -> return@LaunchedEffect aller(Destination.RECHERCHE)
            LIEN_TELECHARGEMENTS -> return@LaunchedEffect aller(Destination.MA_ZONE)
            // La notification « Nouvelle version » : la fenêtre revient, même écartée plus tôt.
            LIEN_MISE_A_JOUR -> {
                nouvelle = runCatching { c.miseAJour.disponible(demandee = true) }.getOrNull()
                if (nouvelle == null) c.alertes.signaler(AlerteLecture.Message("Tu as déjà la dernière version de Moziik.", succes = true))
                return@LaunchedEffect
            }
            LIEN_BANDE_SON -> {
                runCatching { c.catalogue.station() }
                    .onSuccess { c.lecteur.lire(it.titres, 0, it.source) }
                    .onFailure { c.alertes.signaler(AlerteLecture.Message("Ta bande son n'a pas pu être chargée. Vérifie ta connexion.")) }
                return@LaunchedEffect
            }
        }
        val cible = com.moziik.app.donnees.catalogue.cibleDe(lien, com.moziik.app.BuildConfig.SITE)
        if (!navigationFiches.suivre(cible)) navigationFiches.notifications()
    }
    LaunchedEffect(aDemander) {
        if (aDemander && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            demande.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        } else if (aDemander) {
            c.horsLigne.autorisationDemandee()
        }
    }

    CompositionLocalProvider(LocalNavigation provides navigationFiches, LocalMenus provides menus) {
    // Le cadre : un ton à peine plus marqué que le fond des pages, autour de l'en-tête et de la barre du bas.
    val cadre = lerp(p.base.compose, p.encre.compose, 0.05f)
    // Tablette ou téléphone couché : la navigation passe en barre latérale, le contenu garde toute la hauteur.
    val large = LocalConfiguration.current.screenWidthDp >= 600
    Box(Modifier.fillMaxSize().background(cadre)) {
      Row(Modifier.fillMaxSize()) {
        if (large) BarreLaterale(onglet = onglet, nonLus = nonLus, onChoisir = aller)
        // Sans barre du bas, le contenu s'arrête au-dessus de la barre de gestes du système.
        Column(Modifier.weight(1f).fillMaxHeight().then(if (large) Modifier.windowInsetsPadding(WindowInsets.navigationBars).padding(bottom = 8.dp) else Modifier)) {
            // L'en-tête et la barre du bas restent sur toutes les pages : le contenu, lecteur compris, vit entre les deux.
            EnTete(
                sombre = sombre,
                onBasculerMode = onBasculerMode,
                notifications = if (session is EtatSession.Connecte) notificationsNonLues else null,
                onNotifications = navigationFiches::notifications,
                onParametres = navigationFiches::parametres,
            )
            // Sans réseau, les pages déjà vues s'affichent depuis le téléphone : le dire, et mener à la musique gardée (6.4).
            AnimatedVisibility(
                visible = horsReseau,
                enter = fadeIn(tween(Mouvement.VOILE)) + expandVertically(tween(Mouvement.VOILE, easing = Mouvement.sortieDouce)),
                exit = fadeOut(tween(Mouvement.VOILE)) + shrinkVertically(tween(Mouvement.VOILE)),
            ) {
                BandeauHorsLigne(onMesTitres = { aller(Destination.MA_ZONE) })
            }
            // La zone de contenu : un panneau aux quatre coins arrondis, posé dans le cadre.
            val panneau = RoundedCornerShape(22.dp)
            Box(
                Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp)
                    .clip(panneau)
                    .background(p.base.compose)
                    .border(BorderStroke(1.dp, p.bordure.compose.copy(alpha = 0.6f)), panneau),
            ) {
            Column(Modifier.fillMaxSize()) {
            NavHost(
                navController = navigation,
                startDestination = Destination.ACCUEIL.route,
                modifier = Modifier.weight(1f),
                // Entrée de page du site : fondu et 6 dp de montée, 280 ms.
                enterTransition = {
                    fadeIn(tween(Mouvement.ENTREE_PAGE, easing = Mouvement.sortieDouce)) +
                        slideInVertically(tween(Mouvement.ENTREE_PAGE, easing = Mouvement.sortieDouce)) { montee }
                },
                exitTransition = { fadeOut(tween(Mouvement.ENTREE_PAGE / 2)) },
            ) {
                composable(Destination.ACCUEIL.route) { EcranAccueil() }
                composable(Destination.RECHERCHE.route) {
                    EcranRecherche(termeDemande = termeDemande, onTermeConsomme = { termeDemande = null })
                }
                composable(Destination.MA_ZONE.route) { EcranBibliotheque(onConnexion = { aller(Destination.COMPTE) }) }
                composable(Destination.MESSAGES.route) {
                    EcranMessages(onConnexion = { aller(Destination.COMPTE) }, onOuvrir = { navigationFiches.conversation(it) })
                }
                grapheCompte(navigation)
                // Les fiches s'empilent sur l'onglet d'où on les ouvre.
                val retour: () -> Unit = { navigation.popBackStack() }
                composable(Fiches.ALBUM) { e -> FicheAlbum(e.arguments?.getString("id").orEmpty(), retour) }
                composable(Fiches.ARTISTE) { e -> FicheArtiste(e.arguments?.getString("id").orEmpty(), retour) }
                composable(Fiches.PLAYLIST, listOf(navArgument("jeton") { defaultValue = "" })) { e ->
                    FichePlaylist(e.arguments?.getString("id").orEmpty(), retour, e.arguments?.getString("jeton")?.ifEmpty { null })
                }
                composable(Fiches.SELECTION) { e -> EcranSelection(e.arguments?.getString("cle").orEmpty(), retour) }
                composable(Fiches.MEMBRE) { e -> com.moziik.app.ui.social.EcranMembre(e.arguments?.getString("username").orEmpty(), retour) }
                composable(Fiches.AMIS) { com.moziik.app.ui.social.EcranAmis(retour) }
                composable(Fiches.BLEND) { e -> com.moziik.app.ui.social.EcranBlend(e.arguments?.getString("username").orEmpty(), retour) }
                composable(Fiches.TITRE) { e -> FicheTitre(e.arguments?.getString("id").orEmpty(), retour) }
                // Paramètres facultatifs : une chaîne vide vaut « non précisé ».
                val facultatif: (String) -> NamedNavArgument = { nom -> navArgument(nom) { defaultValue = "" } }
                composable(Fiches.CLASSEMENTS, listOf(facultatif("type"), facultatif("periode"))) { e ->
                    EcranClassements(e.arguments?.getString("type")?.ifEmpty { null }, e.arguments?.getString("periode")?.ifEmpty { null }, retour)
                }
                composable(Fiches.RADIO, listOf(facultatif("station"))) { e -> EcranRadio(e.arguments?.getString("station")?.ifEmpty { null }, retour) }
                composable(Fiches.TITRES, listOf(facultatif("genre"))) { e -> EcranTitres(e.arguments?.getString("genre")?.ifEmpty { null }, retour) }
                composable(Fiches.EVENEMENTS) { EcranEvenements(retour) }
                composable(Fiches.CONVERSATION) { e -> EcranConversation(e.arguments?.getString("id").orEmpty(), retour) }
                composable(Fiches.EVENEMENT) { e -> FicheEvenement(e.arguments?.getString("id").orEmpty(), retour) }
                composable(Fiches.NOTIFICATIONS) { EcranNotifications(retour) }
                composable(Fiches.BLIND_TEST) { EcranBlindTest(retour, onConnexion = { aller(Destination.COMPTE) }) }
                composable(Fiches.PARAMETRES) { EcranParametres(retour, onOuvrir = { navigation.navigate(it) }) }
                composable(PARAMETRES_LECTURE) { EcranLecture(retour) }
                composable(PARAMETRES_APPARENCE) { EcranApparence(retour) }
                composable(PARAMETRES_REVEIL) { EcranReveil(retour) }
            }
            BandeauMessage((alerte as? AlerteLecture.Message)?.texte, onFini = c.alertes::oublier, succes = (alerte as? AlerteLecture.Message)?.succes == true)
            AnimatedVisibility(
                visible = lecture.courant != null && !pleinePage && !clavier,
                enter = fadeIn(tween(Mouvement.VOILE)) + expandVertically(tween(Mouvement.VOILE, easing = Mouvement.sortieDouce)),
                exit = fadeOut(tween(Mouvement.VOILE)) + shrinkVertically(tween(Mouvement.VOILE)),
            ) {
                // Le mini-lecteur s'efface à mesure que le plein écran monte : on croit voir le même bloc grandir.
                MiniLecteur(
                    lecture, c.lecteur, onOuvrir = tiroir::ouvrir,
                    modifier = Modifier
                        .graphicsLayer { alpha = (1f - tiroir.ouverture * 2.5f).coerceIn(0f, 1f) }
                        .glissementDuTiroir(tiroir),
                )
            }
            }
            // Le plein écran suit le doigt : il monte de la place du mini-lecteur et y redescend,
            // dans la zone de contenu, sous l'en-tête et au-dessus de la barre du bas.
            if (tiroir.ouvert && lecture.courant != null) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .clipToBounds()
                        .graphicsLayer {
                            translationY = (1f - tiroir.ouverture) * size.height
                            // Le contenu apparaît dans le premier tiers de la course, pendant que le mini-lecteur s'efface.
                            alpha = (tiroir.ouverture * 3f).coerceIn(0f, 1f)
                        }
                        .nestedScroll(tiroir.defilement),
                ) {
                    LecteurPleinEcran(lecture, onFermer = tiroir::fermer, poignee = Modifier.glissementDuTiroir(tiroir))
                }
            }
            }
            // Clavier ouvert (message, recherche) : la barre du bas s'efface pour laisser la place à la saisie.
            if (!clavier && !large) BarreDuBas(onglet = onglet, nonLus = nonLus, onChoisir = aller)
        }
      }
    }

        HoteMenus(menus)
    }

    // Retour : le lecteur plein écran se ferme avant toute navigation.
    BackHandler(enabled = tiroir.ouvert) { tiroir.fermer() }

    if (alerte == AlerteLecture.Quota) {
        MurQuota(
            onInscription = {
                c.alertes.oublier()
                tiroir.fermer()
                aller(Destination.COMPTE)
                navigation.navigate(INSCRIPTION)
            },
            onConnexion = {
                c.alertes.oublier()
                tiroir.fermer()
                aller(Destination.COMPTE)
            },
            onFermer = c.alertes::oublier,
        )
    }
}

@Composable
private fun BandeauHorsLigne(onMesTitres: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().background(p.surface.compose).padding(start = 16.dp, end = 8.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icone(R.drawable.lucide_wifi_off, description = null, teinte = p.encreAttenuee.compose, taille = 15.dp)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text("Mode hors-ligne", style = Texte.secondaire.copy(fontWeight = FontWeight.SemiBold), color = p.encre.compose)
            Text("Synchronisation au retour du réseau.", style = Texte.secondaire, color = p.encreAttenuee.compose)
        }
        Text(
            "Mes titres",
            style = Texte.secondaire.copy(fontWeight = FontWeight.SemiBold),
            color = p.accent.compose,
            modifier = Modifier.clip(CircleShape).clickable(role = Role.Button, onClick = onMesTitres).padding(horizontal = 10.dp, vertical = 6.dp),
        )
    }
}

/** `notifications` : le nombre de non lues, ou null pour un visiteur (pas de cloche). */
@Composable
private fun EnTete(sombre: Boolean, onBasculerMode: () -> Unit, notifications: Int?, onNotifications: () -> Unit, onParametres: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.statusBars)
            .height(56.dp)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Sans logo publié par le site, l'égaliseur sert de marque (comme MobileHeader.tsx).
        // Le logo s'écrit une fois à l'ouverture de l'app, puis reste en place.
        LogoMoziik(hauteur = 22.dp, anime = true)
        Spacer(Modifier.weight(1f))
        if (notifications != null) {
            Box(
                Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .clickable(role = Role.Button, onClick = onNotifications)
                    .semantics {
                        contentDescription = if (notifications > 0) "Notifications, $notifications non lue${if (notifications > 1) "s" else ""}" else "Notifications"
                    },
                contentAlignment = Alignment.Center,
            ) {
                Icone(R.drawable.lucide_bell, description = null, teinte = p.encre.compose, taille = 19.dp)
                if (notifications > 0) {
                    // Un point, pas un nombre : la cloche dit « il y a du nouveau », la page dit combien.
                    Box(
                        Modifier
                            .align(Alignment.TopEnd)
                            .padding(top = 7.dp, end = 7.dp)
                            .size(9.dp)
                            .clip(CircleShape)
                            .background(p.base.compose)
                            .padding(1.5.dp)
                            .clip(CircleShape)
                            .background(p.accent.compose),
                    )
                }
            }
            Spacer(Modifier.width(8.dp))
        }
        // Tous les réglages, visiteur compris : qualité, suite de lecture, thème, notifications, compte.
        Box(
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .clickable(role = Role.Button, onClickLabel = "Paramètres", onClick = onParametres),
            contentAlignment = Alignment.Center,
        ) {
            Icone(R.drawable.lucide_settings, description = "Paramètres", teinte = p.encre.compose, taille = 19.dp)
        }
        Spacer(Modifier.width(8.dp))
        Box(
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .border(BorderStroke(1.dp, p.bordure.compose), CircleShape)
                .clickable(role = Role.Button, onClick = onBasculerMode),
            contentAlignment = Alignment.Center,
        ) {
            Icone(
                dessin = if (sombre) R.drawable.lucide_sun else R.drawable.lucide_moon,
                description = if (sombre) "Passer en mode clair" else "Passer en mode sombre",
                teinte = p.encre.compose,
                taille = 18.dp,
            )
        }
    }
}

/**
 * La barre latérale des grands écrans : les mêmes onglets que la barre du
 * bas, à la verticale ; une pastille à l'accent se pose derrière l'onglet
 * actif.
 */
@Composable
private fun BarreLaterale(onglet: Destination, nonLus: Int, onChoisir: (Destination) -> Unit) {
    val p = LocalPalette.current
    Column(
        Modifier
            .fillMaxHeight()
            .windowInsetsPadding(WindowInsets.statusBars)
            .windowInsetsPadding(WindowInsets.navigationBars)
            .width(88.dp)
            .padding(top = 72.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Destination.entries.forEach { d ->
            val active = d == onglet
            val couleur by animateColorAsState(if (active) p.accent.compose else p.encreAttenuee.compose, tween(Mouvement.VOILE), label = "couleur")
            val pastille by animateColorAsState(if (active) p.accent.compose.copy(alpha = 0.14f) else p.accent.compose.copy(alpha = 0f), tween(Mouvement.VOILE), label = "pastille")
            Column(
                Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .clickable(role = Role.Tab) { onChoisir(d) }
                    .semantics { selected = active }
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(Modifier.size(width = 56.dp, height = 32.dp).clip(CircleShape).background(pastille), contentAlignment = Alignment.Center) {
                    Icone(dessin = d.icone, description = null, teinte = couleur, taille = 22.dp)
                    if (d == Destination.MESSAGES && nonLus > 0) {
                        Box(Modifier.align(Alignment.TopEnd).padding(top = 4.dp, end = 12.dp).size(8.dp).clip(CircleShape).background(p.accent.compose))
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    d.libelle,
                    style = Texte.navigation.copy(fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium),
                    color = couleur,
                    maxLines = 1,
                )
            }
        }
    }
}

/**
 * La barre du bas : un repère à l'accent glisse sous l'onglet actif, l'icône
 * de l'onglet monte d'un cran et son libellé s'affirme. Un seul mouvement,
 * court, qui accompagne le changement d'onglet sans le retarder.
 */
@Composable
private fun BarreDuBas(onglet: Destination, nonLus: Int, onChoisir: (Destination) -> Unit) {
    val p = LocalPalette.current
    val onglets = Destination.entries
    val rang = onglets.indexOf(onglet).coerceAtLeast(0)
    BoxWithConstraints(
        Modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.navigationBars)
            .padding(top = 4.dp),
    ) {
        val largeur = maxWidth / onglets.size
        val position by animateDpAsState(largeur * rang, tween(Mouvement.VOILE, easing = Mouvement.sortieDouce), label = "onglet")
        // Le repère : une pastille douce derrière l'icône, et un trait net au ras du filet.
        // Il prend la taille de la barre (matchParentSize) sans jamais la décider : la barre
        // garde la hauteur de son contenu, et le contenu de la page la place qui reste.
        Box(Modifier.matchParentSize()) {
          Box(Modifier.offset(x = position).width(largeur).fillMaxHeight()) {
            Box(
                Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 8.dp)
                    .size(width = 56.dp, height = 30.dp)
                    .clip(CircleShape)
                    .background(p.accent.compose.copy(alpha = 0.14f)),
            )
            Box(
                Modifier
                    .align(Alignment.TopCenter)
                    .size(width = 24.dp, height = 2.dp)
                    .clip(RoundedCornerShape(bottomStart = 2.dp, bottomEnd = 2.dp))
                    .background(p.accent.compose),
            )
          }
        }
        Row(Modifier.fillMaxWidth().heightIn(min = 64.dp), verticalAlignment = Alignment.CenterVertically) {
            onglets.forEach { d ->
                val active = d == onglet
                val couleur by animateColorAsState(if (active) p.accent.compose else p.encreAttenuee.compose, tween(Mouvement.VOILE), label = "couleur")
                val montee by animateDpAsState(if (active) (-1).dp else 1.dp, tween(Mouvement.VOILE, easing = Mouvement.sortieDouce), label = "montee")
                Column(
                    Modifier
                        .weight(1f)
                        .padding(vertical = 8.dp)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            role = Role.Tab,
                        ) { onChoisir(d) }
                        .semantics { selected = active },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Box(Modifier.offset(y = montee)) {
                        Icone(dessin = d.icone, description = null, teinte = couleur, taille = 22.dp)
                        if (d == Destination.MESSAGES && nonLus > 0) {
                            Text(
                                if (nonLus > 99) "99+" else "$nonLus",
                                style = Texte.pastille,
                                color = p.base.compose,
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .offset(x = 10.dp, y = (-4).dp)
                                    .clip(CircleShape)
                                    .background(p.accent.compose)
                                    .padding(horizontal = 5.dp, vertical = 1.dp)
                                    .semantics { contentDescription = "$nonLus message${if (nonLus > 1) "s" else ""} non lu${if (nonLus > 1) "s" else ""}" },
                            )
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        d.libelle,
                        style = Texte.navigation.copy(fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium),
                        color = couleur,
                        // Police agrandie : le libellé reste sur une ligne plutôt que de pousser la barre.
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}
