package com.moziik.app.donnees.compte

import android.content.Context
import com.moziik.app.BuildConfig
import com.moziik.app.donnees.reseau.JsonMoziik
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import okhttp3.OkHttpClient
import okhttp3.Request

/** Une version plus récente que celle installée, annoncée par le site. */
data class VersionDisponible(val version: String, val adresse: String, val tailleMo: Double?)

/** « 2.16.0 » contre « 2.9.1 » : chiffre par chiffre, pas en texte. */
fun plusRecente(candidate: String, installee: String): Boolean {
    fun nombres(v: String) = v.trim().removePrefix("v").split('.', '-').map { it.toIntOrNull() ?: 0 }
    val a = nombres(candidate)
    val b = nombres(installee)
    for (i in 0 until maxOf(a.size, b.size)) {
        val x = a.getOrElse(i) { 0 }
        val y = b.getOrElse(i) { 0 }
        if (x != y) return x > y
    }
    return false
}

/** Le nom du fichier joint à chaque publication : constant, pour que le lien « latest » ne change jamais. */
const val FICHIER_APK = "moziik.apk"

/** Le lien permanent vers la dernière version publiée, à donner aux utilisateurs. */
const val LIEN_DERNIERE_VERSION = "https://github.com/nandrianina-02/app-moziik/releases/latest/download/$FICHIER_APK"

private const val API_PUBLICATIONS = "https://api.github.com/repos/nandrianina-02/app-moziik/releases/latest"

@Serializable
private data class Publication(
    @SerialName("tag_name") val tag: String = "",
    val draft: Boolean = false,
    val prerelease: Boolean = false,
    val assets: List<FichierPublie> = emptyList(),
)

@Serializable
private data class FichierPublie(
    val name: String = "",
    @SerialName("browser_download_url") val adresse: String = "",
    val size: Long = 0,
)

/** La version d'une publication GitHub (réponse de releases/latest), ou null si elle n'a pas d'APK. */
fun versionPubliee(json: String): VersionDisponible? {
    val p = runCatching { JsonMoziik.decodeFromString(Publication.serializer(), json) }.getOrNull() ?: return null
    if (p.draft || p.prerelease || p.tag.isBlank()) return null
    val apk = p.assets.firstOrNull { it.name == FICHIER_APK } ?: return null
    return VersionDisponible(p.tag.removePrefix("v"), apk.adresse, apk.size.takeIf { it > 0 }?.let { it / 1_048_576.0 })
}

/** Entre l'annonce du site et la publication GitHub, la plus récente. */
fun laPlusRecente(a: VersionDisponible?, b: VersionDisponible?): VersionDisponible? = when {
    a == null -> b
    b == null -> a
    plusRecente(b.version, a.version) -> b
    else -> a
}

/**
 * Tant que l'app n'est pas sur le Play Store, rien ne la met à jour toute
 * seule. Deux sources annoncent la dernière version : les publications du
 * dépôt GitHub, créées à chaque version signée (lien public et permanent),
 * et les réglages androidVersion / androidApkUrl de l'administration du
 * site, qui restent utilisables pour pointer ailleurs. La plus récente est
 * proposée, une fois par version. Seule la version publiée est concernée :
 * la version de test a ses propres constructions.
 */
class MiseAJour(
    contexte: Context,
    private val api: MoziikApi,
    private val client: OkHttpClient,
    private val site: String,
) {
    private val preferences = contexte.getSharedPreferences("mise-a-jour", Context.MODE_PRIVATE)

    /**
     * `demandee` : la recherche lancée à la main depuis les Paramètres. Elle
     * passe outre « Plus tard », qui ne vaut que pour la proposition faite au
     * démarrage : sinon, elle répondrait « à jour » à qui ne l'est pas.
     */
    suspend fun disponible(demandee: Boolean = false): VersionDisponible? {
        if (BuildConfig.APPLICATION_ID != "com.moziik.app") return null
        val candidate = laPlusRecente(duSite(), deGithub()) ?: return null
        if (!plusRecente(candidate.version, BuildConfig.VERSION_NAME)) return null
        if (!demandee && preferences.getString("ignoree", null) == candidate.version) return null
        return candidate
    }

    private suspend fun duSite(): VersionDisponible? {
        val config = appel { api.configuration() }.getOrNull() ?: return null
        val version = config.androidVersion?.takeIf { it.isNotBlank() } ?: return null
        val chemin = config.androidApkUrl?.takeIf { it.isNotBlank() } ?: return null
        val adresse = if (chemin.startsWith("http")) chemin else site.trimEnd('/') + "/" + chemin.trimStart('/')
        return VersionDisponible(version, adresse, config.androidSizeMB)
    }

    /** Un échec (réseau, limite d'appels de GitHub) ne fait que taire cette source. */
    private suspend fun deGithub(): VersionDisponible? = withContext(Dispatchers.IO) {
        runCatching {
            val requete = Request.Builder().url(API_PUBLICATIONS).header("Accept", "application/vnd.github+json").build()
            client.newCall(requete).execute().use { r -> if (r.isSuccessful) versionPubliee(r.body?.string().orEmpty()) else null }
        }.getOrNull()
    }

    /** « Plus tard » : on ne reparle de cette version qu'à la suivante. */
    fun ignorer(version: String) {
        preferences.edit().putString("ignoree", version).apply()
    }
}
