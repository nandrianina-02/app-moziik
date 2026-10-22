package com.moziik.app.donnees.envoi

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.IOException
import kotlin.math.max

/** Une photo prête à partir : JPEG réduit, et ses dimensions pour l'afficher sans saut. */
class ImagePreparee(val octets: ByteArray, val largeur: Int, val hauteur: Int)

/**
 * Réduit une photo choisie dans la galerie avant l'envoi : une photo de
 * téléphone pèse plusieurs mégaoctets pour un affichage de quelques
 * centaines de pixels, et chaque octet envoyé traverse le stockage.
 * Le plus grand côté est ramené à `cote` ; le résultat est un JPEG.
 */
suspend fun preparerImage(contexte: Context, uri: Uri, cote: Int): ImagePreparee = withContext(Dispatchers.IO) {
    val source = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        // ImageDecoder applique l'orientation de la prise de vue et réduit au décodage.
        ImageDecoder.decodeBitmap(ImageDecoder.createSource(contexte.contentResolver, uri)) { decodeur, info, _ ->
            val plusGrand = max(info.size.width, info.size.height)
            if (plusGrand > cote) {
                val f = cote.toFloat() / plusGrand
                decodeur.setTargetSize((info.size.width * f).toInt().coerceAtLeast(1), (info.size.height * f).toInt().coerceAtLeast(1))
            }
            decodeur.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        }
    } else {
        val bornes = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        contexte.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bornes) }
        var echantillon = 1
        while (max(bornes.outWidth, bornes.outHeight) / (echantillon * 2) >= cote) echantillon *= 2
        val brute = contexte.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = echantillon })
        } ?: throw IOException("Image illisible.")
        val plusGrand = max(brute.width, brute.height)
        if (plusGrand > cote) {
            val f = cote.toFloat() / plusGrand
            Bitmap.createScaledBitmap(brute, (brute.width * f).toInt().coerceAtLeast(1), (brute.height * f).toInt().coerceAtLeast(1), true)
        } else {
            brute
        }
    }
    val sortie = ByteArrayOutputStream()
    source.compress(Bitmap.CompressFormat.JPEG, 85, sortie)
    ImagePreparee(sortie.toByteArray(), source.width, source.height)
}
