package com.moziik.app.lecteur

import android.content.ComponentName
import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.reseau.JsonMoziik
import kotlinx.serialization.Serializable
import java.io.File
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Ce que les écrans montrent du lecteur. La position, qui change sans cesse, se lit à part (Lecteur.position). */
data class EtatLecteur(
    val courant: TitreLu? = null,
    val enLecture: Boolean = false,
    /** Le son est demandé mais pas encore là (chargement, mise en mémoire). */
    val attente: Boolean = false,
    val aleatoire: Boolean = false,
    val repetition: Int = Player.REPEAT_MODE_OFF,
    val file: List<TitreLu> = emptyList(),
    val index: Int = 0,
    /** Les positions dans `file` des prochains titres, dans l'ordre où ils seront joués (aléatoire compris). */
    val suivants: List<Int> = emptyList(),
)

/**
 * La télécommande du service de lecture, partagée par tous les écrans.
 * Elle se connecte quand l'app est à l'écran et se libère quand elle passe
 * en arrière-plan ; la musique, elle, continue dans le service.
 */
class Lecteur(private val contexte: Context, private val site: String) {
    private var connexion: ListenableFuture<MediaController>? = null
    private var controleur: MediaController? = null
    private val enAttente = mutableListOf<(MediaController) -> Unit>()

    private val _etat = MutableStateFlow(EtatLecteur())
    val etat: StateFlow<EtatLecteur> = _etat.asStateFlow()

