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
import com.moziik.app.donnees.compte.Bilan
import com.moziik.app.donnees.compte.dureeLisible
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
    val pochette = chargerImage(contexte, titre.coverUrl)
    val image = withContext(Dispatchers.Default) { dessinerCarte(contexte, titre, pochette, accent) }
    envoyer(contexte, image, "moziik-${titre.id}.png", "${titre.title}\n${BuildConfig.SITE}son/${titre.id}")
}

/**
 * Le bilan de l'année en image, au même format que la carte d'un titre :
 * l'année, le temps d'écoute, le titre de l'année avec sa pochette, les
 * trois artistes et le genre préférés.
 */
suspend fun partagerBilanEnImage(contexte: Context, bilan: Bilan, resume: String, accent: Color) {
    val pochette = chargerImage(contexte, bilan.topTitres.firstOrNull()?.coverUrl)
    val image = withContext(Dispatchers.Default) { dessinerBilan(contexte, bilan, pochette, accent) }
    envoyer(contexte, image, "moziik-bilan-${bilan.annee}.png", "$resume\n${BuildConfig.SITE}")
}

private suspend fun chargerImage(contexte: Context, adresse: String?): Bitmap? {
    val complete = adresseMedia(adresse, BuildConfig.SITE) ?: return null
    val demande = ImageRequest.Builder(contexte).data(complete).size(LARGEUR).allowHardware(false).build()
    return (contexte.imageLoader.execute(demande) as? SuccessResult)?.drawable?.toBitmap()
}

private suspend fun envoyer(contexte: Context, image: Bitmap, nom: String, lien: String) {
    val fichier = withContext(Dispatchers.IO) {
        val dossier = File(contexte.cacheDir, "partage").apply { mkdirs() }
        // Un seul fichier gardé : les cartes précédentes ne s'accumulent pas dans le cache.
        dossier.listFiles()?.forEach { it.delete() }
        File(dossier, nom).also { f -> f.outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) } }
    }
    val uri = FileProvider.getUriForFile(contexte, "${contexte.packageName}.partage", fichier)
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
    toile.drawColor(fondDe(pochette))

    // La pochette, carrée, recadrée au centre.
    val cote = LARGEUR - 2 * MARGE
    val cadre = RectF(MARGE, MARGE, MARGE + cote, MARGE + cote)
    dessinerPochette(toile, pochette, cadre, 28f)

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

    dessinerPied(contexte, toile, accent)
    return image
}

private fun fondDe(pochette: Bitmap?): Int = pochette?.let {
    val petite = Bitmap.createScaledBitmap(it, 24, 24, true)
    val pixels = IntArray(24 * 24)
    petite.getPixels(pixels, 0, 24, 0, 0, 24, 24)
    teinteDePochette(pixels)
} ?: 0xFF1A1A1E.toInt()

private fun dessinerPochette(toile: Canvas, pochette: Bitmap?, cadre: RectF, rayon: Float) {
    if (pochette == null) {
        toile.drawRoundRect(cadre, rayon, rayon, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x22FFFFFF })
        return
    }
    val echelle = maxOf(cadre.width() / pochette.width, cadre.height() / pochette.height)
    val matrice = Matrix().apply {
        setScale(echelle, echelle)
        postTranslate(cadre.left + (cadre.width() - pochette.width * echelle) / 2f, cadre.top + (cadre.height() - pochette.height * echelle) / 2f)
    }
    val pinceau = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
        shader = BitmapShader(pochette, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply { setLocalMatrix(matrice) }
    }
    toile.drawRoundRect(cadre, rayon, rayon, pinceau)
}

private const val BLANC_ATTENUE = 0xB3FFFFFF.toInt()

private fun texte(contexte: Context, taille: Float, fonte: Int, graisse: Int, couleur: Int = android.graphics.Color.WHITE) =
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = couleur
        textSize = taille
        typeface = police(contexte, fonte, graisse)
    }

