package com.moziik.app.lecteur

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed interface AlerteLecture {
    /** Limite d'écoute des visiteurs atteinte : le mur « La suite demande un compte » (5.3). */
    data object Quota : AlerteLecture
    data class Message(val texte: String) : AlerteLecture
}

/**
 * Ce que le service de lecture a à dire à l'écran. Le service et l'écran
 * vivent dans le même processus : un état partagé suffit, sans faire
 * transiter ces messages par la session média.
 */
class AlertesLecture {
    private val _alerte = MutableStateFlow<AlerteLecture?>(null)
    val alerte: StateFlow<AlerteLecture?> = _alerte.asStateFlow()

    fun signaler(alerte: AlerteLecture) {
        _alerte.value = alerte
    }

    fun oublier() {
        _alerte.value = null
    }
}
