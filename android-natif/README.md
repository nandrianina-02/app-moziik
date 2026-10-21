# Moziik, app Android native

L'app Android de Moziik réécrite en natif (Kotlin, Jetpack Compose), pour
remplacer la coquille Capacitor du dossier `android/`. Elle est réservée aux
auditeurs : ni administration, ni espace artiste, qui restent sur le site.
Elle ne parle au serveur que par l'API HTTP du site, avec les jetons mobiles
(`app/api/mobile-auth`).

## Ce qui est en place

| Élément | Où |
|---|---|
| Thème : la palette du site calculée à l'identique (préréglages, contraste garanti) | `app/src/main/java/com/moziik/app/theme/` |
| Polices du site : Sora (titres), Plus Jakarta Sans (texte), licence OFL | `app/src/main/res/font/`, `licences/` |
| Icônes Lucide du site, converties en vecteurs Android | `outils/icones.mjs`, `outils/icones.txt` |
| Coquille : en-tête, barre du bas à cinq entrées, transitions du site | `app/src/main/java/com/moziik/app/ui/coquille/` |
| Compte : connexion e-mail et Google, inscription, session chiffrée, jeton renouvelé | `donnees/session/`, `donnees/reseau/`, `ui/compte/` |
| Accueil : bannière, « Ma bande son », sections de l'administration, copie de la dernière visite | `donnees/catalogue/`, `ui/accueil/` |
| Recherche : filtres par type, meilleur résultat, dernières recherches, titres populaires | `ui/recherche/` |
| Fiches titre, album, artiste et playlist : écouter, suivre, enregistrer, partager | `ui/fiches/` |
| Classements (podium, tendance, votre place), radio et stations, titres par genre, évènements ; raccourcis de l'accueil | `ui/decouvrir/`, `donnees/catalogue/Stations.kt` |
| Ma zone : playlists (créer, modifier, ajouter, retirer, supprimer), titres aimés, albums et podcasts, artistes suivis, écoutes récentes ; menu d'un titre à l'appui long | `ui/bibliotheque/`, `ui/menus/`, `donnees/catalogue/Bibliotheque.kt` |
| Messages : conversations, non-lus, fil avec réponses citées, modification, suppression, cartes de partage, accusés de lecture, « Écrit… », envoi d'un titre dans un message | `ui/messages/`, `donnees/messagerie/` |
| Fonctions IA du site, selon leur activation : composer une playlist, assistant d'écoute, recherche par description, traduction des paroles | `donnees/catalogue/IA.kt`, `ui/menus/ComposerIA.kt` |
| Compte : profil, préférences (univers, mode d'écoute), lecture (qualité, économie de données), apparence, abonnement, sécurité (mot de passe, appareils) ; thème du site ; reprise de la lecture au lancement | `ui/compte/Reglages.kt`, `donnees/compte/` |
| Logo animé du site (public/moziik-animated.svg), redessiné en natif : en-tête et chargements | `ui/composants/LogoMoziik.kt` |
| Paroles synchronisées dans le lecteur, analysées comme sur le site (LRC, mot à mot) | `donnees/catalogue/Paroles.kt`, `ui/lecteur/PanneauParoles.kt` |
| Lecteur : Media3 en arrière-plan (notification, écran verrouillé, casque), file prolongée, écoutes déclarées au temps réel, quota des visiteurs | `lecteur/`, `ui/lecteur/` |

## Construire

L'app se construit sur GitHub Actions (`.github/workflows/android-natif.yml`)
à chaque envoi qui touche ce dossier : tests, puis version de test
téléchargeable dans les artefacts de l'exécution (`moziik-test-apk`).

- **Version de test** : identifiant `com.moziik.app.test`, nom « Moziik
  test ». Elle s'installe à côté de l'app actuelle. Elle est signée par
  `app/debug.keystore`, clé de test volontairement versionnée : chaque
  version de test remplace la précédente sans désinstallation. Cette clé
  n'a aucune valeur au-delà.
- **Version publiée** : identifiant `com.moziik.app`, signée avec la clé de
  l'app actuelle (`android/moziik-release.jks`) pour s'installer comme une
  mise à jour. La clé n'est jamais dans le dépôt : elle sera fournie à
  l'intégration continue par des secrets GitHub (`MOZIIK_KEYSTORE_*`,
  `MOZIIK_KEY_*`).

Dans Android Studio, ouvrir ce dossier ; `gradle wrapper` crée le wrapper
si besoin (Gradle 8.11.1, JDK 17).

## Ajouter une icône

1. Ajouter son nom Lucide (nom de fichier de `lucide-react`) dans `outils/icones.txt`,
   suivi de `plein` pour sa version remplie (`lucide_<nom>_plein`).
2. `node android-natif/outils/icones.mjs <node_modules du site>`
3. L'utiliser : `Icone(R.drawable.lucide_<nom>, ...)`.
