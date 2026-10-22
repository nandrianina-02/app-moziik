package com.moziik.app.donnees.horsligne

import com.moziik.app.donnees.catalogue.NouveauCommentaire
import com.moziik.app.donnees.reseau.ErreurApi
import com.moziik.app.donnees.reseau.JsonMoziik
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import java.io.File

/** Une action faite sans réseau, à envoyer au retour de la connexion (spécification 6.4). */
@Serializable
sealed class ActionGardee {
    abstract val titreId: String

    @Serializable
    @SerialName("comment")
    data class Commentaire(
        override val titreId: String,
        val texte: String,
        val moment: Double? = null,
        val parent: String? = null,
        val creeLe: Long = System.currentTimeMillis(),
    ) : ActionGardee()

    /** L'état voulu, pas une bascule : le site ne sait que basculer, l'état réel est relu avant (6.4). */
    @Serializable
    @SerialName("like")
    data class Aime(override val titreId: String, val aime: Boolean) : ActionGardee()
}

/**
 * Les j'aime et commentaires faits hors connexion (G3), gardés sur le
 * disque et rejoués dans l'ordre. Un j'aime répété sur un même titre ne
 * garde que le dernier état voulu.
 */
class ActionsEnAttente(racine: File, private val api: MoziikApi) {
    private val fichier = File(racine, "actions-en-attente.json")
    private val verrou = Mutex()
    private val serialiseur = ListSerializer(ActionGardee.serializer())

    private val _actions = MutableStateFlow(lire())
    /** Pour montrer « en attente d'envoi » sous un commentaire pas encore parti. */
    val actions: StateFlow<List<ActionGardee>> = _actions.asStateFlow()

    private fun lire(): List<ActionGardee> = runCatching { JsonMoziik.decodeFromString(serialiseur, fichier.readText()) }.getOrDefault(emptyList())

    private fun ecrire(liste: List<ActionGardee>) {
        _actions.value = liste
        runCatching { if (liste.isEmpty()) fichier.delete() else fichier.writeText(JsonMoziik.encodeToString(serialiseur, liste)) }
    }

    suspend fun garder(action: ActionGardee) = verrou.withLock {
        val sans = if (action is ActionGardee.Aime) _actions.value.filterNot { it is ActionGardee.Aime && it.titreId == action.titreId } else _actions.value
        ecrire(sans + action)
    }

    suspend fun oublier() = verrou.withLock { ecrire(emptyList()) }

    /**
     * Rejoue dans l'ordre ; s'arrête à la première panne réseau. Une action
     * refusée en 4xx (hors 401 et 429) est retirée plutôt que de bloquer
     * la file. Rend le nombre d'actions envoyées.
     */
    suspend fun rejouer(): Int = verrou.withLock {
        val restantes = _actions.value.toMutableList()
        var envoyees = 0
        while (restantes.isNotEmpty()) {
            val resultat = when (val a = restantes.first()) {
                is ActionGardee.Commentaire -> appel { api.commenter(a.titreId, NouveauCommentaire(a.texte, a.moment, a.parent)); Unit }
                is ActionGardee.Aime -> appel {
                    if (api.aime(a.titreId).liked != a.aime) api.basculerAime(a.titreId)
                    Unit
                }
            }
            val erreur = resultat.exceptionOrNull()
            val definitive = erreur is ErreurApi && erreur.statut in 400..499 && erreur.statut != 401 && erreur.statut != 429
            if (erreur != null && !definitive) break
            if (erreur == null) envoyees++
            restantes.removeAt(0)
            ecrire(restantes.toList())
        }
        envoyees
    }
}
