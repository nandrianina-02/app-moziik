package com.moziik.app.ui.decouvrir

import android.content.Context
import androidx.annotation.OptIn
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import com.moziik.app.BuildConfig
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.DUREE_EXTRAIT_MS
import com.moziik.app.donnees.catalogue.Manche
import com.moziik.app.donnees.catalogue.debutExtraitMs
import com.moziik.app.donnees.catalogue.pointsDe
import com.moziik.app.donnees.catalogue.preparerPartie
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.donnees.session.appel
import com.moziik.app.lecteur.adresseFlux
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Mouvement
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.apparition
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.fiches.BarreRetour
import com.moziik.app.ui.partager
import kotlinx.coroutines.launch

private sealed interface EtapeJeu {
    data object Regles : EtapeJeu
    data object Chargement : EtapeJeu
    data class Manche(val rang: Int) : EtapeJeu
    data object Fin : EtapeJeu
}

/**
 * Le blind test : dix extraits de dix secondes pris dans le catalogue,
 * quatre propositions, des points pour la vitesse et les séries. Les
 * extraits passent par un lecteur à part : la file d'écoute n'est pas
 * touchée, et un extrait de jeu n'est pas déclaré comme une écoute.
 * Réservé aux comptes connectés : un extrait compterait dans le quota d'un
 * visiteur.
 */
@OptIn(UnstableApi::class)
@Composable
fun EcranBlindTest(onRetour: () -> Unit, onConnexion: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val contexte = LocalContext.current
    val portee = rememberCoroutineScope()
    val session by c.session.etat.collectAsStateWithLifecycle()
    var etape by remember { mutableStateOf<EtapeJeu>(EtapeJeu.Regles) }
    var partie by remember { mutableStateOf<List<Manche>>(emptyList()) }
    var score by remember { mutableIntStateOf(0) }
    var serie by remember { mutableIntStateOf(0) }
    var justes by remember { mutableIntStateOf(0) }
    var erreur by remember { mutableStateOf<String?>(null) }
    val preferences = remember { contexte.getSharedPreferences("blind-test", Context.MODE_PRIVATE) }
    var record by remember { mutableIntStateOf(preferences.getInt("record", 0)) }

    // Un lecteur à part, avec le client du compte : la redirection vers le fichier est suivie sans le jeton.
    val extraits = remember {
        ExoPlayer.Builder(contexte)
            .setMediaSourceFactory(DefaultMediaSourceFactory(OkHttpDataSource.Factory(c.reseau.client)))
            .build()
    }
    DisposableEffect(Unit) { onDispose { extraits.release() } }

    val lancer: () -> Unit = {
        etape = EtapeJeu.Chargement
        erreur = null
        // La musique en cours s'arrête le temps du jeu.
        if (c.lecteur.etat.value.enLecture) c.lecteur.basculer()
        portee.launch {
            val univers = c.catalogue.univers()
            appel { c.reseau.api.titres(tri = "popular", limite = 80, univers = univers).songs }
                .onSuccess { titres ->
                    partie = preparerPartie(titres)
                    score = 0
                    serie = 0
                    justes = 0
                    if (partie.isEmpty()) {
                        erreur = "Pas assez de titres pour une partie."
                        etape = EtapeJeu.Regles
                    } else {
                        etape = EtapeJeu.Manche(0)
                    }
                }
                .onFailure {
                    erreur = "La partie n'a pas pu être préparée. Vérifiez votre connexion."
                    etape = EtapeJeu.Regles
                }
        }
    }

    Column(Modifier.fillMaxSize()) {
        BarreRetour(onRetour)
        AnimatedContent(
            targetState = etape,
            transitionSpec = {
                (slideInHorizontally(tween(Mouvement.ENTREE_PAGE, easing = Mouvement.sortieDouce)) { it / 10 } + fadeIn(tween(Mouvement.ENTREE_PAGE)))
                    .togetherWith(fadeOut(tween(Mouvement.VOILE / 2)))
            },
            modifier = Modifier.weight(1f),
            label = "jeu",
        ) { e ->
            when (e) {
                EtapeJeu.Regles -> Regles(record, erreur, connecte = session is EtatSession.Connecte, onJouer = lancer, onConnexion = onConnexion)
                EtapeJeu.Chargement -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 22.dp, libelle = "Préparation de la partie") }
                is EtapeJeu.Manche -> MancheEnCours(
                    manche = partie[e.rang],
                    rang = e.rang,
                    total = partie.size,
                    score = score,
                    serie = serie,
                    extraits = extraits,
                    onReponse = { juste, tempsMs ->
                        serie = if (juste) serie + 1 else 0
                        if (juste) justes++
                        score += pointsDe(juste, tempsMs, serie)
                    },
                    onSuivante = {
                        extraits.stop()
                        if (e.rang + 1 < partie.size) {
                            etape = EtapeJeu.Manche(e.rang + 1)
                        } else {
                            if (score > record) {
                                record = score
                                preferences.edit().putInt("record", score).apply()
                            }
                            etape = EtapeJeu.Fin
                        }
                    },
                )
                EtapeJeu.Fin -> Fin(score, justes, partie.size, record, onRejouer = lancer, onPartager = {
                    partager(contexte, "", "J'ai fait $score points au blind test Moziik ($justes bonnes réponses sur ${partie.size}). À toi de jouer !")
                })
            }
        }
    }
}