private fun dessinerBilan(contexte: Context, b: Bilan, pochette: Bitmap?, accent: Color): Bitmap {
    val image = Bitmap.createBitmap(LARGEUR, HAUTEUR, Bitmap.Config.ARGB_8888)
    val toile = Canvas(image)
    toile.drawColor(fondDe(pochette))
    val largeur = LARGEUR - 2 * MARGE
    val (duree, unite) = dureeLisible(b.minutes)
    val nombres = java.text.NumberFormat.getIntegerInstance(java.util.Locale.FRANCE)

    val surtitre = texte(contexte, 30f, R.font.plus_jakarta_sans, 600, BLANC_ATTENUE).apply { letterSpacing = 0.18f }
    var y = MARGE + 30f
    toile.drawText("MON ANNÉE MOZIIK", MARGE, y, surtitre)
    y += 150f
    toile.drawText("${b.annee}", MARGE - 6f, y, texte(contexte, 150f, R.font.sora, 700))

    y += 90f
    toile.drawText("${nombres.format(duree)} $unite d'écoute", MARGE, y, texte(contexte, 56f, R.font.sora, 600))
    y += 52f
    toile.drawText(
        "${nombres.format(b.titresDifferents)} titres · ${nombres.format(b.artistesDifferents)} artistes · ${nombres.format(b.joursActifs)} jours",
        MARGE, y, texte(contexte, 34f, R.font.plus_jakarta_sans, 500, BLANC_ATTENUE),
    )

    // Le titre de l'année : sa pochette, son nom, son artiste.
    b.topTitres.firstOrNull()?.let { t ->
        y += 76f
        toile.drawText("MON TITRE DE L'ANNÉE", MARGE, y, surtitre)
        y += 26f
        val cote = 280f
        val cadre = RectF(MARGE, y, MARGE + cote, y + cote)
        dessinerPochette(toile, pochette, cadre, 22f)
        val x = cadre.right + 40f
        val nom = texte(contexte, 50f, R.font.sora, 600)
        var yt = y + 60f
        couperEnLignes(t.title, 2, LARGEUR - MARGE - x) { nom.measureText(it) }.forEach {
            toile.drawText(it, x, yt, nom)
            yt += 60f
        }
        val secondaire = texte(contexte, 34f, R.font.plus_jakarta_sans, 500, BLANC_ATTENUE)
        t.artist?.stageName?.let { a ->
            couperEnLignes(a, 1, LARGEUR - MARGE - x) { secondaire.measureText(it) }.firstOrNull()?.let { toile.drawText(it, x, yt, secondaire) }
        }
        toile.drawText("${nombres.format(t.ecoutes)} écoutes", x, yt + 50f, secondaire)
        y += cote
    }

    // Les trois artistes, puis le genre en tête.
    if (b.topArtistes.isNotEmpty()) {
        y += 70f
        toile.drawText("MES ARTISTES", MARGE, y, surtitre)
        val rang = texte(contexte, 40f, R.font.sora, 600, BLANC_ATTENUE)
        val artiste = texte(contexte, 40f, R.font.sora, 600)
        b.topArtistes.take(3).forEachIndexed { i, a ->
            y += 56f
            toile.drawText("${i + 1}", MARGE, y, rang)
            couperEnLignes(a.stageName, 1, largeur - 60f) { artiste.measureText(it) }.firstOrNull()?.let { toile.drawText(it, MARGE + 60f, y, artiste) }
        }
    }
    b.topGenres.firstOrNull()?.let { g ->
        y += 64f
        val etiquette = texte(contexte, 34f, R.font.plus_jakarta_sans, 500, BLANC_ATTENUE)
        val debut = "Mon genre : "
        toile.drawText(debut, MARGE, y, etiquette)
        toile.drawText(g.genre, MARGE + etiquette.measureText(debut), y, texte(contexte, 34f, R.font.plus_jakarta_sans, 700))
    }

    dessinerPied(contexte, toile, accent)
    return image
}

/** Le pied commun des cartes : un filet net, le logo à gauche, l'invitation à droite. */
private fun dessinerPied(contexte: Context, toile: Canvas, accent: Color) {
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
}
