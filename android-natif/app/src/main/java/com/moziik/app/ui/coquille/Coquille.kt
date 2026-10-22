package com.moziik.app.ui.coquille

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
    var pleinEcran by rememberSaveable { mutableStateOf(false) }
    // Une conversation occupe tout l'écran : sans en-tête, barre du bas ni mini-lecteur, le clavier a la place.
    val pleinePage = entree?.destination?.route == Fiches.CONVERSATION
    val nonLus by c.messagerie.nonLus.collectAsStateWithLifecycle()
    val notificationsNonLues by c.notifications.nonLues.collectAsStateWithLifecycle()
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
            onAvantNavigation = { pleinEcran = false },
        )
    }

    val menus = remember { Menus() }

    // L'autorisation de notifier (Android 13), demandée au premier téléchargement seulement.
    val demande = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission(),
    ) { c.horsLigne.autorisationDemandee() }
    val aDemander by c.horsLigne.demandeAutorisation.collectAsStateWithLifecycle()
    LaunchedEffect(aDemander) {
        if (aDemander && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            demande.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        } else if (aDemander) {
            c.horsLigne.autorisationDemandee()
        }
    }

    CompositionLocalProvider(LocalNavigation provides navigationFiches, LocalMenus provides menus) {
    Box(Modifier.fillMaxSize().background(p.base.compose)) {
        Column(Modifier.fillMaxSize()) {
            if (!pleinePage) {
                EnTete(
                    sombre = sombre,
                    onBasculerMode = onBasculerMode,
                    notifications = if (session is EtatSession.Connecte) notificationsNonLues else null,
                    onNotifications = navigationFiches::notifications,
                )
            }
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
                composable(Fiches.PLAYLIST) { e -> FichePlaylist(e.arguments?.getString("id").orEmpty(), retour) }
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
            }
            BandeauMessage((alerte as? AlerteLecture.Message)?.texte, onFini = c.alertes::oublier, succes = (alerte as? AlerteLecture.Message)?.succes == true)
            AnimatedVisibility(
                visible = lecture.courant != null && !pleinePage,
                enter = fadeIn(tween(Mouvement.VOILE)) + expandVertically(tween(Mouvement.VOILE, easing = Mouvement.sortieDouce)),
                exit = fadeOut(tween(Mouvement.VOILE)) + shrinkVertically(tween(Mouvement.VOILE)),
            ) {
                MiniLecteur(lecture, c.lecteur, onOuvrir = { pleinEcran = true })
            }
            if (!pleinePage) BarreDuBas(onglet = onglet, nonLus = nonLus, onChoisir = aller)
        }

        // Le plein écran monte du bas et y redescend, par-dessus la coquille.
        AnimatedVisibility(
            visible = pleinEcran && lecture.courant != null,
            enter = slideInVertically(tween(Mouvement.TIROIR, easing = Mouvement.sortieDouce)) { it },
            exit = slideOutVertically(tween(Mouvement.VOILE)) { it },
        ) {
            LecteurPleinEcran(lecture, onFermer = { pleinEcran = false })
        }
    }

        HoteMenus(menus)
    }

    // Retour : le lecteur plein écran se ferme avant toute navigation.
    BackHandler(enabled = pleinEcran) { pleinEcran = false }

    if (alerte == AlerteLecture.Quota) {
        MurQuota(
            onInscription = {
                c.alertes.oublier()
                pleinEcran = false
                aller(Destination.COMPTE)
                navigation.navigate(INSCRIPTION)
            },
            onConnexion = {
                c.alertes.oublier()
                pleinEcran = false
                aller(Destination.COMPTE)
            },
            onFermer = c.alertes::oublier,
        )
    }
}

/** `notifications` : le nombre de non lues, ou null pour un visiteur (pas de cloche). */
@Composable
private fun EnTete(sombre: Boolean, onBasculerMode: () -> Unit, notifications: Int?, onNotifications: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier
            .fillMaxWidth()
            .background(p.base.compose)
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

@Composable
private fun BarreDuBas(onglet: Destination, nonLus: Int, onChoisir: (Destination) -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier
            .fillMaxWidth()
            .background(p.surface.compose.copy(alpha = 0.95f))
            .filetSuperieur(p.bordure.compose)
            .windowInsetsPadding(WindowInsets.navigationBars)
            .height(64.dp),
        horizontalArrangement = Arrangement.SpaceAround,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Destination.entries.forEach { d ->
            val active = d == onglet
            val couleur = if (active) p.accent.compose else p.encreAttenuee.compose
            Column(
                Modifier
                    .weight(1f)
                    .clip(CircleShape)
                    .clickable(role = Role.Tab) { onChoisir(d) }
                    .semantics { selected = active }
                    .padding(vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box {
                    Icone(dessin = d.icone, description = null, teinte = couleur)
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
                Spacer(Modifier.height(3.dp))
                Text(d.libelle, style = Texte.navigation, color = couleur)
            }
        }
    }
}

/** Le filet de 1 dp qui sépare la barre du contenu, comme border-t sur le site. */
private fun Modifier.filetSuperieur(couleur: Color): Modifier =
    drawBehind { drawLine(couleur, start = Offset.Zero, end = Offset(size.width, 0f), strokeWidth = 1.dp.toPx()) }
