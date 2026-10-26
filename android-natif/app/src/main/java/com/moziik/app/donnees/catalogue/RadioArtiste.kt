package com.moziik.app.donnees.catalogue

/** Longueur d'une radio d'artiste : environ deux heures d'écoute. */
const val TAILLE_RADIO = 40

/**
 * La radio d'un artiste : ses titres, et entre eux des titres proches
 * d'autres artistes, à raison d'un titre de l'artiste pour deux
 * découvertes. Quand l'une des deux listes s'épuise, l'autre continue
 * seule : un artiste au petit catalogue garde une radio pleine.
 */
fun entrelacerRadio(siens: List<Titre>, proches: List<Titre>, taille: Int = TAILLE_RADIO): List<Titre> {
    val artiste = siens.firstOrNull()?.artist?.id
    val autres = proches.filter { it.publie && (artiste == null || it.artist?.id != artiste) }
    val a = siens.filter { it.publie }.distinctBy { it.id }.iterator()
    val b = autres.distinctBy { it.id }.iterator()
    val vus = HashSet<String>()
    val radio = ArrayList<Titre>(taille)
    fun prendre(source: Iterator<Titre>): Boolean {
        while (source.hasNext()) {
            val t = source.next()
            if (vus.add(t.id)) {
                radio += t
                return true
            }
        }
        return false
    }
    var rang = 0
    while (radio.size < taille && (a.hasNext() || b.hasNext())) {
        val voulu = if (rang % 3 == 0) a else b
        if (!prendre(voulu)) prendre(if (voulu === a) b else a)
        rang++
    }
    return radio
}
