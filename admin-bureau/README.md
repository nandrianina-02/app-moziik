# Moziik Admin (Windows)

Logiciel de bureau pour administrer Moziik : toute l'administration du
site, sans navigateur. Pilotage (tableau de bord, statistiques, analyses,
classements, tâches planifiées), catalogue (musiques, artistes, albums,
playlists, téléversements, univers, sélections, paroles, tempo), qualité
(modération, doublons, années de sortie, genres), communauté
(utilisateurs, badges, annonces, assistance, escalades, centre d'aide) et
site (pages du site, paramètres du site, intelligence artificielle). C'est un client de l'API du site, avec le
même compte administrateur et les mêmes routes que l'administration web :
rien n'entre au catalogue par une autre porte.

Le thème est celui du site (sombre par défaut, clair au choix), avec les
polices Sora et Plus Jakarta Sans embarquées : le logiciel n'a besoin
d'aucune ressource en ligne pour s'afficher.

## Routes du site propres au logiciel

- `/api/admin/stats/ecoutes?days=N` : écoutes jour par jour, pour les
  courbes du tableau de bord et des statistiques.
- `/api/admin/users` rend aussi `stageName` et `artistCoverUrl` pour les
  comptes d'artistes : la grille des artistes montre le profil public.

Tant que le site déployé ne les a pas, les écrans concernés l'indiquent au
lieu d'afficher des zéros.

## Construire

Jamais sur un poste local : le workflow `.github/workflows/admin-bureau.yml`
construit l'installeur sur Windows à chaque envoi qui touche ce dossier
(artefact de l'exécution). Lancé à la main, il publie en plus une version
GitHub `admin-vX.Y.Z` avec `moziik-admin-setup.exe`, sans la marquer
comme dernière version : l'application Android lit `releases/latest`.

En local, seuls les types se vérifient : `npm run typecheck`.

## Session

Connexion par e-mail et mot de passe (`/api/mobile-auth/login`), réservée
au rôle administrateur. Le jeton de renouvellement est chiffré par Windows
pour le compte utilisateur (DPAPI, `safeStorage`) dans le dossier de
l'application ; le jeton d'accès ne vit qu'en mémoire.

## Import

Trois façons d'ajouter, qui s'additionnent à la liste (un fichier déjà
présent est ignoré) : « Ajouter des fichiers », « Ajouter un dossier »
(sous-dossiers compris), ou glisser fichiers et dossiers n'importe où dans
la fenêtre, depuis n'importe quelle page. Le chemin d'un fichier glissé
vient de `webUtils.getPathForFile` (preload) ; une zone marquée
`data-depot` (pochette, clip) garde ce qu'on y lâche.

1. Lecture des balises (`music-metadata`, processus principal), reprise de
   `lib/audioMetadata.ts` : invités, producteur, tonalité, ISRC, copyright,
   langue, paroles (SYLT converti en LRC), description, date complète,
   mots-clés, mention explicite. Rapprochement des valeurs par
   `metadonnees.ts`, copie de `lib/metadataMapping.ts`.
2. Rapprochement par le site (`/api/import/inspect`) : artiste reconnu,
   doublon ; puis les invités « (feat. X) », rattachés à leur profil.
3. La fiche d'une ligne (`FicheTeleversement.tsx`) reprend tous les champs
   de `/son/nouveau` et ses outils : pochette remplaçable, écoute locale,
   doublon revérifié (`/api/songs/duplicate`), artiste et invités
   (recherche dans les deux univers, création), album existant ou nouveau,
   date de sortie (une date à venir programme la sortie), brouillon,
   explicite, description, tags, paroles, crédits, tempo mesuré
   (`bpm.ts`), découpe, clip vidéo, et l'assistance IA du site
   (`/api/ai/song-metadata`, si la fonction « publication » est ouverte).
   Plusieurs lignes se modifient ensemble (`ModificationGroupee.tsx`).
4. Envoi vers Karaks Storage par `/api/fichiers/envoi` : la source telle
   quelle et entière, puis les trois qualités d'écoute (64 kb/s mono, 128
   et 320 kb/s), découpe appliquée, encodées dans un worker comme le site
   (`encodage.ts`, copie de `lib/encodageAudio.ts`). Désactivable dans
   Paramètres. Le clip part dans le dossier « videos ».
5. Album retrouvé chez l'artiste, ou créé (`/api/albums` avec `artistId`,
   réservé à l'administration), puis publication par `/api/songs`.

Les envois vivent au niveau de la coquille (`televersements.tsx`) : ils
continuent quand on change de page. Un titre publié sans album ou sans
qualités (format que le décodeur ne lit pas) est marqué « Publié* », la
raison en infobulle.

## Modifier un titre du catalogue

La fiche d'un titre (`EditionTitre.tsx`, ouverte depuis Musiques) reprend
la page `/son/[id]/modifier` du site sur les mêmes routes (GET et PATCH
`/api/songs/[id]`) : tous les champs, artiste et invités, album existant,
single ou nouveau, pochette, fichier audio remplacé, découpe, clip ajouté
ou retiré, tempo mesuré, assistance IA, doublon revérifié ; plus la
validation, le refus, la remise en attente et la suppression. Les champs
et outils sont partagés avec la fiche de téléversement (`champsTitre.tsx`).

Deux règles du site :

- une date de sortie envoyée fait passer le titre en « publié » ou
  « programmé » : elle n'est modifiable que pour un titre déjà publié ou
  programmé, et n'est envoyée que si elle a changé ;
- changer la découpe d'un titre qui a ses qualités d'écoute exige de les
  renvoyer (sinon 409) : elles sont encodées de nouveau ici, depuis la
  source relue en `?brut=1`, avant l'enregistrement. Si l'encodage échoue,
  `audioVariantes: null` laisse le site lire la source.

## Essais

L'intégration continue lance le logiciel construit dans Electron
(`MOZIIK_ESSAI_RESEAU=1`) : appels au site et au stockage depuis une page
locale, puis encodage d'un son d'essai par le vrai worker. Un échec bloque
la publication de l'installeur.

## Affichage et raccourcis

Musiques, Artistes, Classements, Utilisateurs et Téléversements s'affichent
en liste ou en grille, chacune en trois tailles, retenues page par page
(`vues.tsx`). Le changement passe par l'API View Transitions de Chromium :
pochettes et titres portent un nom de transition et glissent vers leur
nouvelle place.

- Ctrl + molette sur une liste : les six affichages à la suite, comme dans
  l'Explorateur Windows. Ailleurs, la taille de l'interface.
- Ctrl + +, Ctrl + −, Ctrl + 0 : taille de l'interface (80 à 150 %).

Le menu d'Electron est retiré : ses propres raccourcis de zoom doublaient
ceux-ci. Les préférences du poste (`preferences.ts`) : thème (dont
« Système »), taille, animations, page d'ouverture, actualisation des
compteurs, qualités d'écoute, genre par défaut, notification de fin.

## Assistance et mises à jour

La page Assistance reprend `/api/admin/support` : conversations (demandes
d'un humain et non-lus en tête), fil relu toutes les 8 secondes avec
`after`, réponse (Ctrl + Entrée), brouillon de l'assistant du site
(`/suggest`), clore ou rouvrir.

Les mises à jour s'installent depuis les Paramètres : le processus
principal télécharge l'installeur de la version choisie, le lance et se
ferme. Seule une adresse `releases/download/admin-v…` du dépôt est
acceptée. Une nouvelle version se signale en bas de la barre latérale.

## Retour sur une page

Une page ouverte reste montée, masquée, quand on en quitte (`ZonePage`
dans `App.tsx`, `page.tsx`) : au retour, défilement, page de pagination,
recherche, filtres, sélection et panneau ouvert sont là où on les avait
laissés. Masquer passe par `visibility` et `inert`, pas par `display: none`,
qui ferait perdre la position et rejouerait les animations d'entrée.

Une page masquée se tait : raccourcis (`useSelection`, Ctrl + molette,
Échap, atelier des paroles), relectures périodiques (Assistance) et son de
l'atelier attendent le retour. `usePageActive()` le dit à un composant ;
`useAuRetour()` relit ce qui a pu changer (compteurs du tableau de bord,
conversations de l'assistance). Seule une recherche ou un filtre transmis
(palette, cloche) fait repartir une page de cette demande.

## Souris et clavier

Comme dans l'Explorateur Windows (`interactions.tsx`) :

- clic : sélectionner ; Ctrl + clic : ajouter ; Maj + clic : une plage ;
  Ctrl + A : tout ; Échap : désélectionner ;
- double-clic ou Entrée : ouvrir (fiche d'un titre, d'un artiste, ligne
  d'import ; Classements ouvre la page du site) ;
- clic droit : les actions de l'élément, ou de toute la sélection ;
- à partir de deux éléments, une barre d'actions groupées en bas de
  l'écran (valider ou refuser des titres, badge d'artistes, suspension de
  comptes, genre des lignes d'import…). Les actions de masse demandent
  confirmation.

Dans les champs, le clic droit ouvre le menu d'édition (processus
principal) : correcteur orthographique en français, couper, copier,
coller, tout sélectionner.

## Pages reprises de l'administration web

Chaque page du site `app/admin/*` a son écran dans `ecrans/`, sur les mêmes
routes d'API. Les listes reprises telles quelles du site (catégories
d'aide, modes d'écoute, préréglages de thème, réseaux sociaux, analyse du
tempo `bpm.ts`, paroles `paroles.ts`) portent un commentaire : une
correction d'un côté se reporte de l'autre.

L'audio (extraits, atelier des paroles, mesure du tempo) est téléchargé avec
le jeton (`telechargerAuthentifie`, `lecture.tsx`) : un `<audio src>` ne
peut pas porter d'en-tête, et le site compterait l'écoute comme anonyme ou
refuserait les brouillons.
