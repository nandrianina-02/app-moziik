package com.moziik.app

import android.app.Application
import com.moziik.app.donnees.Conteneur

class MoziikApplication : Application() {
    /** Réseau et session, partagés par tous les écrans. */
    val conteneur by lazy { Conteneur(this) }

    override fun onCreate() {
        super.onCreate()
        // Avant tout message push : Firebase s'initialise ici, sans google-services.json.
        conteneur.push.initialiser()
        conteneur.push.suivreSession()
    }
}
