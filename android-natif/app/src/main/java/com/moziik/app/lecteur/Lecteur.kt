package com.moziik.app.lecteur

import android.content.ComponentName
import android.content.Context
import androidx.core.content.ContextCompat
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.moziik.app.donnees.catalogue.Titre
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
        override fun onEvents(player: Player, events: Player.Events) = publier()
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
            c.addListener(ecouteur)
            publier()
            enAttente.toList().forEach { it(c) }
            enAttente.clear()
        }, ContextCompat.getMainExecutor(contexte))
    }

    fun liberer() {
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

    fun suivant() = avec { it.seekToNext() }

    /** Au-delà de 3 secondes, revient au début du titre ; sinon au titre précédent (comportement par défaut de Media3, et du site). */
    fun precedent() = avec { it.seekToPrevious() }

    fun deplacer(positionMs: Long) = avec { it.seekTo(positionMs) }

    fun allerA(index: Int) = avec { c ->
        c.seekToDefaultPosition(index)
        if (c.playbackState == Player.STATE_IDLE) c.prepare()
        c.play()
    }

    fun basculerAleatoire() = avec { it.shuffleModeEnabled = !it.shuffleModeEnabled }

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
    }
}
