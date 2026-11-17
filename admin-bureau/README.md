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
4. Envoi vers Karaks Storage par `/api/fichiers/envoi`, puis `/api/songs`.

Pas encore : les qualités d'écoute 64 et 128 kb/s (le site les encode dans
le navigateur ; ici, la source sert à toutes), la création d'albums.
