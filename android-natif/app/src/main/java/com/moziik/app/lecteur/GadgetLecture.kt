package com.moziik.app.lecteur

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.os.Build
import android.view.KeyEvent
import android.view.View
import android.widget.RemoteViews
import androidx.core.graphics.drawable.toBitmap
import androidx.media3.common.Player
import coil.imageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import com.moziik.app.MainActivity
import com.moziik.app.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/** Côté de la pochette du gadget, en pixels : assez pour un écran dense, assez peu pour le transport. */
private const val COTE_POCHETTE = 320

/** Ce que montre le gadget ; null au repos, sans lecture en cours. */
private data class EtatGadget(
    val titre: String,
    val artiste: String,
    val pochette: String?,
    val enLecture: Boolean,
    val suivant: Boolean,
)

/**
 * Le gadget de l'écran d'accueil : le titre en cours et les commandes de
 * lecture. Il est mis à jour par le service de lecture ; ses boutons
 * envoient au service les mêmes touches qu'un casque, que Media3 traite
 * comme les commandes de la notification.
 */
class GadgetLecture : AppWidgetProvider() {
    override fun onUpdate(contexte: Context, gestionnaire: AppWidgetManager, ids: IntArray) {
        gestionnaire.updateAppWidget(ids, vues(contexte, etat, pochette, R.layout.gadget_lecture))
    }

