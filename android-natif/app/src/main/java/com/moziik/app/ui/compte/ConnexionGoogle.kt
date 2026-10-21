package com.moziik.app.ui.compte

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.moziik.app.BuildConfig
import com.moziik.app.donnees.Conteneur
import com.moziik.app.ui.ouvrirConnexionGoogle
import kotlinx.coroutines.launch

/**
 * « Continuer avec Google » sans quitter l'app : la fenêtre de connexion
 * Google intégrée à Android (Credential Manager) s'ouvre par-dessus l'écran,
 * avec les comptes Google du téléphone. Elle rend un jeton d'identité
 * signé par Google, que le site vérifie (POST /api/mobile-auth/google).
 *
 * Seul un téléphone sans services Google (certains Huawei) n'a pas cette
 * fenêtre : il passe alors par l'onglet du navigateur et le relais du site,
 * faute d'autre chemin.
 *
 * `contexte` doit être l'activité : la fenêtre s'ouvre par-dessus elle.
 */
suspend fun connexionGoogleIntegree(contexte: Context, conteneur: Conteneur, couleurBarre: Int) {
    val session = conteneur.session
    session.oublierEchecGoogle()
    val requete = GetCredentialRequest.Builder()
        .addCredentialOption(GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_CLIENT_WEB).build())
        .build()
    try {
        val identifiant = CredentialManager.create(contexte).getCredential(contexte, requete).credential
        if (identifiant is CustomCredential && identifiant.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            val jeton = GoogleIdTokenCredential.createFrom(identifiant.data).idToken
            // Portée de l'app : l'échange avec le site survit à une rotation de l'écran.
            conteneur.portee.launch { session.connexionJetonGoogle(jeton) }
        } else {
            session.signalerEchecGoogle("Google n'a pas renvoyé de compte. Réessaie.")
        }
    } catch (e: GetCredentialCancellationException) {
        // Fenêtre fermée par l'utilisateur : rien à dire.
    } catch (e: GetCredentialProviderConfigurationException) {
        ouvrirConnexionGoogle(contexte, couleurBarre)
    } catch (e: GetCredentialUnsupportedException) {
        ouvrirConnexionGoogle(contexte, couleurBarre)
    } catch (e: NoCredentialException) {
        session.signalerEchecGoogle("Aucun compte Google n'est disponible sur ce téléphone.")
    } catch (e: GetCredentialException) {
        session.signalerEchecGoogle(messageGoogle(e.message))
    }
}

/**
 * « 28444 » / « Developer console is not set up correctly » : Google ne
 * connaît pas encore cette app (identifiant client Android à déclarer dans
 * la console Google Cloud). Dit tel quel pour que le diagnostic soit immédiat.
 */
internal fun messageGoogle(detail: String?): String = when {
    detail != null && ("28444" in detail || "Developer console" in detail) ->
        "La connexion Google n'est pas encore activée pour cette version de l'app."
    else -> "La connexion Google n'a pas abouti. Réessaie."
}
