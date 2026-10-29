package com.moziik.app.donnees.reseau

import com.moziik.app.donnees.catalogue.Accueil
import com.moziik.app.donnees.catalogue.DetailSelection
import com.moziik.app.donnees.catalogue.ListeSelections
import com.moziik.app.donnees.catalogue.DemandeIA
import com.moziik.app.donnees.catalogue.EchangeAssistant
import com.moziik.app.donnees.catalogue.FilAssistant
import com.moziik.app.donnees.catalogue.ReponsePropositionPlaylist
import com.moziik.app.donnees.catalogue.ResultatRechercheIA
import com.moziik.app.donnees.catalogue.Traduction
import com.moziik.app.donnees.catalogue.Traduite
import com.moziik.app.donnees.catalogue.AlbumAEnregistrer
import com.moziik.app.donnees.catalogue.ArtistesSuivis
import com.moziik.app.donnees.catalogue.EtatEnregistre
import com.moziik.app.donnees.catalogue.EtatSuivi
import com.moziik.app.donnees.catalogue.ListeAlbums
import com.moziik.app.donnees.catalogue.ReponseParoles
import com.moziik.app.donnees.catalogue.Classement
import com.moziik.app.donnees.catalogue.ConfigurationSite
import com.moziik.app.donnees.catalogue.EtatInteret
import com.moziik.app.donnees.catalogue.ListeEvenements
import com.moziik.app.donnees.catalogue.PageTitres
import com.moziik.app.donnees.catalogue.ReponseRadio
import com.moziik.app.donnees.catalogue.Ecoute
import com.moziik.app.donnees.catalogue.EtatAime
import com.moziik.app.donnees.catalogue.ListeTitres
import com.moziik.app.donnees.catalogue.ReponseAlbum
import com.moziik.app.donnees.catalogue.ReponseArtiste
import com.moziik.app.donnees.catalogue.ReponsePlaylist
import com.moziik.app.donnees.catalogue.ReponseRecherche
import com.moziik.app.donnees.catalogue.ReponseTitre
import com.moziik.app.donnees.catalogue.Station
import com.moziik.app.donnees.catalogue.TermeRecherche
import com.moziik.app.donnees.catalogue.UniversCourant
import kotlinx.serialization.Serializable
import com.moziik.app.donnees.catalogue.ListePlaylists
import com.moziik.app.donnees.catalogue.ModificationPlaylist
import com.moziik.app.donnees.catalogue.NouvellePlaylist
import com.moziik.app.donnees.catalogue.ReponsePlaylistCreee
import com.moziik.app.donnees.catalogue.TitreDePlaylist
import com.moziik.app.donnees.catalogue.TitresDePlaylist
import com.moziik.app.donnees.messagerie.CompteurNonLus
import com.moziik.app.donnees.messagerie.ConversationAOuvrir
import com.moziik.app.donnees.messagerie.Destinataires
import com.moziik.app.donnees.messagerie.ListeConversations
import com.moziik.app.donnees.messagerie.ModificationMessage
import com.moziik.app.donnees.messagerie.NouveauMessage
import com.moziik.app.donnees.messagerie.PageMessages
import com.moziik.app.donnees.messagerie.ReponseConversation
import com.moziik.app.donnees.messagerie.ReponseMessage
import com.moziik.app.donnees.compte.Appareils
import com.moziik.app.donnees.compte.ChangementMotDePasse
import com.moziik.app.donnees.compte.ChoixMode
import com.moziik.app.donnees.compte.ChoixUnivers
import com.moziik.app.donnees.compte.ConfigurationTheme
import com.moziik.app.donnees.compte.EtatAbonnement
import com.moziik.app.donnees.compte.StatistiquesArtiste
import com.moziik.app.donnees.compte.Bilan
import com.moziik.app.donnees.compte.ModeCourant
import com.moziik.app.donnees.compte.ModificationProfil
import com.moziik.app.donnees.compte.ThemesCompte
import retrofit2.http.Body
import retrofit2.http.PUT
import retrofit2.http.DELETE
import retrofit2.http.HTTP
import retrofit2.http.PATCH
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import com.moziik.app.donnees.notifications.PageAvis
import com.moziik.app.donnees.catalogue.ReponseEvenement
import com.moziik.app.donnees.catalogue.ListeCommentaires
import com.moziik.app.donnees.catalogue.NouveauCommentaire
import com.moziik.app.donnees.catalogue.ReponseCommentaire
import com.moziik.app.donnees.messagerie.NouveauGroupe
import com.moziik.app.donnees.messagerie.ModificationConversation
import com.moziik.app.donnees.envoi.AnnonceFichier
import com.moziik.app.donnees.envoi.OuvertureEnvoi
import com.moziik.app.donnees.messagerie.ReactionEnvoyee
import com.moziik.app.donnees.push.AppareilPush
import com.moziik.app.donnees.push.JetonPush
import com.moziik.app.donnees.ensemble.CodeEnsemble
import com.moziik.app.donnees.ensemble.EtatEnsembleDistant
import com.moziik.app.donnees.ensemble.EtatPublie

