# Nouvelles sections d'accueil — Pour vous / Écoutes récemment / Playlists populaires

Les 3 sections de la maquette sont ajoutées, **dynamiques** (données réelles) et **pilotables depuis l'admin** (`/admin/accueil`), en s'intégrant au système de sections déjà en place plutôt qu'en créant un système parallèle.

## 1. "Pour vous" (nouveau)

Carrousel avec flèches précédent/suivant, 4 cartes par défaut : **Daily Mix**, **Nouveautés**, **Top Écoutes**, **Chill Vibes**.

- Chaque carte affiche automatiquement la pochette du **vrai contenu du moment** (dernier titre sorti, titre le plus écouté, un titre du genre "chill", ou le dernier titre écouté par l'utilisateur pour Daily Mix) — tant que l'admin n'a pas mis sa propre image.
- Par défaut, les cartes renvoient vers les sections correspondantes plus bas sur la même page (`#new_releases`, `#top_tracks`, etc.) ou vers la recherche filtrée ("Chill Vibes" → `/recherche?q=chill`).
- **Depuis l'admin** (`/admin/accueil`, ligne "Pour vous" → icône engrenage) : modifier titre/sous-titre/badge/lien de chaque carte, uploader une pochette personnalisée, activer/désactiver, réordonner, ajouter/supprimer des cartes.

## 2. "Écoutes récemment" (nouveau)

Ligne défilante des derniers titres écoutés par l'utilisateur connecté (dédupliqués), avec lecture intégrée au lecteur (bouton play/pause en overlay). Vide et masquée pour un visiteur non connecté — section personnelle par nature.

Contrôlable depuis l'admin comme toute section standard (activer/désactiver, réordonner, limite d'éléments affichés).

## 3. "Playlists populaires" (déjà existante, redesignée)

Cette section existait déjà mais avec un rendu carré basique. Le composant est repris intégralement pour matcher la maquette : cartes larges en dégradé photo, titre + nombre de titres en overlay, et une pile d'avatars des artistes présents dans la playlist.

## Déploiement

Aucune étape manuelle requise : à la première visite de la page d'accueil après déploiement, le système ajoute automatiquement les 2 nouvelles sections (et les 4 cartes par défaut) à la configuration existante, sans écraser tes réglages actuels.

## Vérifications effectuées

- `npx tsc --noEmit` : 0 erreur
- `npm run lint` : 0 erreur/avertissement
- Le build échoue uniquement à cause des polices Google Fonts inaccessibles dans mon environnement d'audit (pas d'accès réseau externe) — aucune autre erreur détectée derrière ça. Ça compilera normalement chez toi/sur Vercel.
