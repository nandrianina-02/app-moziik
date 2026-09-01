# Moziik — Phase 1 : Fondations

## Démarrage

1. `cp .env.example .env.local` puis renseigner MONGODB_URI et les clés Cloudinary
2. `npm install`
3. `npm run dev` → http://localhost:3000

Le script `build` fixe `--max-old-space-size=4096`. Ce n'est pas
décoratif : au-delà d'une certaine taille de projet, la collecte des
données de page épuise le tas par défaut de Node, et Next échoue sur un
`kill EPERM` qui ne dit rien de la cause réelle. Ne pas retirer ce
réglage sans avoir vérifié qu'un build complet passe sans lui.

## Ce qui est en place
- Next.js 14 (App Router) + TypeScript + Tailwind
- Connexion MongoDB réutilisable (`lib/db.ts`)
- Config Cloudinary + helper d'upload (`lib/cloudinary.ts`)
- Thème clair / sombre persisté (`context/ThemeProvider.tsx`)
- Design system (`tailwind.config.ts`) : palette corail/indigo, polices
  Sora (display) + Plus Jakarta Sans (body) + JetBrains Mono (données)
- Config du site centralisée et modifiable (`config/site.ts`) — nom, logo,
  devises. Sera branchée sur un `SiteConfig` en base en Phase 5.
- Navigation desktop (sidebar) + mobile (bottom tabs), icônes lucide-react
- Modèle `User` de base (`models/User.ts`)

## Phase 2 — Authentification
- `/inscription`, `/connexion`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe`
- NextAuth : Credentials (email/mdp) + Google, session JWT avec le rôle
- `middleware.ts` protège `/admin`, `/artiste`, `/compte` selon le rôle
- Récupération de mot de passe par email (`utils/mailer.ts`, nodemailer)
- Pour Google OAuth : créer des identifiants OAuth sur Google Cloud
  Console et renseigner `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- Générer `NEXTAUTH_SECRET` avec `openssl rand -base64 32`

## Phase 3 — Gestion des erreurs & notifications
- `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `app/loading.tsx`
- Toasts : `context/ToastProvider.tsx` → `useToast()` (success/error/info)
- API : `lib/apiError.ts` (`ApiError` + `withApiErrors`) pour un format
  d'erreur uniforme sur toutes les routes
- Notifications in-app : modèle `Notification`, routes
  `/api/notifications` (liste), `/api/notifications/[id]/read`,
  `/api/notifications/read-all`
- `lib/notify.ts` : à appeler depuis n'importe quelle route serveur
  pour déclencher une notification (ex: publication d'un son →
  `notifyMany(followerIds, { type: "new_song", ... })`)
- Cloche de notifications dans la sidebar + page dédiée `/notifications`
  avec filtres par type

## Phase 4 — Modèles de données complets
Tous les modèles vivent dans `models/` : `User`, `Artist`, `Song`,
`Album`, `Playlist`, `Event`, `Badge`, `Comment`, `Play`,
`Subscription`, `SiteConfig`, `Notification`.

- `lib/siteConfig.ts` → `getSiteConfig()` lit (et initialise au premier
  appel) le document unique piloté depuis le futur dashboard admin :
  nom du site, logo, coûts d'abonnement (USD + MGA), taux de
  rémunération par écoute.
- Les `status` (`Song`, `Event`) portent toute la logique de
  validation admin / planification.
- `Play` est indexé par son + date et par pays + date, pour supporter
  les classements jour/semaine/mois/année et l'analytics géographique
  sans re-modélisation plus tard.

## Phase 5 — Musique & artistes
- Configurer un **upload preset non-signé** sur Cloudinary (Settings →
  Upload → Add upload preset → Signing mode: Unsigned), puis renseigner
  `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
- `CRON_SECRET` : chaîne secrète à fournir en `Authorization: Bearer`
  lors de l'appel périodique à `/api/cron/publish-songs`
- Le lecteur (`context/PlayerProvider.tsx`) est monté une seule fois
  dans `app/layout.tsx` : `usePlayer()` est utilisable depuis n'importe
  quelle page (`playQueue`, `togglePlay`, etc.)
- L'égaliseur agit réellement sur le son via l'API Web Audio — ce
  n'est pas un habillage visuel. Il compte **10 bandes** (31 Hz à
  16 kHz) + un **Bass Boost** dédié (0-100%, filtre low-shelf ~80 Hz)
  avec compensation automatique du volume pour un rendu plus
  puissant, façon Poweramp
