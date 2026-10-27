package com.moziik.app.ui.fiches

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.moziik.app.R
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.Egaliseur
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.Pochette
import com.moziik.app.ui.composants.pressable
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.moziik.app.ui.composants.LogoMoziik
import com.moziik.app.ui.composants.SqueletteFiche

sealed interface EtatFiche<out T> {
    data object Chargement : EtatFiche<Nothing>
    data class Erreur(val message: String) : EtatFiche<Nothing>
    data class Prete<T>(val donnees: T) : EtatFiche<T>
}

/** Le chargement d'une fiche, gardé d'une rotation à l'autre. */
class ModeleFiche<T>(private val charger: suspend () -> T) : ViewModel() {
    private val _etat = MutableStateFlow<EtatFiche<T>>(EtatFiche.Chargement)
    val etat: StateFlow<EtatFiche<T>> = _etat.asStateFlow()

    init {
        recharger()
    }

    fun recharger() {
        _etat.value = EtatFiche.Chargement
        viewModelScope.launch {
            _etat.value = try {
                EtatFiche.Prete(charger())
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                EtatFiche.Erreur(messageErreur(e))
            }
        }
    }
}

/** Retour : la fiche se superpose à la liste d'où elle vient, l'en-tête de l'app ne porte pas de flèche. */
@Composable
fun BarreRetour(onRetour: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier
            .padding(start = 8.dp, top = 4.dp)
            .clip(CircleShape)
            .clickable(role = Role.Button, onClick = onRetour)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icone(R.drawable.lucide_arrow_left, description = null, teinte = p.encreAttenuee.compose, taille = 18.dp)
        Spacer(Modifier.width(6.dp))
        Text("Retour", style = Texte.corps, color = p.encreAttenuee.compose)
    }
}

/** Chargement, erreur avec nouvel essai, ou le contenu. */
@Composable
fun <T> ContenuFiche(etat: EtatFiche<T>, onReessayer: () -> Unit, contenu: @Composable (T) -> Unit) {
    val p = LocalPalette.current
    when (etat) {
        EtatFiche.Chargement -> SqueletteFiche()
        is EtatFiche.Erreur -> Column(
            Modifier.fillMaxSize().padding(32.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icone(R.drawable.lucide_circle_alert, description = null, teinte = p.encreAttenuee.compose, taille = 32.dp)
            Spacer(Modifier.height(12.dp))
            Text(etat.message, style = Texte.corps, color = p.encreAttenuee.compose, textAlign = TextAlign.Center)
            Spacer(Modifier.height(20.dp))
            BoutonPrincipal("Réessayer", onReessayer, Modifier.width(180.dp))
        }
        is EtatFiche.Prete -> contenu(etat.donnees)
    }
}

/**
 * L'en-tête commun des fiches (AlbumHero.tsx, ArtistHero, PlaylistHero) :
 * bannière voilée vers la surface, pochette posée à cheval, type, titre,
 * ligne secondaire, pastilles d'informations, puis les actions.
 */
@Composable
fun EnTeteFiche(
    pochette: String?,
    banniere: String?,
    type: String,
    titre: String,
    modifier: Modifier = Modifier,
    forme: Shape = RoundedCornerShape(LocalPalette.current.rayon.dp),
    sousTitre: (@Composable () -> Unit)? = null,
    pastilles: List<String> = emptyList(),
    actions: @Composable RowScope.() -> Unit = {},
) {
    val p = LocalPalette.current
    val surface = p.base.compose
    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        // La pochette chevauche le bas de la bannière : posées dans la même boîte, sans décalage
        // qui laisserait un vide sous elles.
        Box(Modifier.fillMaxWidth()) {
            Box(Modifier.fillMaxWidth().height(150.dp)) {
                if (banniere != null) {
                    Pochette(banniere, Modifier.fillMaxSize(), RoundedCornerShape(0.dp))
                    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.25f)))
                } else {
                    Box(Modifier.fillMaxSize().background(p.surface.compose))
                }
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.4f to Color.Transparent, 1f to surface)))
            }
            Box(
                Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 74.dp)
                    .size(152.dp)
                    .clip(forme)
                    .background(surface)
                    .padding(4.dp),
            ) {
                Pochette(pochette, Modifier.fillMaxSize(), forme)
            }
        }
        Column(
            Modifier.padding(start = 24.dp, end = 24.dp, top = 14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                type,
                style = Texte.secondaire.copy(fontWeight = FontWeight.Medium),
                color = p.accent.compose,
                modifier = Modifier.clip(CircleShape).background(p.accent.compose.copy(alpha = 0.15f)).padding(horizontal = 10.dp, vertical = 4.dp),
            )
            Spacer(Modifier.height(10.dp))
            Text(titre, style = Texte.titreFiche, color = p.encre.compose, textAlign = TextAlign.Center, maxLines = 3, overflow = TextOverflow.Ellipsis)
            if (sousTitre != null) {
                Spacer(Modifier.height(6.dp))
                sousTitre()
            }
            if (pastilles.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    pastilles.forEach { Pastille(it) }
                }
            }
            Spacer(Modifier.height(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically, content = actions)
        }
    }
}

