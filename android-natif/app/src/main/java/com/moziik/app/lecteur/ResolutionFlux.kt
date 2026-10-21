package com.moziik.app.lecteur

import com.moziik.app.donnees.catalogue.DemandeQuota
import com.moziik.app.donnees.catalogue.Quota
import com.moziik.app.donnees.reseau.JsonMoziik
import com.moziik.app.donnees.reseau.messageDuCorps
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap

/**
 * Refus du site de servir un titre : 402 quota des visiteurs atteint,
 * 403 titre indisponible, 404 introuvable. Une IOException, pour que le
 * lecteur la reçoive comme une erreur de chargement.
 */
class ErreurFlux(val statut: Int, message: String?) : IOException(message)

/**
 * Transforme /api/stream/{id} en adresse du fichier audio.
 *
 * Le site répond par une redirection vers Cloudinary ou Karaks Storage.
 * Elle est suivie ici, une fois par titre, plutôt que par le lecteur à
 * chaque ouverture : le lecteur rouvre l'adresse à chaque déplacement dans
 * le morceau, et chaque passage par le site coûte une fonction serverless
 * et des lectures en base (spécification 5.2). Le fichier lui-même est
 * ensuite lu sans le jeton du compte.
 */
class ResolutionFlux(
    /** Le client authentifié de l'app : jeton posé, renouvelé sur 401. */
    private val client: OkHttpClient,
    private val site: String,
    private val estVisiteur: () -> Boolean,
    private val horloge: () -> Long = System::currentTimeMillis,
) {
    private val sansRedirection = client.newBuilder().followRedirects(false).followSslRedirects(false).build()
    private val resolues = ConcurrentHashMap<String, Pair<String, Long>>()

    /** L'adresse du fichier, ou null si `adresse` n'est pas un flux du site (fichier déjà résolu, par exemple). */
    fun resoudre(adresse: String): String? {
        val id = idDuFlux(adresse, site) ?: return null
        resolues[adresse]?.let { (cible, quand) -> if (horloge() - quand < VALIDITE_MS) return cible }

        // Le seul appel qui décompte une écoute de visiteur : /api/stream ne fait que vérifier (5.3).
        if (estVisiteur()) verifierQuota(id)

        sansRedirection.newCall(Request.Builder().url(adresse).build()).execute().use { reponse ->
            val emplacement = reponse.header("Location")
            if (reponse.isRedirect && emplacement != null) {
                val cible = reponse.request.url.resolve(emplacement)?.toString() ?: throw ErreurFlux(502, null)
                resolues[adresse] = cible to horloge()
                return cible
            }
            throw ErreurFlux(reponse.code, messageDuCorps(reponse.body?.string()))
        }
    }

    /** Un lien expiré chez l'hébergeur, un changement de compte : la prochaine lecture repasse par le site. */
    fun oublier() = resolues.clear()

    private fun verifierQuota(id: String) {
        val corps = JsonMoziik.encodeToString(DemandeQuota.serializer(), DemandeQuota(id)).toRequestBody(TYPE_JSON)
        val quota = try {
            client.newCall(Request.Builder().url("${site}api/ecoute/quota").post(corps).build()).execute().use { r ->
                if (!r.isSuccessful) return
                JsonMoziik.decodeFromString(Quota.serializer(), r.body?.string().orEmpty())
            }
        } catch (e: IOException) {
            // Réseau en panne : on laisse jouer, comme le site. /api/stream refusera de toute façon au-delà de la limite.
            return
        } catch (e: IllegalArgumentException) {
            return
        }
        if (!quota.autorise) throw ErreurFlux(402, "Limite d'écoute atteinte. Crée un compte pour continuer.")
    }

    private companion object {
        val TYPE_JSON = "application/json; charset=utf-8".toMediaType()
        /** Les liens de Karaks Storage valent 6 heures ; ceux de Cloudinary, moins : on redemande bien avant. */
        const val VALIDITE_MS = 30 * 60 * 1000L
    }
}