- Chaque son a un menu contextuel complet (bouton `...`, clic droit,
  appui long) : file d'attente, playlist, like, téléchargement,
  partage, crédits, navigation artiste/album, suppression (propriétaire/admin)
- Un son peut être publié avec des artistes en featuring ; ils
  reçoivent une notification et doivent confirmer le crédit
  (`/api/songs/[id]/featuring`) pour qu'il soit marqué comme validé

## Phase 6 — Administration
- Pour te donner le rôle admin la première fois : modifie directement
  le document `User` en base (`role: "admin"`), aucune UI ne le permet
  volontairement pour éviter qu'un utilisateur se l'attribue lui-même
- `/admin` est protégé par `middleware.ts` (redirection) *et* par
  `lib/requireAdmin.ts` côté API (401/403) — double protection
- Les sons soumis par un artiste sont en statut `draft` jusqu'à
  validation dans `/admin/musiques` ; ceux créés par un admin sont
  publiés immédiatement
- Pour autoriser un artiste à publier des évènements sans validation
  a priori (ils passeront quand même par `/admin/evenements`), mets
  `eventPublishingAuthorized: true` sur son document `Artist`
- **Fiche d'un évènement** (`/evenements/<id>`) : galerie, artistes à
  l'affiche, programme, catégories de billets, infos pratiques,
  coordonnées du lieu. Une rubrique laissée vide n'apparaît pas sur la
  fiche, plutôt que de s'y afficher vide
- **Création et modification** partagent le même formulaire
  (`components/events/EventForm.tsx`), servi en pleine page par
  `/evenements/nouveau` et `/evenements/<id>/modifier`. Il n'y a plus de
  modale : la fiche compte trop de champs pour tenir dans une fenêtre
- **Poste de travail** `/admin/evenements` : compteurs de la plateforme,
  onglets à venir / en cours / passés, recherche, filtres catégorie,
  statut et lieu, table paginée, export CSV des filtres en cours, et
  répartition par catégorie. Les compteurs décrivent toute la
  plateforme — les filtres de la table ne les modifient pas
- Pas de graphique de vues ni d'inscriptions : rien n'enregistre les
  consultations d'une fiche, et un tel graphique aurait été inventé
- Le compteur de participants vient de `Event.interested`, alimenté par
  le seul bouton « Ça m'intéresse » : ce n'est jamais une estimation
- La billetterie est **informative**. Moziik n'encaisse rien : les
  catégories de billets décrivent l'offre, et « Choisir mes billets »
  renvoie vers `ticketUrl`, chez l'organisateur
- `visibility: "unlisted"` garde la fiche accessible par son lien mais la
  retire des listes, de la recherche interne et du sitemap
- Le bandeau d'accueil est un carrousel (`components/home/HeroCarousel.tsx`)
  : d'abord tout ce qui est épinglé sur la section « hero » depuis
  `/admin/accueil`, évènements comme musique, puis — en mode automatique —
  les deux prochains évènements, une nouvelle sortie, le titre le plus
  écouté et une playlist tendance, six diapositives au plus
- La carte du lieu n'apparaît qu'avec `latitude` **et** `longitude`.
  Elle vient d'OpenStreetMap, autorisé pour cela en `frame-src` dans
  la CSP de `next.config.mjs` ; sans coordonnées, « Itinéraire »
  cherche simplement le nom du lieu
- Les coûts d'abonnement et le taux de rémunération par écoute
  modifiés dans `/admin/parametres` sont lus par `getSiteConfig()` —
  ils seront branchés sur Stripe/Mobile Money en Phase 7
- **Offrir l'accès Premium** depuis `/admin/membres` : bouton « Accès
  Premium », dans la barre de filtres ou dans la barre de sélection. La
  cible est soit les comptes cochés, soit **tous les résultats du filtre
  courant** — filtre résolu côté serveur, jamais à partir d'une liste
  envoyée par le navigateur. La durée va d'illimitée à une date précise
