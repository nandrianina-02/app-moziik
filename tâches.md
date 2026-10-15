NB: à vider après avoir terminé

# Intègre **Moziik Dev API** au projet existant.

Avant toute modification, analyse l'architecture actuelle et réutilise le backend, l'authentification, MongoDB et les routes déjà existantes.

Objectif :
- créer une couche API propre et sécurisée pour Moziik ;
- permettre au futur plugin Moziik et aux autres services autorisés de communiquer avec l'application ;
- ne jamais donner d'accès direct à MongoDB ;
- utiliser une authentification sécurisée avec permissions ;
- versionner l'API, par exemple `/api/v1` ;
- conserver la compatibilité avec les fonctionnalités existantes ;
- documenter les endpoints créés.

Commence par identifier les routes et fonctionnalités existantes qui peuvent être exposées via **Moziik Dev API**, puis implémente uniquement ce qui est nécessaire sans casser l'application actuelle.