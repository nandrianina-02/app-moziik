package com.moziik.app.donnees.horsligne

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.moziik.app.MainActivity
import com.moziik.app.R

/** Canal à part de celui de la lecture : on peut couper l'un sans l'autre dans les réglages d'Android. */
private const val CANAL = "moziik_telechargements"
private const val ID_PROGRESSION = 4101
private const val ID_FIN = 4102
/** Android limite la cadence des mises à jour d'une notification : une par demi-seconde suffit à l'œil. */
private const val INTERVALLE_MS = 500L

/**
 * Les notifications des téléchargements (spécification 6.5) : la
 * progression pendant qu'ils tournent (titre, nombre restant, barre), puis
 * « Téléchargement terminé ». Affichées que l'app soit à l'écran ou non,
 * à la demande de l'utilisateur ; le bandeau de l'app s'y ajoute. Sans
 * l'autorisation d'Android 13, rien n'est affiché, sans erreur.
 */
class AvisTelechargement(private val contexte: Context) {
    /** Tenu par l'activité (onStart, onStop) : vrai quand l'app est à l'écran. */
    @Volatile var premierPlan = false

    private var titreEnCours: String? = null
    private var restants = 0
    private var derniereMaj = 0L

    fun autorise(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(contexte, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun canal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val gestion = contexte.getSystemService(NotificationManager::class.java) ?: return
        if (gestion.getNotificationChannel(CANAL) != null) return
        gestion.createNotificationChannel(
            NotificationChannel(CANAL, contexte.getString(R.string.canal_telechargements), NotificationManager.IMPORTANCE_LOW),
        )
    }

    private fun ouvrirApp() = PendingIntent.getActivity(
        contexte,
        1,
        Intent(contexte, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    // L'autorisation est vérifiée par autorise() avant chaque envoi : lint ne suit pas la vérification à travers cette fonction.
    @SuppressLint("MissingPermission")
    private fun publier(id: Int, avis: Notification) {
        if (!autorise()) return
        canal()
        runCatching { NotificationManagerCompat.from(contexte).notify(id, avis) }
    }

    /** Un titre commence : « Téléchargement en cours », avec le nombre de titres qui restent après lui. */
    fun commence(titre: String, restantsApres: Int) {
        titreEnCours = titre
        restants = restantsApres
        derniereMaj = 0L
        progression(null)
    }

    /** L'avancement du titre en cours (0 à 1), à cadence limitée ; null : indéterminé. */
    fun progression(avancement: Float?) {
        val titre = titreEnCours ?: return
        val maintenant = SystemClock.elapsedRealtime()
        if (avancement != null && avancement < 1f && maintenant - derniereMaj < INTERVALLE_MS) return
        derniereMaj = maintenant
        val pourcent = avancement?.let { (it * 100).toInt().coerceIn(0, 100) }
        val suite = when (restants) {
            0 -> null
            1 -> "Encore 1 titre après celui-ci"
            else -> "Encore $restants titres après celui-ci"
        }
        val avis = NotificationCompat.Builder(contexte, CANAL)
            .setSmallIcon(R.drawable.ic_stat_moziik)
            .setContentTitle("Téléchargement en cours")
            .setContentText(titre)
            .setSubText(suite)
            .setProgress(100, pourcent ?: 0, pourcent == null)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setContentIntent(ouvrirApp())
            .build()
        publier(ID_PROGRESSION, avis)
    }

    /** Plus rien ne tourne (file vide, ou en attente du réseau) : la progression disparaît. */
    fun arrete(raison: String? = null) {
        titreEnCours = null
        if (raison == null) {
            runCatching { NotificationManagerCompat.from(contexte).cancel(ID_PROGRESSION) }
            return
        }
        val avis = NotificationCompat.Builder(contexte, CANAL)
            .setSmallIcon(R.drawable.ic_stat_moziik)
            .setContentTitle("Téléchargements en attente")
            .setContentText(raison)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setContentIntent(ouvrirApp())
            .build()
        publier(ID_PROGRESSION, avis)
    }

    fun termine(texte: String) {
        val avis = NotificationCompat.Builder(contexte, CANAL)
            .setSmallIcon(R.drawable.ic_stat_moziik)
            .setContentTitle("Téléchargement terminé")
            .setContentText(texte)
            .setStyle(NotificationCompat.BigTextStyle().bigText(texte))
            .setContentIntent(ouvrirApp())
            .setAutoCancel(true)
            .build()
        // Un seul avis de fin : le dernier terminé remplace le précédent plutôt que d'empiler.
        publier(ID_FIN, avis)
    }
}
