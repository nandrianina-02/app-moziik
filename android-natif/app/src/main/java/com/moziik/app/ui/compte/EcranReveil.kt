package com.moziik.app.ui.compte

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TimePickerDefaults
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.moziik.app.R
import com.moziik.app.lecteur.PlanificateurReveil
import com.moziik.app.lecteur.prochainReveil
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.menus.Interrupteur
import java.text.SimpleDateFormat
import java.util.Locale

private val JOURS = listOf(1 to "L", 2 to "M", 3 to "M", 4 to "J", 5 to "V", 6 to "S", 7 to "D")
private val NOMS_JOURS = listOf("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")
private val SOURCES = listOf(
    Triple("bande-son", "Ma bande son", "La sélection du moment, renouvelée chaque matin"),
    Triple("aimes", "Mes titres aimés", "Dans le désordre"),
    Triple("telechargements", "Mes téléchargements", "Sans réseau : sonne même en mode avion"),
)

/**
 * Le réveil musical : une heure, des jours, une musique. Le volume monte sur
 * une minute ; sans réseau, ce sont les titres téléchargés qui jouent.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EcranReveil(onRetour: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val contexte = LocalContext.current
    val actif by c.reglages.reveilActif.collectAsStateWithLifecycle()
    val minutes by c.reglages.reveilMinutes.collectAsStateWithLifecycle()
    val jours by c.reglages.reveilJours.collectAsStateWithLifecycle()
    val source by c.reglages.reveilSource.collectAsStateWithLifecycle()
    var choixHeure by remember { mutableStateOf(false) }
    var autorise by remember { mutableStateOf(PlanificateurReveil.autorise(contexte)) }
    // L'autorisation se donne dans les réglages d'Android : relue au retour dans l'app.
    val cycle = LocalLifecycleOwner.current
    LaunchedEffect(cycle) {
        cycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            autorise = PlanificateurReveil.autorise(contexte)
            PlanificateurReveil.replanifier(contexte)
        }
    }
    val enregistrer: (Boolean, Int, Set<Int>, String) -> Unit = { a, m, j, s ->
        c.reglages.choisirReveil(a, m, j, s)
        PlanificateurReveil.replanifier(contexte)
    }

    PageReglage("Réveil musical", onRetour) {
        Box(Modifier.padding(vertical = 4.dp)) {
            Interrupteur(actif, "Me réveiller en musique") { enregistrer(it, minutes, jours, source) }
        }
        Text(
            "%02d:%02d".format(minutes / 60, minutes % 60),
            style = Texte.titreFiche.copy(fontSize = 56.sp, lineHeight = 60.sp),
            color = if (actif) p.encre.compose else p.encreAttenuee.compose,
            modifier = Modifier.padding(top = 12.dp).clip(RoundedCornerShape(12.dp)).clickable(role = Role.Button, onClickLabel = "Changer l'heure") { choixHeure = true }.padding(horizontal = 4.dp),
        )
        val prochain = if (actif) prochainReveil(System.currentTimeMillis(), minutes, jours) else null
        Text(
            prochain?.let { "Prochain réveil : " + SimpleDateFormat("EEEE d MMMM 'à' HH:mm", Locale.FRANCE).format(it) } ?: "Réveil désactivé",
            style = Texte.secondaire, color = p.encreAttenuee.compose,
        )

        Text("JOURS", style = Texte.surtitre, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 24.dp, bottom = 8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            JOURS.forEach { (j, initiale) ->
                val choisi = j in jours
                Box(
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .border(BorderStroke(1.dp, if (choisi) p.accent.compose else p.bordure.compose), CircleShape)
                        .background(if (choisi) p.accent.compose.copy(alpha = 0.14f) else p.surface.compose)
                        .clickable(role = Role.Checkbox, onClickLabel = NOMS_JOURS[j - 1]) {
                            enregistrer(actif, minutes, if (choisi) jours - j else jours + j, source)
                        }
                        .semantics { selected = choisi },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(initiale, style = Texte.corps.copy(fontWeight = FontWeight.SemiBold), color = if (choisi) p.accent.compose else p.encreAttenuee.compose)
                }
            }
        }
        Text(
            if (jours.isEmpty()) "Aucun jour coché : le réveil sonne tous les jours." else "",
            style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 6.dp),
        )

        Text("MUSIQUE", style = Texte.surtitre, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 18.dp, bottom = 8.dp))
        SOURCES.forEach { (cle, titre, detail) ->
            val choisie = cle == source
            val forme = RoundedCornerShape(p.rayon.dp)
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
                    .clip(forme)
                    .border(BorderStroke(1.dp, if (choisie) p.accent.compose else p.bordure.compose), forme)
                    .background(if (choisie) p.accent.compose.copy(alpha = 0.06f) else p.surface.compose)
                    .clickable(role = Role.RadioButton) { enregistrer(actif, minutes, jours, cle) }
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                androidx.compose.foundation.layout.Column(Modifier.weight(1f)) {
                    Text(titre, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose)
                    Text(detail, style = Texte.secondaire, color = p.encreAttenuee.compose)
                }
                if (choisie) Icone(R.drawable.lucide_check, description = "Choisie", teinte = p.accent.compose, taille = 18.dp)
            }
        }
        Text(
            "Le volume monte doucement sur une minute. Sans réseau, ce sont vos titres téléchargés qui jouent.",
            style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 4.dp),
        )

        if (actif && !autorise && Build.VERSION.SDK_INT >= 31) {
            Spacer(Modifier.height(16.dp))
            Text(
                "Android doit autoriser Moziik à sonner à l'heure exacte.",
                style = Texte.corps, color = p.alerte.compose,
            )
            Text(
                "Autoriser",
                style = Texte.corps.copy(fontWeight = FontWeight.SemiBold),
                color = p.accent.compose,
                modifier = Modifier.padding(top = 6.dp).clip(CircleShape).clickable(role = Role.Button) {
                    runCatching {
                        contexte.startActivity(
                            Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${contexte.packageName}"))
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                        )
                    }
                }.padding(vertical = 6.dp),
            )
        }
    }

    if (choixHeure) {
        val etat = rememberTimePickerState(minutes / 60, minutes % 60, is24Hour = true)
        AlertDialog(
            onDismissRequest = { choixHeure = false },
            containerColor = p.surface.compose,
            confirmButton = {
                TextButton(onClick = {
                    enregistrer(true, etat.hour * 60 + etat.minute, jours, source)
                    choixHeure = false
                }) { Text("Valider", color = p.accent.compose) }
            },
            dismissButton = { TextButton(onClick = { choixHeure = false }) { Text("Annuler", color = p.encreAttenuee.compose) } },
            text = {
                TimePicker(
                    state = etat,
                    colors = TimePickerDefaults.colors(
                        selectorColor = p.accent.compose,
                        timeSelectorSelectedContainerColor = p.accent.compose.copy(alpha = 0.18f),
                        timeSelectorSelectedContentColor = p.accent.compose,
                        clockDialColor = p.base.compose,
                    ),
                )
            },
        )
    }
}
