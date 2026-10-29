package com.moziik.app.donnees.reseau

import com.moziik.app.donnees.session.StockageSession
import okhttp3.HttpUrl
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import java.io.File
import java.io.IOException
import java.security.MessageDigest

/** Signale à l'appelant qu'une réponse vient du cache : l'écran peut le dire. */
const val EN_TETE_CACHE = "X-Moziik-Cache"

/**
 * Les réponses GET de l'API gardées sur le téléphone (spécification 6.4,
 * lib/offlineApi.ts) : le réseau d'abord, toujours ; sans réseau, ou si
 * le site répond par une panne (5xx), la dernière réponse connue est
 * rendue telle quelle. Rangées par compte : un compte ne lit jamais le
 * cache d'un autre, et la déconnexion le garde (voir oublier).
 */
class CacheHorsLigne(
    private val dossier: File,
    private val site: HttpUrl?,
    private val stockage: StockageSession,
    private val horloge: () -> Long = System::currentTimeMillis,
) : Interceptor {
    private var ecritures = 0

    override fun intercept(chain: Interceptor.Chain): Response {
        val requete = chain.request()
        if (!eligible(requete)) return chain.proceed(requete)
        val fichier = File(File(dossier, compte()), empreinte(requete.url) + ".json")
        val reponse = try {
            chain.proceed(requete)
        } catch (e: IOException) {
            return garde(fichier, requete) ?: throw e
        }
        if (reponse.code >= 500) {
            garde(fichier, requete)?.let {
                reponse.close()
                return it
            }
            return reponse
        }
        if (reponse.code == 200 && reponse.header("Content-Type").orEmpty().contains("json")) {
            // Lu sans consommer : l'appelant reçoit la réponse intacte.
            val octets = runCatching { reponse.peekBody(TAILLE_MAX + 1).bytes() }.getOrNull()
            if (octets != null && octets.size <= TAILLE_MAX) ranger(fichier, octets)
        }
        return reponse
    }

    /**
     * Efface la copie d'un compte, à sa demande seulement. Une simple
     * déconnexion la garde : rangée sous l'identifiant du compte, elle
     * n'est lue par personne d'autre et sert de nouveau à son retour.
     */
    fun oublier(compteId: String) {
        val c = compteId.filter { it.isLetterOrDigit() }.ifEmpty { return }
        if (c != VISITEUR) File(dossier, c).deleteRecursively()
    }

    private fun compte(): String = stockage.lire()?.utilisateur?.id?.filter { it.isLetterOrDigit() }?.ifEmpty { null } ?: VISITEUR

    private fun eligible(r: Request): Boolean {
        if (r.method != "GET") return false
        if (site != null && r.url.host != site.host) return false
        val chemin = r.url.encodedPath
        if (!chemin.startsWith("/api/")) return false
        // Connexion, flux audio, quota, frappe et suivi en direct d'un fil : rien à rejouer hors connexion.
        if (EXCLUS.any { chemin.startsWith(it) } || chemin.endsWith("/stream") || chemin.endsWith("/saisie")) return false
        if (r.url.queryParameter("depuis") != null) return false
        return true
    }

    private fun garde(fichier: File, requete: Request): Response? {
        if (!fichier.exists()) return null
        if (horloge() - fichier.lastModified() > PEREMPTION_MS) {
            fichier.delete()
            return null
        }
        val octets = runCatching { fichier.readBytes() }.getOrNull() ?: return null
        return Response.Builder()
            .request(requete)
            .protocol(Protocol.HTTP_1_1)
            .code(200)
            .message("OK")
            .header("Content-Type", "application/json; charset=utf-8")
            .header(EN_TETE_CACHE, "1")
            .body(octets.toResponseBody(TYPE_JSON))
            .build()
    }

    @Synchronized
    private fun ranger(fichier: File, octets: ByteArray) {
        runCatching {
            fichier.parentFile?.mkdirs()
            val provisoire = File(fichier.parentFile, fichier.name + ".tmp")
            provisoire.writeBytes(octets)
            provisoire.renameTo(fichier)
            fichier.setLastModified(horloge())
        }
        // De temps en temps, les plus anciennes réponses partent pour tenir sous le plafond.
        if (++ecritures % 50 == 0) elaguer()
    }

    private fun elaguer() {
        val fichiers = dossier.walkTopDown().filter { it.isFile }.sortedBy { it.lastModified() }.toMutableList()
        var total = fichiers.sumOf { it.length() }
        while (total > PLAFOND && fichiers.isNotEmpty()) {
            val f = fichiers.removeAt(0)
            total -= f.length()
            f.delete()
        }
    }

    private fun empreinte(url: HttpUrl): String {
        val cle = url.encodedPath + "?" + (url.encodedQuery ?: "")
        return MessageDigest.getInstance("SHA-1").digest(cle.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    private companion object {
        const val VISITEUR = "visiteur"
        /** Une réponse de plusieurs mégaoctets ne mérite pas sa place. */
        const val TAILLE_MAX = 2_000_000L
        const val PLAFOND = 40L * 1024 * 1024
        /** Au-delà, une réponse n'est plus resservie (lib/offlineApi.ts). */
        const val PEREMPTION_MS = 30L * 24 * 60 * 60 * 1000
        val EXCLUS = listOf("/api/mobile-auth", "/api/auth", "/api/stream", "/api/ecoute")
        val TYPE_JSON = "application/json; charset=utf-8".toMediaType()
    }
}
