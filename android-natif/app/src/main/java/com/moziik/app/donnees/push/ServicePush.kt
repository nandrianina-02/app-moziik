package com.moziik.app.donnees.push

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.moziik.app.MainActivity
import com.moziik.app.MoziikApplication
import com.moziik.app.R
import kotlinx.coroutines.launch

/** Canal à part : on règle les notifications du compte sans toucher à celles de la lecture ni des téléchargements. */
private const val CANAL = "moziik_notifications"

/** L'extra de l'intention qui ouvre l'app sur la page dont parle la notification. */
const val EXTRA_LIEN = "com.moziik.app.LIEN"

/**
 * Les messages push du site (lib/push.ts) : des données seules, que l'app
 * affiche elle-même, avec son canal, son icône et le lien à ouvrir.
 */
class ServicePush : FirebaseMessagingService() {
    private val conteneur get() = (application as MoziikApplication).conteneur

    override fun onNewToken(token: String) {
        conteneur.push.nouveauJeton(token)
    }

    // L'autorisation d'Android 13 est vérifiée juste avant : lint ne suit pas la vérification.
    @SuppressLint("MissingPermission")
    override fun onMessageReceived(message: RemoteMessage) {
        val donnees = message.data
        val titre = donnees["titre"].orEmpty().ifBlank { "Moziik" }
        val texte = donnees["message"].orEmpty()
        val lien = donnees["lien"].orEmpty()
        // La cloche de l'en-tête suit, si l'app est ouverte.
        conteneur.portee.launch { conteneur.notifications.actualiser() }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val gestion = getSystemService(NotificationManager::class.java)
            if (gestion?.getNotificationChannel(CANAL) == null) {
                gestion?.createNotificationChannel(NotificationChannel(CANAL, getString(R.string.canal_notifications), NotificationManager.IMPORTANCE_DEFAULT))
            }
        }
        val ouvrir = PendingIntent.getActivity(
            this,
            lien.hashCode(),
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra(EXTRA_LIEN, lien),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val avis = NotificationCompat.Builder(this, CANAL)
            .setSmallIcon(R.drawable.ic_stat_moziik)
            .setContentTitle(titre)
            .setContentText(texte)
            .setStyle(NotificationCompat.BigTextStyle().bigText(texte))
            .setContentIntent(ouvrir)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(this).notify((titre + texte + lien).hashCode(), avis)
    }
}
