package com.moziik.app.donnees.compte

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import com.moziik.app.donnees.reseau.JsonMoziik
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.theme.PreferenceTheme
import com.moziik.app.donnees.session.appel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable

// ------------------------------------------------------------ Formes de l'API

/** Le thème tel que le site le stocke (lib/theme.ts) : couleurs #RRGGBB, rayon en pixels. */
@Serializable
data class ThemeSite(
    val preset: String = "moziik",
    val mode: String = "dark",
    val accent: String = "#FF6B4A",
    val backgroundDark: String = "#0D0F1A",
    val backgroundLight: String = "#FBF9F4",
    val secondary: String = "#3DDC97",
    val warning: String = "#FBBF24",
    val radius: Int = 12,
)

/** Le thème du site dans la forme de la palette de l'app (theme/Palette.kt, portage de lib/theme.ts). */
fun ThemeSite.versPreference() = PreferenceTheme(
    preset = preset,
    mode = when (mode) {
        "light" -> com.moziik.app.theme.ChoixMode.CLAIR
        "system" -> com.moziik.app.theme.ChoixMode.SYSTEME
        else -> com.moziik.app.theme.ChoixMode.SOMBRE
    },
    accent = accent,
    fondSombre = backgroundDark,
    fondClair = backgroundLight,
    secondaire = secondary,
    alerte = warning,
    rayon = radius,
)

fun themeDepuisJson(json: String): PreferenceTheme? =
    runCatching { JsonMoziik.decodeFromString(ThemeSite.serializer(), json).versPreference() }.getOrNull()

@Serializable
data class ConfigurationTheme(val theme: ThemeSite? = null)

@Serializable
data class ThemesCompte(val theme: ThemeSite? = null, val siteTheme: ThemeSite? = null, val hasPremium: Boolean = false)

@Serializable
data class Abonnement(
    val plan: String = "free",
    val amount: Double? = null,
    val currency: String? = null,
    val paymentMethod: String? = null,
    val status: String = "active",
    val startedAt: String? = null,
    val currentPeriodEnd: String? = null,
)

@Serializable
data class EtatAbonnement(val subscription: Abonnement? = null, val hasPremium: Boolean = false)

@Serializable
data class Appareil(val id: String, val device: String = "Appareil inconnu", val createdAt: String? = null, val expiresAt: String? = null)

@Serializable
data class Appareils(val devices: List<Appareil> = emptyList())

@Serializable
data class ChangementMotDePasse(val currentPassword: String? = null, val newPassword: String)

@Serializable
data class ModificationProfil(val name: String? = null, val username: String? = null, val avatarUrl: String? = null)

@Serializable
data class ChoixUnivers(val univers: String)

@Serializable
data class ChoixMode(val mode: String)

@Serializable
data class ModeCourant(val mode: String? = null)

// ------------------------------------------------------------ Le compte

/**
 * Les réglages du compte connecté (domaines A, B et C) : préférences,
 * sécurité, abonnement. `premium` est lu une fois et partagé ; une panne
 * réseau le laisse à faux (C1).
 */
class Compte(private val api: MoziikApi) {
    private val _premium = MutableStateFlow(false)
    val premium: StateFlow<Boolean> = _premium.asStateFlow()

    suspend fun abonnement(): EtatAbonnement = appel { api.abonnement() }.getOrThrow().also { _premium.value = it.hasPremium }

    suspend fun actualiserPremium() {
        appel { api.abonnement().hasPremium }.onSuccess { _premium.value = it }.onFailure { _premium.value = false }
    }

    fun oublierPremium() {
        _premium.value = false
    }

    suspend fun appareils(): List<Appareil> = appel { api.appareils().devices }.getOrThrow()

    suspend fun deconnecterAppareil(id: String) {
        appel { api.deconnecterAppareil(id) }.getOrThrow()
    }

    /** Ferme toutes les sessions, y compris celle-ci (B12). */
    suspend fun toutFermer() {
        appel { api.fermerToutesLesSessions() }.getOrThrow()
    }

    suspend fun changerMotDePasse(actuel: String?, nouveau: String) {
        appel { api.changerMotDePasse(ChangementMotDePasse(actuel?.ifEmpty { null }, nouveau)) }.getOrThrow()
    }

    suspend fun modifierProfil(nom: String?, nomUtilisateur: String?) {
        appel { api.modifierProfil(ModificationProfil(nom?.trim(), nomUtilisateur?.trim()?.lowercase())) }.getOrThrow()
    }

    /** `adresse` : `/media/<fichierId>` d'une photo déjà envoyée (dossier avatars). */
    suspend fun changerPhoto(adresse: String) {
        appel { api.modifierProfil(ModificationProfil(avatarUrl = adresse)) }.getOrThrow()
    }

    suspend fun changerUnivers(univers: String) {
        appel { api.changerUnivers(ChoixUnivers(univers)) }.getOrThrow()
    }

    suspend fun mode(): String? = appel { api.mode().mode }.getOrNull()