@Composable
fun Pastille(texte: String) {
    val p = LocalPalette.current
    Text(
        texte,
        style = Texte.secondaire,
        color = p.encreAttenuee.compose,
        maxLines = 1,
        modifier = Modifier.clip(CircleShape).border(BorderStroke(1.dp, p.bordure.compose), CircleShape).padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

/**
 * Une action de fiche. La principale (Tout écouter) porte l'accent ;
 * les autres sont bordées, et leur état actif (Ajouté, Abonné) passe à
 * l'accent sans changer de forme.
 */
@Composable
fun BoutonFiche(
    icone: Int,
    libelle: String?,
    onClick: () -> Unit,
    principal: Boolean = false,
    actif: Boolean = false,
    chargement: Boolean = false,
    description: String? = libelle,
) {
    val p = LocalPalette.current
    val forme = RoundedCornerShape(12.dp)
    val fond = if (principal) p.accent.compose else Color.Transparent
    val encre = when {
        principal -> p.base.compose
        actif -> p.accent.compose
        else -> p.encreAttenuee.compose
    }
    Row(
        Modifier
            .height(42.dp)
            .clip(forme)
            .background(fond)
            .then(if (principal) Modifier else Modifier.border(BorderStroke(1.dp, if (actif) p.accent.compose else p.bordure.compose), forme))
            .pressable(onClick = onClick)
            .padding(horizontal = if (libelle == null) 11.dp else 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (chargement) {
            Egaliseur(hauteur = 14.dp, libelle = "Chargement", couleur = encre)
        } else {
            Icone(icone, description = if (libelle == null) description else null, teinte = encre, taille = 17.dp)
        }
        if (libelle != null) {
            Spacer(Modifier.width(8.dp))
            Text(libelle, style = Texte.corps.copy(fontWeight = FontWeight.Medium), color = encre)
        }
    }
}

/** Une section de fiche : un titre et son contenu, séparés du bloc précédent par un filet. */
@Composable
fun SectionFiche(titre: String, modifier: Modifier = Modifier, contenu: @Composable () -> Unit) {
    val p = LocalPalette.current
    Column(modifier.fillMaxWidth().padding(top = 28.dp)) {
        Text(titre, style = Texte.titreSection, color = p.encre.compose, modifier = Modifier.padding(horizontal = 16.dp))
        Spacer(Modifier.height(12.dp))
        contenu()
    }
}

/** Le lien vers l'artiste d'une fiche, avec son badge vérifié. */
@Composable
fun LienArtiste(nom: String?, verifie: Boolean, onClick: (() -> Unit)?) {
    val p = LocalPalette.current
    Row(
        Modifier.clip(RoundedCornerShape(6.dp)).then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier).padding(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(nom ?: "Artiste supprimé", style = Texte.corps, color = p.encreAttenuee.compose)
        if (verifie) {
            Spacer(Modifier.width(4.dp))
            Icone(R.drawable.lucide_badge_check, description = "Artiste vérifié", teinte = p.verifie.compose, taille = 14.dp)
        }
    }
}

/** « 2024 » depuis une date ISO, ou null. */
fun annee(iso: String?): String? = iso?.take(4)?.takeIf { it.length == 4 && it.all(Char::isDigit) }

/** « 42 min » ou « 1 h 05 » : la durée totale d'une liste de titres. */
fun dureeTotale(secondes: Double): String {
    val minutes = (secondes / 60).toInt()
    return if (minutes < 60) "$minutes min" else "${minutes / 60} h ${(minutes % 60).toString().padStart(2, '0')}"
}

/** Accord simple : « 1 titre », « 12 titres ». */
fun nombre(n: Int, mot: String): String = "$n $mot${if (n > 1) "s" else ""}"
