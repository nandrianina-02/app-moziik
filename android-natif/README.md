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

1. Ajouter son nom Lucide (nom de fichier de `lucide-react`) dans `outils/icones.txt`.
2. `node android-natif/outils/icones.mjs <node_modules du site>`
3. L'utiliser : `Icone(R.drawable.lucide_<nom>, ...)`.
