package com.moziik.app.ui

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.core.content.FileProvider
import androidx.core.content.res.ResourcesCompat
import androidx.core.graphics.drawable.toBitmap
import coil.imageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import com.moziik.app.BuildConfig
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.reseau.adresseMedia
import com.moziik.app.ui.composants.RAPPORT_LOGO
import com.moziik.app.ui.composants.logoEntier
import com.moziik.app.ui.composants.teinteDePochette
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** Format portrait 4:5 : celui que les stories et les fils d'actualité affichent sans recadrer. */
private const val LARGEUR = 1080
private const val HAUTEUR = 1350
private const val MARGE = 96f

/**
 * Coupe `texte` en au plus `max` lignes de `largeur` au plus, mot à mot ;
 * la dernière ligne finit par « … » si le texte ne tient pas.
 */
fun couperEnLignes(texte: String, max: Int, largeur: Float, mesure: (String) -> Float): List<String> {
    val mots = texte.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    val lignes = ArrayList<String>()
    var courante = ""
    var i = 0
    while (i < mots.size && lignes.size < max) {
        val essai = if (courante.isEmpty()) mots[i] else "$courante ${mots[i]}"
        if (mesure(essai) <= largeur || courante.isEmpty()) {
            courante = essai
            i++
        } else {
            lignes += courante
            courante = ""
        }
    }
    if (courante.isNotEmpty() && lignes.size < max) lignes += courante
    val reste = i < mots.size
    if (lignes.isNotEmpty() && (reste || mesure(lignes.last()) > largeur)) {
        var derniere = lignes.last()
        while (derniere.isNotEmpty() && mesure("$derniere…") > largeur) derniere = derniere.dropLast(1)
        lignes[lignes.lastIndex] = derniere.trimEnd() + "…"
    }
    return lignes
}

/**
 * Partage d'un titre en image : pochette, titre, artiste et logo sur la
 * teinte de la pochette, avec le lien en texte d'accompagnement. Une image
 * se poste en story là où un lien seul passe inaperçu.
 */
suspend fun partagerEnImage(contexte: Context, titre: Titre, accent: Color) {
    val adresse = adresseMedia(titre.coverUrl, BuildConfig.SITE)
    val pochette = adresse?.let {
        val demande = ImageRequest.Builder(contexte).data(it).size(LARGEUR).allowHardware(false).build()
        (contexte.imageLoader.execute(demande) as? SuccessResult)?.drawable?.toBitmap()
    }
    val fichier = withContext(Dispatchers.Default) {
        val image = dessinerCarte(contexte, titre, pochette, accent)
        withContext(Dispatchers.IO) {
            val dossier = File(contexte.cacheDir, "partage").apply { mkdirs() }
            // Un seul fichier gardé : les cartes précédentes ne s'accumulent pas dans le cache.
            dossier.listFiles()?.forEach { it.delete() }
            File(dossier, "moziik-${titre.id}.png").also { f -> f.outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) } }
        }
    }
    val uri = FileProvider.getUriForFile(contexte, "${contexte.packageName}.partage", fichier)
    val lien = "${titre.title}\n${BuildConfig.SITE}son/${titre.id}"
    val envoi = Intent(Intent.ACTION_SEND)
        .setType("image/png")
        .putExtra(Intent.EXTRA_STREAM, uri)
        .putExtra(Intent.EXTRA_TEXT, lien)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    // Sans ClipData, certaines applications ne reçoivent pas le droit de lecture sur l'image.
    envoi.clipData = ClipData.newRawUri(null, uri)
    runCatching { contexte.startActivity(Intent.createChooser(envoi, "Partager").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

private fun police(contexte: Context, id: Int, graisse: Int): Typeface {
    val base = runCatching { ResourcesCompat.getFont(contexte, id) }.getOrNull() ?: Typeface.DEFAULT
    return if (Build.VERSION.SDK_INT >= 28) Typeface.create(base, graisse, false) else Typeface.create(base, if (graisse >= 600) Typeface.BOLD else Typeface.NORMAL)
}

private fun dessinerCarte(contexte: Context, titre: Titre, pochette: Bitmap?, accent: Color): Bitmap {
    val image = Bitmap.createBitmap(LARGEUR, HAUTEUR, Bitmap.Config.ARGB_8888)
    val toile = Canvas(image)

    // Le fond : la teinte de la pochette, sombre et unie, comme le lecteur plein écran.
    val fond = pochette?.let {
        val petite = Bitmap.createScaledBitmap(it, 24, 24, true)
        val pixels = IntArray(24 * 24)
        petite.getPixels(pixels, 0, 24, 0, 0, 24, 24)
        teinteDePochette(pixels)
    } ?: 0xFF1A1A1E.toInt()
    toile.drawColor(fond)

    // La pochette, carrée, recadrée au centre.
    val cote = LARGEUR - 2 * MARGE
    val cadre = RectF(MARGE, MARGE, MARGE + cote, MARGE + cote)
    val rayon = 28f
    if (pochette != null) {
        val echelle = maxOf(cote / pochette.width, cote / pochette.height)
        val matrice = Matrix().apply {
            setScale(echelle, echelle)
            postTranslate(MARGE + (cote - pochette.width * echelle) / 2f, MARGE + (cote - pochette.height * echelle) / 2f)
        }
        val pinceau = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
            shader = BitmapShader(pochette, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply { setLocalMatrix(matrice) }
        }
        toile.drawRoundRect(cadre, rayon, rayon, pinceau)
    } else {
        toile.drawRoundRect(cadre, rayon, rayon, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x22FFFFFF })
    }

    val largeurTexte = LARGEUR - 2 * MARGE
    val nom = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        textSize = 64f
        typeface = police(contexte, R.font.sora, 600)
    }
    val artiste = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xB3FFFFFF.toInt()
        textSize = 40f
        typeface = police(contexte, R.font.plus_jakarta_sans, 500)
    }
    var y = cadre.bottom + 64f + nom.textSize * 0.8f
    couperEnLignes(titre.title, 2, largeurTexte) { nom.measureText(it) }.forEach { ligne ->
        toile.drawText(ligne, MARGE, y, nom)
        y += nom.textSize * 1.12f
    }
    y += 4f
    val nomArtiste = titre.artist?.stageName ?: "Artiste inconnu"
    couperEnLignes(nomArtiste, 1, largeurTexte) { artiste.measureText(it) }.firstOrNull()?.let { toile.drawText(it, MARGE, y, artiste) }

    // Le pied : un filet net, le logo à gauche, l'invitation à droite.
    val pied = HAUTEUR - MARGE
    toile.drawLine(MARGE, pied - 72f, LARGEUR - MARGE, pied - 72f, Paint().apply { color = 0x33FFFFFF; strokeWidth = 2f })
    val hauteurLogo = 44f
    val logo = ImageBitmap((hauteurLogo * RAPPORT_LOGO).toInt(), hauteurLogo.toInt())
    CanvasDrawScope().draw(Density(1f), LayoutDirection.Ltr, androidx.compose.ui.graphics.Canvas(logo), Size(logo.width.toFloat(), logo.height.toFloat())) {
        logoEntier(Color.White, accent)
    }
    toile.drawBitmap(logo.asAndroidBitmap(), MARGE, pied - hauteurLogo, Paint(Paint.FILTER_BITMAP_FLAG))
    val invitation = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xB3FFFFFF.toInt()
        textSize = 30f
        typeface = police(contexte, R.font.plus_jakarta_sans, 500)
        textAlign = Paint.Align.RIGHT
    }
    toile.drawText("Écouter sur Moziik", LARGEUR - MARGE, pied - 10f, invitation)
    return image
}
