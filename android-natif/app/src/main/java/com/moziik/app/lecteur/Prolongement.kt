package com.moziik.app.lecteur

import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.catalogue.heureLocale
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel

/** Titres retenus pour prolonger la file : jouables, jamais déjà vus, sans doublon (spécification 5.6). */
fun retenirSuite(candidats: List<Titre>, exclus: Set<String>, maximum: Int = TITRES_PAR_TOUR): List<Titre> =
    candidats.asSequence()
        .filter { it.publie && it.id !in exclus }
        .distinctBy { it.id }
        .take(maximum)
        .toList()

const val TITRES_PAR_TOUR = 20

/**
 * La suite d'une file arrivée à sa fin : la musique ne s'arrête pas au
 * dernier titre d'un album ou d'une recherche. Des titres proches du
 * dernier, à défaut les recommandations du compte.
 */
class Prolongement(private val api: MoziikApi, private val univers: suspend () -> String?) {
    suspend fun suite(dernier: String, exclus: Set<String>): List<Titre> {
        val proches = appel { api.similaires(dernier, 30).songs }.getOrDefault(emptyList())
        retenirSuite(proches, exclus).takeIf { it.isNotEmpty() }?.let { return it }
        val recommandes = appel { api.recommandations(univers(), heureLocale()).songs }.getOrDefault(emptyList())
        return retenirSuite(recommandes, exclus)
    }
}
