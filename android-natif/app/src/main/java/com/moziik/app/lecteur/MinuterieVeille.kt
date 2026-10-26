package com.moziik.app.lecteur

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Ce que la minuterie attend : une heure d'arrêt, ou la fin du titre en cours. */
sealed interface Veille {
    data object Aucune : Veille
    data class A(val finMs: Long) : Veille
    data object FinDuTitre : Veille
}

/**
 * La minuterie de mise en veille : l'écran la règle, le service de lecture
 * l'applique (ServiceLecture), même écran éteint. Les deux vivent dans le
 * même processus : un état partagé suffit, comme pour AlertesLecture.
 */
class MinuterieVeille(private val horloge: () -> Long = System::currentTimeMillis) {
    private val _veille = MutableStateFlow<Veille>(Veille.Aucune)
    val veille: StateFlow<Veille> = _veille.asStateFlow()

    fun dans(minutes: Int) {
        _veille.value = Veille.A(horloge() + minutes * 60_000L)
    }

    fun finDuTitre() {
        _veille.value = Veille.FinDuTitre
    }

    fun annuler() {
        _veille.value = Veille.Aucune
    }

    /** Minutes restantes, arrondies au-dessus ; null sans minuterie à heure fixe. */
    fun minutesRestantes(): Int? = (veille.value as? Veille.A)?.let { ((it.finMs - horloge()).coerceAtLeast(0) + 59_999) / 60_000 }?.toInt()
}
