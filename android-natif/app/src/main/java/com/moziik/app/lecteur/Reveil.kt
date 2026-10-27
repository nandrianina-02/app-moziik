package com.moziik.app.lecteur

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import com.moziik.app.MainActivity
import com.moziik.app.MoziikApplication
import java.util.Calendar

/** L'action qui demande au service de lecture de lancer le réveil. */
const val ACTION_REVEIL = "com.moziik.app.REVEIL"

/** Le volume monte sur une minute : on se réveille en douceur, pas en sursaut. */
const val MONTEE_REVEIL_MS = 60_000L

/**
 * Le prochain réveil après `maintenant` : à `minutes` (depuis minuit) un des
 * `jours` (1 = lundi … 7 = dimanche) ; tous les jours si l'ensemble est vide.
 * Null si l'heure est hors bornes.
 */
fun prochainReveil(maintenant: Long, minutes: Int, jours: Set<Int>): Long? {
    if (minutes !in 0 until 24 * 60) return null
    val c = Calendar.getInstance().apply {
        timeInMillis = maintenant
        set(Calendar.HOUR_OF_DAY, minutes / 60)
        set(Calendar.MINUTE, minutes % 60)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }
    repeat(8) {
        if (c.timeInMillis > maintenant && (jours.isEmpty() || jourDe(c) in jours)) return c.timeInMillis
        c.add(Calendar.DAY_OF_MONTH, 1)
    }
    return null
}

/** Le jour de la semaine d'une date, lundi = 1 … dimanche = 7. */
fun jourDe(c: Calendar): Int = (c.get(Calendar.DAY_OF_WEEK) + 5) % 7 + 1

/**
 * La planification du réveil auprès d'Android. setAlarmClock : le réveil
 * sonne à l'heure même en économie d'énergie, s'affiche dans la barre
 * d'état, et autorise le service de lecture à démarrer depuis l'arrière-plan.
 */
object PlanificateurReveil {
    private fun intention(contexte: Context) = PendingIntent.getBroadcast(
        contexte, 7001, Intent(contexte, ReceveurReveil::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    /** Faux si Android refuse les alarmes exactes : l'écran du réveil propose alors l'autorisation. */
    fun autorise(contexte: Context): Boolean {
        val alarmes = contexte.getSystemService(AlarmManager::class.java) ?: return false
        return Build.VERSION.SDK_INT < 31 || alarmes.canScheduleExactAlarms()
    }

    fun replanifier(contexte: Context) {
        val c = (contexte.applicationContext as MoziikApplication).conteneur
        val alarmes = contexte.getSystemService(AlarmManager::class.java) ?: return
        alarmes.cancel(intention(contexte))
        if (!c.reglages.reveilActif.value || !autorise(contexte)) return
        val quand = prochainReveil(System.currentTimeMillis(), c.reglages.reveilMinutes.value, c.reglages.reveilJours.value) ?: return
        val montrer = PendingIntent.getActivity(contexte, 7002, Intent(contexte, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        runCatching { alarmes.setAlarmClock(AlarmManager.AlarmClockInfo(quand, montrer), intention(contexte)) }
    }
}

/** L'heure du réveil : la musique part, et le réveil suivant est planifié. */
class ReceveurReveil : BroadcastReceiver() {
    override fun onReceive(contexte: Context, intent: Intent) {
        runCatching {
            ContextCompat.startForegroundService(contexte, Intent(contexte, ServiceLecture::class.java).setAction(ACTION_REVEIL))
        }
        PlanificateurReveil.replanifier(contexte)
    }
}

/** Après un redémarrage du téléphone ou une mise à jour de l'app, Android a oublié l'alarme : on la repose. */
class ReceveurDemarrage : BroadcastReceiver() {
    override fun onReceive(contexte: Context, intent: Intent) {
        PlanificateurReveil.replanifier(contexte)
    }
}
