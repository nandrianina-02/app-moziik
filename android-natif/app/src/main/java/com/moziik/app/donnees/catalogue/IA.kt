package com.moziik.app.donnees.catalogue

import com.moziik.app.donnees.messagerie.Conversation
import com.moziik.app.donnees.messagerie.MessageFil
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DemandeIA(val demande: String)

/** Un titre proposé par l'IA pour une playlist : toujours un titre réel du catalogue. */
@Serializable
data class TitrePropose(
    @SerialName("_id") val id: String,
    val title: String,
    val artiste: String = "",
    val genre: String? = null,
    val duration: Double? = null,
    val coverUrl: String? = null,
)

@Serializable
data class PropositionPlaylist(val titre: String, val description: String = "", val remarque: String = "", val songs: List<TitrePropose> = emptyList())

/** `proposition` vaut null quand le catalogue n'offre pas assez de titres pour la demande : ce n'est pas une erreur (F11). */
@Serializable
data class ReponsePropositionPlaylist(val proposition: PropositionPlaylist? = null)

@Serializable
data class InterpretationRecherche(val genres: List<String> = emptyList(), val langue: String? = null, val motsCles: List<String> = emptyList(), val explication: String = "")

@Serializable
data class ResultatRechercheIA(val interpretation: InterpretationRecherche? = null, val songs: List<Titre> = emptyList())

@Serializable
data class Traduction(val text: String, val target: String, val source: String = "auto")

@Serializable
data class Traduite(val translatedText: String, val detected: String? = null, val target: String = "", val moteur: String? = null)

@Serializable
data class FilAssistant(val conversation: Conversation, val disponible: Boolean = true)

/** La question enregistrée, la réponse de l'assistant ; `lancer` : la carte de la réponse se lance aussitôt (H12). */
@Serializable
data class EchangeAssistant(val question: MessageFil, val reponse: MessageFil, val lancer: Boolean = false)

/**
 * Les fonctions IA du site, chacune proposée seulement si l'administration
 * l'a activée (`SiteConfig.aiFeatures`, spécification A1).
 */
class FonctionsIA(private val api: MoziikApi, private val univers: suspend () -> String?) {
    @Volatile private var actives: Set<String>? = null

    suspend fun active(fonction: String): Boolean {
        val connues = actives ?: appel { api.configuration().aiFeatures.toSet() }.getOrNull()?.also { actives = it } ?: return false
        return fonction in connues
    }

    suspend fun composerPlaylist(demande: String): PropositionPlaylist? =
        appel { api.composerPlaylist(DemandeIA(demande.trim()), univers()).proposition }.getOrThrow()

    suspend fun chercherParDescription(demande: String): ResultatRechercheIA =
        appel { api.rechercheIA(DemandeIA(demande.trim())) }.getOrThrow().let { r -> r.copy(songs = r.songs.filter { it.publie }) }

    /** Une ligne traduite par ligne d'origine quand le service le permet (5.8). */
    suspend fun traduire(texte: String, cible: String): String = appel { api.traduire(Traduction(texte, cible)).translatedText }.getOrThrow()

    suspend fun filAssistant(): FilAssistant = appel { api.assistant() }.getOrThrow()

    suspend fun demanderAssistant(demande: String): EchangeAssistant = appel { api.demanderAssistant(DemandeIA(demande.trim()), univers()) }.getOrThrow()
}
