package com.moziik.app.ui.coquille

import androidx.annotation.DrawableRes
import com.moziik.app.R

/** Les cinq entrées de la barre du bas, dans l'ordre du site (MobileNav.tsx). */
enum class Destination(val route: String, val libelle: String, @DrawableRes val icone: Int) {
    ACCUEIL("accueil", "Accueil", R.drawable.lucide_house),
    RECHERCHE("recherche", "Recherche", R.drawable.lucide_search),
    MA_ZONE("bibliotheque", "Ma zone", R.drawable.lucide_library),
    MESSAGES("messages", "Messages", R.drawable.lucide_messages_square),
    COMPTE("compte", "Compte", R.drawable.lucide_user),
}