    companion object {
        private var etat: EtatGadget? = null
        // L'avancement du titre, pour la barre du grand gadget (en millièmes).
        private var avancement = 0
        private var pochette: Bitmap? = null
        private var adressePochette: String? = null
        private var chargement: Job? = null

        fun actualiser(contexte: Context, joueur: Player, portee: CoroutineScope) {
            val element = joueur.currentMediaItem
            if (element == null) {
                auRepos(contexte)
                return
            }
            val m = element.mediaMetadata
            val nouveau = EtatGadget(
                titre = m.title?.toString().orEmpty(),
                artiste = m.artist?.toString().orEmpty(),
                pochette = m.artworkUri?.toString(),
                enLecture = joueur.isPlaying || (joueur.playWhenReady && joueur.playbackState == Player.STATE_BUFFERING),
                suivant = joueur.hasNextMediaItem(),
            )
            if (nouveau == etat) return
            etat = nouveau
            if (nouveau.pochette != adressePochette) {
                adressePochette = nouveau.pochette
                pochette = null
                chargement?.cancel()
                val adresse = nouveau.pochette
                if (adresse != null) {
                    chargement = portee.launch {
                        val demande = ImageRequest.Builder(contexte).data(adresse).size(COTE_POCHETTE).allowHardware(false).build()
                        val image = (contexte.imageLoader.execute(demande) as? SuccessResult)?.drawable ?: return@launch
                        // Les coins sont arrondis dans l'image : une vue de gadget ne se découpe pas avant Android 12.
                        pochette = arrondir(image.toBitmap(COTE_POCHETTE, COTE_POCHETTE), 18f)
                        publier(contexte)
                    }
                }
            }
            publier(contexte)
        }

        fun auRepos(contexte: Context) {
            chargement?.cancel()
            etat = null
            pochette = null
            adressePochette = null
            avancement = 0
            publier(contexte)
        }

        private fun publier(contexte: Context) {
            val gestionnaire = AppWidgetManager.getInstance(contexte)
            val petits = gestionnaire.getAppWidgetIds(ComponentName(contexte, GadgetLecture::class.java))
            if (petits.isNotEmpty()) gestionnaire.updateAppWidget(petits, vues(contexte, etat, pochette, R.layout.gadget_lecture))
            val grands = gestionnaire.getAppWidgetIds(ComponentName(contexte, GadgetLectureGrand::class.java))
            if (grands.isNotEmpty()) gestionnaire.updateAppWidget(grands, vues(contexte, etat, pochette, R.layout.gadget_lecture_grand))
        }

        /**
         * La barre d'avancement du grand gadget, relue toutes les quelques
         * secondes par le service pendant la lecture : une mise à jour partielle,
         * qui ne redessine ni la pochette ni les boutons.
         */
        fun progression(contexte: Context, positionMs: Long, dureeMs: Long) {
            val nouveau = if (dureeMs > 0) (positionMs * 1000 / dureeMs).toInt().coerceIn(0, 1000) else 0
            if (nouveau == avancement) return
            avancement = nouveau
            val gestionnaire = AppWidgetManager.getInstance(contexte)
            val grands = gestionnaire.getAppWidgetIds(ComponentName(contexte, GadgetLectureGrand::class.java))
            if (grands.isEmpty()) return
            val v = RemoteViews(contexte.packageName, R.layout.gadget_lecture_grand)
            v.setProgressBar(R.id.gadget_progression, 1000, avancement, false)
            gestionnaire.partiallyUpdateAppWidget(grands, v)
        }

        internal fun rafraichirGrand(contexte: Context, gestionnaire: AppWidgetManager, ids: IntArray) {
            gestionnaire.updateAppWidget(ids, vues(contexte, etat, pochette, R.layout.gadget_lecture_grand))
        }

        private fun vues(contexte: Context, etat: EtatGadget?, pochette: Bitmap?, gabarit: Int): RemoteViews {
            val v = RemoteViews(contexte.packageName, gabarit)
            if (gabarit == R.layout.gadget_lecture_grand) v.setProgressBar(R.id.gadget_progression, 1000, if (etat == null) 0 else avancement, false)
            val ouvrir = PendingIntent.getActivity(
                contexte, 0,
                Intent(contexte, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            v.setOnClickPendingIntent(R.id.gadget_racine, ouvrir)
            if (pochette != null) v.setImageViewBitmap(R.id.gadget_pochette, pochette) else v.setImageViewResource(R.id.gadget_pochette, R.drawable.gadget_pochette_vide)

            if (etat == null) {
                // Au repos, le service n'est pas là pour recevoir une touche : le bouton ouvre l'app.
                v.setTextViewText(R.id.gadget_titre, "Moziik")
                v.setTextViewText(R.id.gadget_artiste, "Touchez pour écouter")
                v.setViewVisibility(R.id.gadget_precedent, View.GONE)
                v.setViewVisibility(R.id.gadget_suivant, View.GONE)
                v.setImageViewResource(R.id.gadget_lecture, R.drawable.lucide_play_plein)
                v.setContentDescription(R.id.gadget_lecture, "Ouvrir Moziik")
                v.setOnClickPendingIntent(R.id.gadget_lecture, ouvrir)
                return v
            }
            v.setTextViewText(R.id.gadget_titre, etat.titre)
            v.setTextViewText(R.id.gadget_artiste, etat.artiste)
            v.setViewVisibility(R.id.gadget_precedent, View.VISIBLE)
            v.setViewVisibility(R.id.gadget_suivant, if (etat.suivant) View.VISIBLE else View.INVISIBLE)
            v.setImageViewResource(R.id.gadget_lecture, if (etat.enLecture) R.drawable.lucide_pause_plein else R.drawable.lucide_play_plein)
            v.setContentDescription(R.id.gadget_lecture, if (etat.enLecture) "Pause" else "Lecture")
            v.setOnClickPendingIntent(
                R.id.gadget_lecture,
                if (etat.enLecture) touche(contexte, 1, KeyEvent.KEYCODE_MEDIA_PAUSE, premierPlan = false)
                // Reprendre relance le service au premier plan, comme le bouton de la notification.
                else touche(contexte, 2, KeyEvent.KEYCODE_MEDIA_PLAY, premierPlan = true),
            )
            v.setOnClickPendingIntent(R.id.gadget_precedent, touche(contexte, 3, KeyEvent.KEYCODE_MEDIA_PREVIOUS, premierPlan = false))
            v.setOnClickPendingIntent(R.id.gadget_suivant, touche(contexte, 4, KeyEvent.KEYCODE_MEDIA_NEXT, premierPlan = false))
            return v
        }

        private fun touche(contexte: Context, code: Int, touche: Int, premierPlan: Boolean): PendingIntent {
            val intention = Intent(Intent.ACTION_MEDIA_BUTTON)
                .setComponent(ComponentName(contexte, ServiceLecture::class.java))
                .putExtra(Intent.EXTRA_KEY_EVENT, KeyEvent(KeyEvent.ACTION_DOWN, touche))
            val drapeaux = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            return if (premierPlan && Build.VERSION.SDK_INT >= 26) {
                PendingIntent.getForegroundService(contexte, code, intention, drapeaux)
            } else {
                PendingIntent.getService(contexte, code, intention, drapeaux)
            }
        }

        private fun arrondir(source: Bitmap, rayon: Float): Bitmap {
            val sortie = Bitmap.createBitmap(source.width, source.height, Bitmap.Config.ARGB_8888)
            val pinceau = Paint(Paint.ANTI_ALIAS_FLAG).apply { shader = BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP) }
            Canvas(sortie).drawRoundRect(RectF(0f, 0f, source.width.toFloat(), source.height.toFloat()), rayon, rayon, pinceau)
            return sortie
        }
    }
}

/**
 * Le grand gadget (4 × 2) : grande pochette, titre, artiste, avancement et
 * commandes. Il partage l'état et les boutons du petit (GadgetLecture).
 */
class GadgetLectureGrand : AppWidgetProvider() {
    override fun onUpdate(contexte: Context, gestionnaire: AppWidgetManager, ids: IntArray) {
        GadgetLecture.rafraichirGrand(contexte, gestionnaire, ids)
    }
}
