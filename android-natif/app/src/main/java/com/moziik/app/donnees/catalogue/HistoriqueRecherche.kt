package com.moziik.app.donnees.catalogue

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Les dernières recherches, gardées sur l'appareil seulement : elles ne
 * sont pas synchronisées avec le compte (spécification D7).
 */
class HistoriqueRecherche(contexte: Context) {
    private val preferences = contexte.getSharedPreferences("recherche", Context.MODE_PRIVATE)
    private val _termes = MutableStateFlow(lire())
    val termes: StateFlow<List<String>> = _termes.asStateFlow()

    private fun lire(): List<String> = preferences.getString(CLE, null)?.split('\n')?.filter { it.isNotBlank() }.orEmpty()

    fun retenir(terme: String) {
        val propre = terme.trim().take(100)
        if (propre.length < 2) return
        val termes = (listOf(propre) + _termes.value.filterNot { it.equals(propre, ignoreCase = true) }).take(MAXIMUM)
        enregistrer(termes)
    }

    fun retirer(terme: String) = enregistrer(_termes.value - terme)

    fun effacer() = enregistrer(emptyList())

    private fun enregistrer(termes: List<String>) {
        _termes.value = termes
        preferences.edit().putString(CLE, termes.joinToString("\n")).apply()
    }

    private companion object {
        const val CLE = "termes"
        const val MAXIMUM = 8
    }
}
