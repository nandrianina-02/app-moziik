# Moziik — Phase 1 : Fondations

## Démarrage

1. `cp .env.example .env.local` puis renseigner MONGODB_URI et les clés Cloudinary
2. `npm install`
3. `npm run dev` → http://localhost:3000

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
- Les coûts d'abonnement et le taux de rémunération par écoute
  modifiés dans `/admin/parametres` sont lus par `getSiteConfig()` —
  ils seront branchés sur Stripe/Mobile Money en Phase 7

## Phase 7 — Monétisation
- Renseigner `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` (créer le
  webhook dans le dashboard Stripe pointant vers
  `/api/webhooks/stripe`, évènements : `checkout.session.completed`,
  `invoice.paid`, `customer.subscription.deleted`)
- Renseigner les identifiants MVola (`MVOLA_CONSUMER_KEY`,
  `MVOLA_CONSUMER_SECRET`, `MVOLA_MERCHANT_MSISDN`) — `MVOLA_ENV=sandbox`
  par défaut, passer à `production` une fois validé par MVola
- Deux cron à planifier en dehors de Next.js (Vercel Cron ou autre) :
  - `/api/cron/publish-songs` (Phase 5) — toutes les 5 minutes
  - `/api/cron/compute-royalties` — une fois par jour
  - Les deux exigent l'en-tête `Authorization: Bearer <CRON_SECRET>`
- Les prix affichés sur `/abonnement` viennent de `/api/site-config`
  (public), donc toujours synchronisés avec `/admin/parametres`

## Phase 8 — Analytics & recommandations
- `lib/sentiment.ts` est un lexique simple, pas un modèle ML — largement
  suffisant pour un premier tri, mais remplaçable par un vrai service
  NLP plus tard (même interface `{ sentiment, score }`)
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