- Un accès offert est un `Subscription` comme les autres —
  `paymentMethod: "offert"`, `grantedBy` pour savoir qui l'a décidé — et
  **sans `currentPeriodEnd` quand il est illimité** : c'est l'absence de
  date qui dit « sans fin », plutôt qu'une date lointaine qui mentirait
  dans « Mon compte ». Un compte déjà abonné et payant n'est jamais
  écrasé : il est compté à part dans le retour de l'API
- L'admin retrouve « Mon compte » depuis la barre de navigation de
  l'espace d'administration, après le séparateur
- **Modifier un profil artiste** : menu d'une ligne artiste dans
  `/admin/membres` → « Modifier le profil artiste ». Photo, bannière, nom
  de scène, biographie, genres, réseaux, plus les trois réglages que
  l'artiste ne décide pas lui-même (vérification, monétisation, droit de
  publier des évènements). La vérification est écrite des deux côtés,
  `Artist.verified` et `User.verifiedArtist` : désynchronisées, le filtre
  « Vérifiés » de l'annuaire ne retrouverait plus l'artiste
- **La photo du compte devient la photo d'artiste** tant qu'il n'y en a
  pas d'autre (`lib/artistPhoto.ts`) : à la création du profil comme au
  changement d'avatar. Rien ne reliait `User.avatarUrl` à
  `Artist.coverUrl`, si bien qu'un membre déjà photographié, promu
  artiste, se retrouvait avec un profil public sans visage. Le report est
  à sens unique et non destructif : une photo d'artiste déjà choisie
  n'est jamais écrasée par un changement d'avatar

## Podcasts et clips vidéo
- **Un podcast est un album** de `type: "podcast"` (`lib/albums.ts`) : même
  publication, même bibliothèque, même lecteur, même hors-ligne. Lui donner
  son propre modèle aurait tout dupliqué pour ne rien gagner. Le
  vocabulaire suit la forme — « épisodes » au lieu de « titres » sur la
  page et dans l'onglet
- L'onglet « Podcasts » de la bibliothèque montre les publications de ce
  type parmi les albums enregistrés ; l'onglet « Albums » les en exclut,
  pour qu'aucune n'apparaisse deux fois
- **Un clip est un titre qui a une `videoUrl`**, pas un contenu séparé :
  la publication, la modération et les crédits restent ceux du morceau.
  Le champ s'ajoute sous le fichier audio, à la publication comme à la
  modification, et le fichier part directement vers Cloudinary comme
  l'audio (200 Mo maximum)
- L'onglet « Vidéos » d'un artiste liste ses titres qui en ont un ; la
  fiche d'un titre gagne un bouton « Regarder le clip ». Les deux ouvrent
  le même lecteur (`components/song/VideoPlayerModal.tsx`), qui met la
  lecture audio en pause — deux sons à la fois ne s'écoutent pas

## Interface tactile
- **La sélection de texte est coupée sur les pointeurs grossiers**
  (`app/globals.css`). L'appui long sert à ouvrir les menus contextuels :
  sans cette règle, le même geste surlignait le titre d'un morceau et
  faisait surgir la bulle « Copier / Partager » du système par-dessus
  notre propre menu. La sélection reste acquise aux champs de saisie et à
  tout ce qui se recopie — paroles, biographies, descriptions, mentions
  légales, aide, commentaires, messages — marqué `.selectionnable`
- **Une commande révélée au survol n'existe pas au doigt.** La classe
  `.au-survol` remplace le couple `opacity-0 group-hover:opacity-100` :
  visible par défaut, effacée seulement sous `@media (hover: hover) and
  (pointer: fine)`, et rappelée au `focus-within` pour le clavier. Les
  voiles sombres posées sur une pochette passent en plus à `bg-black/0`
  avec un `group-hover:bg-black/NN`, sans quoi chaque pochette se serait
  retrouvée assombrie en permanence sur mobile
- Une exception assumée : dans `TrackTable`, le numéro de piste et
  l'icône de lecture occupent la même case et se remplacent au survol.
  Au doigt, le numéro reste, et toucher la ligne lance la lecture

## Phase 7 — Monétisation
- **L'échéance fait foi autant que le statut.** `hasPremiumAccess`
  (`lib/premium.ts`) exige `status: "active"` **et** une
  `currentPeriodEnd` absente ou dans le futur. Elle ne regardait que le
  statut : un accès à durée limitée n'aurait donc jamais pris fin, et un
  paiement mobile — qui écrit `active` une fois pour toutes, sans rien
  pour le repasser à `expired` — ouvrait le premium indéfiniment.
  Conséquence à la mise en production : **les abonnés Mobile Money dont
  la période est passée perdent l'accès immédiatement**, ce qui est le
  comportement attendu mais n'était pas celui d'avant