/**
 * Les routes du site utilisées par l'app, telles qu'elles existent
 * (dossier app/api du site) : mêmes chemins, mêmes corps, mêmes réponses.
 * L'authentification passe par les jetons mobiles (app/api/mobile-auth).
 */
interface MoziikApi {
    @POST("api/mobile-auth/login")
    suspend fun connexion(@Body corps: Identifiants): Jetons

    /** Connexion Google intégrée : le jeton d'identité rendu par Android, vérifié par le site. */
    @POST("api/mobile-auth/google")
    suspend fun connexionGoogle(@Body corps: JetonGoogle): Jetons

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

    // Catalogue. L'app n'a pas les cookies du site : l'univers voyage en
    // paramètre, sinon le site sert son univers par défaut et non celui du
    // compte (spécification, 2.0).

    @GET("api/me/univers")
    suspend fun univers(): UniversCourant

    /** Repli JSON de l'accueil prévu pour le mobile ; `heure` choisit le moment de la journée. */
    @GET("api/homepage")
    suspend fun accueil(@Query("univers") univers: String?, @Query("heure") heure: Int, @Query("mode") mode: String? = null): Accueil

    @GET("api/search")
    suspend fun recherche(
        @Query("q") terme: String,
        @Query("type") type: String,
        @Query("page") page: Int,
        @Query("limit") limite: Int,
        @Query("univers") univers: String?,
    ): ReponseRecherche

    @POST("api/search/journal")
    suspend fun journalRecherche(@Body corps: TermeRecherche)

    /** Le site ne valide pas ces paramètres : n'envoyer que les valeurs connues (D8). */
    @GET("api/charts")
    suspend fun classement(
        @Query("period") periode: String,
        @Query("type") type: String,
        @Query("univers") univers: String?,
        @Query("genre") genre: String? = null,
    ): Classement

    @GET("api/radio")
    suspend fun radio(@Query("univers") univers: String?): ReponseRadio

    @GET("api/songs")
    suspend fun pageTitres(
        @Query("genre") genre: String?,
        @Query("page") page: Int,
        @Query("limit") limite: Int,
        @Query("univers") univers: String?,
        @Query("sort") tri: String? = null,
        @Query("seed") graine: Int? = null,
    ): PageTitres

    @GET("api/me/liked-songs")
    suspend fun titresAimes(): ListeTitres

    @GET("api/site-config")
    suspend fun configuration(): ConfigurationSite

    @GET("api/events")
    suspend fun evenements(): ListeEvenements

    /** Bascule « Ça m'intéresse » : le site répond l'état obtenu et le nombre d'intéressés. */
    /** Un évènement non publié répond 404, sauf à son auteur. */
    @GET("api/events/{id}")
    suspend fun evenement(@Path("id") id: String): ReponseEvenement

    // ------------------------------------------------------------ Notifications

    /** 20 par page ; `before` : la date de la plus ancienne déjà chargée. */
    @GET("api/notifications")
    suspend fun notifications(@Query("before") avant: String?): PageAvis

