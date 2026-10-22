package com.moziik.app.donnees.catalogue

import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** L'auteur d'un commentaire : sans nom d'utilisateur, donc sans lien de profil ; null pour un compte supprimé. */
@Serializable
data class AuteurCommentaire(@SerialName("_id") val id: String? = null, val name: String? = null, val avatarUrl: String? = null)

/**
 * Un commentaire (models/Comment.ts). Les champs de modération du site
 * (sentiment, signalement) ne sont pas lus : ils ne s'affichent jamais.
 */
@Serializable
data class Commentaire(
    @SerialName("_id") val id: String,
    /** L'identifiant du titre commenté (jamais peuplé). */
    @SerialName("song") val titreId: String? = null,
    val user: AuteurCommentaire? = null,
    val text: String = "",
    /** Le moment du titre auquel il se rapporte, en secondes. */
    val timestampInSong: Double? = null,
    val parentComment: String? = null,
    val createdAt: String? = null,
    /** Seulement dans les commentaires d'un album : le titre commenté. */
    val songTitle: String? = null,
)

@Serializable
data class ListeCommentaires(val comments: List<Commentaire> = emptyList(), val total: Int? = null)

@Serializable
data class ReponseCommentaire(val comment: Commentaire)

@Serializable
data class NouveauCommentaire(val text: String, val timestampInSong: Double? = null, val parentComment: String? = null)

/** Un commentaire et ses réponses, sur un seul niveau. */
data class Fil(val racine: Commentaire, val reponses: List<Commentaire>)

/** Un morceau de texte affichable : texte ordinaire, ou mention `@quelquun`. */
data class Morceau(val texte: String, val mention: String? = null)

/** Le motif de lib/mentions.ts, à l'identique : une adresse e-mail n'est pas une mention. */
private val MOTIF_MENTION = Regex("(^|[^\\p{L}\\p{N}@._])@([a-zA-Z0-9._]{3,20})")

object FilsDeCommentaires {
    /**
     * Les fils, du plus récent au plus ancien ; les réponses dans l'ordre
     * de la conversation. Une réponse dont le commentaire a été supprimé
     * reste en base (le site ne les retire pas) : elle est masquée.
     */
    fun fils(commentaires: List<Commentaire>): List<Fil> {
        val ids = commentaires.map { it.id }.toSet()
        val reponses = commentaires.filter { it.parentComment != null && it.parentComment in ids }.groupBy { it.parentComment!! }
        return commentaires
            .filter { it.parentComment == null }
            .sortedByDescending { it.createdAt.orEmpty() }
            .map { r -> Fil(r, reponses[r.id].orEmpty().sortedBy { it.createdAt.orEmpty() }) }
    }

    /** Le texte découpé en morceaux, les mentions à part (decouperMentions de lib/mentions.ts). */
    fun morceaux(texte: String): List<Morceau> {
        val resultat = mutableListOf<Morceau>()
        var curseur = 0
        for (m in MOTIF_MENTION.findAll(texte)) {
            val nom = m.groupValues[2].trimEnd('.', '_')
            if (nom.length < 3) continue
            val debutMention = m.range.first + m.groupValues[1].length
            if (debutMention > curseur) resultat += Morceau(texte.substring(curseur, debutMention))
            resultat += Morceau("@$nom", mention = nom.lowercase())
            curseur = debutMention + 1 + nom.length
        }
        if (curseur < texte.length) resultat += Morceau(texte.substring(curseur))
        return resultat
    }
}

/** Les commentaires d'un titre ou d'un album (H1). */
class Commentaires(private val api: MoziikApi) {
    suspend fun duTitre(id: String): List<Commentaire> = appel { api.commentaires(id).comments }.getOrThrow()

    suspend fun delAlbum(id: String): ListeCommentaires = appel { api.commentairesAlbum(id) }.getOrThrow()

    /** Le texte est rogné ; 1 à 2000 caractères, comme le valide le site. */
    suspend fun publier(titreId: String, texte: String, moment: Double?, parent: String?): Commentaire =
        appel { api.commenter(titreId, NouveauCommentaire(texte.trim().take(2000), moment, parent)).comment }.getOrThrow()

    suspend fun supprimer(id: String) {
        appel { api.supprimerCommentaire(id) }.getOrThrow()
    }
}