    private val ecouteur = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) {
            publier()
            // La file sauvegardée à chaque changement, la position à chaque pause (E10).
            if (events.containsAny(Player.EVENT_TIMELINE_CHANGED, Player.EVENT_MEDIA_ITEM_TRANSITION, Player.EVENT_IS_PLAYING_CHANGED)) sauvegarder()
            if (events.contains(Player.EVENT_IS_PLAYING_CHANGED)) {
                minuterie.removeCallbacks(sauvegardePeriodique)
                if (player.isPlaying) minuterie.postDelayed(sauvegardePeriodique, SAUVEGARDE_MS)
            }
        }
    }

    // ------------------------------------------------------------ Reprise (E10)

    private val fichierReprise = fichierDeReprise(contexte)
    private var repriseFaite = false
    private val minuterie = Handler(Looper.getMainLooper())
    /** La position, toutes les 5 secondes pendant la lecture : une coupure brutale ne la perd pas. */
    private val sauvegardePeriodique: Runnable = object : Runnable {
        override fun run() {
            sauvegarder()
            if (controleur?.isPlaying == true) minuterie.postDelayed(this, SAUVEGARDE_MS)
        }
    }

    private fun sauvegarder() {
        val c = controleur ?: return
        if (c.mediaItemCount == 0) return
        val reprise = Reprise((0 until c.mediaItemCount).map { c.getMediaItemAt(it).versTitreLu() }, c.currentMediaItemIndex, c.currentPosition)
        runCatching { fichierReprise.writeText(JsonMoziik.encodeToString(Reprise.serializer(), reprise)) }
    }

    /**
     * Au lancement, si le service n'a plus de file : la dernière file,
     * prête mais en pause. Pas de reprise sous une seconde d'écoute ni
     * dans les cinq dernières secondes d'un titre (E10).
     */
    private fun reprendre(c: MediaController) {
        if (repriseFaite) return
        repriseFaite = true
        if (c.mediaItemCount > 0) return
        val reprise = repriseSauvegardee(contexte, site) ?: return
        c.setMediaItems(reprise.mediaItems, reprise.startIndex, reprise.startPositionMs)
    }

    fun connecter() {
        if (connexion != null) return
        val jeton = SessionToken(contexte, ComponentName(contexte, ServiceLecture::class.java))
        val futur = MediaController.Builder(contexte, jeton).buildAsync()
        connexion = futur
        futur.addListener({
            val c = runCatching { futur.get() }.getOrNull()
            if (c == null || connexion !== futur) {
                c?.release()
                return@addListener
            }
            controleur = c
            reprendre(c)
            c.addListener(ecouteur)
            publier()
            enAttente.toList().forEach { it(c) }
            enAttente.clear()
        }, ContextCompat.getMainExecutor(contexte))
    }

    fun liberer() {
        sauvegarder()
        minuterie.removeCallbacks(sauvegardePeriodique)
        controleur?.removeListener(ecouteur)
        connexion?.let { MediaController.releaseFuture(it) }
        connexion = null
        controleur = null
    }

    /** Exécute tout de suite si la télécommande est connectée, sinon dès qu'elle l'est. */
    private fun avec(action: (MediaController) -> Unit) {
        controleur?.let(action) ?: run {
            enAttente += action
            connecter()
        }
    }

    /**
     * Lance une liste à partir d'un titre. Si c'est déjà la file en cours,
     * on y saute simplement : relancer la même liste ne la reconstruit pas
     * (spécification 5.5).
     */
    fun lire(titres: List<Titre>, depart: Int, source: String?) {
        val jouables = titres.filter { it.publie }
        if (jouables.isEmpty()) return
        val premier = titres.getOrNull(depart)?.let { voulu -> jouables.indexOfFirst { it.id == voulu.id } }?.takeIf { it >= 0 } ?: 0
        avec { c ->
            val memeFile = c.mediaItemCount == jouables.size && jouables.indices.all { c.getMediaItemAt(it).mediaId == jouables[it].id }
            if (memeFile) {
                c.seekToDefaultPosition(premier)
            } else {
                c.setMediaItems(jouables.map { it.versElement(site, source) }, premier, 0)
            }
            c.prepare()
            c.play()
        }
    }

    /**
     * « Écouter ensuite » : juste après le titre en cours. Sans file en
     * cours, le titre est simplement lancé.
     */
    fun lireEnsuite(titre: Titre, source: String?) = avec { c ->
        if (c.mediaItemCount == 0) {
            lire(listOf(titre), 0, source)
        } else {
            c.addMediaItem(c.currentMediaItemIndex + 1, titre.versElement(site, source))
        }
    }

    /** « Ajouter à la file d'attente » : à la fin de la file. */
    fun ajouterALaFile(titres: List<Titre>, source: String?) = avec { c ->
        val jouables = titres.filter { it.publie }
        if (jouables.isEmpty()) return@avec
        if (c.mediaItemCount == 0) lire(jouables, 0, source) else c.addMediaItems(jouables.map { it.versElement(site, source) })
    }

    /** Lecture/pause. Après une erreur ou la fin de la file, Lecture repart vraiment. */
    fun basculer() = avec { c ->
        when {
            c.isPlaying -> c.pause()
            else -> {
                if (c.playbackState == Player.STATE_ENDED) c.seekToDefaultPosition(c.currentMediaItemIndex)
                if (c.playbackState == Player.STATE_IDLE) c.prepare()
                c.play()
            }
        }
    }

    /** Lecture ou pause explicite, sans dépendre de l'état du moment (un chargement n'est ni l'un ni l'autre). */
    fun mettreEnLecture(oui: Boolean) = avec { c ->
        if (!oui) {
            c.pause()
        } else {
            if (c.playbackState == Player.STATE_IDLE) c.prepare()
            c.play()
        }
    }

    fun suivant() = avec { it.seekToNext() }

    /** Au-delà de 3 secondes, revient au début du titre ; sinon au titre précédent (comportement par défaut de Media3, et du site). */
    fun precedent() = avec { it.seekToPrevious() }

    /** Le titre d'avant, quelle que soit la position : un glissement demande un autre titre, pas un retour au début. */
    fun titrePrecedent() = avec { it.seekToPreviousMediaItem() }

    /** Y a-t-il un titre avant celui-ci, dans l'ordre réel (aléatoire et répétition compris) ? */
    fun aUnPrecedent(): Boolean = controleur?.hasPreviousMediaItem() == true

    fun aUnSuivant(): Boolean = controleur?.hasNextMediaItem() == true

    fun deplacer(positionMs: Long) = avec { it.seekTo(positionMs) }

    fun allerA(index: Int) = avec { c ->
        c.seekToDefaultPosition(index)
        if (c.playbackState == Player.STATE_IDLE) c.prepare()
        c.play()
    }

    fun basculerAleatoire() = avec { it.shuffleModeEnabled = !it.shuffleModeEnabled }

    /** Retire un titre de la file (index de la file, pas du titre en cours). */
    fun retirerDeLaFile(index: Int) = avec { c -> if (index != c.currentMediaItemIndex && index in 0 until c.mediaItemCount) c.removeMediaItem(index) }

    /** Déplace un titre de la file d'un index à un autre. */
    fun deplacerDansLaFile(de: Int, vers: Int) = avec { c ->
        if (de != vers && de in 0 until c.mediaItemCount && vers in 0 until c.mediaItemCount) c.moveMediaItem(de, vers)
    }

    /** Retire tout ce qui suit le titre en cours ; la suite automatique reprendra à la fin. */
    fun viderLaSuite() = avec { c ->
        val i = c.currentMediaItemIndex
        if (i + 1 < c.mediaItemCount) c.removeMediaItems(i + 1, c.mediaItemCount)
    }

    private val _vitesse = kotlinx.coroutines.flow.MutableStateFlow(1f)
    /** La vitesse de lecture : elle reste réglée d'un titre à l'autre, comme dans tout lecteur de podcasts. */
    val vitesse: kotlinx.coroutines.flow.StateFlow<Float> = _vitesse

    fun choisirVitesse(v: Float) {
        _vitesse.value = v
        avec { it.setPlaybackSpeed(v) }
    }

    /** Désactivée, puis toute la file, puis le titre seul : l'ordre du site. */
    fun basculerRepetition() = avec { c ->
        c.repeatMode = when (c.repeatMode) {
            Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
            Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
            else -> Player.REPEAT_MODE_OFF
        }
    }

    fun position(): Long = controleur?.currentPosition ?: 0L

    /** La durée lue dans le fichier si elle est connue, sinon celle du catalogue. */
    fun duree(): Long {
        val lue = controleur?.duration ?: return 0L
        if (lue > 0) return lue
        return ((_etat.value.courant?.dureeSecondes ?: 0.0) * 1000).toLong()
    }

    private fun publier() {
        val c = controleur ?: return
        val file = (0 until c.mediaItemCount).map { c.getMediaItemAt(it).versTitreLu() }
        val chronologie = c.currentTimeline
        val suivants = buildList {
            var i = c.currentMediaItemIndex
            while (!chronologie.isEmpty && size < SUIVANTS_MAX) {
                i = chronologie.getNextWindowIndex(i, Player.REPEAT_MODE_OFF, c.shuffleModeEnabled)
                if (i == C.INDEX_UNSET) break
                add(i)
            }
        }
        _etat.value = EtatLecteur(
            courant = c.currentMediaItem?.versTitreLu(),
            enLecture = c.isPlaying,
            attente = c.playWhenReady && c.playbackState == Player.STATE_BUFFERING,
            aleatoire = c.shuffleModeEnabled,
            repetition = c.repeatMode,
            file = file,
            index = c.currentMediaItemIndex,
            suivants = suivants,
        )
    }

    private companion object {
        const val SUIVANTS_MAX = 30
        const val SAUVEGARDE_MS = 5_000L
    }
}

