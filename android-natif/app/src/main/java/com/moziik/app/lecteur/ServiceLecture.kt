package com.moziik.app.lecteur

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.Timeline
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.HttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy
import androidx.media3.exoplayer.upstream.LoadErrorHandlingPolicy
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.moziik.app.BuildConfig
import com.moziik.app.MainActivity
import com.moziik.app.MoziikApplication
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.Ecoute
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.donnees.session.appel
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import java.io.IOException

/** Canal de la notification de lecture, repris de l'app Capacitor : les réglages de l'utilisateur sur ce canal sont gardés. */
private const val CANAL = "moziik_lecture"
/** Plafond du site pour le temps déclaré d'une écoute (6 heures). */
private const val ECOUTE_MAX_SECONDES = 21_600
private const val HISTORIQUE_MAX = 60

private fun Throwable.chaine(): List<Throwable> = generateSequence(this) { it.cause }.take(8).toList()

/**
 * Le lecteur réel de l'app : il joue le son, garde la file et continue
 * écran éteint, avec sa notification, l'écran verrouillé et les boutons du
 * casque (Media3). Les écrans le pilotent par une MediaController (Lecteur).
 *
 * La file, son prolongement et le comptage des écoutes vivent ici et non
 * dans l'interface (spécification 5.1) : ils continuent quand l'app est en
 * arrière-plan.
 */
@OptIn(UnstableApi::class)
class ServiceLecture : MediaSessionService() {
    private var session: MediaSession? = null
    private val portee = MainScope()
    private val compteur = CompteurEcoute()
    private val historique = ArrayDeque<String>()
    private lateinit var resolution: ResolutionFlux
    private lateinit var prolongement: Prolongement
    private var prolongementEnCours = false
    private var toursVides = 0
    private var ajoutInterne = false
    /** L'élément déjà relancé après un lien expiré chez l'hébergeur : une seule nouvelle tentative. */
    private var relance: String? = null

    private val conteneur get() = (application as MoziikApplication).conteneur

    override fun onCreate() {
        super.onCreate()
        val c = conteneur
        resolution = ResolutionFlux(c.reseau.client, BuildConfig.SITE, estVisiteur = { c.session.etat.value is EtatSession.Anonyme })
        prolongement = Prolongement(c.reseau.api, c.catalogue::univers, c.catalogue::mode)

        val fichiers = ResolvingDataSource.Factory(OkHttpDataSource.Factory(c.reseau.clientPublic)) { spec ->
            resolution.resoudre(spec.uri.toString())?.let { spec.withUri(Uri.parse(it)) } ?: spec
        }
        val joueur = ExoPlayer.Builder(this)
            .setMediaSourceFactory(DefaultMediaSourceFactory(fichiers).setLoadErrorHandlingPolicy(PolitiqueErreurs()))
            // `true` : pause quand un appel ou une autre app prend le son, reprise ensuite.
            .setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true)
            // Casque débranché : pause, plutôt que de continuer sur le haut-parleur.
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build()
        joueur.addListener(Ecouteur(joueur))

        val ouvrirApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        session = MediaSession.Builder(this, joueur)
            .setCallback(Rappels())
            .setSessionActivity(ouvrirApp)
            .build()

        setMediaNotificationProvider(
            DefaultMediaNotificationProvider.Builder(this)
                .setChannelId(CANAL)
                .setChannelName(R.string.canal_lecture)
                .build()
                .also { it.setSmallIcon(R.drawable.ic_stat_moziik) },
        )

