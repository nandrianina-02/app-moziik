package com.moziik.app.donnees.reseau

/**
 * Adresse d'une image du site (pochette, photo de profil). Le site renvoie
 * des adresses absolues (Cloudinary, Google) ou des chemins `/media/<id>`
 * relatifs à son origine ; un identifiant de stockage brut (« ks:… ») ne
 * s'affiche pas directement.
 */
fun adresseMedia(adresse: String?, site: String): String? = when {
    adresse.isNullOrBlank() -> null
    // file:// : la pochette d'un titre téléchargé, gardée sur le téléphone.
    adresse.startsWith("https://") || adresse.startsWith("http://") || adresse.startsWith("file://") -> adresse
    adresse.startsWith("/") -> site.trimEnd('/') + adresse
    else -> null
}
