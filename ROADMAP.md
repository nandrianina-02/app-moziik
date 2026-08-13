# Feuille de route — Moziik

Reconstruction complète, en 8 phases. Chaque phase est livrée séparément,
testable indépendamment, avant de passer à la suivante.

## Phase 1 — Fondations (TERMINÉ)
- Scaffold Next.js 14 (App Router) + TypeScript + Tailwind
- Connexion MongoDB (Mongoose)
- Config Cloudinary
- Système de thème clair / sombre
- Config du site (nom, logo) centralisée et modifiable
- Design system : palette, typographie, composants de base
- Layout principal (sidebar desktop / nav mobile + mini-player)

## Phase 2 — Authentification (TERMINÉ)
- Email + mot de passe (hash bcrypt, sessions)
- OAuth Google (NextAuth)
- Récupération de mot de passe par email
- Rôles : membre / artiste / admin
- Middleware de protection des routes /admin, /artiste, /compte

## Phase 3 — Gestion des erreurs & notifications (TERMINÉ)
- Error boundaries Next.js (page, layout, 404)
- Système de toasts (succès / erreur / info)
- Helper d'erreurs API uniforme
- Notifications in-app avec pages dédiées (nouveau son, nouvel abonné,
  commentaire, évènement, paiement, système) + cloche de notifications

## Phase 4 — Modèles de données complets (TERMINÉ)
- User (fait en Phase 2), Notification (fait en Phase 3)
- Artist : profil étendu, vérification, followers, monétisation
- Song : statut (brouillon/planifié/publié/rejeté), date de sortie planifiable
- Album : album / EP / single
- Playlist : privée ou publique, suiveurs
- Event : créé par admin ou artiste autorisé, statut de validation
- Badge : catalogue de badges (membre, artiste, succès)
- Comment : ancré à un timestamp du son, champ sentiment (analyse à venir en Phase 8)
- Play : traçage écoute (pays/ville/appareil), base des classements et de la monétisation
- Subscription : plan, méthode de paiement (Stripe / Mobile Money), région
- SiteConfig : document unique piloté par l'admin (nom, logo, coûts, taux de rémunération)

## Phase 5 — Musique & artistes (TERMINÉ)
- Upload : audio + pochette envoyés directement navigateur → Cloudinary
  (upload preset non-signé), pour ne pas passer par le serveur Next.js
- Routes API : `/api/songs`, `/api/albums`, `/api/playlists` (CRUD +
  ajout/retrait de sons), `/api/badges`
- Planification des sorties : `releaseDate` future → statut `scheduled`,
  publication automatique via `/api/cron/publish-songs` (à brancher sur
  un cron externe, ex. Vercel Cron) qui notifie les abonnés
- Traçage des écoutes dès Phase 5 : `/api/songs/[id]/play` enregistre
  pays/ville (en-têtes Vercel) et alimente `Play`
- Lecteur complet : `PlayerProvider` (file d'attente, lecture/pause,
  progression), mini-lecteur persistant, lecteur plein écran avec vrai
  égaliseur **10 bandes** (Web Audio API, `BiquadFilterNode`) + **Bass
  Boost** dédié façon Poweramp (low-shelf + compensation de volume),
  presets, et panneau file d'attente
- `SongRow`, `BadgeChip`, `UploadModal` (réservée aux artistes)
- **Menu contextuel par son** (`SongContextMenu`) : déclenché par le
  bouton `...`, le clic droit (desktop) ou l'appui long (mobile, via
  `useLongPress`) — file d'attente, ajout à une playlist (avec
  création à la volée), j'aime, téléchargement, partage, crédits,
  navigation vers l'artiste/l'album, suppression pour le propriétaire/admin
- **Featurings** : un son peut être publié avec des artistes en
  featuring (`FeaturingPicker`, recherche live via `/api/artists`) ;
  l'artiste crédité reçoit une notification et peut confirmer ou
  retirer le crédit (`/api/songs/[id]/featuring`)
