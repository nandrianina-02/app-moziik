package com.moziik.app.donnees.reseau

import com.moziik.app.donnees.session.StockageSession
import kotlinx.serialization.json.Json
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Le lecteur JSON de l'app : le site ajoute des champs au fil du temps, l'app ignore ceux qu'elle ne connaît pas. */
val JsonMoziik = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
}

private val TYPE_JSON = "application/json; charset=utf-8".toMediaType()

/** Pose le jeton d'accès sur chaque requête vers le site, s'il y a une session. */
class AjoutJeton(private val stockage: StockageSession) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val requete = chain.request()
        val jeton = stockage.lire()?.accessToken
        if (jeton == null || requete.header("Authorization") != null) return chain.proceed(requete)
        return chain.proceed(requete.newBuilder().header("Authorization", "Bearer $jeton").build())
    }
}

/** Issue d'un renouvellement du jeton d'accès. */
sealed interface Renouveler {
    data class Nouveau(val accessToken: String) : Renouveler
    /** Le site refuse : session révoquée, expirée (30 jours) ou compte suspendu. */
    data object Refuse : Renouveler
    /** Réseau ou serveur indisponible : la session reste, on réessaiera. */
    data object Echec : Renouveler
}

/**
 * Le jeton d'accès ne vit que 15 minutes. Sur une réponse 401, on le
 * renouvelle une fois et on rejoue la requête. Si le site refuse le
 * renouvellement, la session est finie : on l'oublie, et la requête repart
 * sans jeton, car le site refuse un jeton expiré même sur ses routes
 * publiques. Une panne réseau ne déconnecte jamais personne.
 */
class RenouvellementJeton(
    private val stockage: StockageSession,
    private val renouveler: (refreshToken: String) -> Renouveler,
) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        val requete = response.request
        val envoye = requete.header("Authorization")?.removePrefix("Bearer ") ?: return null
        // Déjà rejouée une fois avec un jeton neuf et toujours refusée : le refus est réel.
        if (response.priorResponse != null) return null

        synchronized(this) {
            val session = stockage.lire() ?: return requete.newBuilder().removeHeader("Authorization").build()
            // Un autre appel a renouvelé pendant qu'on attendait le verrou.
            if (session.accessToken != envoye) {
                return requete.newBuilder().header("Authorization", "Bearer ${session.accessToken}").build()
            }
            return when (val issue = renouveler(session.refreshToken)) {
                is Renouveler.Nouveau -> {
                    stockage.ecrire(session.copy(accessToken = issue.accessToken))
                    requete.newBuilder().header("Authorization", "Bearer ${issue.accessToken}").build()
                }
                Renouveler.Refuse -> {
                    stockage.effacer()
                    requete.newBuilder().removeHeader("Authorization").build()
                }
                Renouveler.Echec -> null
            }
        }
    }
}

/** POST /api/mobile-auth/refresh, sur un client sans authentificateur (sinon il s'appellerait lui-même). */
fun renouvellementPar(client: OkHttpClient, site: String): (String) -> Renouveler = { refreshToken ->
    val corps = JsonMoziik.encodeToString(DemandeRenouvellement.serializer(), DemandeRenouvellement(refreshToken))
    val requete = Request.Builder().url("${site}api/mobile-auth/refresh").post(corps.toRequestBody(TYPE_JSON)).build()
    try {
        client.newCall(requete).execute().use { reponse ->
            when {
                reponse.isSuccessful -> {
                    val texte = reponse.body?.string().orEmpty()
                    Renouveler.Nouveau(JsonMoziik.decodeFromString(Renouvellement.serializer(), texte).accessToken)
                }
                reponse.code == 401 -> Renouveler.Refuse
                else -> Renouveler.Echec
            }
        }
    } catch (e: IOException) {
        Renouveler.Echec
    }
}

/** Le client HTTP et l'API, tels que l'app les utilise. */
class Reseau(site: String, stockage: StockageSession) {
    private val base = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    val client: OkHttpClient = base.newBuilder()
        .addInterceptor(AjoutJeton(stockage))
        .authenticator(RenouvellementJeton(stockage, renouvellementPar(base, site)))
        .build()

    val api: MoziikApi = Retrofit.Builder()
        .baseUrl(site)
        .client(client)
        .addConverterFactory(JsonMoziik.asConverterFactory(TYPE_JSON))
        .build()
        .create(MoziikApi::class.java)
}
