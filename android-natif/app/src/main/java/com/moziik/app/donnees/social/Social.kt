package com.moziik.app.donnees.social

import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.reseau.MoziikApi
import com.moziik.app.donnees.session.appel
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/*
 * Le côté social, comme sur le site : suivre des membres, voir ce qu'ils
 * écoutent, et le Blend entre deux membres qui se suivent
 * (lib/amis.ts, lib/blend.ts). Ce qu'un compte montre de son écoute
 * dépend de son réglage « Partager mon activité d'écoute », actif par
 * défaut.
 */

/** Un membre tel que le site le montre : jamais d'adresse email. */
@Serializable
data class Membre(
    @SerialName("_id") val id: String = "",
    val name: String = "Membre",
    val username: String? = null,
    val avatarUrl: String? = null,
)

@Serializable
data class LiensMembre(
    val abonnes: Int = 0,
    val abonnements: Int = 0,
    val estMoi: Boolean = false,
    val suivi: Boolean = false,
    /** Les deux comptes se suivent : le Blend est possible. */
    val mutuel: Boolean = false,
)

@Serializable
data class PlaylistMembre(
    @SerialName("_id") val id: String,
    val title: String,
    val coverUrl: String? = null,
    val songsCount: Int = 0,
)

@Serializable
data class ArtisteDuMembre(@SerialName("_id") val id: String, val stageName: String, val verified: Boolean = false)

@Serializable
data class ProfilMembre(
    val user: Membre,
    val playlists: List<PlaylistMembre> = emptyList(),
    val artist: ArtisteDuMembre? = null,
    val social: LiensMembre = LiensMembre(),
)

@Serializable
data class EtatSuiviMembre(val suivi: Boolean, val abonnes: Int)

@Serializable
data class ActiviteAmi(val ami: Membre, val titre: Titre, val ecouteLe: String)

@Serializable
data class ListeActiviteAmis(val activite: List<ActiviteAmi> = emptyList())

@Serializable
data class MembreSuivi(
    @SerialName("_id") val id: String,
    val name: String = "Membre",
    val username: String? = null,
    val avatarUrl: String? = null,
    val mutuel: Boolean = false,
)

@Serializable
data class EtatSocial(val partageEcoute: Boolean = true, val abonnements: List<MembreSuivi> = emptyList())

@Serializable
data class ReglagePartage(val partageEcoute: Boolean)

/** `pour` : « deux » (écouté par les deux), « a » (moi) ou « b » (l'autre). */
@Serializable
data class LigneBlend(val titre: Titre, val pour: String)

@Serializable
data class Blend(
    val moi: Membre,
    val ami: Membre,
    /** Part d'artistes en commun, en pourcentage. */
    val correspondance: Int = 0,
    val titres: List<LigneBlend> = emptyList(),
)

class Social(private val api: MoziikApi) {
    suspend fun profil(username: String): ProfilMembre = appel { api.membre(username) }.getOrThrow()

    suspend fun suivre(username: String, suivre: Boolean): EtatSuiviMembre =
        appel { if (suivre) api.suivreMembre(username) else api.neplusSuivreMembre(username) }.getOrThrow()

    suspend fun activite(): List<ActiviteAmi> =
        appel { api.activiteAmis() }.getOrThrow().activite.filter { it.titre.publie }

    suspend fun etat(): EtatSocial = appel { api.social() }.getOrThrow()

    suspend fun partager(partageEcoute: Boolean): Boolean =
        appel { api.reglerPartage(ReglagePartage(partageEcoute)) }.getOrThrow().partageEcoute

    suspend fun blend(username: String): Blend =
        appel { api.blend(username) }.getOrThrow().let { b -> b.copy(titres = b.titres.filter { it.titre.publie }) }
}
