package com.moziik.app.donnees.catalogue

/**
 * Les paroles d'un titre, synchronisées ou non : portage de lib/lyrics.ts
 * du site, pour que l'app lise le champ `lyrics` exactement comme lui.
 *
 * Le site stocke les paroles en texte brut, au format LRC quand elles sont
 * synchronisées (`[00:12.34]Première ligne`), éventuellement enrichi mot à
 * mot (`<00:12.40>Je <00:12.70>marche`). Un texte sans horodatage reste
 * affiché tel quel, sans défilement automatique.
 */

data class MotParoles(val debut: Double, val fin: Double?, val texte: String)

data class LigneParoles(
    /** Secondes depuis le début du morceau, ou null si la ligne n'est pas horodatée. */
    val temps: Double?,
    /** Début de la ligne suivante ; absent sur la dernière. */
    val fin: Double? = null,
    val texte: String,
    val mots: List<MotParoles>? = null,
)

data class Paroles(
    val synchronisees: Boolean,
    val lignes: List<LigneParoles>,
    /** Balise `[by:…]` : qui a transcrit ou synchronisé. */
    val credits: String? = null,
) {
    val vides: Boolean get() = lignes.none { it.texte.isNotBlank() }
}

private val HORODATAGE = Regex("""\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)]""")
private val BALISE_META = Regex("""^\[([a-zA-Z]{2,8}):(.*)]$""")
private val HORODATAGE_MOT = Regex("""<(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)>""")

private fun enSecondes(minutes: String, reste: String): Double {
    val parties = reste.split('.', ':')
    val frac = parties.getOrNull(1) ?: "0"
    // Un LRC écrit les centièmes sur 2 chiffres, parfois les millièmes sur 3.
    return minutes.toDouble() * 60 + parties[0].toDouble() + frac.toDouble() / Math.pow(10.0, frac.length.toDouble())
}

/** Une ligne enrichie découpée en mots horodatés ; null si elle n'en porte pas. */
private fun decouperEnMots(reste: String): List<MotParoles>? {
    val marques = HORODATAGE_MOT.findAll(reste).toList()
    if (marques.isEmpty()) return null
    val bruts = marques.mapIndexedNotNull { i, m ->
        val depart = m.range.last + 1
        val arrivee = marques.getOrNull(i + 1)?.range?.first ?: reste.length
        val texte = reste.substring(depart, arrivee).trim()
        // Une marque suivie de rien ne désigne aucun mot : la garder surlignerait un blanc.
        if (texte.isEmpty()) null else enSecondes(m.groupValues[1], m.groupValues[2]) to texte
    }
    if (bruts.isEmpty()) return null
    return bruts.mapIndexed { i, (debut, texte) -> MotParoles(debut, bruts.getOrNull(i + 1)?.first, texte) }
}

fun analyserParoles(brut: String?): Paroles {
    if (brut.isNullOrBlank()) return Paroles(false, emptyList())
    val meta = mutableMapOf<String, String>()
    var lignes = mutableListOf<LigneParoles>()
    var horodatees = 0

    for (ligneBrute in brut.split(Regex("\r?\n"))) {
        val ligne = ligneBrute.trim()
        if (ligne.isEmpty()) {
            // Une ligne vide sépare les couplets : elle fait partie de la mise en page voulue par l'auteur.
            lignes += LigneParoles(null, texte = "")
            continue
        }
        val entete = BALISE_META.matchEntire(ligne)
        if (entete != null) {
            meta[entete.groupValues[1].lowercase()] = entete.groupValues[2].trim()
            continue
        }
        val temps = HORODATAGE.findAll(ligne).map { enSecondes(it.groupValues[1], it.groupValues[2]) }.toList()
        val sansHorodatage = ligne.replace(HORODATAGE, "")
        val mots = decouperEnMots(sansHorodatage)
        val texte = sansHorodatage.replace(HORODATAGE_MOT, "").trim()

        if (temps.isEmpty()) {
            // Une ligne enrichie peut n'avoir que des marques de mots : le premier mot donne le départ.
            if (mots != null) {
                horodatees += 1
                lignes += LigneParoles(mots[0].debut, texte = texte, mots = mots)
            } else {
                lignes += LigneParoles(null, texte = ligne)
            }
            continue
        }
        horodatees += temps.size
        // Un refrain porte plusieurs horodatages : chacun devient une ligne. Le mot à mot
        // n'accompagne que la première, ses instants sont absolus.
        temps.forEachIndexed { i, t -> lignes += LigneParoles(t, texte = texte, mots = if (i == 0) mots else null) }
    }

    // Décalage global éventuel, en millisecondes (balise `offset`).
    val decalage = meta["offset"]?.toDoubleOrNull()
    if (decalage != null && decalage != 0.0) {
        val s = decalage / 1000
        lignes = lignes.map { l ->
            l.copy(
                temps = l.temps?.let { maxOf(0.0, it - s) },
                mots = l.mots?.map { m -> m.copy(debut = maxOf(0.0, m.debut - s), fin = m.fin?.let { maxOf(0.0, it - s) }) },
            )
        }.toMutableList()
    }

    val synchronisees = horodatees >= 2
    val finales = if (synchronisees) poserLesFins(lignes.sortedWith(compareBy(nullsLast()) { it.temps })) else lignes
    return Paroles(synchronisees, finales, meta["by"]?.takeIf { it.isNotEmpty() })
}

/** La fin de chaque ligne est le départ de la ligne horodatée suivante ; les blancs intercalés sont sautés. */
private fun poserLesFins(lignes: List<LigneParoles>): List<LigneParoles> {
    val resultat = lignes.toMutableList()
    var suivante: Double? = null
    for (i in resultat.indices.reversed()) {
        val l = resultat[i]
        val t = l.temps ?: continue
        val fin = suivante?.takeIf { it > t }
        // Le dernier mot d'une ligne s'arrête là où la ligne s'arrête.
        val mots = l.mots?.let { m -> if (fin != null && m.last().fin == null) m.dropLast(1) + m.last().copy(fin = fin) else m }
        resultat[i] = l.copy(fin = fin, mots = mots)
        suivante = t
    }
    return resultat
}

/** Index de la ligne chantée à `seconde`, ou -1 avant la première (recherche dichotomique). */
fun ligneActive(lignes: List<LigneParoles>, seconde: Double): Int {
    var bas = 0
    var haut = lignes.size - 1
    var trouve = -1
    while (bas <= haut) {
        val milieu = (bas + haut) ushr 1
        val t = lignes[milieu].temps
        if (t == null || t > seconde) haut = milieu - 1 else {
            trouve = milieu
            bas = milieu + 1
        }
    }
    return trouve
}

/** Index du mot chanté dans une ligne enrichie, ou -1 ; passé la fin du dernier mot, plus rien n'est surligné. */
fun motActif(mots: List<MotParoles>?, seconde: Double): Int {
    if (mots.isNullOrEmpty()) return -1
    var bas = 0
    var haut = mots.size - 1
    var trouve = -1
    while (bas <= haut) {
        val milieu = (bas + haut) ushr 1
        if (mots[milieu].debut > seconde) haut = milieu - 1 else {
            trouve = milieu
            bas = milieu + 1
        }
    }
    if (trouve >= 0) {
        val fin = mots[trouve].fin
        if (fin != null && seconde >= fin) return -1
    }
    return trouve
}
