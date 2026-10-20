package com.moziik.app.donnees.reseau

import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Les routes du site utilisées par l'app, telles qu'elles existent
 * (dossier app/api du site) : mêmes chemins, mêmes corps, mêmes réponses.
 * L'authentification passe par les jetons mobiles (app/api/mobile-auth).
 */
interface MoziikApi {
    @POST("api/mobile-auth/login")
    suspend fun connexion(@Body corps: Identifiants): Jetons

    /** Fin du relais Google : le code reçu par le schéma de l'app contre des jetons. */
    @POST("api/mobile-auth/relais/jetons")
    suspend fun connexionRelais(@Body corps: CodeRelais): Jetons

    @POST("api/mobile-auth/logout")
    suspend fun deconnexion(@Body corps: DemandeRenouvellement)

    @POST("api/auth/register")
    suspend fun inscription(@Body corps: Inscription)

    @POST("api/auth/resend-verification")
    suspend fun renvoyerConfirmation(@Body corps: AdresseEmail): Message

    @POST("api/auth/forgot-password")
    suspend fun motDePasseOublie(@Body corps: AdresseEmail): Message

    @GET("api/me/profile")
    suspend fun profil(): Profil
}

@Serializable
data class Identifiants(val email: String, val password: String, val device: String)

@Serializable
data class CodeRelais(val code: String, val device: String)

@Serializable
data class DemandeRenouvellement(val refreshToken: String)

@Serializable
data class Renouvellement(val accessToken: String)

@Serializable
data class Inscription(val name: String, val email: String, val password: String)

@Serializable
data class AdresseEmail(val email: String)

@Serializable
data class Message(val message: String)

/** Ce que renvoient la connexion et le relais : mêmes champs dans les deux cas. */
@Serializable
data class Jetons(val accessToken: String, val refreshToken: String, val user: UtilisateurCourt)

@Serializable
data class UtilisateurCourt(
    val id: String,
    val name: String,
    val email: String,
    val avatarUrl: String? = null,
    val role: String,
)

/** GET /api/me/profile (seuls les champs dont l'app se sert). */
@Serializable
data class Profil(val user: ProfilUtilisateur, val stats: Statistiques)

@Serializable
data class ProfilUtilisateur(
    val id: String,
    val name: String,
    val username: String? = null,
    val email: String,
    val avatarUrl: String? = null,
    val role: String,
    val emailVerified: Boolean = true,
    val hasPassword: Boolean = false,
    val hasGoogleAccount: Boolean = false,
    val createdAt: String? = null,
)

@Serializable
data class Statistiques(
    val likedSongsCount: Int = 0,
    val savedAlbumsCount: Int = 0,
    val playlistsCount: Int = 0,
    val followedArtistsCount: Int = 0,
)
