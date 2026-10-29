package com.moziik.app.donnees.compte

import android.Manifest
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
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.moziik.app.BuildConfig
import com.moziik.app.MainActivity
import com.moziik.app.MoziikApplication
import com.moziik.app.R
import com.moziik.app.donnees.push.EXTRA_LIEN
import com.moziik.app.ui.LIEN_MISE_A_JOUR
import java.util.Locale
import java.util.concurrent.TimeUnit

private const val CANAL = "moziik_mises_a_jour"
private const val TRAVAIL = "verification-mise-a-jour"
private const val NOTIFICATION = 4_201

/**
 * Prévenir d'une nouvelle version même quand l'app reste fermée. Tant
 * qu'elle n'est pas sur le Play Store, rien d'autre ne le ferait : la
 * fenêtre de la coquille ne s'affiche qu'à l'ouverture.
 *
 * Deux fois par jour, réseau disponible, la même recherche que la
 * coquille (MiseAJour.disponible). Une version n'est annoncée qu'une fois,
 * et pas du tout si on l'a écartée par « Plus tard ».
 */
class VerificationMiseAJour(contexte: Context, parametres: WorkerParameters) : CoroutineWorker(contexte, parametres) {
    override suspend fun doWork(): Result {
        val conteneur = (applicationContext as MoziikApplication).conteneur
        val version = runCatching { conteneur.miseAJour.disponible() }.getOrNull() ?: return Result.success()
        if (conteneur.miseAJour.dejaAnnoncee(version.version)) return Result.success()
        if (annoncer(applicationContext, version)) conteneur.miseAJour.annoncee(version.version)
        return Result.success()
    }

    companion object {
        /** Programmé à chaque lancement ; KEEP garde la cadence déjà en place. Seule la version publiée est concernée. */
        fun programmer(contexte: Context) {
            if (BuildConfig.APPLICATION_ID != "com.moziik.app") return
            val requete = PeriodicWorkRequestBuilder<VerificationMiseAJour>(12, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(contexte).enqueueUniquePeriodicWork(TRAVAIL, ExistingPeriodicWorkPolicy.KEEP, requete)
        }
    }
}

/** Faux si Android refuse les notifications (Android 13 sans autorisation) : on retentera plus tard. */
private fun annoncer(contexte: Context, v: VersionDisponible): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        ContextCompat.checkSelfPermission(contexte, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
        return false
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val gestion = contexte.getSystemService(NotificationManager::class.java)
        if (gestion?.getNotificationChannel(CANAL) == null) {
            gestion?.createNotificationChannel(
                NotificationChannel(CANAL, contexte.getString(R.string.canal_mises_a_jour), NotificationManager.IMPORTANCE_DEFAULT),
            )
        }
    }
    // Toucher la notification ouvre l'app sur la fenêtre de mise à jour, qui lance le téléchargement.
    val ouvrir = PendingIntent.getActivity(
        contexte,
        NOTIFICATION,
        Intent(contexte, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra(EXTRA_LIEN, LIEN_MISE_A_JOUR),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val taille = v.tailleMo?.let { " (" + String.format(Locale.FRANCE, "%.1f", it) + " Mo)" }.orEmpty()
    val texte = "La version ${v.version}$taille est prête. Elle s'installe par-dessus l'actuelle : ton compte et tes téléchargements sont gardés."
    val avis = NotificationCompat.Builder(contexte, CANAL)
        .setSmallIcon(R.drawable.ic_stat_moziik)
        .setContentTitle("Nouvelle version de Moziik")
        .setContentText(texte)
        .setStyle(NotificationCompat.BigTextStyle().bigText(texte))
        .setContentIntent(ouvrir)
        .setAutoCancel(true)
        .build()
    NotificationManagerCompat.from(contexte).notify(NOTIFICATION, avis)
    return true
}
