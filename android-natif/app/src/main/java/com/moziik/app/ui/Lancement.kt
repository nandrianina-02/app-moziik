package com.moziik.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import com.moziik.app.donnees.Conteneur
import com.moziik.app.donnees.catalogue.AEcouter
import com.moziik.app.donnees.catalogue.Cible
import com.moziik.app.donnees.catalogue.SourceStation
import com.moziik.app.donnees.catalogue.StationRadio
import com.moziik.app.donnees.session.EtatSession
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.reseau.messageErreur
import com.moziik.app.lecteur.AlerteLecture
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Lancer la lecture depuis une vignette. Un album, une playlist, un
 * artiste ou un genre se chargent d'abord : la vignette touchée montre
 * l'égaliseur le temps du chargement (`enCours` porte sa clé).
 */
class Lancement(private val conteneur: Conteneur, private val portee: CoroutineScope) {
    var enCours by mutableStateOf<String?>(null)
        private set

    fun titres(titres: List<Titre>, depart: Int, source: String) = conteneur.lecteur.lire(titres, depart, source)

    fun cible(cle: String, cible: Cible) = charger(cle) { conteneur.catalogue.aEcouter(cible) }

    fun station() = charger("station") { conteneur.catalogue.station() }

    /** Une station de la page Radio ; « Mes favoris » demande un compte. */
    fun stationRadio(station: StationRadio) {
        if (station.source == SourceStation.Favoris && conteneur.session.etat.value !is EtatSession.Connecte) {
            conteneur.alertes.signaler(AlerteLecture.Message("Connecte-toi pour écouter tes favoris."))
            return
        }
        charger(station.cle) { conteneur.catalogue.station(station) }
    }

    private fun charger(cle: String, chargement: suspend () -> AEcouter?) {
        if (enCours != null) return
        enCours = cle
        portee.launch {
            try {
                val liste = chargement()
                if (liste == null || liste.titres.isEmpty()) {
                    conteneur.alertes.signaler(AlerteLecture.Message("Rien à écouter ici pour le moment."))
                } else {
                    conteneur.lecteur.lire(liste.titres, 0, liste.source)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                conteneur.alertes.signaler(AlerteLecture.Message(messageErreur(e)))
            } finally {
                enCours = null
            }
        }
    }
}

@Composable
fun rememberLancement(): Lancement {
    val c = conteneur()
    val portee = rememberCoroutineScope()
    return remember { Lancement(c, portee) }
}
