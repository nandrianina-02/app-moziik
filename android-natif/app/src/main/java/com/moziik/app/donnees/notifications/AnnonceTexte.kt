package com.moziik.app.donnees.notifications

/**
 * Le texte mis en forme des annonces de la plateforme, découpé comme sur
 * le site (lib/annonceTexte.ts) : **gras**, *italique*, [texte](adresse),
 * listes « - », paragraphes séparés par une ligne vide. Les deux
 * découpages doivent rester identiques.
 */
sealed interface Morceau {
    data class Texte(val valeur: String) : Morceau
    data class Gras(val morceaux: List<Morceau>) : Morceau
    data class Italique(val morceaux: List<Morceau>) : Morceau
    data class Lien(val adresse: String, val morceaux: List<Morceau>) : Morceau
}

sealed interface Bloc {
    data class Paragraphe(val morceaux: List<Morceau>) : Bloc
    data class Liste(val elements: List<List<Morceau>>) : Bloc
}

object AnnonceTexte {
    private val LIEN = Regex("^\\[([^\\]]+)\\]\\(([^)\\s]+)\\)")
    private val PUCE = Regex("^\\s*[-•]\\s+")

    /** https:// ou une page du site : ni javascript:, ni data:. */
    fun adresseAcceptee(adresse: String): Boolean =
        Regex("^https://\\S+$", RegexOption.IGNORE_CASE).matches(adresse) || Regex("^/(?!/)\\S*$").matches(adresse)

    fun morceaux(texte: String): List<Morceau> {
        val resultat = mutableListOf<Morceau>()
        val courant = StringBuilder()
        fun pousser() {
            if (courant.isNotEmpty()) resultat += Morceau.Texte(courant.toString())
            courant.clear()
        }
        var i = 0
        while (i < texte.length) {
            if (texte.startsWith("**", i)) {
                val fin = texte.indexOf("**", i + 2)
                if (fin > i + 2) {
                    pousser()
                    resultat += Morceau.Gras(morceaux(texte.substring(i + 2, fin)))
                    i = fin + 2
                    continue
                }
            } else if (texte[i] == '*') {
                val fin = texte.indexOf('*', i + 1)
                if (fin > i + 1 && texte.getOrNull(fin + 1) != '*') {
                    pousser()
                    resultat += Morceau.Italique(morceaux(texte.substring(i + 1, fin)))
                    i = fin + 1
                    continue
                }
            } else if (texte[i] == '[') {
                val m = LIEN.find(texte.substring(i))
                if (m != null && adresseAcceptee(m.groupValues[2])) {
                    pousser()
                    resultat += Morceau.Lien(m.groupValues[2], morceaux(m.groupValues[1]))
                    i += m.value.length
                    continue
                }
            }
            courant.append(texte[i])
            i++
        }
        pousser()
        return resultat
    }

    fun blocs(texte: String): List<Bloc> =
        texte.replace(Regex("\r\n?"), "\n").split(Regex("\n\\s*\n")).mapNotNull { paragraphe ->
            val lignes = paragraphe.split("\n").filter { it.isNotBlank() }
            when {
                lignes.isEmpty() -> null
                lignes.all { PUCE.containsMatchIn(it) } -> Bloc.Liste(lignes.map { morceaux(it.replaceFirst(PUCE, "")) })
                else -> Bloc.Paragraphe(morceaux(lignes.joinToString("\n")))
            }
        }

    private fun brut(morceaux: List<Morceau>): String = morceaux.joinToString("") {
        when (it) {
            is Morceau.Texte -> it.valeur
            is Morceau.Gras -> brut(it.morceaux)
            is Morceau.Italique -> brut(it.morceaux)
            is Morceau.Lien -> brut(it.morceaux)
        }
    }

    fun texteBrut(texte: String): String = blocs(texte).joinToString("\n\n") { b ->
        when (b) {
            is Bloc.Paragraphe -> brut(b.morceaux)
            is Bloc.Liste -> b.elements.joinToString("\n") { "• ${brut(it)}" }
        }
    }
}
