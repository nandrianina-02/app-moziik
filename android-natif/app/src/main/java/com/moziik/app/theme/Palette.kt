package com.moziik.app.theme

import kotlin.math.max
import kotlin.math.min

/**
 * Le thème, portage de lib/theme.ts : quatre choix (mode, accent, un fond
 * par mode) et deux couleurs d'identité, tout le reste en est déduit et
 * vérifié pour le contraste. Les préréglages et le thème par défaut sont
 * ceux du site, à l'identique.
 */

enum class Mode { SOMBRE, CLAIR }

/** Le mode choisi : SYSTEME délègue au réglage de l'appareil. */
enum class ChoixMode { SOMBRE, CLAIR, SYSTEME }

data class PreferenceTheme(
    /** Identifiant d'un préréglage, ou [PRESET_PERSONNALISE] pour des couleurs libres. */
    val preset: String,
    val mode: ChoixMode,
    val accent: String,
    val fondSombre: String,
    val fondClair: String,
    /** Seconde couleur d'identité : badges vérifiés, confirmations. */
    val secondaire: String,
    /** Avertissements, seuils. */
    val alerte: String,
    /** Rayon des coins, en dp (barème du site : 0 à 20). */
    val rayon: Int,
)

data class Preset(val id: String, val libelle: String, val accent: String, val fondSombre: String, val fondClair: String)

const val PRESET_PERSONNALISE = "custom"

val PRESETS = listOf(
    Preset("moziik", "Moziik", "#FF6B4A", "#0D0F1A", "#FBF9F4"),
    Preset("ocean", "Océan", "#38BDF8", "#0A1220", "#F4F9FF"),
    Preset("emeraude", "Émeraude", "#34D399", "#08150F", "#F3FBF6"),
    Preset("violet", "Violet", "#A78BFA", "#110E1E", "#F8F6FF"),
    Preset("rubis", "Rubis", "#FB7185", "#170C11", "#FFF5F7"),
    Preset("or", "Or", "#FBBF24", "#14110A", "#FFFAF0"),
    Preset("ardoise", "Ardoise", "#94A3B8", "#0F1216", "#F6F7F8"),
)

val THEME_PAR_DEFAUT = PreferenceTheme(
    preset = "moziik",
    mode = ChoixMode.SOMBRE,
    accent = "#FF6B4A",
    fondSombre = "#0D0F1A",
    fondClair = "#FBF9F4",
    secondaire = "#3DDC97",
    alerte = "#FBBF24",
    rayon = 12,
)

/** Les couleurs d'une page, prêtes à peindre. */
data class Palette(
    val base: Rgb,
    val surface: Rgb,
    val bordure: Rgb,
    val encre: Rgb,
    val encreAttenuee: Rgb,
    val accent: Rgb,
    val accentSurvol: Rgb,
    val verifie: Rgb,
    val alerte: Rgb,
    val danger: Rgb,
    val info: Rgb,
    val rayon: Int,
    /** C'est la luminance du fond qui tranche, pas le mode déclaré. */
    val sombre: Boolean,
)

/** Encres de référence, reprises de la palette d'origine. */
private val ENCRE_CLAIRE = Rgb(242.0, 240.0, 233.0) // #F2F0E9
private val ENCRE_SOMBRE = Rgb(23.0, 26.0, 36.0) // #171A24

fun modeApplique(choix: ChoixMode, systemeSombre: Boolean): Mode = when (choix) {
    ChoixMode.SOMBRE -> Mode.SOMBRE
    ChoixMode.CLAIR -> Mode.CLAIR
    ChoixMode.SYSTEME -> if (systemeSombre) Mode.SOMBRE else Mode.CLAIR
}

/** Les couleurs réellement appliquées : celles du préréglage, sinon les choix libres. */
private fun couleursDe(pref: PreferenceTheme, mode: Mode): Pair<String, String> {
    val preset = PRESETS.firstOrNull { it.id == pref.preset }
    val accent = preset?.accent ?: pref.accent
    val fond = if (mode == Mode.CLAIR) preset?.fondClair ?: pref.fondClair else preset?.fondSombre ?: pref.fondSombre
    return accent to fond
}

/** Équivalent de themeVariables(), plus les couleurs sémantiques de globals.css. */
fun palette(pref: PreferenceTheme, mode: Mode): Palette {
    val (accent, fond) = couleursDe(pref, mode)
    val base = Rgb.depuisHex(fond) ?: Rgb.depuisHex(THEME_PAR_DEFAUT.fondSombre)!!
    val sombre = estFondSombre(base)

    val surface = melange(base, Rgb.BLANC, if (sombre) 0.05 else 0.6)
    val bordure = if (sombre) melange(base, Rgb.BLANC, 0.12) else melange(base, Rgb.NOIR, 0.09)

    val encre = if (sombre) ENCRE_CLAIRE else ENCRE_SOMBRE
    // Du texte courant : il doit tenir 4,5:1 sur le fond.
    val encreAttenuee = assurerContraste(melange(encre, base, 0.45), base, 4.5)

    val accentLisible = accentAjuste(Rgb.depuisHex(accent) ?: Rgb.depuisHex(THEME_PAR_DEFAUT.accent)!!, base)
    val accentSurvol = if (sombre) melange(accentLisible, Rgb.BLANC, 0.15) else melange(accentLisible, Rgb.NOIR, 0.2)
    val secondaire = accentAjuste(Rgb.depuisHex(pref.secondaire) ?: Rgb.depuisHex(THEME_PAR_DEFAUT.secondaire)!!, base)
    val alerte = accentAjuste(Rgb.depuisHex(pref.alerte) ?: Rgb.depuisHex(THEME_PAR_DEFAUT.alerte)!!, base)

    // Couleurs sémantiques : deux jeux fixes dans globals.css, choisis par la luminance du fond.
    val danger = Rgb.depuisHex(if (sombre) "#F87171" else "#B91C1C")!!
    val info = Rgb.depuisHex(if (sombre) "#38BDF8" else "#0369A1")!!

    return Palette(
        base = base,
        surface = surface,
        bordure = bordure,
        encre = encre,
        encreAttenuee = encreAttenuee,
        accent = accentLisible,
        accentSurvol = accentSurvol,
        verifie = secondaire,
        alerte = alerte,
        danger = danger,
        info = info,
        rayon = rayonValide(pref.rayon),
        sombre = sombre,
    )
}

/** Un rayon hors barème casserait la mise en page : on le ramène dedans. */
private fun rayonValide(rayon: Int): Int = min(24, max(0, rayon))

/**
 * L'accent rendu lisible sur deux fonds : la page, et sa propre teinte à
 * 15 % (pastilles, encarts). Corriger le second déplace le premier, d'où
 * les deux passes.
 */
private fun accentAjuste(accent: Rgb, base: Rgb): Rgb {
    var resultat = assurerContraste(accent, base, 4.5)
    repeat(2) {
        val teinte = melange(base, resultat, 0.15)
        resultat = assurerContraste(resultat, teinte, 4.5)
    }
    return resultat
}
