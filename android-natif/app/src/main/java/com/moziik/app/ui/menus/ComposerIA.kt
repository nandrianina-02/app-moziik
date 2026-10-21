package com.moziik.app.ui.menus

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.moziik.app.R
import com.moziik.app.donnees.catalogue.PropositionPlaylist
import com.moziik.app.donnees.catalogue.TitrePropose
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.ChampTexte
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LienTexte
import com.moziik.app.ui.composants.MessageErreur
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.Puce
import com.moziik.app.ui.composants.duree
import com.moziik.app.ui.conteneur
import com.moziik.app.ui.navigation
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** Des pistes pour commencer, comme les exemples du site. */
private val EXEMPLES = listOf("Soirée calme entre amis", "Pour courir le matin", "Louange du dimanche", "Rock malgache des années 2000")

/**
 * « Composer avec l'IA » (AiPlaylistModal.tsx, F11) : une description, une
 * proposition de 5 à 30 titres réels, relue et retouchée avant d'être
 * enregistrée. Rien n'est créé tant qu'on n'a pas validé.
 */
@Composable
fun ComposerAvecIA(onFermer: () -> Unit) {
    val c = conteneur()
    val p = LocalPalette.current
    val nav = navigation()
    val menus = LocalMenus.current
    val portee = rememberCoroutineScope()
    var demande by rememberSaveable { mutableStateOf("") }
    var enCours by remember { mutableStateOf(false) }
    var erreur by remember { mutableStateOf<String?>(null) }
    var proposition by remember { mutableStateOf<PropositionPlaylist?>(null) }
    var titre by rememberSaveable { mutableStateOf("") }
    val retenus = remember { mutableStateListOf<TitrePropose>() }
    var creation by remember { mutableStateOf(false) }

    val composer: () -> Unit = {
        if (demande.trim().length < 3) {
            erreur = "Décris en quelques mots la playlist voulue."
        } else if (!enCours) {
            enCours = true
            erreur = null
            portee.launch {
                try {
                    val resultat = c.ia.composerPlaylist(demande)
                    if (resultat == null) {
                        erreur = "Le catalogue n'a pas assez de titres pour cette demande. Essaie une autre description."
                    } else {
                        proposition = resultat
                        titre = resultat.titre
                        retenus.clear()
                        retenus.addAll(resultat.songs)
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    erreur = messageErreur(e)
                }
                enCours = false
            }
        }
    }

    Feuille(onFermer) {
        Column(Modifier.padding(horizontal = 20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icone(R.drawable.lucide_sparkles, description = null, teinte = p.accent.compose, taille = 18.dp)
                Spacer(Modifier.width(8.dp))
                Text("Composer avec l'IA", style = Texte.titreSection, color = p.encre.compose)
            }
            Spacer(Modifier.height(4.dp))
            Text("Les titres proposés viennent tous du catalogue de Moziik.", style = Texte.secondaire, color = p.encreAttenuee.compose)
        }
        val prop = proposition
        if (prop == null) {
            Column(Modifier.padding(horizontal = 20.dp, vertical = 16.dp)) {
                ChampTexte(demande, { demande = it.take(400) }, "Ta playlist idéale", R.drawable.lucide_sparkles, indication = "Une ambiance, un moment, un style…", onValider = composer)
                Spacer(Modifier.height(12.dp))
            }
            LazyRow(contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(EXEMPLES) { e -> Puce(e, false) { demande = e } }
            }
            Column(Modifier.padding(20.dp)) {
                MessageErreur(erreur, Modifier.padding(bottom = 12.dp))
                BoutonPrincipal(if (enCours) "Composition…" else "Composer", composer, enCours = enCours)
                if (enCours) {
                    Text("L'IA choisit les titres, cela peut prendre une vingtaine de secondes.", style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(top = 8.dp))
                }
            }
        } else {
            Column(Modifier.padding(horizontal = 20.dp, vertical = 12.dp)) {
                ChampTexte(titre, { titre = it.take(150) }, "Titre", R.drawable.lucide_list_music)
                if (prop.description.isNotBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(prop.description, style = Texte.corps, color = p.encreAttenuee.compose)
                }
                if (prop.remarque.isNotBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(prop.remarque, style = Texte.secondaire.copy(fontStyle = FontStyle.Italic), color = p.encreAttenuee.compose)
                }
                Spacer(Modifier.height(10.dp))
                Text("${retenus.size} titre${if (retenus.size > 1) "s" else ""}", style = Texte.surtitre, color = p.encreAttenuee.compose)
            }
            LazyColumn(Modifier.heightIn(max = 320.dp)) {
                items(retenus.toList(), key = { it.id }) { t ->
                    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Pochette(t.coverUrl, Modifier.size(40.dp), RoundedCornerShape(8.dp))
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(t.title, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(listOfNotNull(t.artiste.ifBlank { null }, t.duration?.let(::duree)).joinToString(" · "), style = Texte.secondaire, color = p.encreAttenuee.compose, maxLines = 1)
                        }
                        Box(Modifier.size(36.dp).clip(CircleShape).clickable(role = Role.Button) { retenus.remove(t) }, contentAlignment = Alignment.Center) {
                            Icone(R.drawable.lucide_x, description = "Retirer ${t.title}", teinte = p.encreAttenuee.compose, taille = 16.dp)
                        }
                    }
                }
            }
            Column(Modifier.padding(20.dp)) {
                MessageErreur(erreur, Modifier.padding(bottom = 12.dp))
                BoutonPrincipal(
                    "Créer la playlist",
                    {
                        if (titre.isBlank()) {
                            erreur = "Le titre est requis."
                        } else if (retenus.isEmpty()) {
                            erreur = "Garde au moins un titre."
                        } else if (!creation) {
                            creation = true
                            portee.launch {
                                try {
                                    val creee = c.bibliotheque.creer(titre, prop.description, false, retenus.map { it.id })
                                    c.alertes.signaler(AlerteLecture.Message("Playlist créée.", succes = true))
                                    menus.bibliothequeChangee()
                                    onFermer()
                                    nav.playlist(creee.id)
                                } catch (e: CancellationException) {
                                    throw e
                                } catch (e: Exception) {
                                    erreur = messageErreur(e)
                                }
                                creation = false
                            }
                        }
                    },
                    enCours = creation,
                    actif = retenus.isNotEmpty(),
                )
                Box(Modifier.fillMaxWidth().padding(top = 10.dp), contentAlignment = Alignment.Center) {
                    LienTexte("Recommencer") {
                        proposition = null
                        erreur = null
                    }
                }
            }
        }
    }
}

/** Vrai quand l'administration a activé cette fonction IA (aiFeatures) ; faux tant que ce n'est pas connu. */
@Composable
fun fonctionIA(nom: String): Boolean {
    val c = conteneur()
    return androidx.compose.runtime.produceState(false, nom) { value = c.ia.active(nom) }.value
}

/** La tuile « Composer avec l'IA », à côté de « Créer une playlist ». */
@Composable
fun TuileIA(modifier: Modifier, onClick: () -> Unit) {
    val p = LocalPalette.current
    Column(modifier.clickable(role = Role.Button, onClick = onClick)) {
        Box(
            Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(p.rayon.dp))
                .background(p.accent.compose.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            Icone(R.drawable.lucide_sparkles, description = null, teinte = p.accent.compose, taille = 30.dp)
        }
        Spacer(Modifier.height(8.dp))
        Text("Composer avec l'IA", style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = p.encre.compose)
    }
}
