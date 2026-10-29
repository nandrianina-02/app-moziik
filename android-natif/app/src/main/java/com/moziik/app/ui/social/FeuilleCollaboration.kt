package com.moziik.app.ui.social

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.PlaylistDetail
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.donnees.social.EtatCollaboration
import com.moziik.app.donnees.social.Membre
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.Avatar
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.fiches.BoutonFiche
import com.moziik.app.ui.menus.Feuille
import com.moziik.app.ui.menus.Interrupteur
import com.moziik.app.ui.partager
import kotlinx.coroutines.launch

/**
 * La collaboration d'une playlist, comme sur le site
 * (FenetreCollaboration.tsx). Le propriétaire l'active, partage le lien
 * d'invitation et retire des collaborateurs ; un collaborateur voit qui
 * participe et peut se retirer. Le titre, la pochette et la visibilité
 * restent au propriétaire.
 */
@Composable
fun FeuilleCollaboration(
    playlist: PlaylistDetail,
    estProprietaire: Boolean,
    onFermer: () -> Unit,
    onChangee: () -> Unit,
    onQuittee: () -> Unit,
) {
    val c = conteneur()
    val p = LocalPalette.current
    val contexte = LocalContext.current
    val portee = rememberCoroutineScope()
    var etat by remember { mutableStateOf<EtatCollaboration?>(null) }
    var envoi by remember { mutableStateOf(false) }

    LaunchedEffect(playlist.id, estProprietaire) {
        if (!estProprietaire) return@LaunchedEffect
        runCatching { c.social.collaboration(playlist.id) }
            .onSuccess { etat = it }
            .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
    }

    fun agir(action: suspend () -> EtatCollaboration?) {
        envoi = true
        portee.launch {
            runCatching { action() }
                .onSuccess { suivant ->
                    if (suivant != null) etat = suivant
                    onChangee()
                }
                .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
            envoi = false
        }
    }

    Feuille(onFermer) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp)) {
            Text("Playlist collaborative", style = Texte.titreSection, color = p.encre.compose)
            Spacer(Modifier.height(4.dp))
            Text(
                "Les collaborateurs ajoutent, retirent et réordonnent les titres. Le titre, la pochette et la visibilité restent au propriétaire.",
                style = Texte.secondaire, color = p.encreAttenuee.compose,
            )
            Spacer(Modifier.height(16.dp))

            val e = etat
            if (estProprietaire && e == null) {
                Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) { Egaliseur(hauteur = 18.dp) }
                return@Column
            }
            if (estProprietaire && e != null) {
                Interrupteur(e.collaborative, "Collaboration") { actif -> agir { c.social.reglerCollaboration(playlist.id, actif) } }
                Text(
                    if (e.collaborative) "Activée : les collaborateurs peuvent modifier les titres." else "Suspendue : personne d'autre que toi ne modifie la playlist.",
                    style = Texte.secondaire, color = p.encreAttenuee.compose,
                )
                val jeton = e.jeton
                if (e.collaborative && jeton != null) {
                    Spacer(Modifier.height(16.dp))
                    HorizontalDivider(color = p.bordure.compose)
                    Spacer(Modifier.height(16.dp))
                    Text("Lien d'invitation", style = Texte.corpsFort, color = p.encre.compose)
                    Text(
                        "Qui l'ouvre, connecté, devient collaborateur.",
                        style = Texte.secondaire, color = p.encreAttenuee.compose,
                    )
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        BoutonFiche(
                            R.drawable.lucide_share_2, "Inviter",
                            onClick = { partager(contexte, "playlist/${playlist.id}/rejoindre?jeton=$jeton", "Rejoins la playlist « ${playlist.title} »") },
                            principal = true,
                        )
                        BoutonFiche(
                            R.drawable.lucide_rotate_ccw, "Nouveau lien",
                            onClick = { agir { c.social.renouvelerLien(playlist.id) } },
                            chargement = envoi,
                            description = "Renouveler le lien : l'ancien ne fonctionnera plus",
                        )
                    }
                }
                Spacer(Modifier.height(16.dp))
                HorizontalDivider(color = p.bordure.compose)
                Spacer(Modifier.height(16.dp))
            }

            Text("Collaborateurs", style = Texte.corpsFort, color = p.encre.compose)
            Spacer(Modifier.height(8.dp))
            val membres = e?.collaborateurs ?: playlist.collaborateurs
            if (membres.isEmpty()) {
                Text("Personne pour l'instant. Partage le lien d'invitation.", style = Texte.secondaire, color = p.encreAttenuee.compose)
            }
            membres.forEach { m ->
                LigneCollaborateur(m, retirer = if (estProprietaire) ({ agir { c.social.retirerCollaborateur(playlist.id, m.id) } }) else null)
            }

            if (!estProprietaire) {
                Spacer(Modifier.height(16.dp))
                BoutonFiche(
                    R.drawable.lucide_log_out, "Ne plus participer",
                    onClick = {
                        envoi = true
                        portee.launch {
                            runCatching { c.social.quitter(playlist.id) }
                                .onSuccess {
                                    c.alertes.signaler(AlerteLecture.Message("Tu ne participes plus à « ${playlist.title} ».", succes = true))
                                    onQuittee()
                                }
                                .onFailure { c.alertes.signaler(AlerteLecture.Message(messageErreur(it))) }
                            envoi = false
                        }
                    },
                    chargement = envoi,
                )
            }
        }
    }
}

@Composable
private fun LigneCollaborateur(m: Membre, retirer: (() -> Unit)?) {
    val p = LocalPalette.current
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Avatar(m.name, m.avatarUrl, taille = 36.dp)
        Spacer(Modifier.width(12.dp))
        Text(m.name, style = Texte.corps, color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        if (retirer != null) {
            Box(
                Modifier.size(36.dp).clip(CircleShape).clickable(role = Role.Button, onClickLabel = "Retirer ${m.name}", onClick = retirer),
                contentAlignment = Alignment.Center,
            ) {
                Icone(R.drawable.lucide_user_minus, description = "Retirer ${m.name}", teinte = p.encreAttenuee.compose, taille = 17.dp)
            }
        }
    }
}
