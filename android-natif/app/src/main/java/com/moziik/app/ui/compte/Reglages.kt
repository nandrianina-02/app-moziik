package com.moziik.app.ui.compte

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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.moziik.app.BuildConfig
import com.moziik.app.R
import com.moziik.app.donnees.compte.Appareil
import com.moziik.app.donnees.compte.EtatAbonnement
import com.moziik.app.donnees.reseau.ErreurApi
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.ChampTexte
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LienTexte
import com.moziik.app.ui.composants.MessageErreur
import com.moziik.app.ui.composants.Saisie
import com.moziik.app.ui.composants.instantIso
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.fiches.BarreRetour
import com.moziik.app.ui.menus.Confirmation
import com.moziik.app.ui.ouvrirLien
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale
import com.moziik.app.ui.composants.LogoMoziik
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import com.moziik.app.donnees.envoi.preparerImage
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.ui.composants.Avatar

/** Les écrans d'une rubrique du compte : retour, titre, contenu défilant. */
@Composable
private fun PageReglage(titre: String, onRetour: () -> Unit, contenu: @Composable () -> Unit) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        BarreRetour(onRetour)
        Text(titre, style = Texte.titreFiche, color = p.encre.compose, modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 4.dp, bottom = 16.dp))
        Column(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 32.dp)) { contenu() }
    }
}

@Composable
private fun Rubrique(titre: String, detail: String? = null) {
    val p = LocalPalette.current
    Text(titre, style = Texte.titreSection, color = p.encre.compose, modifier = Modifier.padding(top = 20.dp))
    detail?.let { Text(it, style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 2.dp)) }
    Spacer(Modifier.height(10.dp))
}

/** Un choix parmi plusieurs : bordure et coche à l'accent quand il est retenu. */
@Composable
private fun Option(titre: String, detail: String?, choisie: Boolean, icone: Int? = null, verrou: String? = null, enCours: Boolean = false, onClick: () -> Unit) {
    val p = LocalPalette.current
    val forme = RoundedCornerShape(p.rayon.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp)
            .clip(forme)
            .border(BorderStroke(1.dp, if (choisie) p.accent.compose else p.bordure.compose), forme)
            .background(if (choisie) p.accent.compose.copy(alpha = 0.06f) else p.surface.compose)
            .clickable(enabled = verrou == null && !enCours, role = Role.RadioButton, onClick = onClick)
            .semantics { selected = choisie }
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icone != null) {
            Icone(icone, description = null, teinte = if (choisie) p.accent.compose else p.encreAttenuee.compose, taille = 20.dp)
            Spacer(Modifier.width(12.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(titre, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = if (verrou != null) p.encreAttenuee.compose else p.encre.compose)
            (verrou ?: detail)?.let { Text(it, style = Texte.secondaire, color = p.encreAttenuee.compose) }
        }
        when {
            enCours -> Egaliseur(hauteur = 12.dp)
            verrou != null -> Icone(R.drawable.lucide_lock, description = null, teinte = p.encreAttenuee.compose, taille = 16.dp)
            choisie -> Icone(R.drawable.lucide_check, description = "Choisi", teinte = p.accent.compose, taille = 18.dp)
        }
    }
}

// ------------------------------------------------------------ Profil (B9)

