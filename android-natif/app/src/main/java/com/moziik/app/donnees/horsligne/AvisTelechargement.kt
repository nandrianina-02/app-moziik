package com.moziik.app.donnees.horsligne

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.moziik.app.MainActivity
import com.moziik.app.R

/** Canal à part de celui de la lecture : on peut couper l'un sans l'autre dans les réglages d'Android. */
private const val CANAL = "moziik_telechargements"

/**
 * La notification de fin de téléchargement (spécification 6.5), seulement
 * quand l'app n'est pas à l'écran : au premier plan, le bandeau de l'app
 * suffit. Sans l'autorisation d'Android 13, rien n'est affiché, sans
 * erreur.
 */
class AvisTelechargement(private val contexte: Context) {
    /** Tenu par l'activité (onStart, onStop) : vrai quand l'app est à l'écran. */
    @Volatile var premierPlan = false

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

    // L'autorisation est vérifiée juste au-dessus par autorise() : lint ne suit pas la vérification à travers cette fonction.
    @SuppressLint("MissingPermission")
    fun termine(texte: String) {
        if (premierPlan || !autorise()) return
        canal()
        val ouvrir = PendingIntent.getActivity(
            contexte,
            1,
            Intent(contexte, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val avis = NotificationCompat.Builder(contexte, CANAL)
            .setSmallIcon(R.drawable.ic_stat_moziik)
            .setContentTitle("Téléchargement terminé")
            .setContentText(texte)
            .setStyle(NotificationCompat.BigTextStyle().bigText(texte))
            .setContentIntent(ouvrir)
            .setAutoCancel(true)
            .build()
        // Un seul avis à la fois : le dernier terminé remplace le précédent plutôt que d'empiler.
        runCatching { NotificationManagerCompat.from(contexte).notify(CANAL.hashCode(), avis) }
    }
}