- Renseigner `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` (créer le
  webhook dans le dashboard Stripe pointant vers
  `/api/webhooks/stripe`, évènements : `checkout.session.completed`,
  `invoice.paid`, `customer.subscription.deleted`)
- Renseigner les identifiants MVola (`MVOLA_CONSUMER_KEY`,
  `MVOLA_CONSUMER_SECRET`, `MVOLA_MERCHANT_MSISDN`) — `MVOLA_ENV=sandbox`
  par défaut, passer à `production` une fois validé par MVola
- Cinq cron, déclenchés par un ordonnanceur **externe** (horaires en UTC) :
  - `/api/cron/publish-songs` — toutes les 5 minutes
  - `/api/cron/moderate-comments` — toutes les heures, facultatif : la
    file se vide aussi à l'ouverture de `/admin/commentaires`
  - `/api/cron/compute-royalties` — chaque nuit à 02 h 15 UTC
  - `/api/cron/weekly-curation` — le lundi à 03 h 00 UTC : la fenêtre
    couvre alors les sept jours pleins de la semaine écoulée. Accepte
    `?univers=general` ou `?univers=christian` pour n'analyser qu'un
    répertoire ; sans paramètre, les deux passent à la suite
  - `/api/cron/weekly-report` — le lundi à 03 h 45 UTC, après la curation :
    il archive le rapport d'exploitation et prévient les administrateurs
  - Tous exigent l'en-tête `Authorization: Bearer <CRON_SECRET>`. Sans
    cette variable côté serveur, la route répond 500 ; sans l'en-tête côté
    appelant, elle répond 401.
  - Ils répondent en `POST` comme en `GET` : le premier est le verbe de
    référence, le second existe pour les ordonnanceurs qui ne savent
    envoyer que des `GET`.
  - **Il n'y a volontairement pas de `vercel.json`.** Déclarer les mêmes
    tâches dans Vercel Cron les ferait partir deux fois, et l'offre Hobby
    refuse d'ailleurs le déploiement au-delà de deux cron.
  - **Délai d'attente de l'ordonnanceur** : `weekly-curation` prend
    plusieurs minutes (deux univers, une quarantaine de sélections, le
    nommage par lots). Un service qui coupe à trente secondes signalera un
    échec alors que le travail se termine normalement côté serveur. Régler
    le délai à cinq minutes au moins, et **désactiver les reprises
    automatiques** — une relance pendant l'exécution est refusée par le
    verrou (409), ce qui produirait une alerte pour rien.
  - Réponses attendues : 200 dans tous les cas nominaux, y compris quand
    il n'y a rien à faire (semaine trop calme, aucun titre à publier). Un
    échec réel remonte en 4xx ou 5xx.
  - **Plafond de durée de l'hébergeur.** Les routes déclarent leur
    `maxDuration`, plafonné à 300 s — la limite de l'offre Hobby de
    Vercel, qui refuse le déploiement au-delà. Si la curation approche ce
    plafond (gros catalogue, modèle lent), la scinder en deux
    déclenchements espacés de cinq minutes :

    ```
    0 3 * * 1   /api/cron/weekly-curation?univers=general
    5 3 * * 1   /api/cron/weekly-curation?univers=christian
    ```

    Chacun tient alors largement dans le plafond, et un univers en échec
    n'emporte plus l'autre.
- Les prix affichés sur `/abonnement` viennent de `/api/site-config`
  (public), donc toujours synchronisés avec `/admin/parametres`

## Phase 8 — Analytics & recommandations
- `lib/sentiment.ts` est un lexique simple, pas un modèle ML. Il sert
  désormais de **classement provisoire** — instantané, donc l'envoi d'un
  commentaire n'attend rien — puis la relecture par IA repasse par lots
  et corrige le ton (voir la section « Assistance par IA »). Sans clé
  d'API, ce lexique reste le seul classement, comme avant.
- Les classements (`/api/charts`) tournent sur des agrégations MongoDB
  en temps réel ; à indexer/mettre en cache si le volume d'écoutes
  devient important
