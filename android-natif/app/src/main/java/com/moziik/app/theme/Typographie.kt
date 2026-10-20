@file:OptIn(ExperimentalTextApi::class)

package com.moziik.app.theme

import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.moziik.app.R

/**
 * Les polices du site (app/layout.tsx) : Sora pour les titres, Plus Jakarta
 * Sans pour le texte. Fichiers variables embarqués (licence OFL) : la graisse
 * se règle sur Android 8 et plus ; avant, la graisse par défaut du fichier.
 */
private fun variable(fichier: Int, graisse: FontWeight) =
    Font(fichier, graisse, variationSettings = FontVariation.Settings(FontVariation.weight(graisse.weight)))

val Sora = FontFamily(
    variable(R.font.sora, FontWeight.Normal),
    variable(R.font.sora, FontWeight.Medium),
    variable(R.font.sora, FontWeight.SemiBold),
    variable(R.font.sora, FontWeight.Bold),
)

val Jakarta = FontFamily(
    variable(R.font.plus_jakarta_sans, FontWeight.Normal),
    variable(R.font.plus_jakarta_sans, FontWeight.Medium),
    variable(R.font.plus_jakarta_sans, FontWeight.SemiBold),
    variable(R.font.plus_jakarta_sans, FontWeight.Bold),
)

/** Les tailles relevées sur le site, nommées par usage plutôt que par rang. */
object Texte {
    /** Titre d'en-tête d'accueil, héros de fiche. */
    val titreFiche = TextStyle(fontFamily = Sora, fontWeight = FontWeight.SemiBold, fontSize = 24.sp, lineHeight = 30.sp)
    /** Titre du lecteur plein écran. */
    val titreLecteur = TextStyle(fontFamily = Sora, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 26.sp)
    /** En-tête de section, feuille modale. */
    val titreSection = TextStyle(fontFamily = Sora, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 24.sp)
    /** Nom du site dans l'en-tête, titre de confirmation. */
    val marque = TextStyle(fontFamily = Sora, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp)
    val corps = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 20.sp)
    val corpsFort = corps.copy(fontWeight = FontWeight.SemiBold)
    val secondaire = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 16.sp)
    /** Libellés de la barre du bas. */
    val navigation = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 14.sp)
    /** Surtitres en majuscules (« EN COURS DE LECTURE »). */
    val surtitre = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight.SemiBold, fontSize = 10.sp, letterSpacing = 0.18.em)
    /** Pastilles de compteur. */
    val pastille = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight.Bold, fontSize = 9.sp)
}
