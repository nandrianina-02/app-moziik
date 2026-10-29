package com.moziik.app.donnees.horsligne

import com.moziik.app.donnees.catalogue.Ecoute
import com.moziik.app.donnees.reseau.ErreurApi
import com.moziik.app.donnees.reseau.JsonMoziik
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import java.io.File

@Serializable
data class EcouteGardee(val id: String, val secondes: Double, val complete: Boolean)

/** Au-delà, les plus anciennes écoutes sont abandonnées : un mois sans réseau ne doit pas remplir le téléphone. */
private const val MAXIMUM = 500

/**
 * Les écoutes faites sans réseau, gardées puis déclarées au retour de la
 * connexion (spécification 6.4, `record_play`). Elles seront datées du
 * moment de l'envoi : le site n'accepte pas de date d'écoute.
 */
class EcoutesEnAttente(private val racine: File, private val api: MoziikApi, compteInitial: String? = null) {
    private val verrou = Mutex()
    /**
     * Un fichier par compte : rejouées avec le jeton d'un autre compte, ces
     * écoutes lui seraient attribuées. Se déconnecter ne les efface pas,
     * elles partent au retour du compte.
     */
    private var fichier = fichierDe(compteInitial)

    private fun fichierDe(id: String?): File {
        val c = id?.filter { it.isLetterOrDigit() }?.ifEmpty { null }
        val f = File(racine, "ecoutes-en-attente-${c ?: "visiteur"}.json")
        // Le fichier unique d'avant la séparation revient au premier compte connecté.
        val ancien = File(racine, "ecoutes-en-attente.json")
        if (c != null && ancien.exists() && !f.exists()) ancien.renameTo(f)
        return f
    }

    suspend fun changerDeCompte(id: String?) = verrou.withLock { fichier = fichierDe(id) }

    private fun lire(): List<EcouteGardee> = runCatching {
        JsonMoziik.decodeFromString(ListSerializer(EcouteGardee.serializer()), fichier.readText())
    }.getOrDefault(emptyList())

    private fun ecrire(liste: List<EcouteGardee>) {
        runCatching {
            if (liste.isEmpty()) fichier.delete()
            else fichier.writeText(JsonMoziik.encodeToString(ListSerializer(EcouteGardee.serializer()), liste))
        }
    }

    suspend fun garder(ecoute: EcouteGardee) = verrou.withLock {
        ecrire((lire() + ecoute).takeLast(MAXIMUM))
    }

    suspend fun oublier() = verrou.withLock { ecrire(emptyList()) }

    /**
     * Rejoue dans l'ordre ; s'arrête à la première panne réseau pour
     * réessayer plus tard. Une écoute refusée (4xx hors 401 et 429) est
     * retirée : la garder bloquerait toutes les suivantes.
     */
    suspend fun rejouer() = verrou.withLock {
        val restantes = lire().toMutableList()
        while (restantes.isNotEmpty()) {
            val e = restantes.first()
            val resultat = appel { api.ecoute(e.id, Ecoute(e.secondes, e.complete)) }
            val erreur = resultat.exceptionOrNull()
            val definitive = erreur is ErreurApi && erreur.statut in 400..499 && erreur.statut != 401 && erreur.statut != 429
            if (erreur != null && !definitive) break
            restantes.removeAt(0)
        }
        ecrire(restantes)
    }
}
