package com.moziik.app.donnees.push

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.moziik.app.BuildConfig
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.donnees.session.Session
import com.moziik.app.donnees.session.appel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.Serializable

@Serializable
data class AppareilPush(val jeton: String, val plateforme: String = "android")

@Serializable
data class JetonPush(val jeton: String)

/**
 * Les notifications push (H14, Firebase Cloud Messaging) : ce téléphone
 * s'inscrit auprès du site pour le compte connecté, et s'en retire à la
 * déconnexion. Sans configuration Firebase (firebase.properties), tout
 * reste inactif : l'app fonctionne comme avant, la cloche reste relue
 * chaque minute.
 */
class Push(private val contexte: Context, private val api: MoziikApi, private val session: Session, private val portee: CoroutineScope) {
    /** Vrai si l'app a été construite avec les identifiants du projet Firebase. */
    val actif: Boolean = BuildConfig.FIREBASE_APP.isNotBlank() && BuildConfig.FIREBASE_PROJET.isNotBlank()

    /** À appeler au démarrage du processus, avant tout usage de Firebase (pas de google-services.json). */
    fun initialiser() {
        if (!actif || FirebaseApp.getApps(contexte).isNotEmpty()) return
        FirebaseApp.initializeApp(
            contexte,
            FirebaseOptions.Builder()
                .setApplicationId(BuildConfig.FIREBASE_APP)
                .setApiKey(BuildConfig.FIREBASE_CLE)
                .setProjectId(BuildConfig.FIREBASE_PROJET)
                .setGcmSenderId(BuildConfig.FIREBASE_EXPEDITEUR)
                .build(),
        )
    }

    /** Chaque connexion (et chaque lancement connecté) inscrit ce téléphone : le site met à jour la date de dernière vue. */
    fun suivreSession() {
        if (!actif) return
        portee.launch {
            session.etat.distinctUntilChanged { a, b -> (a as? EtatSession.Connecte)?.utilisateur?.id == (b as? EtatSession.Connecte)?.utilisateur?.id }
                .collect { if (it is EtatSession.Connecte) inscrire() }
        }
    }

    private suspend fun jeton(): String? = runCatching { FirebaseMessaging.getInstance().token.await() }.getOrNull()

    suspend fun inscrire(jeton: String? = null) {
        if (!actif || session.etat.value !is EtatSession.Connecte) return
        val j = jeton ?: jeton() ?: return
        appel { api.inscrireAppareil(AppareilPush(j)) }
    }

    /** Firebase a changé le jeton de ce téléphone. */
    fun nouveauJeton(jeton: String) {
        portee.launch { inscrire(jeton) }
    }

    /** Avant la déconnexion, tant que le jeton d'accès vaut encore : ce téléphone ne sonne plus pour ce compte. */
    suspend fun retirer() {
        if (!actif || session.etat.value !is EtatSession.Connecte) return
        val j = jeton() ?: return
        appel { api.retirerAppareil(JetonPush(j)) }
    }
}
