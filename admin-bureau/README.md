# Moziik Admin (Windows)

Logiciel de bureau pour administrer Moziik : tableau de bord, musiques,
artistes, classements, statistiques, utilisateurs, import de dossiers de
musique, modération et annonces. C'est un client de l'API du site, avec le
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

1. Lecture des balises de chaque fichier (`music-metadata`, processus principal).
2. Rapprochement par le site (`/api/import/inspect`) : artiste reconnu, doublon.
3. Corrections dans le panneau de droite ; création d'un artiste absent
   (`/api/admin/users`, rôle artiste, adresse `@moziik.app`).
4. Envoi vers Karaks Storage par `/api/fichiers/envoi` : la source telle
   quelle, puis les trois qualités d'écoute (64 kb/s mono, 128 et 320 kb/s)
   encodées dans un worker, comme le site (`encodage.ts`, copie de
   `lib/encodageAudio.ts`). Désactivable dans Paramètres.
5. Album retrouvé chez l'artiste, ou créé (`/api/albums` avec `artistId`,
   réservé à l'administration), puis publication par `/api/songs`.

Les envois vivent au niveau de la coquille (`televersements.tsx`) : ils
continuent quand on change de page. Un titre publié sans album ou sans
qualités (format que le décodeur ne lit pas) est marqué « Publié* », la
raison en infobulle.

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