@Composable
private fun Regles(record: Int, erreur: String?, connecte: Boolean, onJouer: () -> Unit, onConnexion: () -> Unit) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 16.dp)) {
        Box(Modifier.size(64.dp).clip(CircleShape).background(p.accent.compose).apparition(0), contentAlignment = Alignment.Center) {
            Icone(R.drawable.lucide_gamepad_2, description = null, teinte = p.base.compose, taille = 30.dp)
        }
        Spacer(Modifier.height(20.dp))
        Text("Blind test", style = Texte.titreFiche.copy(fontSize = 30.sp, lineHeight = 36.sp), color = p.encre.compose, modifier = Modifier.apparition(1))
        Spacer(Modifier.height(8.dp))
        Text(
            "Dix extraits de dix secondes. Trouvez le titre parmi quatre propositions : plus vous répondez vite, plus vous marquez, et les bonnes réponses d'affilée rapportent un bonus.",
            style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.apparition(2),
        )
        if (record > 0) {
            Text("Votre record : $record points", style = Texte.corpsFort, color = p.accent.compose, modifier = Modifier.padding(top = 16.dp).apparition(3))
        }
        erreur?.let { Text(it, style = Texte.secondaire, color = p.danger.compose, modifier = Modifier.padding(top = 12.dp)) }
        Spacer(Modifier.height(28.dp))
        if (connecte) {
            BoutonPrincipal("Jouer", onJouer, Modifier.apparition(4))
        } else {
            Text("Connectez-vous pour jouer : les extraits utilisent votre compte.", style = Texte.corps, color = p.encreAttenuee.compose)
            Spacer(Modifier.height(12.dp))
            BoutonPrincipal("Se connecter", onConnexion)
        }
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun MancheEnCours(
    manche: Manche,
    rang: Int,
    total: Int,
    score: Int,
    serie: Int,
    extraits: ExoPlayer,
    onReponse: (Boolean, Long) -> Unit,
    onSuivante: () -> Unit,
) {
    val c = conteneur()
    val p = LocalPalette.current
    var choisie by remember(manche) { mutableStateOf<String?>(null) }
    var depart by remember(manche) { mutableLongStateOf(0L) }
    val temps = remember(manche) { Animatable(1f) }

    // L'extrait part, et la barre de temps descend sur dix secondes ; sans réponse, la manche est perdue.
    LaunchedEffect(manche) {
        val qualite = "low"
        extraits.setMediaItem(MediaItem.fromUri(adresseFlux(BuildConfig.SITE, manche.reponse.id, qualite)), debutExtraitMs(manche.reponse.duration))
        extraits.prepare()
        extraits.play()
        depart = System.currentTimeMillis()
        temps.animateTo(0f, tween(DUREE_EXTRAIT_MS.toInt(), easing = LinearEasing))
        extraits.pause()
        if (choisie == null) {
            choisie = ""
            onReponse(false, DUREE_EXTRAIT_MS)
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Manche ${rang + 1} sur $total", style = Texte.secondaire.copy(fontWeight = FontWeight.Medium), color = p.encreAttenuee.compose, modifier = Modifier.weight(1f))
            if (serie >= 2) Text("Série de $serie", style = Texte.secondaire.copy(fontWeight = FontWeight.SemiBold), color = p.accent.compose, modifier = Modifier.padding(end = 12.dp))
            Text("$score pts", style = Texte.corpsFort, color = p.encre.compose)
        }
        Spacer(Modifier.height(10.dp))
        Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(p.bordure.compose)) {
            Box(Modifier.fillMaxWidth(temps.value).fillMaxHeight().background(p.accent.compose))
        }
        Spacer(Modifier.height(24.dp))
        // La pochette reste cachée jusqu'à la réponse : elle donnerait la solution.
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            if (choisie != null) {
                Pochette(manche.reponse.coverUrl, Modifier.size(150.dp))
            } else {
                Box(Modifier.size(150.dp).clip(RoundedCornerShape(p.rayon.dp)).background(p.surface.compose).border(BorderStroke(1.dp, p.bordure.compose), RoundedCornerShape(p.rayon.dp)), contentAlignment = Alignment.Center) {
                    Egaliseur(hauteur = 28.dp, libelle = "Extrait en cours")
                }
            }
        }
        Spacer(Modifier.height(24.dp))
        manche.propositions.forEach { t ->
            val juste = t.id == manche.reponse.id
            val montree = choisie != null
            val couleur = when {
                montree && juste -> p.accent.compose
                montree && t.id == choisie -> p.danger.compose
                else -> p.bordure.compose
            }
            val forme = RoundedCornerShape(p.rayon.dp)
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(bottom = 10.dp)
                    .clip(forme)
                    .border(BorderStroke(if (montree && (juste || t.id == choisie)) 2.dp else 1.dp, couleur), forme)
                    .background(if (montree && juste) p.accent.compose.copy(alpha = 0.1f) else p.surface.compose)
                    .clickable(enabled = !montree, role = Role.Button) {
                        choisie = t.id
                        extraits.pause()
                        onReponse(juste, System.currentTimeMillis() - depart)
                    }
                    .padding(horizontal = 16.dp, vertical = 13.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(t.title, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(t.artist?.stageName.orEmpty(), style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                if (montree && juste) Icone(R.drawable.lucide_check, description = "Bonne réponse", teinte = p.accent.compose, taille = 18.dp)
                if (montree && !juste && t.id == choisie) Icone(R.drawable.lucide_x, description = "Mauvaise réponse", teinte = p.danger.compose, taille = 18.dp)
            }
        }
        if (choisie != null) {
            Spacer(Modifier.height(8.dp))
            BoutonPrincipal(if (rang + 1 < total) "Manche suivante" else "Voir mon score", onSuivante)
            Text(
                "Écouter « ${manche.reponse.title} » en entier",
                style = Texte.secondaire.copy(fontWeight = FontWeight.Medium),
                color = p.accent.compose,
                modifier = Modifier.padding(top = 12.dp).clip(CircleShape).clickable(role = Role.Button) {
                    c.lecteur.lire(listOf(manche.reponse), 0, "Blind test")
                }.padding(vertical = 6.dp),
            )
        }
    }
}

@Composable
private fun Fin(score: Int, justes: Int, total: Int, record: Int, onRejouer: () -> Unit, onPartager: () -> Unit) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 16.dp)) {
        Text("PARTIE TERMINÉE", style = Texte.surtitre, color = p.encreAttenuee.compose, modifier = Modifier.apparition(0))
        Text("$score", style = Texte.titreFiche.copy(fontSize = 64.sp, lineHeight = 68.sp), color = p.encre.compose, modifier = Modifier.apparition(1))
        Text("points · $justes bonnes réponses sur $total", style = Texte.corps, color = p.encreAttenuee.compose, modifier = Modifier.apparition(2))
        if (score >= record && score > 0) {
            Text("Nouveau record", style = Texte.corpsFort, color = p.accent.compose, modifier = Modifier.padding(top = 10.dp).apparition(3))
        } else if (record > 0) {
            Text("Record : $record points", style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 10.dp).apparition(3))
        }
        Spacer(Modifier.height(28.dp))
        BoutonPrincipal("Rejouer", onRejouer, Modifier.apparition(4))
        Spacer(Modifier.height(12.dp))
        Row(
            Modifier.fillMaxWidth().clip(CircleShape).border(BorderStroke(1.dp, p.bordure.compose), CircleShape).clickable(role = Role.Button, onClick = onPartager).padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icone(R.drawable.lucide_share_2, description = null, teinte = p.encre.compose, taille = 16.dp)
            Spacer(Modifier.width(8.dp))
            Text("Défier un ami", style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose)
        }
    }
}
