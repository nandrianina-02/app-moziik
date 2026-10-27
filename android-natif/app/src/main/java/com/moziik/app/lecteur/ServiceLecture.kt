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
import androidx.media3.datasource.DefaultDataSource
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.HttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy
import androidx.media3.exoplayer.upstream.LoadErrorHandlingPolicy
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaLibraryService.LibraryParams
import androidx.media3.session.MediaLibraryService.MediaLibrarySession
import androidx.media3.session.SessionError
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.SettableFuture
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.moziik.app.BuildConfig
import com.moziik.app.MainActivity
import com.moziik.app.MoziikApplication
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.Ecoute
import com.moziik.app.donnees.horsligne.EcouteGardee
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.donnees.session.appel
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import java.io.IOException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest

/** Canal de la notification de lecture, repris de l'app Capacitor : les réglages de l'utilisateur sur ce canal sont gardés. */
private const val CANAL = "moziik_lecture"
/** L'écoute qui fait changer d'univers : assez pour être voulue, assez peu pour suivre l'auditeur. */
private const val DELAI_UNIVERS_MS = 30_000L
/** Durée du fondu de fin de la minuterie de veille. */
private const val FONDU_MS = 8_000L
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
class ServiceLecture : MediaLibraryService() {
    private var session: MediaLibrarySession? = null
    private lateinit var arborescence: ArborescenceAuto
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
        prolongement = Prolongement(c.reseau.api, c.catalogue::univers, c.catalogue::mode) { ModeSuite.de(c.reglages.suite.value) }
        arborescence = ArborescenceAuto(c, BuildConfig.SITE)

        // Le réseau : /api/stream résolu en adresse du fichier, puis lu par OkHttp.
        val reseau = ResolvingDataSource.Factory(OkHttpDataSource.Factory(c.reseau.clientPublic)) { spec ->
            resolution.resoudre(spec.uri.toString())?.let { spec.withUri(Uri.parse(it)) } ?: spec
        }
        // Devant le réseau, le cache d'écoute : sa clé est l'adresse /api/stream (titre et qualité),
        // pas l'adresse signée qui change à chaque résolution. Un réécoute ne retélécharge rien.
        val avecCache = CacheDataSource.Factory()
            .setCache(c.cacheLecture.cache)
            .setUpstreamDataSourceFactory(reseau)
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
        // Un visiteur passe toujours par le site : son quota d'écoutes se compte à la résolution (5.2).
        val distant = DataSource.Factory {
            if (c.session.etat.value is EtatSession.Anonyme) reseau.createDataSource() else avecCache.createDataSource()
        }
        // Un titre téléchargé se lit depuis le téléphone, sans passer par le site ni par le cache (spécification 6.2) :
        // DefaultDataSource lit les fichiers locaux et confie le reste au réseau.
        val sources = DefaultDataSource.Factory(this, distant)
        val fichiers = ResolvingDataSource.Factory(sources) { spec ->
            val local = idDuFlux(spec.uri.toString(), BuildConfig.SITE)?.let { c.horsLigne.telechargements.fichier(it) }
            if (local != null) spec.withUri(Uri.fromFile(local)) else spec
        }
        val joueur = ExoPlayer.Builder(this)
            .setMediaSourceFactory(DefaultMediaSourceFactory(fichiers).setLoadErrorHandlingPolicy(PolitiqueErreurs()))
            // Démarrage rapide : la lecture part dès une seconde en mémoire (deux après une coupure),
            // et le tampon monte jusqu'à une minute, ce qui couvre aussi le début du titre suivant.
            .setLoadControl(
                DefaultLoadControl.Builder()
                    .setBufferDurationsMs(20_000, 60_000, 1_000, 2_000)
                    .setPrioritizeTimeOverSizeThresholds(true)
                    .build(),
            )
            // Les déplacements de la notification et du casque : 10 s en arrière, 15 s en avant.
            .setSeekBackIncrementMs(10_000)
            .setSeekForwardIncrementMs(15_000)
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
        session = MediaLibrarySession.Builder(this, joueur, Rappels())
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
        portee.launch {
            c.session.etat.drop(1).collect {
                resolution.oublier()
                if (it is EtatSession.Anonyme) withContext(Dispatchers.IO) { c.cacheLecture.vider() }
            }
        }

        // Minuterie de veille à heure fixe : le son baisse sur les 8 dernières secondes, puis la lecture s'arrête.
        portee.launch {
            c.veille.veille.collectLatest { v ->
                if (v !is Veille.A) return@collectLatest
                val j = session?.player ?: return@collectLatest
                try {
                    delay((v.finMs - System.currentTimeMillis() - FONDU_MS).coerceAtLeast(0))
                    val pas = 16
                    repeat(pas) { i ->
                        j.volume = 1f - (i + 1).toFloat() / pas
                        delay(FONDU_MS / pas)
                    }
                    j.pause()
                    c.veille.annuler()
                } finally {
                    // Annulée en plein fondu, ou terminée : le volume revient pour la prochaine écoute.
                    j.volume = 1f
                }
            }
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? = session

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
        GadgetLecture.auRepos(this)
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
        val c = conteneur
        val secondes = minOf(ecoute.secondes, ECOUTE_MAX_SECONDES).toDouble()
        c.horsLigne.telechargements.marquerEcoute(ecoute.id)
        // Portée de l'app : la déclaration part même si le service s'arrête juste après.
        c.portee.launch {
            val echec = appel { c.reseau.api.ecoute(ecoute.id, Ecoute(secondes, ecoute.complete)) }.exceptionOrNull()
            // Sans réseau, l'écoute est gardée et déclarée au retour de la connexion (6.4).
            if (echec is IOException) c.horsLigne.ecoutes.garder(EcouteGardee(ecoute.id, secondes, ecoute.complete))
        }
    }

