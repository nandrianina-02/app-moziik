package com.moziik.app.donnees.catalogue

import kotlin.random.Random

/** Au-delà, l'extrait est déclaré illisible : la manche ne compte pas, plutôt que d'attendre en silence. */
const val ATTENTE_EXTRAIT_MS = 15_000L

/** Dix manches : assez pour un vrai score, assez court pour rejouer. */
const val MANCHES = 10

/** L'extrait dure dix secondes ; répondre vite rapporte plus. */
const val DUREE_EXTRAIT_MS = 10_000L

/** Une manche : le titre à reconnaître et quatre propositions, dont la bonne. */
data class Manche(val reponse: Titre, val propositions: List<Titre>)

/**
 * Les manches d'une partie, tirées des titres publiés : jamais deux fois le
 * même titre ni le même artiste à reconnaître, et des leurres pris de
 * préférence dans le même genre, pour que la réponse ne se devine pas au
 * style. Les leurres ne reprennent pas l'artiste de la réponse : deux
 * titres du même artiste se départageraient au hasard.
 */
fun preparerPartie(titres: List<Titre>, hasard: Random = Random.Default, manches: Int = MANCHES): List<Manche> {
    val jouables = titres.filter { it.publie && it.artist?.id != null }.distinctBy { it.id }
    val reponses = jouables.shuffled(hasard).distinctBy { it.artist?.id }.take(manches)
    return reponses.map { reponse ->
        val autres = jouables.filter { it.id != reponse.id && it.artist?.id != reponse.artist?.id }.shuffled(hasard)
        val memeGenre = autres.filter { it.genre != null && it.genre == reponse.genre }
        val leurres = (memeGenre + autres).distinctBy { it.id }.distinctBy { it.artist?.id }.take(3)
        Manche(reponse, (leurres + reponse).shuffled(hasard))
    }.filter { it.propositions.size == 4 }
}

/**
 * Les points d'une réponse : rien si elle est fausse ; sinon 100, plus 10 par
 * seconde gagnée sur l'extrait, et 50 de plus par bonne réponse d'affilée
 * (à partir de la deuxième).
 */
fun pointsDe(juste: Boolean, tempsMs: Long, serie: Int): Int {
    if (!juste) return 0
    val restant = ((DUREE_EXTRAIT_MS - tempsMs).coerceAtLeast(0) / 1000).toInt()
    return 100 + restant * 10 + (serie - 1).coerceAtLeast(0) * 50
}

/** Où commence l'extrait : vers le premier refrain, à 35 % du titre, jamais au tout début. */
fun debutExtraitMs(dureeSecondes: Double): Long = (dureeSecondes * 1000 * 0.35).toLong().coerceIn(20_000L, 120_000L)
