package com.moziik.app.donnees.session

import com.moziik.app.donnees.reseau.UtilisateurCourt
import kotlinx.serialization.Serializable

/**
 * Une session mobile du site : un jeton d'accès de 15 minutes, un jeton de
 * renouvellement de 30 jours (lib/mobileAuth.ts), et le compte connecté.
 */
@Serializable
data class SessionMobile(
    val accessToken: String,
    val refreshToken: String,
    val utilisateur: UtilisateurCourt,
)

/**
 * Où vit la session. Lue et écrite depuis le fil réseau (renouvellement du
 * jeton) comme depuis l'interface : les implémentations sont synchronisées.
 */
interface StockageSession {
    fun lire(): SessionMobile?
    fun ecrire(session: SessionMobile)
    fun effacer()
    /** Prévenu à chaque changement, y compris quand le réseau efface une session expirée. */
    fun surChangement(ecouteur: (SessionMobile?) -> Unit)
}

/** En mémoire : pour les tests. */
class StockageSessionMemoire(initiale: SessionMobile? = null) : StockageSession {
    private var session = initiale
    private val ecouteurs = mutableListOf<(SessionMobile?) -> Unit>()

    @Synchronized override fun lire() = session

    @Synchronized override fun ecrire(session: SessionMobile) {
        this.session = session
        ecouteurs.forEach { it(session) }
    }

    @Synchronized override fun effacer() {
        session = null
        ecouteurs.forEach { it(null) }
    }

    @Synchronized override fun surChangement(ecouteur: (SessionMobile?) -> Unit) {
        ecouteurs += ecouteur
    }
}
