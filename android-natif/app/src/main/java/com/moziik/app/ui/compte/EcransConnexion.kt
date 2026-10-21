package com.moziik.app.ui.compte

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.moziik.app.R
import com.moziik.app.donnees.session.EtatGoogle
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose
import com.moziik.app.ui.composants.BoutonGoogle
import com.moziik.app.ui.composants.BoutonPrincipal
import com.moziik.app.ui.composants.ChampTexte
import com.moziik.app.ui.composants.Icone
import com.moziik.app.ui.composants.LienTexte
import com.moziik.app.ui.composants.MessageErreur
import com.moziik.app.ui.composants.Saisie
import com.moziik.app.ui.conteneur
import kotlinx.coroutines.launch

/** Mise en page commune : colonne défilante, largeur bornée sur tablette, titre en Sora. */
@Composable
private fun CadreFormulaire(titre: String, sousTitre: String, contenu: @Composable ColumnScope.() -> Unit) {
    val p = LocalPalette.current
    Box(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 420.dp).fillMaxWidth().padding(horizontal = 24.dp, vertical = 28.dp)) {
            Text(titre, style = Texte.titreFiche, color = p.encre.compose)
            Spacer(Modifier.height(4.dp))
            Text(sousTitre, style = Texte.corps, color = p.encreAttenuee.compose)
            Spacer(Modifier.height(24.dp))
            contenu()
        }
    }
}

@Composable
private fun SeparateurOu() {
    val p = LocalPalette.current
    Row(Modifier.fillMaxWidth().padding(vertical = 20.dp), verticalAlignment = Alignment.CenterVertically) {
        HorizontalDivider(Modifier.weight(1f), color = p.bordure.compose)
        Text("ou", style = Texte.secondaire, color = p.encreAttenuee.compose, modifier = Modifier.padding(horizontal = 12.dp))
        HorizontalDivider(Modifier.weight(1f), color = p.bordure.compose)
    }
}

@Composable
private fun ConnexionGoogle() {
    val contexte = LocalContext.current
    val c = conteneur()
    val google by c.session.google.collectAsStateWithLifecycle()
    val barre = LocalPalette.current.base.enArgb().toInt()
    val portee = rememberCoroutineScope()
    BoutonGoogle(
        enCours = google is EtatGoogle.EnCours,
        onClick = { portee.launch { connexionGoogleIntegree(contexte, c, barre) } },
    )
    MessageErreur((google as? EtatGoogle.Echec)?.message, Modifier.padding(top = 12.dp))
}

