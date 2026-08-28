# Application Android

L'app Android **n'est pas un second Moziik**. C'est une coquille native qui
affiche le site Next.js déployé, plus une couche Kotlin/Java qui apporte ce
qu'un navigateur ne sait pas faire sur Android : lecture en arrière-plan,
notification média, boutons de casque, liens profonds.

Conséquence directe, et c'est tout l'intérêt : **il n'y a aucune interface à
maintenir en double**. Une page corrigée sur le site est corrigée dans l'app
au déploiement suivant, sans passer par une revue du Play Store.

---

## Pourquoi ce choix

Le site rend ses pages côté serveur, avec MongoDB, dans 44 routes. Embarquer
l'interface dans l'APK aurait supposé de tout réécrire en client — plusieurs
semaines de travail, et deux bases d'interface qui divergent ensuite mois
après mois.

Trois éléments rendaient la coquille immédiatement viable :

| Déjà en place | Où |
|---|---|
| API qui accepte `Authorization: Bearer` sur **toutes** les routes protégées | `lib/mobileAuth.ts` — les 46 routes passent par `requireAuthUser` |
| Jetons mobiles (accès 15 min + rafraîchissement 30 j révocable) | `app/api/mobile-auth/` |
| PWA complète : cache hors-ligne, file de synchronisation, `MediaSession` | `public/sw.js`, `lib/offline*.ts`, `context/PlayerProvider.tsx` |

Le pont natif est injecté par Capacitor **dans le site distant**, via
`WebViewCompat.addDocumentStartJavaScript` sur l'origine de `server.url`
(`Bridge.java`). C'est ce détail qui permet à `lib/native/pont.ts` de lire
directement `window.Capacitor.Plugins.*` : **aucun paquet Capacitor n'entre
dans le bundle web**, les visiteurs du site ne paient pas un octet pour
l'app.

---

## Ce que la couche native ajoute

| Fonction | Fichier |
|---|---|
| Lecture qui survit à l'écran éteint (service de premier plan) | `android/…/MoziikAudioService.java` |
| Notification média : pochette, artiste, précédent/lecture/suivant, barre de progression | idem |
| Commandes écran verrouillé + boutons de casque Bluetooth | `MediaSessionCompat` dans le même fichier |
| Pont JS ↔ natif | `android/…/MoziikAudioPlugin.java`, `components/native/NativeMediaSession.tsx` |
| Bouton Retour matériel (ferme le tiroir, puis le lecteur, puis l'historique, puis quitte sur double appui) | `components/native/NativeShell.tsx` |
| Barre d'état qui suit le thème choisi dans l'app | idem |
| Liens profonds : un lien Moziik reçu par message ouvre l'app | `AndroidManifest.xml` + `app/.well-known/assetlinks.json/route.ts` |
| Connexion Google (impossible en WebView, passe par un onglet Chrome) | `lib/native/authGoogle.ts`, `app/api/mobile-auth/relais/` |
| Écran de repli hors connexion, aux couleurs Moziik | `android-shell/erreur-reseau.html` |

### Le détail qui fait tout tenir : le service de premier plan

Contrairement à une idée répandue, Capacitor **ne met pas la WebView en
pause** quand l'app passe en arrière-plan (`Bridge.onPause()` se contente de
notifier les plugins). La lecture continue donc d'elle-même… quelques
minutes. Sans composant de premier plan, Android met le processus en cache
puis le gèle, et le son s'arrête sans prévenir — typiquement juste après le
verrouillage de l'écran. `MoziikAudioService` existe pour ça.

---

## Installer la chaîne de build

Rien n'est nécessaire pour modifier le code ; seul le **passage à l'APK**
demande ces outils.

1. **Android Studio** — <https://developer.android.com/studio>
   L'installation par défaut fournit le JDK 17 et le SDK Android.
2. Au premier lancement, accepter le téléchargement du **SDK Platform 34**
   (`compileSdkVersion` du projet) et des **Build Tools**.
