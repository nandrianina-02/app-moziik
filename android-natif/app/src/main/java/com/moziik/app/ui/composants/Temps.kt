package com.moziik.app.ui.composants

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Une date ISO 8601 du site (`2026-10-21T10:29:21.376Z`), ou null si illisible. */
fun instantIso(iso: String?): Date? = iso?.let {
    runCatching {
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.parse(it.take(19))
    }.getOrNull()
}

private fun memeJour(a: Calendar, b: Calendar) = a.get(Calendar.YEAR) == b.get(Calendar.YEAR) && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR)

/** « 14:32 » aujourd'hui, « Hier », le jour de la semaine cette semaine, sinon « 12/10 ». */
fun dateCourte(iso: String?, maintenant: Date = Date()): String {
    val date = instantIso(iso) ?: return ""
    val c = Calendar.getInstance().apply { time = date }
    val n = Calendar.getInstance().apply { time = maintenant }
    val hier = Calendar.getInstance().apply { time = maintenant; add(Calendar.DAY_OF_YEAR, -1) }
    return when {
        memeJour(c, n) -> SimpleDateFormat("HH:mm", Locale.FRANCE).format(date)
        memeJour(c, hier) -> "Hier"
        maintenant.time - date.time < 6 * 864e5 -> SimpleDateFormat("EEE", Locale.FRANCE).format(date).trimEnd('.')
        else -> SimpleDateFormat("dd/MM", Locale.FRANCE).format(date)
    }
}

fun heure(iso: String?): String = instantIso(iso)?.let { SimpleDateFormat("HH:mm", Locale.FRANCE).format(it) }.orEmpty()

/** « En ligne » sous deux minutes d'activité, sinon depuis quand (H4). */
fun presence(vuLe: String?, maintenant: Long = System.currentTimeMillis()): String? {
    val date = instantIso(vuLe) ?: return null
    val minutes = (maintenant - date.time) / 60_000
    return when {
        minutes < 2 -> "En ligne"
        minutes < 60 -> "Vu il y a $minutes min"
        minutes < 24 * 60 -> "Vu il y a ${minutes / 60} h"
        else -> "Vu il y a ${minutes / (24 * 60)} j"
    }
}

/** La photo d'un membre, ou son initiale sur un rond teinté d'accent (AvatarMembre.tsx). */
@Composable
fun Avatar(nom: String, photo: String?, modifier: Modifier = Modifier, taille: Dp = 44.dp) {
    val p = LocalPalette.current
    if (photo != null) {
        Pochette(photo, modifier.size(taille), CircleShape)
    } else {
        Box(modifier.size(taille).clip(CircleShape).background(p.accent.compose.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) {
            Text(
                nom.trim().take(1).uppercase().ifEmpty { "?" },
                style = Texte.corps.copy(fontWeight = FontWeight.SemiBold, fontSize = (taille.value * 0.38f).sp),
                color = p.accent.compose,
            )
        }
    }
}