- Les recommandations sont du filtrage par contenu (genres écoutés),
  pas du collaboratif — un bon point de départ, améliorable plus tard

## Phase 9 — PWA & offline
- Le mode hors-ligne utilise le **Cache Storage** du navigateur (pas
  IndexedDB) — suffisant pour des fichiers audio, avec un index léger
  en `localStorage` pour l'UI de `/bibliotheque`
- Le service worker (`public/sw.js`) doit être servi à la racine du
  domaine (`/sw.js`) pour pouvoir contrôler toute l'app — c'est déjà
  le cas via `public/`
- L'icône PWA utilise le logo configuré dans `/admin/parametres` ;
  pour un rendu optimal, prévoir un logo carré ≥512×512
- `/contact` a besoin des variables SMTP déjà configurées en Phase 2

## Application Android

Le dossier `android/` est une coquille Capacitor qui affiche **le site
déployé**, et non une seconde interface : il n'y a donc aucune page à
maintenir en double, et un correctif mis en ligne est dans l'app au
déploiement suivant, sans revue du Play Store.

Ce que la coquille ajoute par-dessus la PWA — et que le navigateur ne sait
pas faire sur Android :

- la lecture survit à l'écran éteint (service de premier plan
  `MoziikAudioService`) ; sans lui, Android gèle le processus au bout de
  quelques minutes et le son s'arrête sans prévenir
- une vraie notification média : pochette, commandes, barre de progression,
  écran verrouillé, boutons de casque Bluetooth
- le bouton Retour matériel, les liens Moziik qui ouvrent l'app, la barre
  d'état qui suit le thème

Le pont natif est injecté par Capacitor dans le site distant, si bien que
`lib/native/pont.ts` lit directement `window.Capacitor` : **aucun paquet
Capacitor n'entre dans le bundle web**, les visiteurs du site ne paient rien
pour l'app.

Installation de la chaîne de build, signature, liens profonds et publication
sur le Store : voir **[ANDROID.md](ANDROID.md)**.

```powershell
npm run android:sync   # recopie la config dans android/
npm run android:apk    # APK de test
npm run android:aab    # bundle pour le Play Store
```

## Assistance par IA

Douze endroits appellent le modèle. Une seule variable les commande :
`ANTHROPIC_API_KEY`. Absente, **rien n'est cassé** — chaque page garde son
fonctionnement d'avant, et aucun bouton d'assistance ne s'affiche.

- **Le catalogue des fonctionnalités vit dans `lib/ai/features.ts`** : le
  modèle employé, le plafond de sortie et la cadence par compte y sont
  décrits une fois. `/admin/ia` affiche cette liste telle quelle, l'éteint
  ligne par ligne, fixe un plafond d'appels par jour et montre la
  consommation des trente derniers jours.
- **Tout passe par `lib/ai/client.ts`.** Aucune route ne parle au SDK
  directement : disponibilité, cadence, plafond, comptage et traduction
  des pannes y sont traités une fois pour toutes. La clé ne quitte jamais
  le serveur.
- **Les réponses sont contraintes par un schéma** (outil imposé côté API,
  revalidé par zod). On ne parse jamais de la prose.
- **Deux modèles** : Haiku 4.5 pour ce qui classe et trie, Sonnet 5 pour ce
  qui rédige. Sonnet 5 refuse le paramètre `temperature` — le client le
  retire pour lui et le conserve pour Haiku, qui l'honore encore.
- **Rien ne s'écrit tout seul.** Les propositions de titre, la biographie,
  l'article d'aide et la réponse au support reviennent dans un formulaire ;
  c'est un humain qui valide. La modération signale, elle ne masque jamais.
- **Ce qui n'est pas su reste vide.** Une description de morceau sans
  paroles, une biographie sans notes, un tarif absent du centre d'aide : le
  champ revient vide ou marqué `[À COMPLÉTER]` plutôt qu'inventé.
- **Les textes des utilisateurs sont des données, pas des consignes** —
  message de support, paroles, commentaire, demande de playlist. Chaque
  invite le dit, et le texte est encadré.
- `models/AiUsage.ts` ne stocke que des compteurs : aucun contenu envoyé au
  modèle n'est conservé.

## Rapport d'exploitation

