package com.moziik.app.ui.notifications

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.moziik.app.donnees.notifications.AnnonceTexte
import com.moziik.app.donnees.notifications.Bloc
import com.moziik.app.donnees.notifications.Morceau
import com.moziik.app.theme.LocalPalette
import com.moziik.app.theme.Texte
import com.moziik.app.theme.compose

private fun AnnotatedString.Builder.ajouter(morceaux: List<Morceau>, accent: Color, encre: Color, onLien: (String) -> Unit) {
    morceaux.forEach { m ->
        when (m) {
            is Morceau.Texte -> append(m.valeur)
            is Morceau.Gras -> withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = encre)) { ajouter(m.morceaux, accent, encre, onLien) }
            is Morceau.Italique -> withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { ajouter(m.morceaux, accent, encre, onLien) }
            is Morceau.Lien -> withLink(
                LinkAnnotation.Clickable(
                    tag = m.adresse,
                    styles = TextLinkStyles(SpanStyle(color = accent, textDecoration = TextDecoration.Underline)),
                ) { onLien(m.adresse) },
            ) { ajouter(m.morceaux, accent, encre, onLien) }
        }
    }
}

/**
 * Le corps d'une annonce de la plateforme, mis en forme comme sur le site :
 * gras, italique, liens (une page du site s'ouvre dans l'app, une adresse
 * externe dans le navigateur), listes à puces.
 */
@Composable
fun TexteAnnonce(texte: String, onLien: (String) -> Unit, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    val accent = p.accent.compose
    val encre = p.encre.compose
    val blocs = remember(texte) { AnnonceTexte.blocs(texte) }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        blocs.forEach { bloc ->
            when (bloc) {
                is Bloc.Paragraphe -> Text(
                    buildAnnotatedString { ajouter(bloc.morceaux, accent, encre, onLien) },
                    style = Texte.corps,
                    color = p.encreAttenuee.compose,
                )
                is Bloc.Liste -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    bloc.elements.forEach { element ->
                        Row {
                            Text("•", style = Texte.corps, color = accent)
                            androidx.compose.foundation.layout.Spacer(Modifier.width(8.dp))
                            Text(
                                buildAnnotatedString { ajouter(element, accent, encre, onLien) },
                                style = Texte.corps,
                                color = p.encreAttenuee.compose,
                            )
                        }
                    }
                }
            }
        }
    }
}