    @POST("api/notifications/{id}/read")
    suspend fun notificationLue(@Path("id") id: String)

    @POST("api/notifications/read-all")
    suspend fun notificationsToutesLues()

    @DELETE("api/notifications/{id}")
    suspend fun supprimerNotification(@Path("id") id: String)

    @DELETE("api/notifications")
    suspend fun supprimerNotifications()

    @POST("api/events/{id}/interet")
    suspend fun basculerInteret(@Path("id") id: String): EtatInteret

    @GET("api/songs")
    suspend fun titres(
        @Query("genre") genre: String? = null,
        @Query("sort") tri: String? = null,
        @Query("limit") limite: Int = 50,
        @Query("univers") univers: String? = null,
        @Query("artist") artiste: String? = null,
    ): ListeTitres

    /** Aucun filtre de statut côté site : l'app écarte elle-même un titre non publié. */
    @GET("api/songs/{id}")
    suspend fun titre(@Path("id") id: String): ReponseTitre

    @GET("api/songs/{id}/similar")
    suspend fun similaires(@Path("id") id: String, @Query("limit") limite: Int): ListeTitres

    @GET("api/recommendations")
    suspend fun recommandations(@Query("univers") univers: String?, @Query("heure") heure: Int, @Query("mode") mode: String? = null): ListeTitres

    @GET("api/station")
    suspend fun station(@Query("heure") heure: Int, @Query("univers") univers: String?, @Query("mode") mode: String? = null): Station

    @GET("api/albums/{id}")
    suspend fun album(@Path("id") id: String): ReponseAlbum

    @GET("api/playlists/{id}")
    suspend fun playlist(@Path("id") id: String): ReponsePlaylist

    /** Les sélections du jour : propres au compte connecté, communes pour un visiteur. */
    @GET("api/selections")
    suspend fun selections(@Query("univers") univers: String?): ListeSelections

    @GET("api/selections/{cle}")
    suspend fun selection(@Path("cle") cle: String, @Query("univers") univers: String?): DetailSelection

    @GET("api/artists/{id}")
    suspend fun artiste(@Path("id") id: String): ReponseArtiste

    @GET("api/songs/{id}/like")
    suspend fun aime(@Path("id") id: String): EtatAime

    /** Bascule : le site répond l'état obtenu. */
    @POST("api/songs/{id}/like")
    suspend fun basculerAime(@Path("id") id: String): EtatAime

    @POST("api/songs/{id}/play")
    suspend fun ecoute(@Path("id") id: String, @Body corps: Ecoute)

    /** Compte le téléchargement complet d'un album (20 par minute et par adresse IP). */
    @POST("api/albums/{id}/download")
    suspend fun albumTelecharge(@Path("id") id: String)

    /** Tous, récents d'abord, réponses à plat (ni pagination ni filtre). */
    @GET("api/songs/{id}/comments")
    suspend fun commentaires(@Path("id") id: String): ListeCommentaires

    /** 10 par minute et par adresse IP (429 au-delà). */
    @POST("api/songs/{id}/comments")
    suspend fun commenter(@Path("id") id: String, @Body corps: NouveauCommentaire): ReponseCommentaire

    /** 403 si ce n'est pas le sien. */
    @DELETE("api/comments/{id}")
    suspend fun supprimerCommentaire(@Path("id") id: String)

    /** Les 100 plus récents des titres de l'album, avec le nom du titre. */
    @GET("api/albums/{id}/comments")
    suspend fun commentairesAlbum(@Path("id") id: String): ListeCommentaires

    @GET("api/songs/{id}/lyrics")
    suspend fun paroles(@Path("id") id: String): ReponseParoles

    /** Compte un partage (20 par minute et par adresse IP). */
    @POST("api/songs/{id}/share")
    suspend fun partage(@Path("id") id: String)

    /** Toujours avec l'artiste : sans lui, le site renvoie tous les albums de la base. */
    @GET("api/albums")
    suspend fun albumsDe(@Query("artist") artiste: String): ListeAlbums

