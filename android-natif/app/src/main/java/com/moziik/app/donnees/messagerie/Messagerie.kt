package com.moziik.app.donnees.messagerie

import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Les formes de app/api/messagerie (lib/messagerie.ts du site), réduites à ce que l'app affiche. */

@Serializable
data class Participant(
    @SerialName("_id") val id: String,
    val name: String = "",
    val username: String? = null,
    val avatarUrl: String? = null,
    val gestionnaire: Boolean = false,
    /** Dernière activité : « En ligne » sous deux minutes (H4). */
    val vuLe: String? = null,
)

@Serializable
data class Saisissant(@SerialName("_id") val id: String, val name: String = "")

@Serializable
data class Conversation(
    @SerialName("_id") val id: String,
    /** direct, group ou assistant. */
    val type: String,
    val titre: String = "",
    val imageUrl: String? = null,
    val participants: List<Participant> = emptyList(),
    val interlocuteur: Participant? = null,
    val apercu: String = "",
    val dernierMessageLe: String? = null,
    val nonLus: Int = 0,
    val silencieux: Boolean = false,
    val gestionnaire: Boolean = false,
    /** Qui écrit en ce moment (« Écrit… »). */
    val saisie: List<Saisissant> = emptyList(),
)

@Serializable
data class ListeConversations(val conversations: List<Conversation> = emptyList(), val nonLus: Int = 0)

@Serializable
data class CompteurNonLus(val nonLus: Int = 0)

@Serializable
data class ReponseConversation(val conversation: Conversation)

/** Une carte de partage, figée à l'envoi : `chemin` est un chemin du site, traduit par le routeur de l'app. */
@Serializable
data class Partage(
    val type: String,
    val refId: String,
    val titre: String = "",
    val sousTitre: String? = null,
    val imageUrl: String? = null,
    val chemin: String = "",
)

@Serializable
data class Piece(
    val type: String,
    val url: String,
    val nom: String = "",
    val taille: Long? = null,
    val duree: Double? = null,
    val largeur: Int? = null,
    val hauteur: Int? = null,
)

@Serializable
data class Citation(val messageId: String, val auteurNom: String = "", val extrait: String = "")

/** Une réaction est une donnée saisie par un membre, affichée telle quelle (H7). */
@Serializable
data class Reaction(val emoji: String, val users: List<String> = emptyList())

@Serializable
data class Auteur(@SerialName("_id") val id: String, val name: String = "", val avatarUrl: String? = null)

@Serializable
data class MessageFil(
    @SerialName("_id") val id: String,
    /** membre ou assistant. */
    val role: String = "membre",
    val auteur: Auteur? = null,
    val corps: String = "",
    val partage: Partage? = null,
    val pieces: List<Piece> = emptyList(),
    val citation: Citation? = null,
    val reactions: List<Reaction> = emptyList(),
    val supprime: Boolean = false,
    val modifieLe: String? = null,
    val createdAt: String,
)

/** Jusqu'où un autre participant a lu : un message est lu par lui si sa date est antérieure. */
@Serializable
data class LectureMembre(val user: String, val luJusqua: String? = null)

@Serializable
data class PageMessages(
    val messages: List<MessageFil> = emptyList(),
    val encore: Boolean = false,
    val lecteurs: List<LectureMembre> = emptyList(),
    val saisie: List<Saisissant> = emptyList(),
)

@Serializable
data class PartageEnvoye(val type: String, val refId: String)

@Serializable
data class NouveauMessage(
    val corps: String,
    val partage: PartageEnvoye? = null,
    val repondA: String? = null,
    /** Déjà envoyées au stockage (K2) : 4 au plus par message (H11). */
    val pieces: List<Piece> = emptyList(),
)

@Serializable
data class ReponseMessage(val message: MessageFil)

@Serializable
data class ReactionEnvoyee(val emoji: String)

@Serializable
data class ModificationMessage(val corps: String)

@Serializable
data class Personne(
    @SerialName("_id") val id: String,
    val name: String = "",
    val username: String? = null,
    val avatarUrl: String? = null,
    val vuLe: String? = null,
)

/** `recents` : sans recherche, ce sont les contacts des conversations récentes. */
@Serializable
data class Destinataires(val personnes: List<Personne> = emptyList(), val recents: Boolean = false)

