package com.moziik.app.donnees.reseau

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import retrofit2.HttpException
import java.io.IOException

/**
 * Une réponse d'erreur du site. Toutes ses routes passent par withApiErrors
 * (lib/apiError.ts) et répondent `{ "error": "<message en français>" }` :
 * le message est prêt à afficher, sauf les codes techniques (EMAIL_NOT_VERIFIED).
 */
class ErreurApi(val statut: Int, val code: String?) : Exception(code)

private val lecteur = Json { ignoreUnknownKeys = true }

/** Le message `error` d'un corps de réponse, s'il y en a un. */
fun messageDuCorps(corps: String?): String? = try {
    corps?.let { lecteur.parseToJsonElement(it).jsonObject["error"]?.jsonPrimitive?.content }
} catch (e: Exception) {
    null
}

/** Ramène une erreur de Retrofit à une ErreurApi lisible ; les autres passent telles quelles. */
fun versErreurApi(e: Throwable): Throwable = when (e) {
    is HttpException -> ErreurApi(e.code(), messageDuCorps(e.response()?.errorBody()?.string()))
    else -> e
}

/** Le texte à montrer pour une erreur, quelle qu'elle soit. */
fun messageErreur(e: Throwable): String = when (e) {
    is ErreurApi -> when {
        e.statut == 429 -> e.code ?: "Trop de tentatives. Réessaie dans quelques minutes."
        e.statut >= 500 -> "Moziik ne répond pas pour le moment. Réessaie dans un instant."
        else -> e.code ?: "Une erreur est survenue."
    }
    is IOException -> "Connexion impossible. Vérifie ton réseau et réessaie."
    else -> "Une erreur inattendue est survenue."
}