    /**
     * Les éléments envoyés par l'écran, Android Auto ou un casque arrivent
     * sans adresse : on la repose ici, toujours /api/stream. Android Auto
     * n'envoie parfois que l'identifiant : les métadonnées viennent alors
     * de la liste qu'on lui a servie.
     */
    private fun complet(element: MediaItem): MediaItem {
        val base = if (element.mediaMetadata.title == null) arborescence.element(element.mediaId) ?: element else element
        return base.buildUpon().setUri(adresseFlux(BuildConfig.SITE, base.mediaId, conteneur.reglages.qualiteEffective())).build()
    }

    private inner class Rappels : MediaLibrarySession.Callback {
        override fun onAddMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: MutableList<MediaItem>,
        ): ListenableFuture<MutableList<MediaItem>> = Futures.immediateFuture(mediaItems.map(::complet).toMutableList())

        override fun onSetMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: MutableList<MediaItem>,
            startIndex: Int,
            startPositionMs: Long,
        ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
            // Android Auto envoie le seul titre touché : on joue toute sa liste à partir de lui, comme dans l'app.
            val seul = mediaItems.singleOrNull()
            val liste = if (seul != null && controller.packageName != packageName) arborescence.listeDe(seul.mediaId) else null
            val resultat = if (liste != null) {
                MediaSession.MediaItemsWithStartPosition(liste.first.map(::complet), liste.second, C.TIME_UNSET)
            } else {
                MediaSession.MediaItemsWithStartPosition(mediaItems.map(::complet), startIndex, startPositionMs)
            }
            return Futures.immediateFuture(resultat)
        }

        /** Lecture demandée sans file (casque Bluetooth, voiture, gadget) : la dernière file reprend. */
        override fun onPlaybackResumption(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
        ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> =
            repriseSauvegardee(this@ServiceLecture, BuildConfig.SITE)?.let { Futures.immediateFuture(it) }
                ?: Futures.immediateFailedFuture(UnsupportedOperationException("Aucune file à reprendre"))

        override fun onGetLibraryRoot(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<MediaItem>> = Futures.immediateFuture(LibraryResult.ofItem(arborescence.racine, params))

        override fun onGetItem(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            mediaId: String,
        ): ListenableFuture<LibraryResult<MediaItem>> = Futures.immediateFuture(
            arborescence.element(mediaId)?.let { LibraryResult.ofItem(it, null) } ?: LibraryResult.ofError(SessionError.ERROR_BAD_VALUE),
        )

        override fun onGetChildren(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            parentId: String,
            page: Int,
            pageSize: Int,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
            val futur = SettableFuture.create<LibraryResult<ImmutableList<MediaItem>>>()
            portee.launch {
                val resultat = runCatching { arborescence.enfants(parentId) }.fold(
                    { LibraryResult.ofItemList(paginer(it, page, pageSize), params) },
                    // Sans réseau, une liste du site ne vient pas : Android Auto l'annonce, les téléchargements restent.
                    { LibraryResult.ofError(SessionError.ERROR_IO) },
                )
                futur.set(resultat)
            }
            return futur
        }
    }

    private inner class Ecouteur(private val joueur: ExoPlayer) : Player.Listener {
        private var bascule: kotlinx.coroutines.Job? = null

        override fun onEvents(player: Player, events: Player.Events) {
            if (events.containsAny(Player.EVENT_MEDIA_ITEM_TRANSITION, Player.EVENT_IS_PLAYING_CHANGED, Player.EVENT_MEDIA_METADATA_CHANGED, Player.EVENT_TIMELINE_CHANGED)) {
                GadgetLecture.actualiser(this@ServiceLecture, joueur, portee)
            }
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            suivreUnivers(mediaItem)
            // « Fin du titre » : le titre suivant ne démarre pas.
            if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO && conteneur.veille.veille.value == Veille.FinDuTitre) {
                joueur.pause()
                conteneur.veille.annuler()
            }
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

        /**
         * L'univers suit l'écoute : un titre évangélique écouté pour de bon
         * (30 s, toujours en cours) fait passer l'accueil, la radio et les
         * suites en évangélique, et inversement. Un titre lancé puis passé
         * aussitôt ne change rien.
         */
        private fun suivreUnivers(element: MediaItem?) {
            bascule?.cancel()
            val cible = element?.univers() ?: return
            val c = conteneur
            if (!c.reglages.universSuitEcoute.value) return
            bascule = portee.launch {
                delay(DELAI_UNIVERS_MS)
                if (joueur.currentMediaItem?.mediaId != element.mediaId || joueur.currentPosition < DELAI_UNIVERS_MS * 2 / 3) return@launch
                val actuel = c.catalogue.univers() ?: return@launch
                if (actuel == cible) return@launch
                c.catalogue.changerUnivers(cible)
                c.alertes.signaler(
                    AlerteLecture.Message(
                        if (cible == "christian") "Univers évangélique : l'accueil et la radio suivent votre écoute."
                        else "Univers général : l'accueil et la radio suivent votre écoute.",
                        succes = true,
                    ),
                )
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
