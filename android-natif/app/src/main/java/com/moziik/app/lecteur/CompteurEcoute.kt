package com.moziik.app.lecteur

/** Une écoute à déclarer au site (POST /api/songs/{id}/play). */
data class EcouteFinie(val id: String, val secondes: Int, val complete: Boolean)

/**
 * Le temps réellement écouté d'un titre, pour le déclarer une fois, quand
 * on le quitte.
 *
 * Le site ne retient une écoute complète, la seule qui compte dans les
 * classements et la rémunération des artistes, que si le temps déclaré
 * couvre 80 % du titre. Le site web déclare « complète » au bout de 30 s,
 * ce que le serveur rejette presque toujours ; l'app déclare au contraire
 * le temps vraiment passé à écouter, mesuré en lecture et non d'après la
 * position (un déplacement dans le morceau ne compte pas comme écoute).
 * Sous 30 secondes, rien n'est déclaré (spécification 5.4).
 */
class CompteurEcoute {
    private var id: String? = null
    private var dureeSecondes = 0.0
    private var cumulMs = 0L
    private var depuis: Long? = null

    fun demarrer(id: String, dureeSecondes: Double, enLecture: Boolean, maintenant: Long) {
        this.id = id
        this.dureeSecondes = dureeSecondes
        cumulMs = 0
        depuis = if (enLecture) maintenant else null
    }

    fun lecture(enCours: Boolean, maintenant: Long) {
        if (id == null) return
        val debut = depuis
        if (enCours && debut == null) depuis = maintenant
        if (!enCours && debut != null) {
            cumulMs += maintenant - debut
            depuis = null
        }
    }

    /** Clôt l'écoute en cours ; null si elle est trop courte pour être déclarée. */
    fun terminer(maintenant: Long): EcouteFinie? {
        val titre = id ?: return null
        lecture(false, maintenant)
        id = null
        val secondes = (cumulMs / 1000).toInt()
        if (secondes < SEUIL_SECONDES) return null
        return EcouteFinie(titre, secondes, dureeSecondes > 0 && secondes >= dureeSecondes * 0.8)
    }

    companion object {
        /** PLAY_RECORD_THRESHOLD_SECONDS du site. */
        const val SEUIL_SECONDES = 30
    }
}