@Composable
fun EcranProfil(nomInitial: String, nomUtilisateurInitial: String?, onRetour: () -> Unit, onEnregistre: () -> Unit) {
    val c = conteneur()
    val portee = rememberCoroutineScope()
    var nom by rememberSaveable { mutableStateOf(nomInitial) }
    var pseudo by rememberSaveable { mutableStateOf(nomUtilisateurInitial.orEmpty()) }
    var erreur by remember { mutableStateOf<String?>(null) }
    var enCours by remember { mutableStateOf(false) }
    val session by c.session.etat.collectAsStateWithLifecycle()
    val photo = (session as? EtatSession.Connecte)?.utilisateur?.avatarUrl
    var envoiPhoto by remember { mutableStateOf(false) }
    val contexte = LocalContext.current
    // La photo de profil (K2, dossier avatars) : réduite à 512 px, envoyée, puis enregistrée sur le compte.
    val choixPhoto = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null && !envoiPhoto) {
            envoiPhoto = true
            portee.launch {
                runCatching {
                    val image = preparerImage(contexte, uri, 512)
                    val adresse = c.envoi.envoyer(image.octets, "photo-de-profil.jpg", "image/jpeg", "avatars")
                    c.compte.changerPhoto(adresse)
                    c.session.majUtilisateur { it.copy(avatarUrl = adresse) }
                }
                    .onSuccess { c.alertes.signaler(AlerteLecture.Message("Photo de profil mise à jour.", succes = true)) }
                    .onFailure { erreur = messageErreur(it) }
                envoiPhoto = false
            }
        }
    }
    PageReglage("Profil", onRetour) {
        Row(Modifier.padding(bottom = 18.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(contentAlignment = Alignment.Center) {
                Avatar(nom.ifBlank { "?" }, photo, taille = 72.dp)
                if (envoiPhoto) {
                    Box(Modifier.size(72.dp).clip(CircleShape).background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.45f)), contentAlignment = Alignment.Center) {
                        Egaliseur(hauteur = 16.dp, libelle = "Envoi", couleur = androidx.compose.ui.graphics.Color.White)
                    }
                }
            }
            Spacer(Modifier.width(16.dp))
            Column {
                LienTexte(if (photo == null) "Ajouter une photo" else "Changer la photo", {
                    if (!envoiPhoto) choixPhoto.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                })
                Text("Visible sur ton profil et dans les messages.", style = Texte.secondaire, color = LocalPalette.current.encreAttenuee.compose)
            }
        }
        ChampTexte(nom, { nom = it.take(80) }, "Nom affiché", R.drawable.lucide_user, saisie = Saisie.NOM)
        Spacer(Modifier.height(14.dp))
        ChampTexte(pseudo, { pseudo = it.lowercase().take(20) }, "Nom d'utilisateur", R.drawable.lucide_user_round_pen, indication = "lettres, chiffres, point, tiret bas")
        Text(
            "C'est l'adresse de ton profil public et ton nom dans les messages (@${pseudo.ifBlank { "…" }}).",
            style = Texte.secondaire, color = LocalPalette.current.encreAttenuee.compose, modifier = Modifier.padding(top = 6.dp),
        )
        MessageErreur(erreur, Modifier.padding(top = 12.dp))
        Spacer(Modifier.height(20.dp))
        BoutonPrincipal("Enregistrer", {
            erreur = when {
                nom.isBlank() -> "Le nom est requis."
                pseudo.isNotBlank() && !Regex("^[a-z0-9._]{3,20}$").matches(pseudo) -> "Le nom d'utilisateur fait de 3 à 20 caractères : lettres minuscules, chiffres, point ou tiret bas."
                else -> null
            }
            if (erreur == null && !enCours) {
                enCours = true
                portee.launch {
                    try {
                        c.compte.modifierProfil(nom, pseudo.ifBlank { null })
                        c.session.majUtilisateur { it.copy(name = nom.trim()) }
                        c.alertes.signaler(AlerteLecture.Message("Profil enregistré.", succes = true))
                        onEnregistre()
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        erreur = messageErreur(e)
                    }
                    enCours = false
                }
            }
        }, enCours = enCours)
    }
}

// ------------------------------------------------------------ Préférences (A2, A3)

/** Les modes d'écoute du site (lib/modes.ts), avec l'intention affichée sous chacun. */
private val MODES = listOf(
    Triple("auto", "Automatique", "Selon l'heure : matin, journée, nuit"),
    Triple("voyage", "Voyage", "De quoi accompagner un long trajet, sans lasser ni endormir"),
    Triple("sport", "Sport", "De quoi soutenir un effort physique, rythme tenu du début à la fin"),
    Triple("etude", "Étude / Concentration", "De quoi travailler ou réviser sans que la musique prenne le dessus"),
    Triple("travail", "Travail", "De quoi accompagner une journée de travail sans occuper toute l'attention"),
    Triple("sommeil", "Sommeil", "De quoi s'endormir, très calme, sans montée ni surprise"),
    Triple("relaxation", "Relaxation", "De quoi se détendre, posé sans être endormant"),
    Triple("romance", "Romance", "Des morceaux d'amour, à écouter à deux"),
    Triple("fete", "Fête", "De quoi lancer une soirée et la tenir"),
    Triple("matin", "Matin", "De quoi démarrer la journée, sans brusquer"),
    Triple("nuit", "Nuit", "De quoi écouter tard, plus calme"),
    Triple("decouverte", "Découverte", "Des morceaux peu connus que ceux qui les lancent écoutent jusqu'au bout"),
    Triple("tendance", "Tendance", "Ce qui décolle en ce moment"),
)