- Nouvelles pages `/artiste/[id]` (profil, sons, albums, suivi) et
  `/album/[id]` (lecture de l'album), destinations du menu contextuel
  et des notifications

## Phase 6 — Administration (TERMINÉ)
- Dashboard `/admin` : statistiques (membres, artistes, sons, évènements en attente, abonnements)
- `/admin/membres` : recherche, changement de rôle (membre/artiste/admin),
  vérification artiste (badge), suspension de compte
- `/admin/musiques` : modération des sons soumis par les artistes
  (approbation → publié ou planifié selon la date de sortie ; rejet)
- `/admin/evenements` : modération des évènements soumis par des
  artistes autorisés
- `/admin/parametres` : nom du site, logo (upload Cloudinary), slogan,
  email de support, copyright, **coûts d'abonnement modifiables**
  (USD + MGA), taux de rémunération par écoute
- Les sons créés par un artiste passent désormais par la modération
  (`draft` → `published`/`scheduled` après validation) ; ceux créés
  par un admin sont publiés directement
- Un artiste ne peut publier un évènement que si un admin lui a
  accordé `eventPublishingAuthorized`
- `/api/site-config` (public) + `SiteConfigProvider` : la sidebar,
  l'accueil et les pages d'auth affichent le nom/logo/slogan configurés
  par l'admin, pas des valeurs figées

## Phase 7 — Monétisation (TERMINÉ)
- **Stripe** : `/api/subscriptions/checkout` crée une session Checkout
  avec un prix généré à la volée depuis `SiteConfig` (pas de Price ID
  figé — reste synchronisé avec `/admin/parametres`) ; webhook
  `/api/webhooks/stripe` synchronise `Subscription` (activation,
  renouvellement, annulation)
- **Mobile Money (MVola)** : `lib/mvola.ts` (auth OAuth + initiation
  merchantpay), `/api/subscriptions/mobile-money` initie le paiement,
  `/api/webhooks/mvola` confirme via callback
- **Détection de région** : `/api/region` (en-têtes Vercel) propose le
  mode de paiement adapté ; `/abonnement` affiche les deux avec les
  prix USD *et* MGA configurés par l'admin
- **Rémunération à l'écoute** : modèle `Royalty`, cron
  `/api/cron/compute-royalties` (à planifier quotidiennement) agrège
  les écoutes complètes non monétisées au tarif `payPerListenRateUSD`
  et notifie l'artiste ; page `/artiste/revenus` pour consulter
  l'historique

## Phase 8 — Analytics & recommandations (TERMINÉ)
- Traçage pays/ville déjà en place depuis la Phase 5 (`Play`)
- `/api/charts` : classements jour/semaine/mois/année, par sons,
  artistes ou auditeurs (agrégation MongoDB sur `Play`), page `/classements`
- `/api/songs/[id]/comments` : commentaires avec analyse de sentiment
  automatique (`lib/sentiment.ts`, lexique FR autonome, positif/neutre/
  négatif), affichée avec une icône sur chaque commentaire
- `/api/recommendations` : recommandations par genres écoutés ces 30
  derniers jours (repli sur les sons populaires si pas d'historique ou
  utilisateur anonyme), section "Recommandé pour toi" sur l'accueil
- Nouvelle page `/son/[id]` : détail d'un son, lecture, commentaires —
  c'est la page vers laquelle pointent les notifications "nouveau son"

## Ajustements post-Phase 8 (TERMINÉ)
- **Bug corrigé** : un admin sans profil `Artist` peut désormais publier
  un son en précisant `artistId` (au lieu d'échouer avec 404)
- **Pages manquantes construites** (liens de la nav qui menaient à des
  404) : `/compte`, `/bibliotheque`, `/recherche`, `/evenements`,
  `/radio`, `/playlist/[id]`, `/son/[id]/modifier`
- `/admin/badges` : création de badges + attribution à un membre
- `/admin/membres` : bouton pour autoriser un artiste à publier des
  évènements (`eventPublishingAuthorized`)
- Le titre du site (`<title>`) est maintenant dynamique
  (`generateMetadata` + `getSiteConfig()`), cohérent avec le reste de
  l'app

## Phase 9 — PWA & offline (TERMINÉ)
- `app/manifest.ts` : manifest PWA généré dynamiquement (nom, logo,
  couleurs) depuis `SiteConfig` — pas de fichier statique à resynchroniser
- `public/sw.js` : service worker, network-first pour l'app (repli
  cache si hors-ligne), cache-first pour les médias Cloudinary déjà
  téléchargés explicitement
- `lib/offlineCache.ts` + option **"Écouter hors-ligne"** dans le menu
  contextuel de chaque son : télécharge audio + pochette dans le Cache
  Storage du navigateur, indexés en local pour l'onglet **Hors-ligne**
  de `/bibliotheque` (lecture et suppression, sans connexion)
- `FloatingInstallButton` + `usePWA()` : bouton d'installation natif
  (`beforeinstallprompt`), s'enregistre le service worker au chargement
- Pages **`/contact`** (formulaire → email de support via nodemailer)
  et **`/mentions-legales`** (propriété intellectuelle, contenu
  utilisateurs, données personnelles, copyright — texte dynamique
  depuis `SiteConfig`), liées depuis le pied de la sidebar et `/compte`

## Ajustements post-Phase 9 (TERMINÉ)
- **Bug corrigé** : la modale "Ajouter à une playlist" se fermait
  instantanément — le détecteur de clic extérieur du menu contextuel
  considérait tout clic dans la sous-modale comme un clic "en dehors"
- Menu contextuel : retrait du téléchargement brut du fichier (gardé
  uniquement "Écouter hors-ligne"), ajout d'un lien direct vers la
  page du son (et donc ses commentaires)
- Bibliothèque hors-ligne : lecture au clic + menu complet (comme sur
  l'accueil) au lieu d'un bouton supprimer isolé ; rafraîchissement
  automatique via un évènement global à chaque changement
- `/admin/musiques` : gestion complète de tous les sons (tous statuts,
  pas seulement en attente), avec modération, édition, suppression
- Nouvel espace `/artiste/gestion` : sons, albums (création incluse),
  et featurings à confirmer/retirer
- Publication admin : sélecteur d'artiste (recherche live) pour
  publier au nom de n'importe quel artiste existant
- Accès Premium automatique pour les comptes admin (`lib/premium.ts`),
  affiché distinctement dans `/compte`
- Navigation mobile complète : nouvelle barre fixe en haut (menu,
  logo, notifications, photo de profil) + tiroir latéral listant
  toutes les routes (y compris espace artiste / administration)
- Plusieurs pages élargies sur desktop (grilles avec plus de colonnes,
  largeur de contenu augmentée) pour mieux exploiter l'espace

## Phase 10 — Mode hors-ligne avancé (base solide posée)
Base reconstruite sur **IndexedDB** (`lib/offlineDb.ts`) au lieu du
simple localStorage initial :
- **Téléchargement** : sons individuels, **albums entiers**,
  **playlists entières** (`downloadAlbumForOffline`,
  `downloadPlaylistForOffline`), avec progression
- **Téléchargement différé** : si on clique hors-ligne, la demande est
  mise en attente (`queuePendingDownload`) et démarre seule à la
  reconnexion — la reprise est "recommencer proprement", pas une
  reprise octet-par-octet (non réaliste avec Cache Storage)
- **Qualité audio configurable** (64/128/320 kb/s, transformation
  Cloudinary à la volée) + **Wi-Fi uniquement** pour les téléchargements
- **Gestion de l'espace** (`/bibliotheque` → onglet Stockage) :
  estimation d'usage, nettoyage "non écouté depuis 90 jours", vidage
  complet
- **File de synchronisation** (`lib/syncQueue.ts`) : favoris,
  commentaires, création/renommage/suppression de playlist, ajout/retrait
  de son dans une playlist, écoutes — tout ce qui est fait hors-ligne
  est rejoué automatiquement à la reconnexion, dans l'ordre
- **Commentaires hors-ligne** : écrits localement avec statut "en
  attente", publiés à la reconnexion
- **Historique local** (IndexedDB) à chaque écoute, en ligne comme
  hors-ligne
- **Recherche locale** : bascule automatiquement sur les sons
  téléchargés quand il n'y a pas de réseau
- **Cache des profils d'artistes** consultés, avec repli automatique
  dessus si le réseau est indisponible
- **Notification locale** (Notification API du navigateur) à la fin
  d'un téléchargement d'album/playlist, si l'onglet n'est pas au premier plan
- **Bannière "hors-ligne"** globale + `OnlineStatusProvider` déclenchant
  la synchronisation automatique au retour du réseau

### Volontairement simplifié pour l'instant
- **Chiffrement des fichiers téléchargés** : non implémenté (le Cache
  Storage stocke les réponses telles quelles). Le faire correctement
  demanderait de chiffrer en Blob via `crypto.subtle` et de déchiffrer
  à la volée pendant la lecture — faisable mais complexe, à traiter en
  tâche dédiée si c'est un vrai besoin de sécurité pour ce projet.
- **Reprise de téléchargement octet-par-octet** : non implémenté (voir
  ci-dessus, on relance proprement au lieu de reprendre à 61%).
- **Notifications différées côté serveur (push)** : seule la
  notification locale (onglet fermé/en fond) est en place ; un vrai
  système push nécessiterait un abonnement Push API + clés VAPID +
  logique serveur dédiée.
- **Synchronisation multi-appareils** : déjà couverte de fait, puisque
  toute action synchronisée (Phase précédente comme celle-ci) passe
  par le serveur — donc visible sur tous les appareils dès qu'ils sont
  en ligne. Pas de mécanisme supplémentaire nécessaire.

## Ajustements — gestion admin complète
- `/admin/albums` : recherche, suppression
- `/admin/playlists` : recherche, suppression (modération des playlists publiques/privées)
- `/admin/commentaires` : recherche, filtre par sentiment, suppression
- `/admin/evenements` : refonte complète — tous statuts (pas seulement
  en attente), modification, suppression, en plus de l'approbation/rejet
- Nouvelle page `/evenements/[id]/modifier` (créateur ou admin)
- `/evenements` (page publique) : actions modifier/supprimer visibles
  pour le créateur de l'évènement ou un admin
- Commentaires : suppression possible directement depuis la page du
  son par l'auteur ou un admin, pas seulement depuis l'admin
- Nouvelles routes API : `PATCH`/`DELETE /api/events/[id]`,
  `DELETE /api/comments/[id]`, `GET /api/admin/comments`,
  `GET /api/admin/playlists` ; bypass admin ajouté sur
  `PATCH`/`DELETE /api/playlists/[id]` (absent jusqu'ici)
- Nouveau composant `SafeImage` : évite le crash fatal de next/image
  quand une pochette/couverture est manquante — appliqué partout où
  c'était encore risqué (son, album, artiste, espace de gestion
  artiste, file d'attente, mini-lecteur, lecteur plein écran)
- Correctif : `SiteConfigProvider` ne se rafraîchissait qu'au premier
  chargement — le nom/logo mis à jour dans `/admin/parametres`
  n'apparaissait donc jamais sans recharger la page. Un évènement
  déclenche maintenant le rafraîchissement automatiquement.

## Ajustements — logo et métadonnées de lecture
- **Logo** : sauvegarde immédiate côté serveur dès l'upload (plus
  besoin de cliquer sur "Enregistrer les paramètres" en plus) —
  supprime la cause la plus probable du "ça n'apparaît jamais"
- Ajout d'une **option lien direct** pour le logo, en alternative à
  l'upload de fichier
- Vérification de tous les emplacements : sidebar, header mobile,
  pages de connexion, manifest PWA — tous branchés sur la même config,
  déjà cohérents
- **Favicon** : il n'existait tout simplement aucune balise favicon
  générée (seulement des fichiers dans `/public`, jamais reliés) —
  corrigé dans `generateMetadata`
- **Métadonnées "en cours de lecture"** : le titre de l'onglet devient
  "Titre — Artiste" pendant la lecture (revient au nom du site à
  l'arrêt), le favicon devient la pochette du son en cours, et la
  **Media Session API** est câblée (contrôles lecture/pause/suivant/
  précédent sur l'écran de verrouillage et les notifications média du
  système, sur mobile comme sur desktop)

## Ajustements — bouton d'installation PWA
- **Cause probable trouvée** : le manifest utilisait le logo uploadé
  par l'admin comme icône PWA, mais Chrome exige que les dimensions
  RÉELLES du fichier correspondent exactement à celles déclarées
  (512×512 et 192×192) — sinon l'app n'est simplement pas installable,
  sans message d'erreur visible. Corrigé en forçant ces dimensions via
  une transformation Cloudinary (`w_512,h_512,c_pad`), avec repli sur
  les icônes statiques (déjà aux bonnes tailles, vérifié) si le logo
  n'est pas une URL Cloudinary
- `apple-icon.png` était référencé dans les métadonnées mais n'existait
  pas — corrigé
- **iOS/Safari** : `beforeinstallprompt` n'existe pas sur cette
  plateforme (Apple ne l'implémente pas) — le bouton n'y serait jamais
  apparu, quoi qu'on fasse côté code. Ajout d'une détection iOS avec
  des instructions manuelles ("Partager → Sur l'écran d'accueil") à
  la place du bouton natif
- **Limite restante à connaître** : même corrigé, Chrome peut retarder
  l'apparition du bouton selon ses propres critères d'engagement
  (visites répétées, temps passé sur le site) — ce n'est pas un bug,
  c'est voulu par le navigateur pour éviter les popups d'installation
  agressifs dès la première visite.

## Ajustements — mini-lecteur enrichi, pages d'authentification, icônes PWA
- **Mini-lecteur desktop** entièrement refondu (mobile inchangé, déjà
  compact) : cœur (j'aime, avec vrai état vérifié en base via un
  nouveau `GET /api/songs/[id]/like`), badge qualité audio (reflète le
  vrai réglage hors-ligne), file d'attente avec compteur, ajout à une
  playlist, téléchargement hors-ligne, partage, menu "Plus" (réutilise
  le menu contextuel complet), barre de progression pleine largeur
  avec temps, **volume** (nouveau — n'existait pas du tout avant,
  persisté d'une session à l'autre), bouton plein écran
- **Pages connexion/inscription/mot de passe** : nouveau layout à deux
  panneaux (image + accroche à gauche sur desktop, formulaire à
  droite ; panneau image masqué sur mobile pour ne pas prendre toute
  la place), champs avec icônes, affichage/masquage du mot de passe,
  bouton Google avec vrai logo multicolore (`GoogleIcon`)
- **Icônes PWA** : le logo uploadé par l'admin est maintenant utilisé
  pour *toutes* les icônes (manifest any + maskable, favicon, icône
  Apple), avec la marge de sécurité nécessaire pour les icônes
  maskable (recadrage circulaire Android) — logique centralisée dans
  `lib/icons.ts`
