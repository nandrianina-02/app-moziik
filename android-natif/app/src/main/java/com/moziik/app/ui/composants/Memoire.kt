package com.moziik.app.ui.composants

import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel

/**
 * Ce qu'un écran a chargé, gardé tant que l'écran reste dans la pile de
 * navigation. Un `remember` ordinaire est oublié dès qu'on ouvre une fiche
 * par-dessus : au retour, la liste repartait vide, se rechargeait, et sa
 * position de défilement était ramenée en haut faute d'éléments à
 * l'instant où elle se restaure.
 */
class MemoireEcran : ViewModel() {
    val valeurs = HashMap<String, MutableState<Any?>>()
}

/** Comme `remember { mutableStateOf(initial()) }`, mais survit à l'ouverture d'une fiche par-dessus l'écran. */
@Suppress("UNCHECKED_CAST")
@Composable
fun <T> rememberMemoire(cle: String, initial: () -> T): MutableState<T> {
    val memoire: MemoireEcran = viewModel { MemoireEcran() }
    return memoire.valeurs.getOrPut(cle) { mutableStateOf(initial()) } as MutableState<T>
}

/**
 * Les éléments dont l'entrée a déjà été jouée (voir `apparitionUneFois`),
 * gardés au retour sur l'écran : sinon la page rejouait toutes ses entrées
 * et semblait se recharger.
 */
@Composable
fun rememberVus(): MutableSet<Any> = rememberSaveable(
    saver = Saver<MutableSet<Any>, ArrayList<String>>(
        save = { ArrayList(it.map(Any::toString)) },
        restore = { it.toMutableSet<Any>() },
    ),
) { mutableSetOf() }
