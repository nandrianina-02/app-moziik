package com.moziik.app.donnees.horsligne

import com.moziik.app.donnees.catalogue.Titre
import java.text.Normalizer

/** « Raha ny Olon-Tiana » → « raha ny olon tiana » : sans accents, sans casse, ponctuation en espaces. */
fun normaliser(texte: String): String =
    Normalizer.normalize(texte, Normalizer.Form.NFD)
        .replace(Regex("\\p{Mn}+"), "")
        .lowercase()
        .replace(Regex("[^a-z0-9]+"), " ")
        .trim()

/**
 * La recherche sans réseau, dans les titres téléchargés (spécification
 * 6.4) : chaque mot saisi doit apparaître dans le titre ou l'artiste. Les
 * titres dont le nom commence par la saisie passent en tête.
 */
fun rechercheLocale(titres: List<Titre>, terme: String): List<Titre> {
    val mots = normaliser(terme).split(' ').filter { it.isNotEmpty() }
    if (mots.isEmpty()) return emptyList()
    val debut = normaliser(terme)
    return titres
        .map { it to normaliser("${it.title} ${it.artist?.stageName.orEmpty()}") }
        .filter { (_, texte) -> mots.all { it in texte } }
        .sortedByDescending { (t, _) -> normaliser(t.title).startsWith(debut) }
        .map { it.first }
}