    /** Tous les albums, du plus récent au plus ancien, sans filtre d'univers. */
    @GET("api/albums")
    suspend fun albums(): ListeAlbums

    @GET("api/me/saved-albums")
    suspend fun albumsEnregistres(): ListeAlbums

    /** Bascule : le site répond l'état obtenu. */
    @POST("api/me/saved-albums")
    suspend fun basculerAlbum(@Body corps: AlbumAEnregistrer): EtatEnregistre

    @GET("api/playlists?owner=me")
    suspend fun mesPlaylists(): ListePlaylists

    @POST("api/playlists")
    suspend fun creerPlaylist(@Body corps: NouvellePlaylist): ReponsePlaylistCreee

    @PATCH("api/playlists/{id}")
    suspend fun modifierPlaylist(@Path("id") id: String, @Body corps: ModificationPlaylist)

    @DELETE("api/playlists/{id}")
    suspend fun supprimerPlaylist(@Path("id") id: String)

    @POST("api/playlists/{id}/songs")
    suspend fun ajouterTitres(@Path("id") id: String, @Body corps: TitresDePlaylist)

    /** DELETE avec un corps : la route lit le titre à retirer dans le corps, pas dans l'adresse. */
    @HTTP(method = "DELETE", path = "api/playlists/{id}/songs", hasBody = true)
    suspend fun retirerTitre(@Path("id") id: String, @Body corps: TitreDePlaylist)

    /** Les 12 derniers titres écoutés, distincts, de l'univers (F5). */
    @GET("api/me/recent")
    suspend fun recents(@Query("univers") univers: String?): ListeTitres

    // Compte : préférences, sécurité, abonnement (domaines A, B, C)

    @GET("api/me/subscription")
    suspend fun abonnement(): EtatAbonnement

    // Écoute à plusieurs (donnees/ensemble/EcouteEnsemble.kt)
    @POST("api/ecoute-ensemble")
    suspend fun ouvrirEnsemble(): CodeEnsemble

    @GET("api/ecoute-ensemble/{code}")
    suspend fun etatEnsemble(@Path("code") code: String): EtatEnsembleDistant

    @PUT("api/ecoute-ensemble/{code}")
    suspend fun publierEnsemble(@Path("code") code: String, @Body etat: EtatPublie)

    @DELETE("api/ecoute-ensemble/{code}")
    suspend fun quitterEnsemble(@Path("code") code: String)

    @GET("api/me/bilan")
    suspend fun bilan(@Query("annee") annee: Int): Bilan

    /** Réservé au compte artiste : 404 sans profil artiste. */
    @GET("api/artist/stats")
    suspend fun statistiquesArtiste(@Query("jours") jours: Int): StatistiquesArtiste

    @GET("api/me/sessions")
    suspend fun appareils(): Appareils

    @DELETE("api/me/sessions")
    suspend fun deconnecterAppareil(@Query("id") id: String)

    @DELETE("api/me/sessions")
    suspend fun fermerToutesLesSessions()

    @POST("api/me/password")
    suspend fun changerMotDePasse(@Body corps: ChangementMotDePasse)

    @PATCH("api/me/profile")
    suspend fun modifierProfil(@Body corps: ModificationProfil)

    @PUT("api/me/univers")
    suspend fun changerUnivers(@Body corps: ChoixUnivers)

    @GET("api/me/mode")
    suspend fun mode(): ModeCourant

    @PUT("api/me/mode")
    suspend fun changerMode(@Body corps: ChoixMode)

    @GET("api/me/theme")
    suspend fun themes(): ThemesCompte

    /** La même route que `configuration`, lue pour son seul thème. */
    @GET("api/site-config")
    suspend fun themeDuSite(): ConfigurationTheme

    // Fonctions IA, chacune activable par l'administration (aiFeatures)

    @POST("api/ai/playlist")
    suspend fun composerPlaylist(@Body corps: DemandeIA, @Query("univers") univers: String?): ReponsePropositionPlaylist

