package com.moziik.app.ui

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import androidx.core.content.ContextCompat
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import com.moziik.app.MainActivity
import com.moziik.app.R
import com.moziik.app.donnees.push.EXTRA_LIEN

/** Les liens internes des raccourcis : lus par la coquille comme un lien du site. */
const val LIEN_RECHERCHE = "app:recherche"
const val LIEN_BANDE_SON = "app:bande-son"
const val LIEN_TELECHARGEMENTS = "app:telechargements"
/** La notification « Nouvelle version » (VerificationMiseAJour) : rouvre la fenêtre de mise à jour. */
const val LIEN_MISE_A_JOUR = "app:mise-a-jour"

/**
 * Les raccourcis de l'icône de l'app (appui long sur l'icône) : rechercher,
 * lancer sa bande son, ouvrir ses téléchargements. Publiés à chaque
 * lancement : Android les garde, et une mise à jour de l'app les rafraîchit.
 */
fun publierRaccourcis(contexte: Context) {
    val raccourcis = listOf(
        Triple(LIEN_RECHERCHE, "Rechercher", R.drawable.lucide_search),
        Triple(LIEN_BANDE_SON, "Ma bande son", R.drawable.lucide_radio),
        Triple(LIEN_TELECHARGEMENTS, "Téléchargements", R.drawable.lucide_download),
    ).mapIndexed { rang, (lien, libelle, icone) ->
        ShortcutInfoCompat.Builder(contexte, lien.removePrefix("app:"))
            .setShortLabel(libelle)
            .setRank(rang)
            .setIcon(IconCompat.createWithAdaptiveBitmap(iconeAdaptative(contexte, icone)))
            .setIntent(
                Intent(contexte, MainActivity::class.java)
                    .setAction(Intent.ACTION_VIEW)
                    .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    .putExtra(EXTRA_LIEN, lien),
            )
            .build()
    }
    runCatching { ShortcutManagerCompat.setDynamicShortcuts(contexte, raccourcis) }
}

/** Le pictogramme Lucide en blanc sur l'accent, dans la zone sûre d'une icône adaptative (72 sur 108). */
private fun iconeAdaptative(contexte: Context, icone: Int): Bitmap {
    val cote = 216
    val image = Bitmap.createBitmap(cote, cote, Bitmap.Config.ARGB_8888)
    val toile = Canvas(image)
    // Le fond de l'icône de l'app : les raccourcis lui ressemblent, quel que soit le thème choisi.
    toile.drawColor(ContextCompat.getColor(contexte, R.color.icone_fond))
    val dessin = ContextCompat.getDrawable(contexte, icone)?.mutate() ?: return image
    dessin.colorFilter = PorterDuffColorFilter(android.graphics.Color.WHITE, PorterDuff.Mode.SRC_IN)
    val taille = 64
    val debut = (cote - taille) / 2
    dessin.setBounds(debut, debut, debut + taille, debut + taille)
    dessin.draw(toile)
    return image
}
