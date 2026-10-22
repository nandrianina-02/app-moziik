package com.moziik.app.donnees.catalogue

import java.net.URLDecoder

/**
 * Où mène un lien venu des données du site (`linkHref`, `href`, `link`) :
 * ce sont des chemins du site, que l'app traduit vers ses propres écrans ou
 * vers une lecture (routeur interne, spécification K4).
 */
sealed interface Cible {
    data class DeTitre(val id: String) : Cible
    data class DAlbum(val id: String) : Cible
    data class DePlaylist(val id: String) : Cible
    data class DArtiste(val id: String) : Cible
    /** Lancer la station d'un genre (vignettes de la page Radio). */
    data class DeGenre(val genre: String) : Cible
    data class DeRecherche(val terme: String) : Cible
    /** Tous les titres, filtrés ou non par genre (`/titres?genre=`). */
    data class Titres(val genre: String?) : Cible
    data class Classements(val type: String?, val periode: String?) : Cible
    data class Radio(val station: String?) : Cible
    data object Evenements : Cible
    data class DEvenement(val id: String) : Cible
    /** `#recommendations` : une section de l'accueil. */
    data class Ancre(val cle: String) : Cible
    data class Externe(val adresse: String) : Cible
    /** Une page que l'app n'a pas encore : le lien est ignoré plutôt que de mener à un écran vide. */
    data object Inconnue : Cible
}

private val OBJECT_ID = Regex("[0-9a-fA-F]{24}")

fun cibleDe(lien: String, site: String): Cible {
    val texte = lien.trim()
    if (texte.startsWith("#")) return texte.drop(1).takeIf { it.isNotEmpty() }?.let { Cible.Ancre(it) } ?: Cible.Inconnue
    val origine = site.trimEnd('/')
    val chemin = when {
        texte.startsWith(origine) -> texte.removePrefix(origine).ifEmpty { "/" }
        texte.startsWith("http://") || texte.startsWith("https://") -> return Cible.Externe(texte)
        texte.startsWith("/") -> texte
        else -> return Cible.Inconnue
    }
    val (route, requete) = chemin.substringBefore('#').let { it.substringBefore('?') to it.substringAfter('?', "") }
    val parametres = requete.split('&').filter { '=' in it }.associate {
        it.substringBefore('=') to URLDecoder.decode(it.substringAfter('='), "UTF-8")
    }
    val segments = route.trim('/').split('/').filter { it.isNotEmpty() }
    val id = segments.getOrNull(1)?.takeIf { OBJECT_ID.matches(it) && segments.size == 2 }
    return when (segments.firstOrNull()) {
        "son" -> id?.let { Cible.DeTitre(it) }
        "album" -> id?.let { Cible.DAlbum(it) }
        "playlist" -> id?.let { Cible.DePlaylist(it) }
        // /artiste/gestion et les autres pages de l'espace artiste ne sont pas des fiches : l'identifiant est vérifié.
        "artiste" -> id?.let { Cible.DArtiste(it) }
        "titres" -> Cible.Titres(parametres["genre"]?.takeIf { it.isNotBlank() })
        "recherche" -> parametres["q"]?.takeIf { it.isNotBlank() }?.let { Cible.DeRecherche(it) }
        "classements" -> Cible.Classements(parametres["type"], parametres["period"])
        "radio" -> Cible.Radio(parametres["station"]?.takeIf { it.isNotBlank() })
        "evenements" -> if (segments.size == 1) Cible.Evenements else id?.let { Cible.DEvenement(it) }
        else -> null
    } ?: Cible.Inconnue
}
