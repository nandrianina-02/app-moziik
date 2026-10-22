package com.moziik.app.donnees.notifications

import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Une notification du site (models/Notification.ts). */
@Serializable
data class Avis(
    @SerialName("_id") val id: String,
    /** new_song, new_follower, like, comment, event, payment, message ou system. */
    val type: String = "system",
    val title: String = "",
    val message: String = "",
    /** Chemin du site : /son/…, /evenements/…, /artiste/… */
    val link: String? = null,
    val imageUrl: String? = null,
    val read: Boolean = false,
    val createdAt: String? = null,
)

@Serializable
data class PageAvis(val notifications: List<Avis> = emptyList(), val hasMore: Boolean = false)

/**
 * Les notifications du compte (H, NotificationsProvider.tsx) : la liste,
 * paginée par date, et le nombre de non lues pour la cloche. Le site n'a
 * pas de temps réel : la coquille relit la première page chaque minute
 * tant que l'app est à l'écran.
 */
class Notifications(private val api: MoziikApi) {
    private val _liste = MutableStateFlow<List<Avis>?>(null)
    /** Null tant que rien n'est chargé. */
    val liste: StateFlow<List<Avis>?> = _liste.asStateFlow()

    private val _encore = MutableStateFlow(false)
    val encore: StateFlow<Boolean> = _encore.asStateFlow()

    private val _nonLues = MutableStateFlow(0)
    /** Les non lues parmi la première page : la cloche n'a pas besoin d'un compte exact au-delà de vingt. */
    val nonLues: StateFlow<Int> = _nonLues.asStateFlow()

    private fun publier(liste: List<Avis>) {
        _liste.value = liste
        _nonLues.value = liste.count { !it.read }
    }

    /** Relit la première page ; une panne garde la dernière liste connue. */
    suspend fun actualiser(): Result<Unit> = appel { api.notifications(null) }.map {
        publier(it.notifications)
        _encore.value = it.hasMore
    }

    /** La page suivante, à partir de la plus ancienne déjà chargée. */
    suspend fun suite(): Result<Unit> {
        val avant = _liste.value?.lastOrNull()?.createdAt ?: return Result.success(Unit)
        return appel { api.notifications(avant) }.map { page ->
            publier(_liste.value.orEmpty() + page.notifications.filter { n -> _liste.value.orEmpty().none { it.id == n.id } })
            _encore.value = page.hasMore
        }
    }

    /** Lue dès qu'on l'ouvre : affichée tout de suite, confirmée au site ensuite. */
    suspend fun marquerLue(id: String) {
        publier(_liste.value.orEmpty().map { if (it.id == id) it.copy(read = true) else it })
        appel { api.notificationLue(id) }
    }

    suspend fun toutMarquerLu(): Result<Unit> {
        val avant = _liste.value
        publier(avant.orEmpty().map { it.copy(read = true) })
        return appel { api.notificationsToutesLues() }.onFailure { avant?.let(::publier) }
    }

    suspend fun supprimer(id: String): Result<Unit> {
        val avant = _liste.value
        publier(avant.orEmpty().filter { it.id != id })
        return appel { api.supprimerNotification(id) }.onFailure { avant?.let(::publier) }
    }

    suspend fun toutSupprimer(): Result<Unit> {
        val avant = _liste.value
        publier(emptyList())
        _encore.update { false }
        return appel { api.supprimerNotifications() }.onFailure { avant?.let(::publier) }
    }

    /** Déconnexion : rien du compte précédent ne reste affiché. */
    fun oublier() {
        _liste.value = null
        _nonLues.value = 0
        _encore.value = false
    }
}
