package com.moziik.app.donnees.envoi

import com.moziik.app.donnees.reseau.ErreurApi
import com.moziik.app.donnees.reseau.JsonMoziik
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

/** L'annonce d'un fichier au site, avant d'envoyer ses octets (K2). */
@Serializable
data class AnnonceFichier(val nom: String, val type: String, val taille: Long, val dossier: String, val duree: Double? = null)

@Serializable
data class OuvertureEnvoi(
    /** karaks-storage, ou cloudinary tant que le stockage n'est pas configuré (inutilisable en natif). */
    val mode: String,
    val fichierId: String? = null,
    val adresseEnvoi: String? = null,
    val tailleMorceau: Long = 4L * 1024 * 1024,
)

/**
 * L'envoi d'un fichier (K2, lib/envoiFichier.ts) : le site ouvre la
 * session et rend une adresse à jeton ; les octets y partent directement,
 * par morceaux, sans passer par Moziik. Une coupure ne fait pas tout
 * recommencer : le stockage dit combien il a reçu, et l'envoi reprend de
 * là.
 */
class EnvoiFichiers(
    private val api: MoziikApi,
    /** Sans jeton : l'adresse d'envoi porte le sien, celui du compte n'a rien à faire chez l'hébergeur. */
    private val client: OkHttpClient,
) {
    /** Rend l'adresse à enregistrer, `/media/<fichierId>`. */
    suspend fun envoyer(octets: ByteArray, nom: String, type: String, dossier: String, progression: (Float) -> Unit = {}): String {
        val ouverture = appel { api.ouvrirEnvoi(AnnonceFichier(nom, type, octets.size.toLong(), dossier)) }.getOrThrow()
        val adresse = ouverture.adresseEnvoi
        val id = ouverture.fichierId
        if (ouverture.mode != "karaks-storage" || adresse == null || id == null) {
            throw ErreurApi(503, "L'envoi de fichiers n'est pas disponible pour le moment.")
        }
        withContext(Dispatchers.IO) { deposer(octets, adresse, ouverture.tailleMorceau.coerceAtLeast(256 * 1024), progression) }
        return "/media/$id"
    }

    private suspend fun deposer(octets: ByteArray, adresse: String, morceau: Long, progression: (Float) -> Unit) {
        val total = octets.size.toLong()
        var envoye = 0L
        var essais = 0
        while (envoye < total) {
            val fin = minOf(envoye + morceau, total)
            try {
                val corps = octets.toRequestBody(null, envoye.toInt(), (fin - envoye).toInt())
                val requete = Request.Builder().url(adresse).put(corps).header("Content-Range", "bytes $envoye-${fin - 1}/$total").build()
                val reponse = client.newCall(requete).execute().use { r -> r.code to lire(r.body?.string()) }
                val (statut, json) = reponse
                if (statut !in 200..299) {
                    val message = (json?.get("error") as? JsonObject)?.get("message")?.jsonPrimitive?.content ?: "Le fichier a été refusé par le stockage."
                    // Un refus (format, quota) ne change pas en réessayant ; une panne passagère, si.
                    if (statut in 400..499 && statut != 429) throw ErreurApi(statut, message)
                    throw IOException(message)
                }
                if (json?.get("file") != null) {
                    progression(1f)
                    return
                }
                envoye = recu(json) ?: fin
                essais = 0
                progression(envoye.toFloat() / total)
            } catch (e: ErreurApi) {
                throw e
            } catch (e: IOException) {
                if (essais >= ESSAIS) throw e
                essais++
                delay(1000L shl (essais - 1))
                // Après une coupure, c'est le stockage qui fait foi.
                val etat = runCatching {
                    client.newCall(Request.Builder().url(adresse).build()).execute().use { lire(it.body?.string()) }
                }.getOrNull()
                if (etat?.get("file") != null) return
                recu(etat)?.let { envoye = it }
            }
        }
    }

    private fun lire(texte: String?): JsonObject? = runCatching { JsonMoziik.parseToJsonElement(texte.orEmpty()).jsonObject }.getOrNull()

    private fun recu(json: JsonObject?): Long? = (json?.get("upload") as? JsonObject)?.get("received")?.jsonPrimitive?.longOrNull

    private companion object {
        const val ESSAIS = 4
    }
}
