package com.moziik.app.lecteur

import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import com.moziik.app.donnees.Conteneur
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.session.EtatSession

private const val RACINE = "racine"
private const val POUR_TOI = "pour-toi"
private const val TENDANCES = "tendances"
private const val RECENTS = "recents"
private const val AIMES = "aimes"
private const val TELECHARGES = "telecharges"

/**
 * Ce qu'Android Auto montre de Moziik : quelques listes prêtes à jouer, sans
 * saisie ni écran à lire en conduisant. Les listes d'un compte n'apparaissent
 * qu'une fois connecté ; les téléchargements restent, utiles hors réseau.
 */
internal class ArborescenceAuto(private val c: Conteneur, private val site: String) {
    /** Les listes servies, pour qu'un titre choisi lance toute sa liste à partir de lui. */
    private val listes = HashMap<String, List<MediaItem>>()
    private val parents = HashMap<String, String>()

    val racine: MediaItem = dossier(RACINE, "Moziik")

    private fun libelle(id: String) = when (id) {
        POUR_TOI -> "Pour toi"
        TENDANCES -> "Tendances"
        RECENTS -> "Écoutés récemment"
        AIMES -> "Titres aimés"
        TELECHARGES -> "Téléchargements"
        else -> "Moziik"
    }

    private fun categories(): List<MediaItem> {
        val connecte = c.session.etat.value is EtatSession.Connecte
        val ids = if (connecte) listOf(POUR_TOI, RECENTS, AIMES, TENDANCES, TELECHARGES) else listOf(POUR_TOI, TENDANCES, TELECHARGES)
        return ids.map { dossier(it, libelle(it)) }
    }

    suspend fun enfants(id: String): List<MediaItem> {
        if (id == RACINE) return categories()
        val titres: List<Titre> = when (id) {
            POUR_TOI -> c.catalogue.station().titres
            TENDANCES -> c.catalogue.tendances()
            RECENTS -> c.bibliotheque.recents()
            AIMES -> c.bibliotheque.titresAimes()
            TELECHARGES -> c.horsLigne.telechargements.titres.value.map(c.horsLigne.telechargements::versTitre)
            else -> return emptyList()
        }
        val qualite = c.reglages.qualiteEffective()
        val elements = titres.filter { it.publie }.distinctBy { it.id }.map { it.versElement(site, libelle(id), qualite) }
        listes[id] = elements
        elements.forEach { parents[it.mediaId] = id }
        return elements
    }

    fun element(id: String): MediaItem? = if (id == RACINE) racine else parents[id]?.let { p -> listes[p]?.firstOrNull { it.mediaId == id } }

    /** Un titre choisi dans une liste d'Android Auto : toute la liste, à partir de lui. */
    fun listeDe(id: String): Pair<List<MediaItem>, Int>? {
        val liste = parents[id]?.let { listes[it] } ?: return null
        val index = liste.indexOfFirst { it.mediaId == id }
        return if (index < 0) null else liste to index
    }

    private fun dossier(id: String, titre: String): MediaItem = MediaItem.Builder()
        .setMediaId(id)
        .setMediaMetadata(
            MediaMetadata.Builder()
                .setTitle(titre)
                .setIsBrowsable(true)
                .setIsPlayable(false)
                .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_MIXED)
                .build(),
        )
        .build()
}

/** Une page d'une liste, quand le navigateur multimédia en demande une. */
internal fun <T> paginer(liste: List<T>, page: Int, taille: Int): List<T> {
    if (taille <= 0 || taille == Int.MAX_VALUE) return liste
    val debut = page.toLong() * taille
    if (debut >= liste.size) return emptyList()
    return liste.subList(debut.toInt(), minOf(liste.size, (debut + taille).toInt()))
}
