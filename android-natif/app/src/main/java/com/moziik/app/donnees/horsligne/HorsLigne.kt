package com.moziik.app.donnees.horsligne

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.compte.Compte
import com.moziik.app.donnees.compte.ReglagesAppareil
import com.moziik.app.donnees.reseau.JsonMoziik
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.donnees.session.Session
import com.moziik.app.donnees.session.appel
import com.moziik.app.lecteur.AlerteLecture
import com.moziik.app.lecteur.AlertesLecture
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import java.io.File
import java.io.IOException

/** Un titre à télécharger, et le lot (album, playlist) dont il fait partie. */
@Serializable
data class Tache(
    val titre: Titre,
    val qualite: String,
    /** manual, album ou playlist. */
    val source: String,
    /** « Album « … » » : annoncé une fois le lot terminé. */
    val lot: String? = null,
    val albumId: String? = null,
)

/** Pourquoi un téléchargement n'a pas été accepté : l'écran en tire sa réaction. */
enum class Refus { Compte, Premium }

/**
 * Le téléchargement hors connexion (spécification 6) : droits, file
 * d'attente, Wi-Fi seulement, reprise au retour du réseau.
 *
 * Le site ne vérifie pas le droit au téléchargement, il sert le fichier à
 * tout compte : c'est l'app qui le réserve aux abonnés Premium (6.1). La
 * file est gardée sur le disque : un téléchargement demandé sans réseau
 * part à la reconnexion, même après un redémarrage de l'app.
 */
