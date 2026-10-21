package com.moziik.app.ui.composants

import android.util.LruCache
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.core.graphics.drawable.toBitmap
import coil.imageLoader
import coil.request.CachePolicy
import coil.request.ImageRequest
import coil.request.SuccessResult
import com.moziik.app.BuildConfig
import com.moziik.app.donnees.reseau.adresseMedia
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Côté de l'image réduite analysée : la teinte d'ensemble suffit, pas le détail. */
private const val COTE = 24

private val cache = LruCache<String, Int>(400)

/**
 * La teinte de la pochette `adresse`, calculée une fois par image et
 * gardée en mémoire ; null le temps de la lire, ou sans image.
 */
@Composable
fun rememberTeintePochette(adresse: String?): Color? {
    val contexte = LocalContext.current
    val complete = remember(adresse) { adresseMedia(adresse, BuildConfig.SITE) }
    var teinte by remember(complete) { mutableStateOf(complete?.let { cache.get(it) }?.let { Color(it) }) }
    LaunchedEffect(complete) {
        if (complete == null || teinte != null) return@LaunchedEffect
        val demande = ImageRequest.Builder(contexte)
            .data(complete)
            .size(COTE)
            // Une image matérielle ne se lit pas pixel par pixel.
            .allowHardware(false)
            // La teinte est gardée ici ; la petite image n'a rien à faire dans le cache des pochettes.
            .memoryCachePolicy(CachePolicy.DISABLED)
            .build()
        val image = (contexte.imageLoader.execute(demande) as? SuccessResult)?.drawable ?: return@LaunchedEffect
        val valeur = withContext(Dispatchers.Default) {
            val bitmap = image.toBitmap(COTE, COTE)
            val pixels = IntArray(COTE * COTE)
            bitmap.getPixels(pixels, 0, COTE, 0, 0, COTE, COTE)
            teinteDePochette(pixels)
        }
        cache.put(complete, valeur)
        teinte = Color(valeur)
    }
    return teinte
}
