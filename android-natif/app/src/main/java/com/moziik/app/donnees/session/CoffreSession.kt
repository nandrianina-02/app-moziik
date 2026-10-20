package com.moziik.app.donnees.session

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.annotation.RequiresApi
import kotlinx.serialization.json.Json
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * La session, chiffrée sur le téléphone.
 *
 * Le jeton de renouvellement vaut 30 jours d'accès au compte : il n'est
 * jamais écrit en clair. Il est chiffré (AES-GCM) par une clé du Keystore
 * Android, qui ne quitte pas le matériel et n'est pas sauvegardée avec
 * l'app. Sous Android 6, le Keystore n'offre pas d'AES : la session reste
 * dans le stockage privé de l'app, que les autres applications ne lisent pas.
 */
class CoffreSession(contexte: Context) : StockageSession {
    private val preferences = contexte.getSharedPreferences("moziik-session", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }
    private val ecouteurs = mutableListOf<(SessionMobile?) -> Unit>()
    private var cache: SessionMobile? = null
    private var lue = false

    @Synchronized override fun lire(): SessionMobile? {
        if (!lue) {
            lue = true
            cache = try {
                preferences.getString(CLE, null)?.let { json.decodeFromString(SessionMobile.serializer(), dechiffrer(it)) }
            } catch (e: Exception) {
                // Clé perdue (restauration sur un autre téléphone) ou donnée abîmée : on repart déconnecté.
                preferences.edit().remove(CLE).apply()
                null
            }
        }
        return cache
    }

    @Synchronized override fun ecrire(session: SessionMobile) {
        cache = session
        lue = true
        preferences.edit().putString(CLE, chiffrer(json.encodeToString(SessionMobile.serializer(), session))).apply()
        ecouteurs.forEach { it(session) }
    }

    @Synchronized override fun effacer() {
        cache = null
        lue = true
        preferences.edit().remove(CLE).apply()
        ecouteurs.forEach { it(null) }
    }

    @Synchronized override fun surChangement(ecouteur: (SessionMobile?) -> Unit) {
        ecouteurs += ecouteur
    }

    private fun chiffrer(clair: String): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return clair
        val chiffre = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, cle()) }
        val donnees = chiffre.doFinal(clair.toByteArray(Charsets.UTF_8))
        return PREFIXE + Base64.encodeToString(chiffre.iv + donnees, Base64.NO_WRAP)
    }

    private fun dechiffrer(stocke: String): String {
        if (!stocke.startsWith(PREFIXE)) return stocke
        check(Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) { "Session chiffrée illisible sur cette version d'Android." }
        val octets = Base64.decode(stocke.removePrefix(PREFIXE), Base64.NO_WRAP)
        val chiffre = Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.DECRYPT_MODE, cle(), GCMParameterSpec(128, octets, 0, TAILLE_IV))
        }
        return String(chiffre.doFinal(octets, TAILLE_IV, octets.size - TAILLE_IV), Charsets.UTF_8)
    }

    @RequiresApi(Build.VERSION_CODES.M)
    private fun cle(): SecretKey {
        val magasin = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (magasin.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val generateur = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generateur.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generateur.generateKey()
    }

    private companion object {
        const val CLE = "session"
        const val ALIAS = "moziik-session"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val TAILLE_IV = 12
        /** Marque une valeur chiffrée : une session écrite avant Android 6 reste lisible après une mise à jour du système. */
        const val PREFIXE = "v1:"
    }
}