`/admin/analyses` répond à des questions que `/api/admin/stats` ne pose
pas : qui revient, qui décroche, ce qui sort de l'ordinaire, ce qui se
dessine. Les deux coexistent — l'un compte, l'autre analyse.

- **Le modèle n'écrit aucune quantité.** On ne lui en fournit aucune :
  `lib/insights/report.ts` lui transmet des directions (« en nette
  hausse », « une minorité »), des noms et des constats. Il ne peut donc
  ni transcrire un chiffre de travers, ni en inventer un plausible. Un
  rapport d'exploitation est précisément le document sur lequel on décide
  de reverser ou de relancer : un chiffre faux y coûte plus cher que
  partout ailleurs. Les vrais nombres sont calculés et affichés à côté
  du texte.
- **La rétention se mesure par cohortes**, pas en comparant les actifs
  d'une semaine à l'autre : ce rapport-là monte quand on recrute et
  descend quand on cesse, sans rien dire de la fidélité. Une cohorte de
  moins de cinq personnes affiche « trop peu » plutôt qu'un pourcentage
  qui désignerait une seule personne.
- **Les anomalies se mesurent sur la médiane**, pas sur la moyenne : le
  pic qu'on cherche est justement ce qui tire la moyenne vers le haut et
  finit par masquer sa propre détection. Ce sont des constats, pas des
  verdicts — rien n'est masqué ni suspendu. Un titre écouté presque
  uniquement par un seul compte est signalé sans conclure : ce peut être
  un auditeur passionné comme un gonflage de compteur, et les compteurs
  nourrissent la rémunération des artistes.
- **La prévision est un prolongement de droite, pas une prédiction.**
  Elle rend une fourchette, jamais un nombre seul, et **refuse** de
  répondre sous quatre semaines d'historique — l'écran affiche alors
  pourquoi. La largeur de la fourchette vient de la dispersion réelle
  autour de la droite : une audience erratique donne une fourchette large,
  ce qui est exactement l'information utile.
- **La fenêtre est celle de la curation** (sept jours pleins, journée en
  cours exclue). Deux fenêtres différentes dans la même administration
  donneraient deux chiffres d'audience pour la même semaine.
- Sans clé d'API, le rapport reste entier : seule l'interprétation manque,
  et l'écran le dit.

## Écoute personnalisée

Une station bâtie pour un auditeur, sans fin, sur `/radio`. Radio
personnalisée, « DJ » et mix automatique désignent la même chose — une
suite de morceaux choisie pour quelqu'un et ordonnée pour s'écouter
d'affilée — et sont donc un seul moteur (`lib/taste/station.ts`).

- **Le profil se déduit, il ne se déclare pas.** `lib/taste/profile.ts`
  lit les écoutes des 90 derniers jours et les « j'aime ». Il **oublie**
  (une écoute d'il y a trois mois pèse moitié moins qu'une écoute
  d'hier), il **compte les abandons contre** (un titre lancé puis coupé
  trois fois est un refus, pas un goût — c'est le signal le plus utile et
  le plus souvent ignoré), et il **dit quand il ne sait pas** : en deçà de
  huit écoutes, la station sert ce que le public écoute et l'annonce.
- **Trois familles, dosées.** Du familier pour rester chez soi, du voisin
  pour avancer, de la découverte pour être surpris. Une station qui ne
  passe que du connu lasse ; une station qui ne passe que de l'inconnu se
  fait couper au troisième titre.
- **L'ordre est une décision.** Les familles sont entrelacées et deux
  titres du même artiste ne se suivent pas. Quand le catalogue ne suffit
  pas à remplir la file, les contraintes cèdent **une par une**, en
  commençant par celle qui s'entend le moins (le plafond par artiste) et
  en gardant l'espacement au plus longtemps.
- **Chaque titre dit pourquoi il est là.** « Dans vos favoris »,
  « Vous écoutez Rakoto », « À découvrir — Gospel ». Le motif est une
  **donnée** (`lib/taste/motifs.ts`), pas une phrase du modèle : une
  explication rédigée après coup serait plausible plutôt que vraie, et
  disparaîtrait avec la clé d'API. `/api/recommendations` les renvoie
  aussi.
- **L'heure vient du navigateur.** Le serveur ignore quelle heure il est
  chez l'auditeur ; décider côté serveur proposerait de la musique de nuit
  à quelqu'un qui déjeune. Le moment infléchit le tempo, faiblement : il
  départage deux titres également plausibles, il n'écarte jamais un
  morceau que l'auditeur aime.
