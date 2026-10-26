package com.moziik.app.donnees.compte

import android.content.Context
import com.moziik.app.BuildConfig
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel

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

/**
 * Tant que l'app n'est pas sur le Play Store, rien ne la met à jour toute
 * seule : le site annonce la dernière version (réglages androidVersion et
 * androidApkUrl de l'administration), et l'app la propose une fois par
 * version. Seule la version publiée est concernée : la version de test a
 * ses propres constructions.
 */
class MiseAJour(contexte: Context, private val api: MoziikApi, private val site: String) {
    private val preferences = contexte.getSharedPreferences("mise-a-jour", Context.MODE_PRIVATE)

    suspend fun disponible(): VersionDisponible? {
        if (BuildConfig.APPLICATION_ID != "com.moziik.app") return null
        val config = appel { api.configuration() }.getOrNull() ?: return null
        val version = config.androidVersion?.takeIf { it.isNotBlank() } ?: return null
        val chemin = config.androidApkUrl?.takeIf { it.isNotBlank() } ?: return null
        if (!plusRecente(version, BuildConfig.VERSION_NAME)) return null
        if (preferences.getString("ignoree", null) == version) return null
        val adresse = if (chemin.startsWith("http")) chemin else site.trimEnd('/') + "/" + chemin.trimStart('/')
        return VersionDisponible(version, adresse, config.androidSizeMB)
    }

    /** « Plus tard » : on ne reparle de cette version qu'à la suivante. */
    fun ignorer(version: String) {
        preferences.edit().putString("ignoree", version).apply()
    }
}