class HorsLigne(
    contexte: Context,
    racine: File,
    val telechargements: Telechargements,
    val ecoutes: EcoutesEnAttente,
    val actions: ActionsEnAttente,
    private val api: MoziikApi,
    private val compte: Compte,
    private val session: Session,
    private val reglages: ReglagesAppareil,
    private val alertes: AlertesLecture,
    private val portee: CoroutineScope,
    val avis: AvisTelechargement,
    /** Les réponses de l'API gardées pour le compte : effacées avec le reste à la déconnexion. */
    private val oublierCache: () -> Unit = {},
) {
    private val fichierFile = File(racine, "telechargements-en-attente.json")
    private val preferences = contexte.getSharedPreferences("hors-ligne", Context.MODE_PRIVATE)
    private val file = ArrayDeque(lireFile())
    private var travail: Job? = null

    private val _attente = MutableStateFlow(file.map { it.titre.id }.toSet())
    /** Les titres demandés qui attendent leur tour, le réseau ou le Wi-Fi. */
    val attente: StateFlow<Set<String>> = _attente.asStateFlow()

    private val _demandeAutorisation = MutableStateFlow(false)
    /**
     * Vrai une fois, au premier téléchargement accepté, si Android 13 n'a
     * pas encore donné l'autorisation de notifier : l'écran la demande
     * alors, jamais au lancement (6.5).
     */
    val demandeAutorisation: StateFlow<Boolean> = _demandeAutorisation.asStateFlow()

    /** Demander l'autorisation de notifier si elle n'a jamais été demandée (notifications push). */
    fun proposerAutorisation() {
        if (!avis.autorise() && !preferences.getBoolean("autorisationDemandee", false)) _demandeAutorisation.value = true
    }

    fun autorisationDemandee() {
        preferences.edit().putBoolean("autorisationDemandee", true).apply()
        _demandeAutorisation.value = false
    }

    private val _horsReseau = MutableStateFlow(!reglages.reseauDisponible())
    val horsReseau: StateFlow<Boolean> = _horsReseau.asStateFlow()

    init {
        surveillerReseau(contexte)
        portee.launch {
            // Une déconnexion efface tout ce qui appartient au compte, comme sur le site (oublierCompte).
            session.etat.drop(1).collect { etat ->
                if (etat is EtatSession.Anonyme) oublierCompte()
            }
        }
        portee.launch { compte.premium.collect { if (it) preferences.edit().putBoolean("premium", true).apply() } }
        // La barre de la notification suit l'avancement du titre en cours.
        portee.launch { telechargements.enCours.collect { avancements -> avancements.values.firstOrNull()?.let(avis::progression) } }
        reprendre()
        if (!_horsReseau.value) portee.launch { rejouerEnAttente() }
    }

    private fun lireFile(): List<Tache> = runCatching {
        JsonMoziik.decodeFromString(ListSerializer(Tache.serializer()), fichierFile.readText())
    }.getOrDefault(emptyList())

    @Synchronized
    private fun majFile(transformation: ArrayDeque<Tache>.() -> Unit) {
        file.transformation()
        _attente.value = file.map { it.titre.id }.toSet()
        runCatching {
            if (file.isEmpty()) fichierFile.delete()
            else fichierFile.writeText(JsonMoziik.encodeToString(ListSerializer(Tache.serializer()), file.toList()))
        }
    }

    /**
     * Le droit au téléchargement. Le dernier état Premium connu sert quand
     * le réseau manque : un abonné doit pouvoir mettre un titre en attente
     * dans le métro.
     */
    private suspend fun refus(): Refus? {
        if (session.etat.value !is EtatSession.Connecte) return Refus.Compte
        if (compte.premium.value) return null
        val verifie = appel { compte.abonnement().hasPremium }
        val premium = verifie.getOrNull() ?: (verifie.exceptionOrNull() is IOException && preferences.getBoolean("premium", false))
        preferences.edit().putBoolean("premium", premium).apply()
        return if (premium) null else Refus.Premium
    }

    /** Un titre ; déjà téléchargé, il est retiré (6.2). Null si la demande est acceptée. */
    suspend fun basculer(titre: Titre): Refus? {
        if (telechargements.estTelecharge(titre.id)) {
            telechargements.supprimer(titre.id)
            alertes.signaler(AlerteLecture.Message("« ${titre.title} » est retiré de tes téléchargements.", succes = true))
            return null
        }
        if (titre.id in _attente.value) {
            majFile { removeAll { it.titre.id == titre.id } }
            return null
        }
        return demander(listOf(titre), "manual", lot = null, albumId = null)
    }

    /** Un album ou une playlist entiers : les titres manquants seulement. */
    suspend fun telechargerLot(titres: List<Titre>, source: String, nom: String, albumId: String? = null): Refus? =
        demander(titres.filter { it.publie }, source, lot = nom, albumId = albumId)

    /** Retire d'un coup les titres d'un album ou d'une playlist, et ceux qui attendaient encore. */
    fun retirerLot(titres: List<Titre>) {
        val ids = titres.map { it.id }.toSet()
        majFile { removeAll { it.titre.id in ids } }
        ids.forEach { if (telechargements.estTelecharge(it)) telechargements.supprimer(it) }
    }

    private suspend fun demander(titres: List<Titre>, source: String, lot: String?, albumId: String?): Refus? {
        refus()?.let { return it }
        // Les téléchargements gardent la qualité choisie et ignorent l'économie de données (5.7).
        val qualite = reglages.qualite.value
        val nouvelles = titres
            .filter { !telechargements.estTelecharge(it.id) && it.id !in _attente.value }
            .map { Tache(it, qualite, source, lot, albumId) }
        if (nouvelles.isEmpty()) {
            if (lot != null) alertes.signaler(AlerteLecture.Message("« $lot » est déjà disponible hors connexion.", succes = true))
            return null
        }
        majFile { addAll(nouvelles) }
        if (!avis.autorise() && !preferences.getBoolean("autorisationDemandee", false)) _demandeAutorisation.value = true
        when {
            !reglages.reseauDisponible() ->
                alertes.signaler(AlerteLecture.Message("En attente — le téléchargement démarrera à la reconnexion."))
            !reseauPermis() ->
                alertes.signaler(AlerteLecture.Message("Téléchargement limité au Wi-Fi dans tes paramètres hors-ligne."))
        }
        reprendre()
        return null
    }

    private fun reseauPermis() = reglages.reseauDisponible() && !(reglages.wifiSeulement.value && reglages.reseauFacture())

    /** Relance la file si elle a du travail et que le réseau le permet. Appelé aussi quand le réglage Wi-Fi change. */
    fun reprendre() {
        if (travail?.isActive == true) return
        travail = portee.launch { traiter() }
    }

    private suspend fun traiter() {
        var echecs = 0
        while (true) {
            val tache = synchronized(this) { file.firstOrNull() } ?: break
            if (!reseauPermis()) break
            avis.commence(tache.titre.title, synchronized(this) { file.size } - 1)
            try {
                telechargements.telecharger(tache.titre, tache.qualite, tache.source)
            } catch (e: TitreIndisponible) {
                // Un titre retiré ne doit pas bloquer le reste du lot (le site s'arrête au premier échec).
                echecs++
            } catch (e: IOException) {
                // Le réseau est tombé en route : la tâche reste en tête, la reconnexion la reprendra.
                if (!reglages.reseauDisponible()) break
                echecs++
            }
            majFile { remove(tache) }
            val lotFini = tache.lot != null && synchronized(this) { file.none { it.lot == tache.lot } }
            when {
                lotFini -> {
                    tache.albumId?.let { id -> appel { api.albumTelecharge(id) } }
                    val texte = if (echecs == 0) "« ${tache.lot} » est disponible hors connexion."
                    else "« ${tache.lot} » est disponible hors connexion, sauf $echecs titre${if (echecs > 1) "s" else ""} indisponible${if (echecs > 1) "s" else ""}."
                    alertes.signaler(AlerteLecture.Message(texte, succes = echecs == 0))
                    avis.termine(texte)
                    echecs = 0
                }
                tache.lot == null && telechargements.estTelecharge(tache.titre.id) -> {
                    val texte = "« ${tache.titre.title} » est disponible hors connexion."
                    alertes.signaler(AlerteLecture.Message(texte, succes = true))
                    avis.termine(texte)
                }
                tache.lot == null -> {
                    alertes.signaler(AlerteLecture.Message("« ${tache.titre.title} » n'a pas pu être téléchargé."))
                    echecs = 0
                }
            }
        }
        // La progression laisse la place : rien ne tourne plus, ou la file attend le réseau.
        val enAttente = synchronized(this) { file.isNotEmpty() }
        avis.arrete(
            when {
                !enAttente -> null
                !reglages.reseauDisponible() -> "Ils reprendront au retour du réseau."
                else -> "Ils reprendront en Wi-Fi (réglage Wi-Fi seulement)."
            },
        )
    }

    /** Écoutes, j'aime et commentaires faits sans réseau ; un mot quand des commentaires sont partis. */
    private suspend fun rejouerEnAttente() {
        ecoutes.rejouer()
        val commentaires = actions.actions.value.count { it is ActionGardee.Commentaire }
        actions.rejouer()
        val partis = commentaires - actions.actions.value.count { it is ActionGardee.Commentaire }
        if (partis > 0) {
            alertes.signaler(AlerteLecture.Message(if (partis > 1) "$partis commentaires envoyés." else "Commentaire envoyé.", succes = true))
        }
    }

    private fun surveillerReseau(contexte: Context) {
        val connectivite = contexte.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        val demande = NetworkRequest.Builder().addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build()
        runCatching {
            connectivite.registerNetworkCallback(demande, object : ConnectivityManager.NetworkCallback() {
                // Rappels reçus sur un fil du système : le traitement repasse sur le fil principal.
                override fun onAvailable(network: Network) {
                    portee.launch { auRetourDuReseau() }
                }
                override fun onCapabilitiesChanged(network: Network, capacites: NetworkCapabilities) {
                    portee.launch { auRetourDuReseau() }
                }
                override fun onLost(network: Network) {
                    portee.launch { _horsReseau.value = !reglages.reseauDisponible() }
                }
            })
        }
    }

    private suspend fun auRetourDuReseau() {
        val etait = _horsReseau.value
        _horsReseau.value = !reglages.reseauDisponible()
        if (_horsReseau.value) return
        reprendre()
        if (etait) rejouerEnAttente()
    }

    private fun oublierCompte() {
        travail?.cancel()
        avis.arrete()
        majFile { clear() }
        telechargements.toutSupprimer()
        oublierCache()
        preferences.edit().clear().apply()
        portee.launch {
            ecoutes.oublier()
            actions.oublier()
        }
    }
}