@Composable
fun EcranConnexion(onInscription: () -> Unit, onMotDePasseOublie: () -> Unit) {
    val c = conteneur()
    val modele: ConnexionModele = viewModel { ConnexionModele(c.session) }
    val etat by modele.etat.collectAsStateWithLifecycle()
    var email by rememberSaveable { mutableStateOf("") }
    var motDePasse by rememberSaveable { mutableStateOf("") }
    val p = LocalPalette.current

    CadreFormulaire("Bienvenue !", "Connecte-toi à ton compte") {
        ChampTexte(email, { email = it }, "Email", R.drawable.lucide_mail, saisie = Saisie.EMAIL, indication = "Exemple@email.com")
        Spacer(Modifier.height(16.dp))
        ChampTexte(
            motDePasse, { motDePasse = it }, "Mot de passe", R.drawable.lucide_lock,
            saisie = Saisie.MOT_DE_PASSE, actionClavier = ImeAction.Done,
            onValider = { modele.connexion(email, motDePasse) },
        )
        Box(Modifier.fillMaxWidth().padding(top = 8.dp), contentAlignment = Alignment.CenterEnd) {
            LienTexte("Mot de passe oublié ?", onMotDePasseOublie)
        }
        MessageErreur(etat.erreur, Modifier.padding(top = 12.dp))
        if (etat.aConfirmer != null) {
            LienTexte("Renvoyer l'email de confirmation", modele::renvoyerConfirmation, Modifier.padding(top = 8.dp))
        }
        etat.confirmation?.let { Text(it, style = Texte.corps, color = p.verifie.compose, modifier = Modifier.padding(top = 12.dp)) }
        Spacer(Modifier.height(20.dp))
        BoutonPrincipal("Se connecter", { modele.connexion(email, motDePasse) }, enCours = etat.enCours)
        SeparateurOu()
        ConnexionGoogle()
        Row(Modifier.fillMaxWidth().padding(top = 24.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            Text("Pas encore de compte ? ", style = Texte.corps, color = p.encreAttenuee.compose)
            LienTexte("Créer un compte", onInscription)
        }
    }
}

@Composable
fun EcranInscription(onConnexion: () -> Unit) {
    val c = conteneur()
    val modele: InscriptionModele = viewModel { InscriptionModele(c.session) }
    val etat by modele.etat.collectAsStateWithLifecycle()
    val cree by modele.cree.collectAsStateWithLifecycle()
    var nom by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var motDePasse by rememberSaveable { mutableStateOf("") }
    val p = LocalPalette.current

    val adresse = cree
    if (adresse != null) {
        BoiteMail(
            texte = "Un email de confirmation a été envoyé à $adresse. Clique sur le lien qu'il contient pour activer ton compte et pouvoir te connecter.",
            renvoi = if (etat.confirmation == null) "Je n'ai rien reçu, renvoyer l'email" else null,
            onRenvoyer = modele::renvoyer,
            enCours = etat.enCours,
            erreur = etat.erreur,
            confirmation = etat.confirmation,
            onRetour = onConnexion,
        )
        return
    }

    CadreFormulaire("Créer un compte", "Rejoins la communauté et soutiens tes artistes.") {
        ChampTexte(nom, { nom = it }, "Nom", R.drawable.lucide_user, saisie = Saisie.NOM, indication = "Ton nom")
        Spacer(Modifier.height(16.dp))
        ChampTexte(email, { email = it }, "Email", R.drawable.lucide_mail, saisie = Saisie.EMAIL, indication = "Exemple@email.com")
        Spacer(Modifier.height(16.dp))
        ChampTexte(
            motDePasse, { motDePasse = it }, "Mot de passe", R.drawable.lucide_lock,
            saisie = Saisie.MOT_DE_PASSE, indication = "8 caractères au moins", actionClavier = ImeAction.Done,
            onValider = { modele.inscription(nom, email, motDePasse) },
        )
        MessageErreur(etat.erreur, Modifier.padding(top = 12.dp))
        Spacer(Modifier.height(20.dp))
        BoutonPrincipal("Créer mon compte", { modele.inscription(nom, email, motDePasse) }, enCours = etat.enCours)
        SeparateurOu()
        ConnexionGoogle()
        Row(Modifier.fillMaxWidth().padding(top = 24.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            Text("Déjà un compte ? ", style = Texte.corps, color = p.encreAttenuee.compose)
            LienTexte("Se connecter", onConnexion)
        }
    }
}

@Composable
fun EcranMotDePasseOublie(onRetour: () -> Unit) {
    val c = conteneur()
    val modele: MotDePasseModele = viewModel { MotDePasseModele(c.session) }
    val etat by modele.etat.collectAsStateWithLifecycle()
    var email by rememberSaveable { mutableStateOf("") }

    val envoye = etat.confirmation
    if (envoye != null) {
        BoiteMail(texte = "Si un compte existe avec l'adresse $email, un lien de réinitialisation vient d'être envoyé.", onRetour = onRetour)
        return
    }
    CadreFormulaire("Mot de passe oublié", "Indique ton email, on t'envoie un lien de réinitialisation.") {
        ChampTexte(
            email, { email = it }, "Email", R.drawable.lucide_mail,
            saisie = Saisie.EMAIL, indication = "Exemple@email.com", actionClavier = ImeAction.Done,
            onValider = { modele.envoyer(email) },
        )
        MessageErreur(etat.erreur, Modifier.padding(top = 12.dp))
        Spacer(Modifier.height(20.dp))
        BoutonPrincipal("Envoyer le lien", { modele.envoyer(email) }, enCours = etat.enCours)
        Box(Modifier.fillMaxWidth().padding(top = 20.dp), contentAlignment = Alignment.Center) {
            LienTexte("Retour à la connexion", onRetour)
        }
    }
}

/** « Vérifie ta boîte mail », après une inscription ou une demande de réinitialisation. */
@Composable
private fun BoiteMail(
    texte: String,
    onRetour: () -> Unit,
    renvoi: String? = null,
    onRenvoyer: () -> Unit = {},
    enCours: Boolean = false,
    erreur: String? = null,
    confirmation: String? = null,
) {
    val p = LocalPalette.current
    Column(
        Modifier.fillMaxSize().padding(horizontal = 32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icone(R.drawable.lucide_mail_check, description = null, teinte = p.accent.compose, taille = 40.dp)
        Spacer(Modifier.height(16.dp))
        Text("Vérifie ta boîte mail", style = Texte.titreSection, color = p.encre.compose)
        Spacer(Modifier.height(8.dp))
        Text(texte, style = Texte.corps, color = p.encreAttenuee.compose, textAlign = TextAlign.Center)
        if (renvoi != null) {
            Spacer(Modifier.height(20.dp))
            if (enCours) Text("Envoi…", style = Texte.corps, color = p.encreAttenuee.compose) else LienTexte(renvoi, onRenvoyer)
        }
        confirmation?.let {
            Spacer(Modifier.height(16.dp))
            Text(it, style = Texte.corps, color = p.verifie.compose, textAlign = TextAlign.Center)
        }
        MessageErreur(erreur, Modifier.padding(top = 12.dp))
        Spacer(Modifier.height(24.dp))
        LienTexte("Retour à la connexion", onRetour)
    }
}
