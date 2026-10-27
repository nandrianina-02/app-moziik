package com.moziik.app.donnees.ensemble

import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.reseau.ErreurApi
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.lecteur.AlertesLecture
import com.moziik.app.lecteur.Lecteur
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlin.math.abs

@Serializable
data class CodeEnsemble(val code: String)

@Serializable
data class HoteEnsemble(val name: String = "Hôte", val avatarUrl: String? = null)

/** GET /api/ecoute-ensemble/{code} : l'état de la lecture de l'hôte, position à l'instant. */
@Serializable
data class EtatEnsembleDistant(
    val code: String,
    val estHote: Boolean = false,
    val hote: HoteEnsemble = HoteEnsemble(),
    val titre: Titre? = null,
    val positionMs: Long = 0,
    val enLecture: Boolean = false,
    val participants: Int = 0,
)

/** PUT /api/ecoute-ensemble/{code} : l'hôte publie son état. */
@Serializable
data class EtatPublie(val titreId: String?, val positionMs: Long, val enLecture: Boolean)

sealed interface EtatEnsemble {
    data object Aucun : EtatEnsemble
    data class Hote(val code: String, val participants: Int) : EtatEnsemble
    data class Invite(val code: String, val hote: String) : EtatEnsemble
}

/** Au-delà de cet écart avec l'hôte, l'invité se recale sur sa position. */
const val ECART_TOLERE_MS = 2_500L

/** L'écart entre la position de l'invité et celle de l'hôte justifie-t-il un recalage ? */
fun doitSeRecaler(positionInvite: Long, positionHote: Long): Boolean = abs(positionInvite - positionHote) > ECART_TOLERE_MS

/**
 * L'écoute à plusieurs. L'hôte publie l'état de sa lecture à chaque
 * changement de titre ou de lecture, et toutes les dix secondes ; l'invité
 * relit cet état toutes les trois secondes et suit : même titre, même
 * position à quelques secondes près, lecture ou pause. Chacun écoute sur
 * son téléphone, avec son compte : rien n'est relayé d'un appareil à l'autre.
 */
class EcouteEnsemble(
    private val api: MoziikApi,
    private val lecteur: Lecteur,
    private val alertes: AlertesLecture,
    private val portee: CoroutineScope,
) {
    private val _etat = MutableStateFlow<EtatEnsemble>(EtatEnsemble.Aucun)
    val etat: StateFlow<EtatEnsemble> = _etat.asStateFlow()
    private var travail: Job? = null

    /** Un invité ne prolonge pas sa file : c'est l'hôte qui choisit la suite. */
    val estInvite: Boolean get() = _etat.value is EtatEnsemble.Invite

    suspend fun ouvrir(): Result<String> = appel { api.ouvrirEnsemble().code }.onSuccess { code ->
        travail?.cancel()
        _etat.value = EtatEnsemble.Hote(code, 0)
        travail = portee.launch { publier(code) }
    }

    suspend fun rejoindre(code: String): Result<Unit> = appel { api.etatEnsemble(code.trim().uppercase()) }.map { etat ->
        travail?.cancel()
        _etat.value = EtatEnsemble.Invite(etat.code, etat.hote.name)
        travail = portee.launch { suivre(etat.code) }
    }

    fun quitter() {
        val code = when (val e = _etat.value) {
            is EtatEnsemble.Hote -> e.code
            is EtatEnsemble.Invite -> e.code
            EtatEnsemble.Aucun -> return
        }
        travail?.cancel()
        _etat.value = EtatEnsemble.Aucun
        portee.launch { appel { api.quitterEnsemble(code) } }
    }

    private suspend fun publierEtat(code: String) {
        val e = lecteur.etat.value
        appel { api.publierEnsemble(code, EtatPublie(e.courant?.id, lecteur.position(), e.enLecture)) }
    }

    /** L'hôte : à chaque changement de titre ou de lecture, et toutes les dix secondes pour la position. */
    private suspend fun publier(code: String) {
        portee.launch {
            lecteur.etat.map { it.courant?.id to it.enLecture }.distinctUntilChanged().collect { publierEtat(code) }
        }.also { suivi ->
            try {
                while (true) {
                    delay(10_000)
                    publierEtat(code)
                    appel { api.etatEnsemble(code) }.onSuccess { e ->
                        if (_etat.value is EtatEnsemble.Hote) _etat.value = EtatEnsemble.Hote(code, e.participants)
                    }
                }
            } finally {
                suivi.cancel()
            }
        }
    }

    /** L'invité : relit l'état de l'hôte toutes les trois secondes et s'y aligne. */
    private suspend fun suivre(code: String) {
        while (true) {
            appel { api.etatEnsemble(code) }
                .onSuccess { aligner(it) }
                .onFailure { e ->
                    if (e is ErreurApi && e.statut == 404) {
                        _etat.value = EtatEnsemble.Aucun
                        alertes.signaler(AlerteLecture.Message("L'écoute à plusieurs est terminée."))
                        return
                    }
                }
            delay(3_000)
        }
    }

    private fun aligner(hote: EtatEnsembleDistant) {
        val titre: Titre? = hote.titre
        val local = lecteur.etat.value
        // En chargement, l'invité « veut » déjà jouer : ne pas le relancer pour autant.
        val joue = local.enLecture || local.attente
        when {
            titre == null -> if (joue) lecteur.mettreEnLecture(false)
            local.courant?.id != titre.id -> {
                lecteur.lire(listOf(titre), 0, "Écoute à plusieurs")
                lecteur.deplacer(hote.positionMs)
                lecteur.mettreEnLecture(hote.enLecture)
            }
            else -> {
                if (doitSeRecaler(lecteur.position(), hote.positionMs)) lecteur.deplacer(hote.positionMs)
                if (joue != hote.enLecture) lecteur.mettreEnLecture(hote.enLecture)
            }
        }
    }
}