3. Vérifier dans un nouveau terminal :

   ```powershell
   java -version          # doit afficher 17.x
   $env:ANDROID_HOME      # doit pointer vers le SDK
   ```

   Si `ANDROID_HOME` est vide :

   ```powershell
   [Environment]::SetEnvironmentVariable(
     'ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
   ```

   puis rouvrir le terminal.

---

## Compiler

```powershell
npm run android:sync    # recopie la config dans android/
npm run android:open    # ouvre le projet dans Android Studio
npm run android:apk     # APK de test  -> android/app/build/outputs/apk/debug/
npm run android:aab     # AAB du Store -> android/app/build/outputs/bundle/release/
```

Pour pointer l'app vers un serveur local plutôt que la production :

```powershell
$env:CAP_SERVER_URL = "http://192.168.1.12:3000"
npm run android:sync
```

Viser un `npm run build && npm run start`, **jamais `next dev`** : en
développement, la première navigation vers une route attend 30 à 130 s de
compilation, ce qui ressemble à s'y méprendre à une app figée.

---

## Publier

### 1. Créer la clé de signature — une seule fois, à ne jamais perdre

```powershell
keytool -genkey -v -keystore android/moziik-release.jks `
  -keyalg RSA -keysize 2048 -validity 10000 -alias moziik
```

Puis `android/keystore.properties` (déjà ignoré par git) :

```properties
storeFile=../moziik-release.jks
storePassword=...
keyAlias=moziik
keyPassword=...
```

> Ce fichier `.jks` **ne peut pas être régénéré**. Le perdre oblige à
> republier sous un autre nom de paquet, en abandonnant les installations
> existantes. Le sauvegarder ailleurs que sur cette machine.

### 2. Autoriser les liens profonds

Récupérer l'empreinte SHA-256 :

```powershell
keytool -list -v -keystore android/moziik-release.jks -alias moziik
```

et la placer dans `ANDROID_CERT_SHA256` (variable d'environnement Vercel).

> **Avec « Play App Signing »** — activé par défaut — Google resigne l'app
> avec sa propre clé. C'est alors l'empreinte de la **Play Console**
> (Configuration → Intégrité de l'application) qu'il faut, pas celle du
> keystore d'upload. Se tromper ici ne produit aucune erreur : les liens
> Moziik ouvrent simplement le navigateur au lieu de l'app.

Vérifier après déploiement :

```powershell
curl https://app-moziik.vercel.app/.well-known/assetlinks.json
```

Un `[]` signifie que la variable n'est pas lue.

### 3. Envoyer

`npm run android:aab`, puis déposer le `.aab` dans la Play Console.

À prévoir dans la fiche : politique de confidentialité, déclaration
« Sécurité des données », et la justification du service de premier plan
`mediaPlayback` (Google la demande depuis Android 14 — répondre que
l'application lit de la musique en arrière-plan à la demande de
l'utilisateur).

---

## Points de vigilance

- **Nom de paquet** — `com.moziik.app`, figé dans `capacitor.config.ts`. Il
  est modifiable jusqu'au premier envoi au Store, plus jamais après.
- **Google refuse OAuth en WebView.** Le bouton Google sort donc dans un
  onglet Chrome, et la session revient par un code à usage unique valable
  60 s (`app/api/mobile-auth/relais/`). Toucher à ce flux demande de
  retester la connexion Google sur un vrai téléphone.
- **`minifyEnabled` reste à `false`.** R8 supprimerait les classes de
  plugin, qui ne sont référencées que par réflexion : `MoziikAudioPlugin`
  disparaîtrait du binaire de production tout en fonctionnant parfaitement
  en debug.
- **WebView 83 minimum** (`minWebViewVersion`). En dessous, le pont natif
  n'est pas injecté ; `erreur-reseau.html` détecte le cas et renvoie vers la
  mise à jour de Android System WebView plutôt que d'afficher une app à
  moitié cassée.
- **Notifications refusées** (Android 13+) : la lecture fonctionne tant que
  l'app est à l'écran, mais s'arrête écran éteint. `NativeMediaSession`
  prévient l'auditeur à ce moment-là plutôt que de le laisser conclure à une
  panne.