@Serializable
internal data class Reprise(val file: List<TitreLu>, val index: Int, val positionMs: Long)

internal fun fichierDeReprise(contexte: Context) = File(contexte.filesDir, "reprise-lecture.json")

/**
 * La dernière file sauvegardée, prête à rejouer : par l'app au lancement,
 * et par le service quand la lecture reprend sans elle (casque Bluetooth,
 * Android Auto, gadget de l'écran d'accueil). Pas de reprise de position
 * sous une seconde d'écoute ni dans les cinq dernières secondes d'un titre (E10).
 */
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
internal fun repriseSauvegardee(contexte: Context, site: String): MediaSession.MediaItemsWithStartPosition? {
    val reprise = runCatching { JsonMoziik.decodeFromString(Reprise.serializer(), fichierDeReprise(contexte).readText()) }.getOrNull() ?: return null
    if (reprise.file.isEmpty()) return null
    val index = reprise.index.coerceIn(0, reprise.file.lastIndex)
    val dureeMs = (reprise.file[index].dureeSecondes * 1000).toLong()
    val position = reprise.positionMs.takeIf { it > 1_000 && (dureeMs <= 0 || it < dureeMs - 5_000) } ?: 0L
    return MediaSession.MediaItemsWithStartPosition(reprise.file.map { it.versElement(site) }, index, position)
}