- **Le modèle ne choisit aucun titre.** Il nomme la station et l'introduit
  (`lib/ai/dj.ts`), rien de plus. Sans clé, la station se lance
  exactement pareil sous un nom de repli. Il ne reçoit que des noms de
  genres et d'artistes — aucune statistique, donc rien à inventer sur
  quelqu'un qui saura, lui, si c'est faux.
- **Elle se prolonge toute seule.** `lib/playbackContinuation.ts`
  redemande un tour à `/api/station` en transmettant ce qui est déjà dans
  la file : jamais deux fois le même morceau, et l'heure repart à chaque
  tour.

## Sélections hebdomadaires

Chaque semaine, une analyse compose des playlists à partir de ce qui s'est
réellement passé sur la plateforme, puis les propose à l'accueil. Elle
s'administre depuis `/admin/selections`.

- **Les chiffres choisissent les titres, jamais le modèle.**
  `lib/curation/recipes.ts` décrit sept sélections — top, en progression,
  nouveautés, les plus recherchés, hits malgaches, les plus aimés, genre de
  la semaine — et chacune se justifie par une mesure, affichée à côté
  d'elle. L'IA n'écrit que les titres, les descriptions et la synthèse ;
  sans clef, les libellés de repli prennent le relais et rien d'autre ne
  change.
- **Rien ne s'affiche sans validation.** Le cron *produit*, il ne publie
  pas : les playlists arrivent en brouillon (`isPublic: false`, donc
  invisibles partout où le site filtre déjà sur ce champ) et attendent un
  humain. Le réglage `autoPublish`, faux par défaut, lève cette étape pour
  qui l'assume.
- **Une écoute n'est pas une voix.** La contribution d'un même compte à un
  même titre est plafonnée sur la semaine, sinon le classement mesurerait
  l'insistance d'un auditeur — ou d'une boucle — plutôt que le succès d'un
  morceau.
- **Les recherches sont journalisées sans identité.**
  `models/SearchQuery.ts` ne garde qu'un compteur par saisie et par jour :
  ni compte, ni IP, ni horodatage précis. Le client n'enregistre qu'une
  recherche posée (2,5 s après la dernière frappe), sans quoi le classement
  compterait « mo », « moz », « mozi » autant que « moziik ».
- **Les « j'aime » ne sont pas datables.** `User.likedSongs` n'a pas
  d'horodatage : « les plus aimés » s'appuie sur un taux d'appréciation
  cumulé, et le dit à l'écran plutôt que de laisser croire à une mesure de
  la semaine.
- **Une sélection qui n'a pas de quoi se remplir ne paraît pas.** Faute de
  données, la recette se tait ; si aucune ne répond, le cron renvoie 200
  avec sa raison — une semaine creuse n'est pas une panne, et une alerte
  hebdomadaire finirait par être ignorée.
- **La section d'accueil réutilise l'existant** : une section `custom` en
  mode `manual` dont le contenu est épinglé (`models/HomepagePinned.ts`).
  `lib/homeContentEngine.ts` n'a pas bougé, et la section se déplace, se
  renomme ou s'éteint depuis `/admin/accueil` comme n'importe quelle autre.
  Son titre suit la semaine tant que personne ne l'a renommée ; dès qu'un
  humain l'a fait, son choix tient.
- **Une playlist que quelqu'un suit n'est jamais supprimée.** Les
  sélections périmées quittent l'accueil ; celles que personne n'a ajoutées
  à sa bibliothèque disparaissent après le délai de conservation, les
  autres restent accessibles à ceux qui les ont gardées.

## C'est la dernière phase de la roadmap initiale

Le projet couvre maintenant l'intégralité du cahier des charges de
départ : fondations, auth, erreurs/notifications, modèles de données,
musique/artistes (upload, lecteur 10 bandes + bass boost, menu
contextuel, featurings), administration, monétisation (Stripe +
Mobile Money + royalties), analytics/recommandations, et PWA/offline.

Pistes naturelles pour la suite, si besoin : recherche globale plus
avancée (filtres, tri), gestion des sessions/appareils connectés,
tests automatisés, et déploiement (Vercel + variables d'environnement
listées dans `.env.example`).
"# app-moziik" 
