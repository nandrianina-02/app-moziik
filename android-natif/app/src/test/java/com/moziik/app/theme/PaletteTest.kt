package com.moziik.app.theme

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * L'app doit peindre exactement les couleurs du site. Les valeurs attendues
 * ont été calculées par lib/theme.ts (themeVariables) pour chaque
 * préréglage, en sombre et en clair : tout écart ici serait une couleur qui
 * diffère entre le site et l'app.
 */
class PaletteTest {
    private data class Attendu(
        val preset: String,
        val mode: Mode,
        val base: String,
        val surface: String,
        val bordure: String,
        val encre: String,
        val encreAttenuee: String,
        val accent: String,
        val accentSurvol: String,
        val verifie: String,
        val alerte: String,
    )

    private val attendus = listOf(
        Attendu("moziik", Mode.SOMBRE, "#0D0F1A", "#191B25", "#2A2C35", "#F2F0E9", "#8B8B8C", "#FF6B4A", "#FF8165", "#3DDC97", "#FBBF24"),
        Attendu("moziik", Mode.CLAIR, "#FBF9F4", "#FDFDFB", "#E4E3DE", "#171A24", "#6F7073", "#A3442F", "#823726", "#1E6E4B", "#7D5F12"),
        Attendu("ocean", Mode.SOMBRE, "#0A1220", "#161E2B", "#272E3B", "#F2F0E9", "#8A8C8F", "#38BDF8", "#56C7F9", "#3DDC97", "#FBBF24"),
        Attendu("ocean", Mode.CLAIR, "#F4F9FF", "#FBFDFF", "#DEE3E8", "#171A24", "#6C7077", "#206B8C", "#195570", "#1E6E4B", "#7D5F12"),
        Attendu("emeraude", Mode.SOMBRE, "#08150F", "#14211B", "#26312C", "#F2F0E9", "#898D87", "#34D399", "#52DAA8", "#3DDC97", "#FBBF24"),
        Attendu("emeraude", Mode.CLAIR, "#F3FBF6", "#FAFDFB", "#DDE4E0", "#171A24", "#6C7173", "#1B6E50", "#165840", "#1E6E4B", "#7D5F12"),
        Attendu("violet", Mode.SOMBRE, "#110E1E", "#1D1A29", "#2E2B39", "#F2F0E9", "#8D8A8E", "#A78BFA", "#B49CFB", "#3DDC97", "#FBBF24"),
        Attendu("violet", Mode.CLAIR, "#F8F6FF", "#FCFBFF", "#E2E0E8", "#171A24", "#6E6F77", "#6B59A0", "#554780", "#1E6E4B", "#7D5F12"),
        Attendu("rubis", Mode.SOMBRE, "#170C11", "#23181D", "#33292E", "#F2F0E9", "#8F8988", "#FB7185", "#FC8697", "#3DDC97", "#FBBF24"),
        Attendu("rubis", Mode.CLAIR, "#FFF5F7", "#FFFBFC", "#E8DFE1", "#171A24", "#716E74", "#9A4551", "#7B3741", "#1E6E4B", "#7D5F12"),
        Attendu("or", Mode.SOMBRE, "#14110A", "#201D16", "#302E27", "#F2F0E9", "#8E8C85", "#FBBF24", "#FCC945", "#3DDC97", "#FBBF24"),
        Attendu("or", Mode.CLAIR, "#FFFAF0", "#FFFDF9", "#E8E4DA", "#171A24", "#717071", "#7D5F12", "#644C0E", "#20724F", "#7D5F12"),
        Attendu("ardoise", Mode.SOMBRE, "#0F1216", "#1B1E22", "#2C2E32", "#F2F0E9", "#8C8C8A", "#94A3B8", "#A4B1C3", "#3DDC97", "#FBBF24"),
        Attendu("ardoise", Mode.CLAIR, "#F6F7F8", "#FBFCFC", "#E0E1E2", "#171A24", "#6D6F74", "#5B6471", "#49505A", "#1E6E4B", "#7D5F12"),
    )

    @Test
    fun memes_couleurs_que_le_site_pour_chaque_preset() {
        for (a in attendus) {
            val p = palette(THEME_PAR_DEFAUT.copy(preset = a.preset), a.mode)
            val ou = "${a.preset} ${a.mode}"
            assertEquals("base $ou", a.base, p.base.enHex())
            assertEquals("surface $ou", a.surface, p.surface.enHex())
            assertEquals("bordure $ou", a.bordure, p.bordure.enHex())
            assertEquals("encre $ou", a.encre, p.encre.enHex())
            assertEquals("encre atténuée $ou", a.encreAttenuee, p.encreAttenuee.enHex())
            assertEquals("accent $ou", a.accent, p.accent.enHex())
            assertEquals("survol $ou", a.accentSurvol, p.accentSurvol.enHex())
            assertEquals("vérifié $ou", a.verifie, p.verifie.enHex())
            assertEquals("alerte $ou", a.alerte, p.alerte.enHex())
        }
    }

    @Test
    fun le_texte_reste_lisible_meme_avec_des_couleurs_libres() {
        // Un accent corail sur fond crème ne fait que 2,7:1 : le thème doit le corriger.
        val libre = THEME_PAR_DEFAUT.copy(preset = PRESET_PERSONNALISE, accent = "#FF6B4A", fondClair = "#FFF8EE")
        val p = palette(libre, Mode.CLAIR)
        assertTrue(contraste(p.accent, p.base) >= 4.5)
        assertTrue(contraste(p.encreAttenuee, p.base) >= 4.5)
        assertTrue(!p.sombre)
    }

    @Test
    fun une_couleur_illisible_retombe_sur_le_theme_par_defaut() {
        val abime = THEME_PAR_DEFAUT.copy(preset = PRESET_PERSONNALISE, accent = "rouge", fondSombre = "#12")
        val p = palette(abime, Mode.SOMBRE)
        assertEquals("#0D0F1A", p.base.enHex())
        assertEquals("#FF6B4A", p.accent.enHex())
    }

    @Test
    fun hexadecimal_court_et_sans_diese() {
        assertEquals("#FFAA00", Rgb.depuisHex("fa0")!!.enHex())
        assertEquals(null, Rgb.depuisHex("#GGGGGG"))
    }
}
