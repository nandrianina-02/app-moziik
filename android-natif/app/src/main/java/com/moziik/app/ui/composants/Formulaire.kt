package com.moziik.app.ui.composants

import androidx.annotation.DrawableRes
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.moziik.app.R
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Mouvement
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose

/**
 * Les éléments des formulaires du site (components/ui/FormField.tsx et les
 * boutons des pages de connexion), redessinés en Compose : libellé au-dessus,
 * icône à gauche, bordure qui passe à l'accent quand le champ est actif.
 */

enum class Saisie { TEXTE, EMAIL, MOT_DE_PASSE, NOM }

@Composable
fun ChampTexte(
    valeur: String,
    onChange: (String) -> Unit,
    libelle: String,
    @DrawableRes icone: Int,
    modifier: Modifier = Modifier,
    saisie: Saisie = Saisie.TEXTE,
    indication: String? = null,
    actionClavier: ImeAction = ImeAction.Next,
    onValider: () -> Unit = {},
) {
    val p = LocalPalette.current
    val interactions = remember { MutableInteractionSource() }
    val actif by interactions.collectIsFocusedAsState()
    var visible by rememberSaveable { mutableStateOf(false) }
    val forme = RoundedCornerShape(p.rayon.dp)

    Column(modifier.fillMaxWidth()) {
        Text(libelle, style = Texte.corps, color = p.encreAttenuee.compose)
        Spacer(Modifier.height(6.dp))
        Row(
            Modifier
                .fillMaxWidth()
                .height(46.dp)
                .clip(forme)
                .background(p.base.compose)
                .border(BorderStroke(1.dp, if (actif) p.accent.compose else p.bordure.compose), forme)
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icone(icone, description = null, teinte = p.encreAttenuee.compose, taille = 16.dp)
            Spacer(Modifier.width(10.dp))
            Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                if (valeur.isEmpty() && indication != null) {
                    Text(indication, style = Texte.corps, color = p.encreAttenuee.compose.copy(alpha = 0.7f))
                }
                BasicTextField(
                    value = valeur,
                    onValueChange = onChange,
                    singleLine = true,
                    textStyle = Texte.corps.copy(color = p.encre.compose),
                    cursorBrush = SolidColor(p.accent.compose),
                    interactionSource = interactions,
                    visualTransformation = if (saisie == Saisie.MOT_DE_PASSE && !visible) PasswordVisualTransformation() else VisualTransformation.None,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = when (saisie) {
                            Saisie.EMAIL -> KeyboardType.Email
                            Saisie.MOT_DE_PASSE -> KeyboardType.Password
                            else -> KeyboardType.Text
                        },
                        imeAction = actionClavier,
                        autoCorrectEnabled = saisie == Saisie.TEXTE,
                    ),
                    keyboardActions = KeyboardActions(onAny = { onValider() }),
                    modifier = Modifier.fillMaxWidth().semantics { contentDescription = libelle },
                )
            }
            if (saisie == Saisie.MOT_DE_PASSE) {
                Box(
                    Modifier.size(32.dp).clip(RoundedCornerShape(50)).clickable(role = Role.Button) { visible = !visible },
                    contentAlignment = Alignment.Center,
                ) {
                    Icone(
                        if (visible) R.drawable.lucide_eye_off else R.drawable.lucide_eye,
                        description = if (visible) "Masquer le mot de passe" else "Afficher le mot de passe",
                        teinte = p.encreAttenuee.compose,
                        taille = 16.dp,
                    )
                }
            }
        }
    }
}

/** L'action principale d'un écran : fond d'accent, texte couleur du fond, comme sur le site. */
@Composable
fun BoutonPrincipal(texte: String, onClick: () -> Unit, modifier: Modifier = Modifier, enCours: Boolean = false, actif: Boolean = true) {
    val p = LocalPalette.current
    val interactions = remember { MutableInteractionSource() }
    val appuye by interactions.collectIsPressedAsState()
    // Appui : échelle 0,97 en 140 ms (classe .pressable du site).
    val echelle by animateFloatAsState(if (appuye) 0.97f else 1f, tween(Mouvement.APPUI), label = "appui")
    Box(
        modifier
            .fillMaxWidth()
            .height(46.dp)
            .graphicsLayer { scaleX = echelle; scaleY = echelle }
            .clip(RoundedCornerShape(p.rayon.dp))
            .background(p.accent.compose.copy(alpha = if (actif) 1f else 0.5f))
            .clickable(enabled = actif && !enCours, role = Role.Button, interactionSource = interactions, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (enCours) Egaliseur(hauteur = 16.dp, libelle = "$texte en cours", couleur = p.base.compose)
        else Text(texte, style = Texte.corpsFort, color = p.base.compose)
    }
}

/** « Continuer avec Google » : bordé, sur la surface, avec le logo de Google. */
@Composable
fun BoutonGoogle(onClick: () -> Unit, modifier: Modifier = Modifier, enCours: Boolean = false) {
    val p = LocalPalette.current
    val forme = RoundedCornerShape(p.rayon.dp)
    Row(
        modifier
            .fillMaxWidth()
            .height(46.dp)
            .clip(forme)
            .background(p.surface.compose)
            .border(BorderStroke(1.dp, p.bordure.compose), forme)
            .clickable(enabled = !enCours, role = Role.Button, onClick = onClick),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (enCours) {
            Egaliseur(hauteur = 16.dp, libelle = "Connexion Google en cours")
        } else {
            Image(painterResource(R.drawable.logo_google), contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Text("Continuer avec Google", style = Texte.corpsFort, color = p.encre.compose)
        }
    }
}

/** Un lien d'action dans le texte (« Mot de passe oublié ? »). */
@Composable
fun LienTexte(texte: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    Text(
        texte,
        style = Texte.corpsFort,
        color = p.accent.compose,
        modifier = modifier.clip(RoundedCornerShape(4.dp)).clickable(role = Role.Button, onClick = onClick).padding(vertical = 4.dp),
    )
}

/** Message d'erreur sous un formulaire, annoncé aux lecteurs d'écran. */
@Composable
fun MessageErreur(message: String?, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    AnimatedVisibility(
        visible = message != null,
        enter = fadeIn(tween(180)) + expandVertically(tween(180)),
        exit = fadeOut(tween(120)) + shrinkVertically(tween(120)),
        modifier = modifier,
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(p.rayon.dp))
                .background(p.danger.compose.copy(alpha = 0.1f))
                .padding(12.dp)
                .semantics { liveRegion = LiveRegionMode.Polite },
            verticalAlignment = Alignment.Top,
        ) {
            Icone(R.drawable.lucide_circle_alert, description = null, teinte = p.danger.compose, taille = 16.dp, modifier = Modifier.padding(top = 2.dp))
            Spacer(Modifier.width(8.dp))
            Text(message.orEmpty(), style = Texte.corps, color = p.danger.compose)
        }
    }
}