    suspend fun changerMode(mode: String) {
        appel { api.changerMode(ChoixMode(mode)) }.getOrThrow()
    }

    /** Le thème appliqué : le thème personnel d'un abonné s'il en a un, sinon celui du site (A5). */
    suspend fun themeApplique(connecte: Boolean): ThemeSite? {
        if (connecte) {
            appel { api.themes() }.getOrNull()?.let { t -> return if (t.hasPremium && t.theme != null) t.theme else t.siteTheme }
        }
        return appel { api.themeDuSite().theme }.getOrNull()
    }
}

// ------------------------------------------------------------ Réglages de l'appareil

/**
 * Ce qui se règle sur l'appareil seulement, sans le compte : qualité
 * d'écoute, économie de données, mode clair ou sombre, et le dernier thème
 * connu pour un affichage immédiat au lancement (spécification 5.7, A5).
 */
class ReglagesAppareil(private val contexte: Context) {
    private val preferences = contexte.getSharedPreferences("reglages", Context.MODE_PRIVATE)

    private val _qualite = MutableStateFlow(preferences.getString("qualite", "high") ?: "high")
    /** low, medium ou high : un souhait, plafonné par le site selon l'abonnement. */
    val qualite: StateFlow<String> = _qualite.asStateFlow()

    private val _economie = MutableStateFlow(preferences.getString("economie", "auto") ?: "auto")
    /** auto, toujours ou jamais. */
    val economie: StateFlow<String> = _economie.asStateFlow()

    private val _apparence = MutableStateFlow(preferences.getString("apparence", null))
    /** clair, sombre, systeme, ou null pour suivre le thème du site. */
    val apparence: StateFlow<String?> = _apparence.asStateFlow()

    fun choisirQualite(q: String) = ecrire("qualite", q).also { _qualite.value = q }
    fun choisirEconomie(e: String) = ecrire("economie", e).also { _economie.value = e }
    fun choisirApparence(a: String?) = ecrire("apparence", a).also { _apparence.value = a }

    private val _noirProfond = MutableStateFlow(preferences.getBoolean("noirProfond", false))
    /** Fond noir pur en mode sombre (écrans OLED). */
    val noirProfond: StateFlow<Boolean> = _noirProfond.asStateFlow()

    fun choisirNoirProfond(oui: Boolean) {
        preferences.edit().putBoolean("noirProfond", oui).apply()
        _noirProfond.value = oui
    }

    private val _suite = MutableStateFlow(preferences.getString("suite", "ambiance") ?: "ambiance")
    /** Ce qui suit une file finie : ambiance, rythme, artiste, decouverte, populaires ou arret (lecteur/Prolongement.kt). */
    val suite: StateFlow<String> = _suite.asStateFlow()

    fun choisirSuite(cle: String) = ecrire("suite", cle).also { _suite.value = cle }

    private val _wifiSeulement = MutableStateFlow(preferences.getBoolean("wifiSeulement", false))
    /** Les téléchargements attendent un réseau non facturé (spécification 6.2). */
    val wifiSeulement: StateFlow<Boolean> = _wifiSeulement.asStateFlow()

    fun choisirWifiSeulement(oui: Boolean) {
        preferences.edit().putBoolean("wifiSeulement", oui).apply()
        _wifiSeulement.value = oui
    }

    var themeGarde: String?
        get() = preferences.getString("theme", null)
        set(valeur) = ecrire("theme", valeur)

    private fun ecrire(cle: String, valeur: String?) {
        preferences.edit().putString(cle, valeur).apply()
    }

    /**
     * La qualité réellement demandée : 64 kb/s quand l'économie s'applique,
     * c'est-à-dire toujours, ou en automatique sur un réseau facturé à la
     * consommation ou avec l'économiseur de données d'Android. Un réseau
     * inconnu n'est jamais traité comme mobile (5.7).
     */
    fun qualiteEffective(): String {
        val economise = when (_economie.value) {
            "toujours" -> true
            "jamais" -> false
            else -> reseauFacture()
        }
        return if (economise) "low" else _qualite.value
    }

    fun economieActive(): Boolean = qualiteEffective() == "low" && _qualite.value != "low"

    /** Un réseau joignable, quel qu'il soit. */
    fun reseauDisponible(): Boolean {
        val connectivite = contexte.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return true
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            @Suppress("DEPRECATION")
            return connectivite.activeNetworkInfo?.isConnected == true
        }
        val capacites = connectivite.getNetworkCapabilities(connectivite.activeNetwork ?: return false) ?: return false
        return capacites.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    fun reseauFacture(): Boolean {
        val connectivite = contexte.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N &&
            connectivite.restrictBackgroundStatus == ConnectivityManager.RESTRICT_BACKGROUND_STATUS_ENABLED
        ) {
            return true
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return connectivite.isActiveNetworkMetered
        val capacites = connectivite.getNetworkCapabilities(connectivite.activeNetwork ?: return false) ?: return false
        return capacites.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
            !capacites.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
    }
}