@Serializable
data class ConversationAOuvrir(val type: String = "direct", val destinataire: String)

/** Un groupe : 50 personnes au plus, créateur compris ; le titre est obligatoire (H5). */
@Serializable
data class NouveauGroupe(val type: String = "group", val membres: List<String>, val titre: String)

@Serializable
data class ChangementGestionnaire(val user: String, val actif: Boolean)

/** Les réglages d'une conversation (H9) : tout est réservé aux gestionnaires, sauf la sourdine. */
@Serializable
data class ModificationConversation(
    val titre: String? = null,
    val ajouter: List<String>? = null,
    val exclure: String? = null,
    val gestionnaire: ChangementGestionnaire? = null,
    val silencieux: Boolean? = null,
)

/**
 * La messagerie du compte connecté (H4 à H8). Le compteur de non-lus est
 * partagé : la barre du bas l'affiche, la liste et le fil le remettent à
 * jour.
 */
class Messagerie(private val api: MoziikApi) {
    private val _nonLus = MutableStateFlow(0)
    val nonLus: StateFlow<Int> = _nonLus.asStateFlow()

    suspend fun actualiserNonLus() {
        appel { api.nonLus().nonLus }.onSuccess { _nonLus.value = it }
    }

    fun oublierNonLus() {
        _nonLus.value = 0
    }

    /** L'assistant d'écoute a sa propre route, qui viendra avec lui : ses conversations ne sont pas listées. */
    suspend fun conversations(): List<Conversation> {
        val liste = appel { api.conversations() }.getOrThrow()
        _nonLus.value = liste.nonLus
        return liste.conversations.filter { it.type != "assistant" }
    }

    suspend fun conversation(id: String): Conversation = appel { api.conversation(id).conversation }.getOrThrow()

    suspend fun messages(id: String, avant: String? = null, depuis: String? = null): PageMessages =
        appel { api.messages(id, avant, depuis) }.getOrThrow()

    suspend fun envoyer(id: String, corps: String, partage: PartageEnvoye? = null, repondA: String? = null, pieces: List<Piece> = emptyList()): MessageFil =
        appel { api.envoyerMessage(id, NouveauMessage(corps, partage, repondA, pieces)).message }.getOrThrow()

    suspend fun creerGroupe(titre: String, membres: List<String>): Conversation =
        appel { api.creerGroupe(NouveauGroupe(membres = membres, titre = titre.trim().take(60))).conversation }.getOrThrow()

    suspend fun regler(id: String, modification: ModificationConversation): Conversation =
        appel { api.reglerConversation(id, modification).conversation }.getOrThrow()

    /** Quitter un groupe ; s'il n'y reste plus de gestionnaire, le plus ancien membre le devient (H9). */
    suspend fun quitter(id: String) {
        appel { api.quitterConversation(id) }.getOrThrow()
    }

    suspend fun modifier(message: String, corps: String): MessageFil = appel { api.modifierMessage(message, ModificationMessage(corps)).message }.getOrThrow()

    suspend fun supprimer(message: String): MessageFil = appel { api.supprimerMessage(message).message }.getOrThrow()

    /** Bascule une réaction de ce compte sur un message (H7). */
    suspend fun reagir(message: String, emoji: String): MessageFil = appel { api.reagir(message, ReactionEnvoyee(emoji)).message }.getOrThrow()

    /** Lu jusqu'au dernier message ; le compteur de la barre du bas suit. */
    suspend fun marquerLu(id: String) {
        appel { api.marquerLu(id) }.onSuccess { actualiserNonLus() }
    }

    /** « Écrit… » chez les autres ; une erreur n'est jamais montrée (H8). */
    suspend fun signalerSaisie(id: String) {
        appel { api.signalerSaisie(id) }
    }

    suspend fun destinataires(recherche: String?): Destinataires = appel { api.destinataires(recherche?.trim()?.ifEmpty { null }) }.getOrThrow()

    /** Un seul tête-à-tête par paire : le site renvoie celui qui existe déjà (H5). */
    suspend fun ouvrirAvec(personne: String): Conversation = appel { api.ouvrirConversation(ConversationAOuvrir(destinataire = personne)).conversation }.getOrThrow()
}