        // Connexion ou déconnexion : le quota et le plafond de qualité changent, les adresses déjà résolues ne valent plus.
        portee.launch { c.session.etat.drop(1).collect { resolution.oublier() } }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    /**
     * L'app retirée des applications récentes : la musique en cours
     * continue, comme dans tout lecteur ; une lecture en pause s'arrête et
     * libère sa notification.
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        val joueur = session?.player
        if (joueur == null || !joueur.playWhenReady || joueur.mediaItemCount == 0 || joueur.playbackState == Player.STATE_ENDED) {
            stopSelf()
        }
    }

    override fun onDestroy() {
        declarer(compteur.terminer(SystemClock.elapsedRealtime()))
        session?.run {
            player.release()
            release()
        }
        session = null
        portee.cancel()
        super.onDestroy()
    }

    private fun declarer(ecoute: EcouteFinie?) {
        ecoute ?: return
        val api = conteneur.reseau.api
        // Portée de l'app : la déclaration part même si le service s'arrête juste après.
        conteneur.portee.launch {
            appel { api.ecoute(ecoute.id, Ecoute(minOf(ecoute.secondes, ECOUTE_MAX_SECONDES).toDouble(), ecoute.complete)) }
        }
    }

    /** Les éléments envoyés par l'écran arrivent sans adresse : on la repose ici, toujours /api/stream. */
    private inner class Rappels : MediaSession.Callback {
        override fun onAddMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: MutableList<MediaItem>,
        ): ListenableFuture<MutableList<MediaItem>> = Futures.immediateFuture(
            mediaItems.map { it.buildUpon().setUri(adresseFlux(BuildConfig.SITE, it.mediaId, conteneur.reglages.qualiteEffective())).build() }.toMutableList(),
        )
    }

    private inner class Ecouteur(private val joueur: ExoPlayer) : Player.Listener {
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            val maintenant = SystemClock.elapsedRealtime()
            declarer(compteur.terminer(maintenant))
            if (mediaItem != null) {
                compteur.demarrer(mediaItem.mediaId, mediaItem.dureeSecondes(), joueur.isPlaying, maintenant)
                historique.remove(mediaItem.mediaId)
                historique.addLast(mediaItem.mediaId)
                while (historique.size > HISTORIQUE_MAX) historique.removeFirst()
            }
            relance = null
            prolonger()
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            compteur.lecture(isPlaying, SystemClock.elapsedRealtime())
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_ENDED) declarer(compteur.terminer(SystemClock.elapsedRealtime()))
        }

        override fun onTimelineChanged(timeline: Timeline, reason: Int) {
            // Une nouvelle file choisie par l'utilisateur : le prolongement repart de zéro.
            if (reason == Player.TIMELINE_CHANGE_REASON_PLAYLIST_CHANGED && !ajoutInterne) toursVides = 0
        }

        override fun onRepeatModeChanged(repeatMode: Int) = prolonger()

        override fun onPlayerError(error: PlaybackException) {
            val chaine = error.chaine()
            val refus = chaine.firstNotNullOfOrNull { it as? ErreurFlux }
            val hote = chaine.firstNotNullOfOrNull { it as? HttpDataSource.InvalidResponseCodeException }
            val courant = joueur.currentMediaItem
            when {
                refus?.statut == 402 -> {
                    joueur.pause()
                    conteneur.alertes.signaler(AlerteLecture.Quota)
                }
                refus?.statut == 403 || refus?.statut == 404 -> {
                    conteneur.alertes.signaler(AlerteLecture.Message("« ${courant?.mediaMetadata?.title ?: "Ce titre"} » n'est pas disponible."))
                    passerAuSuivant()
                }
                // Lien de l'hébergeur expiré ou révoqué : une nouvelle adresse au site, une fois.
                hote != null && hote.responseCode in setOf(403, 404, 410) && relance != courant?.mediaId -> {
                    relance = courant?.mediaId
                    resolution.oublier()
                    joueur.prepare()
                }
                refus == null && hote == null && chaine.any { it is IOException } -> {
                    joueur.pause()
                    conteneur.alertes.signaler(AlerteLecture.Message("Connexion impossible. Vérifie ton réseau et réessaie."))
                }
                else -> {
                    joueur.pause()
                    conteneur.alertes.signaler(AlerteLecture.Message("La lecture de ce titre a échoué."))
                }
            }
        }

        private fun passerAuSuivant() {
            if (joueur.hasNextMediaItem()) {
                joueur.seekToNextMediaItem()
                joueur.prepare()
            } else {
                joueur.pause()
            }
        }

        /** Combien de titres restent après le titre en cours, dans l'ordre réel (aléatoire compris), jusqu'à deux. */
        private fun restants(): Int {
            val chronologie = joueur.currentTimeline
            var index = joueur.currentMediaItemIndex
            var compte = 0
            while (compte < 2) {
                index = chronologie.getNextWindowIndex(index, Player.REPEAT_MODE_OFF, joueur.shuffleModeEnabled)
                if (index == C.INDEX_UNSET) break
                compte++
            }
            return compte
        }

        /**
         * Sous deux titres restants, la suite est demandée (spécification
         * 5.6). La répétition de la file la rend inutile ; deux tours sans
         * rien de nouveau arrêtent les demandes.
         */
        private fun prolonger() {
            if (prolongementEnCours || toursVides >= 2 || joueur.mediaItemCount == 0) return
            if (joueur.repeatMode != Player.REPEAT_MODE_OFF || restants() >= 2) return
            val dernier = joueur.getMediaItemAt(joueur.mediaItemCount - 1)
            val exclus = (0 until joueur.mediaItemCount).map { joueur.getMediaItemAt(it).mediaId }.toSet() + historique
            prolongementEnCours = true
            portee.launch {
                val suite = prolongement.suite(dernier.mediaId, exclus)
                prolongementEnCours = false
                // Une autre file a été lancée pendant l'attente : cette suite ne la concerne pas.
                if (joueur.mediaItemCount == 0 || joueur.getMediaItemAt(joueur.mediaItemCount - 1).mediaId != dernier.mediaId) return@launch
                if (suite.isEmpty()) {
                    toursVides++
                    return@launch
                }
                toursVides = 0
                val premier = joueur.mediaItemCount
                val finie = joueur.playbackState == Player.STATE_ENDED
                ajoutInterne = true
                joueur.addMediaItems(suite.map { it.versElement(BuildConfig.SITE, dernier.versTitreLu().source, conteneur.reglages.qualiteEffective()) })
                ajoutInterne = false
                // La file s'était terminée avant l'arrivée de la suite : la lecture reprend dessus.
                if (finie) joueur.seekToDefaultPosition(premier)
            }
        }
    }

    /** Un refus du site ou de l'hébergeur ne s'arrange pas en réessayant : l'erreur remonte tout de suite. */
    private class PolitiqueErreurs : DefaultLoadErrorHandlingPolicy() {
        override fun getRetryDelayMsFor(loadErrorInfo: LoadErrorHandlingPolicy.LoadErrorInfo): Long {
            val definitive = loadErrorInfo.exception.chaine().any {
                it is ErreurFlux || (it is HttpDataSource.InvalidResponseCodeException && it.responseCode in 400..499)
            }
            return if (definitive) C.TIME_UNSET else super.getRetryDelayMsFor(loadErrorInfo)
        }
    }
}