private val ICONES_MODES = mapOf(
    "auto" to R.drawable.lucide_wand_sparkles, "voyage" to R.drawable.lucide_plane, "sport" to R.drawable.lucide_dumbbell,
    "etude" to R.drawable.lucide_graduation_cap, "travail" to R.drawable.lucide_briefcase_business, "sommeil" to R.drawable.lucide_bed_double,
    "relaxation" to R.drawable.lucide_leaf, "romance" to R.drawable.lucide_heart, "fete" to R.drawable.lucide_flame,
    "matin" to R.drawable.lucide_sunrise, "nuit" to R.drawable.lucide_moon, "decouverte" to R.drawable.lucide_compass,
    "tendance" to R.drawable.lucide_trending_up,
)

@Composable
fun EcranPreferences(onRetour: () -> Unit) {
    val c = conteneur()
    val portee = rememberCoroutineScope()
    var univers by remember { mutableStateOf<String?>(null) }
    var mode by remember { mutableStateOf<String?>(null) }
    var enCours by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        univers = c.catalogue.univers()
        mode = c.compte.mode() ?: "auto"
    }
    val changer: (String, suspend () -> Unit, () -> Unit) -> Unit = { cle, requete, apres ->
        if (enCours == null) {
            enCours = cle
            portee.launch {
                try {
                    requete()
                    apres()
                    c.catalogue.preferencesChangees()
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    c.alertes.signaler(AlerteLecture.Message(messageErreur(e)))
                }
                enCours = null
            }
        }
    }
    PageReglage("Préférences", onRetour) {
        Rubrique("Univers musical", "Ce que l'accueil, la recherche et la radio te proposent. Le titre en cours n'est pas coupé.")
        listOf("general" to "Général", "christian" to "Évangélique").forEach { (cle, libelle) ->
            Option(libelle, if (cle == "christian") "Musique chrétienne et gospel" else "Tout le catalogue", univers == cle, enCours = enCours == cle) {
                changer(cle, { c.compte.changerUnivers(cle) }) { univers = cle }
            }
        }
        Rubrique("Mode d'écoute", "L'accueil, la station et les recommandations s'accordent au moment.")
        MODES.forEach { (cle, libelle, intention) ->
            Option(libelle, intention, mode == cle, icone = ICONES_MODES[cle], enCours = enCours == "mode-$cle") {
                changer("mode-$cle", { c.compte.changerMode(cle) }) { mode = cle }
            }
        }
    }
}

// ------------------------------------------------------------ Lecture (5.7)

