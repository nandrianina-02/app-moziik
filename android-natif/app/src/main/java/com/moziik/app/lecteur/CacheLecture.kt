package com.moziik.app.lecteur

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import java.io.File

/** Place réservée aux titres récemment écoutés : une quinzaine d'heures en qualité normale. */
private const val TAILLE_CACHE = 400L * 1024 * 1024

/**
 * Le cache d'écoute : les morceaux lus récemment restent sur le téléphone,
 * et les réécouter (revenir en arrière, relancer un album) ne retélécharge
 * rien. Les plus anciens sont effacés quand la place manque. Ce n'est pas
 * l'écoute hors connexion (spécification 6) : le système peut le vider, et
 * rien n'y est gardé volontairement.
 *
 * Une seule instance par dossier : Media3 refuse deux caches sur le même.
 */
@OptIn(UnstableApi::class)
class CacheLecture(contexte: Context) {
    val cache: SimpleCache = SimpleCache(
        File(contexte.cacheDir, "lecture"),
        LeastRecentlyUsedCacheEvictor(TAILLE_CACHE),
        StandaloneDatabaseProvider(contexte),
    )

    /** À la déconnexion : la qualité servie dépendait du compte, et l'écoute d'un compte ne passe pas au suivant. */
    fun vider() {
        cache.keys.toList().forEach { runCatching { cache.removeResource(it) } }
    }
}