    @POST("api/ai/search")
    suspend fun rechercheIA(@Body corps: DemandeIA): ResultatRechercheIA

    @POST("api/lyrics/translate")
    suspend fun traduire(@Body corps: Traduction): Traduite

    /** Le fil de l'assistant, créé au premier usage (H12). */
    @GET("api/messagerie/assistant")
    suspend fun assistant(): FilAssistant

    @POST("api/messagerie/assistant")
    suspend fun demanderAssistant(@Body corps: DemandeIA, @Query("univers") univers: String?): EchangeAssistant

    // Messagerie (H4 à H8)

    @GET("api/messagerie/non-lus")
    suspend fun nonLus(): CompteurNonLus

    @GET("api/messagerie/conversations")
    suspend fun conversations(): ListeConversations

    @GET("api/messagerie/conversations/{id}")
    suspend fun conversation(@Path("id") id: String): ReponseConversation

    /** 40 messages avant `avant`, ou ceux créés ou modifiés depuis `depuis`. */
    @GET("api/messagerie/conversations/{id}/messages")
    suspend fun messages(@Path("id") id: String, @Query("avant") avant: String?, @Query("depuis") depuis: String?): PageMessages

    @POST("api/messagerie/conversations/{id}/messages")
    suspend fun envoyerMessage(@Path("id") id: String, @Body corps: NouveauMessage): ReponseMessage

    @PATCH("api/messagerie/messages/{id}")
    suspend fun modifierMessage(@Path("id") id: String, @Body corps: ModificationMessage): ReponseMessage

    @DELETE("api/messagerie/messages/{id}")
    suspend fun supprimerMessage(@Path("id") id: String): ReponseMessage

    @POST("api/messagerie/messages/{id}/reaction")
    suspend fun reagir(@Path("id") id: String, @Body corps: ReactionEnvoyee): ReponseMessage

    @POST("api/messagerie/conversations/{id}/lu")
    suspend fun marquerLu(@Path("id") id: String)

    @POST("api/messagerie/conversations/{id}/saisie")
    suspend fun signalerSaisie(@Path("id") id: String)

    /** Même route que l'ouverture d'un tête-à-tête, avec un autre corps. */
    @POST("api/messagerie/conversations")
    suspend fun creerGroupe(@Body corps: NouveauGroupe): ReponseConversation

    @PATCH("api/messagerie/conversations/{id}")
    suspend fun reglerConversation(@Path("id") id: String, @Body corps: ModificationConversation): ReponseConversation

    /** Groupes seulement. */
    @DELETE("api/messagerie/conversations/{id}")
    suspend fun quitterConversation(@Path("id") id: String)

    /** Ce téléphone reçoit les notifications push du compte (H14). */
    @POST("api/me/appareils-push")
    suspend fun inscrireAppareil(@Body corps: AppareilPush)

    @HTTP(method = "DELETE", path = "api/me/appareils-push", hasBody = true)
    suspend fun retirerAppareil(@Body corps: JetonPush)

    /** Ouvre un envoi de fichier chez Karaks Storage (K2). */
    @POST("api/fichiers/envoi")
    suspend fun ouvrirEnvoi(@Body corps: AnnonceFichier): OuvertureEnvoi

    @GET("api/messagerie/destinataires")
    suspend fun destinataires(@Query("q") recherche: String?): Destinataires

    @POST("api/messagerie/conversations")
    suspend fun ouvrirConversation(@Body corps: ConversationAOuvrir): ReponseConversation

    @GET("api/me/followed-artists")
    suspend fun artistesSuivis(): ArtistesSuivis

    /** Bascule : le site répond l'état obtenu et le nouveau nombre d'abonnés. */
    @POST("api/artists/{id}/follow")
    suspend fun basculerSuivi(@Path("id") id: String): EtatSuivi
}

@Serializable
data class Identifiants(val email: String, val password: String, val device: String)

@Serializable
data class CodeRelais(val code: String, val device: String)

@Serializable
data class JetonGoogle(val idToken: String, val device: String)

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