@Composable
fun EcranLecture(onRetour: () -> Unit) {
    val c = conteneur()
    val qualite by c.reglages.qualite.collectAsStateWithLifecycle()
    val economie by c.reglages.economie.collectAsStateWithLifecycle()
    val premium by c.compte.premium.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { c.compte.actualiserPremium() }
    PageReglage("Lecture", onRetour) {
        Rubrique("Qualité d'écoute", "S'applique aux titres lancés ensuite. Les téléchargements gardent leur qualité.")
        Option("Économe", "64 kb/s, le moins de données", qualite == "low") { c.reglages.choisirQualite("low") }
        Option("Standard", "128 kb/s", qualite == "medium") { c.reglages.choisirQualite("medium") }
        Option("Haute", "320 kb/s", qualite == "high", verrou = if (premium) null else "320 kb/s avec Premium ; 128 kb/s sinon") { c.reglages.choisirQualite("high") }
        Rubrique("Économie de données", "En économie, l'écoute passe en 64 kb/s.")
        Option("Automatique", "Sur réseau mobile, ou si l'économiseur de données d'Android est actif", economie == "auto") { c.reglages.choisirEconomie("auto") }
        Option("Toujours", "64 kb/s en permanence", economie == "toujours") { c.reglages.choisirEconomie("toujours") }
        Option("Jamais", "Garder la qualité choisie", economie == "jamais") { c.reglages.choisirEconomie("jamais") }
        if (c.reglages.economieActive()) {
            Text(
                "Économie de données active : la lecture est en 64 kb/s pour le moment.",
                style = Texte.secondaire, color = LocalPalette.current.alerte.compose, modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

// ------------------------------------------------------------ Apparence (A5)

@Composable
fun EcranApparence(onRetour: () -> Unit) {
    val c = conteneur()
    val apparence by c.reglages.apparence.collectAsStateWithLifecycle()
    PageReglage("Apparence", onRetour) {
        Rubrique("Clair ou sombre", "Réglé sur cet appareil seulement.")
        Option("Comme le site", "Le mode choisi par Moziik", apparence == null, icone = R.drawable.lucide_palette) { c.reglages.choisirApparence(null) }
        Option("Sombre", null, apparence == "sombre", icone = R.drawable.lucide_moon) { c.reglages.choisirApparence("sombre") }
        Option("Clair", null, apparence == "clair", icone = R.drawable.lucide_sun) { c.reglages.choisirApparence("clair") }
        Option("Comme le téléphone", "Suit le réglage d'Android", apparence == "systeme", icone = R.drawable.lucide_smartphone) { c.reglages.choisirApparence("systeme") }
        val noir by c.reglages.noirProfond.collectAsStateWithLifecycle()
        Spacer(Modifier.height(12.dp))
        com.moziik.app.ui.menus.Interrupteur(noir, "Noir profond en mode sombre") { c.reglages.choisirNoirProfond(it) }
        Text(
            "Fond noir pur : sur un écran OLED, les pixels noirs sont éteints et la batterie dure plus longtemps.",
            style = Texte.secondaire, color = LocalPalette.current.encreAttenuee.compose,
        )
        Text(
            "Les couleurs suivent le thème du site. Avec Premium, ton thème personnel, réglé sur le site, s'applique aussi ici.",
            style = Texte.secondaire, color = LocalPalette.current.encreAttenuee.compose, modifier = Modifier.padding(top = 8.dp),
        )
    }
}

// ------------------------------------------------------------ Abonnement (C1)

private fun dateLongue(iso: String?): String? = instantIso(iso)?.let { SimpleDateFormat("d MMMM yyyy", Locale.FRANCE).format(it) }

@Composable
fun EcranAbonnement(onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val contexte = LocalContext.current
    var etat by remember { mutableStateOf<EtatAbonnement?>(null) }
    var erreur by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        try {
            etat = c.compte.abonnement()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            erreur = messageErreur(e)
        }
    }
    PageReglage("Abonnement", onRetour) {
        MessageErreur(erreur)
        val e = etat
        if (e == null && erreur == null) {
            Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 18.dp) }
        }
        if (e != null) {
            val a = e.subscription
            val forme = RoundedCornerShape(p.rayon.dp)
            Column(
                Modifier.fillMaxWidth().clip(forme).border(BorderStroke(1.dp, if (e.hasPremium) p.accent.compose else p.bordure.compose), forme).background(p.surface.compose).padding(16.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icone(R.drawable.lucide_crown, description = null, teinte = if (e.hasPremium) p.accent.compose else p.encreAttenuee.compose, taille = 20.dp)
                    Spacer(Modifier.width(10.dp))
                    Text(
                        when {
                            !e.hasPremium -> "Compte gratuit"
                            a?.plan == "premium_annual" -> "Premium annuel"
                            else -> "Premium"
                        },
                        style = Texte.titreSection, color = p.encre.compose,
                    )
                }
                if (a != null && a.plan != "free") {
                    Spacer(Modifier.height(8.dp))
                    // « Actif » si l'accès est ouvert ; sinon le statut tel quel (C1).
                    val statut = when {
                        e.hasPremium -> "Actif"
                        a.status == "past_due" -> "Paiement en attente ou échoué"
                        a.status == "canceled" -> "Résilié"
                        else -> "Échu"
                    }
                    Text("Statut : $statut", style = Texte.corps, color = p.encreAttenuee.compose)
                    dateLongue(a.currentPeriodEnd)?.let { Text(if (e.hasPremium) "Jusqu'au $it" else "Fin d'accès le $it", style = Texte.corps, color = p.encreAttenuee.compose) }
                    if (a.paymentMethod == "offert") {
                        Text("Accès offert", style = Texte.corps, color = p.verifie.compose)
                    } else {
                        a.amount?.let { montant ->
                            val moyen = when (a.paymentMethod) { "mobile_money" -> "Mobile Money"; "stripe" -> "carte"; else -> null }
                            Text(
                                "${if (montant % 1.0 == 0.0) montant.toInt() else montant} ${a.currency.orEmpty().uppercase().replace("MGA", "Ar")}${moyen?.let { " par $it" }.orEmpty()}",
                                style = Texte.corps, color = p.encreAttenuee.compose,
                            )
                        }
                    }
                }
            }
            Rubrique("Ce que Premium débloque")
            listOf(
                "Écoute en haute qualité, 320 kb/s (128 kb/s sans Premium)",
                "Titres téléchargés pour l'écoute hors connexion",
                "Thème et couleurs personnalisés",
            ).forEach { avantage ->
                Row(Modifier.padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icone(R.drawable.lucide_check, description = null, teinte = p.verifie.compose, taille = 16.dp)
                    Spacer(Modifier.width(10.dp))
                    Text(avantage, style = Texte.corps, color = p.encre.compose)
                }
            }
            Spacer(Modifier.height(16.dp))
            // Le paiement se fait sur le site : carte ou Mobile Money.
            BoutonPrincipal(if (e.hasPremium) "Gérer sur le site" else "Passer en Premium sur le site", {
                ouvrirLien(contexte, "${BuildConfig.SITE}abonnement", p.base.enArgb().toInt())
            })
        }
    }
}

// ------------------------------------------------------------ Sécurité (B11, B12)

@Composable
fun EcranSecurite(aUnMotDePasse: Boolean, onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val portee = rememberCoroutineScope()
    var actuel by rememberSaveable { mutableStateOf("") }
    var nouveau by rememberSaveable { mutableStateOf("") }
    var erreurMdp by remember { mutableStateOf<String?>(null) }
    var enCours by remember { mutableStateOf(false) }
    var appareils by remember { mutableStateOf<List<Appareil>?>(null) }
    var retrait by remember { mutableStateOf<String?>(null) }
    var toutFermer by remember { mutableStateOf(false) }
    val charger: suspend () -> Unit = { appareils = runCatching { c.compte.appareils() }.getOrDefault(emptyList()) }
    LaunchedEffect(Unit) { charger() }

    PageReglage("Sécurité", onRetour) {
        Rubrique(if (aUnMotDePasse) "Modifier le mot de passe" else "Définir un mot de passe", if (aUnMotDePasse) null else "Pour te connecter aussi avec ton email, en plus de Google.")
        if (aUnMotDePasse) {
            ChampTexte(actuel, { actuel = it }, "Mot de passe actuel", R.drawable.lucide_lock, saisie = Saisie.MOT_DE_PASSE)
            Spacer(Modifier.height(12.dp))
        }
        ChampTexte(nouveau, { nouveau = it }, "Nouveau mot de passe", R.drawable.lucide_key_round, saisie = Saisie.MOT_DE_PASSE, indication = "8 caractères au moins")
        MessageErreur(erreurMdp, Modifier.padding(top = 12.dp))
        Spacer(Modifier.height(16.dp))
        BoutonPrincipal(if (aUnMotDePasse) "Modifier" else "Définir", {
            erreurMdp = when {
                aUnMotDePasse && actuel.isEmpty() -> "Mot de passe actuel requis."
                nouveau.length < 8 -> "Le nouveau mot de passe doit faire 8 caractères au moins."
                else -> null
            }
            if (erreurMdp == null && !enCours) {
                enCours = true
                portee.launch {
                    try {
                        c.compte.changerMotDePasse(actuel, nouveau)
                        actuel = ""
                        nouveau = ""
                        c.alertes.signaler(AlerteLecture.Message("Mot de passe enregistré.", succes = true))
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: ErreurApi) {
                        erreurMdp = if (e.statut == 403) "Mot de passe actuel incorrect." else messageErreur(e)
                    } catch (e: Exception) {
                        erreurMdp = messageErreur(e)
                    }
                    enCours = false
                }
            }
        }, enCours = enCours)

        Rubrique("Appareils connectés", "Les téléphones et navigateurs où ton compte est ouvert.")
        val liste = appareils
        if (liste == null) {
            Egaliseur(hauteur = 16.dp)
        } else if (liste.isEmpty()) {
            Text("Aucun autre appareil.", style = Texte.corps, color = p.encreAttenuee.compose)
        }
        liste.orEmpty().forEach { a ->
            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(38.dp).clip(CircleShape).background(p.surface.compose), contentAlignment = Alignment.Center) {
                    Icone(if (a.device.contains("app", ignoreCase = true)) R.drawable.lucide_smartphone else R.drawable.lucide_monitor, description = null, teinte = p.encreAttenuee.compose, taille = 18.dp)
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(a.device, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose)
                    dateLongue(a.createdAt)?.let { Text("Connecté le $it", style = Texte.secondaire, color = p.encreAttenuee.compose) }
                }
                if (retrait == a.id) {
                    Egaliseur(hauteur = 12.dp)
                } else {
                    LienTexte("Déconnecter", {
                        retrait = a.id
                        portee.launch {
                            runCatching { c.compte.deconnecterAppareil(a.id) }
                                .onSuccess { charger() }
                                .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                            retrait = null
                        }
                    })
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(p.rayon.dp)).border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(p.rayon.dp)).clickable(role = Role.Button) { toutFermer = true }.padding(14.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icone(R.drawable.lucide_shield, description = null, teinte = p.danger.compose, taille = 18.dp)
            Spacer(Modifier.width(8.dp))
            Text("Fermer toutes les sessions", style = Texte.corpsFort, color = p.danger.compose)
        }
    }

    if (toutFermer) {
        Confirmation(
            titre = "Fermer toutes les sessions ?",
            texte = "Ton compte sera déconnecté partout, y compris sur ce téléphone. Utile si tu penses qu'un autre appareil y a accès.",
            action = "Tout fermer",
            onFermer = { toutFermer = false },
            onConfirmer = {
                toutFermer = false
                portee.launch {
                    runCatching { c.compte.toutFermer() }
                        .onSuccess {
                            c.session.deconnexion()
                            c.alertes.signaler(AlerteLecture.Message("Toutes les sessions sont fermées.", succes = true))
                        }
                        .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                }
            },
        )
    }
}

/** Charge le profil avant d'afficher une rubrique qui en dépend (nom, mot de passe défini ou non). */
@Composable
fun AvecProfil(onRetour: () -> Unit, contenu: @Composable (com.moziik.app.donnees.reseau.Profil) -> Unit) {
    val c = conteneur()
    var profil by remember { mutableStateOf<com.moziik.app.donnees.reseau.Profil?>(null) }
    var erreur by remember { mutableStateOf<String?>(null) }
    var essai by remember { mutableStateOf(0) }
    LaunchedEffect(essai) {
        erreur = null
        try {
            profil = c.reseau.api.profil()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            erreur = messageErreur(com.moziik.app.donnees.reseau.versErreurApi(e))
        }
    }
    val lu = profil
    when {
        lu != null -> contenu(lu)
        erreur != null -> PageReglage("Compte", onRetour) {
            MessageErreur(erreur)
            Spacer(Modifier.height(12.dp))
            BoutonPrincipal("Réessayer", { essai++ })
        }
        else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { LogoMoziik(hauteur = 30.dp, boucle = true) }
    }
}
