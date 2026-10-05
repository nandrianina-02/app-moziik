# Règles générales du projet Moziik

## 0. Au début de chaque session

Lire ces deux fichiers avant toute autre chose :

- `claude.md` — le présent fichier, les règles du projet ;
- `tâches.md` — la file de travail en cours.

`tâches.md` n'est pas suivi par git et n'est pas chargé automatiquement :
il faut l'ouvrir explicitement. Il porte les demandes en attente, dans
l'ordre, et se vide au fur et à mesure qu'elles aboutissent.

## 1. Rigueur du développement

- Respecter strictement l'architecture existante du projet.
- Avant toute modification, analyser le code existant et comprendre son fonctionnement.
- Ne pas réécrire une fonctionnalité qui fonctionne déjà.
- Privilégier les modifications minimales, propres et ciblées.
- Ne pas créer de fichiers, composants, routes ou dépendances inutiles.
- Ne jamais supprimer une fonctionnalité existante sans raison technique claire.
- Vérifier les régressions après chaque modification importante.
- Le code doit être maintenable, cohérent et prêt pour la production.

## 2. Pas d'emoji dans le code

- Ne jamais utiliser d'emoji dans le code source.
- Ne pas utiliser d'emoji dans les commentaires du code.
- Ne pas utiliser d'emoji dans les noms de variables, fonctions, composants ou fichiers.
- Ne pas ajouter automatiquement d'emoji dans les interfaces utilisateur.
- Utiliser des icônes professionnelles provenant du système d'icônes déjà utilisé par le projet.

## 3. Design professionnel et humanisé

Le design de Moziik doit avoir une apparence :

- moderne ;
- professionnelle ;
- naturelle ;
- humaine ;
- cohérente ;
- premium ;
- personnalisée.

Éviter les interfaces génériques qui ressemblent à des interfaces générées automatiquement par une IA.

Ne pas utiliser systématiquement les mêmes patterns visuels :
- cartes identiques partout ;
- gradients excessifs ;
- boutons surdimensionnés ;
- sections répétitives ;
- interfaces trop symétriques ;
- couleurs aléatoires ;
- textes génériques.

Chaque interface doit avoir une vraie logique UX et répondre à son contexte.

## 4. Identité visuelle

Respecter l'identité visuelle existante de Moziik.

Avant de créer une nouvelle page :
- analyser les pages existantes ;
- réutiliser les composants existants lorsque cela est pertinent ;
- conserver les espacements, typographies, couleurs et comportements cohérents ;
- ne pas introduire un nouveau style visuel sans nécessité.

Toute nouvelle page doit sembler appartenir naturellement au même produit.

## 5. Expérience utilisateur

Chaque fonctionnalité doit être pensée pour un utilisateur réel.

Privilégier :
- une navigation évidente ;
- des informations hiérarchisées ;
- des actions compréhensibles ;
- des états de chargement clairs ;
- des messages d'erreur utiles ;
- des confirmations adaptées ;
- des interactions fluides.

Éviter les comportements surprenants ou inutiles.

## 6. Animations

Chaque nouvelle page créée doit avoir des animations d'entrée et de transition adaptées.

Les animations doivent être :
- fluides ;
- rapides ;
- naturelles ;
- discrètes ;
- cohérentes avec l'interface.

Ne pas ajouter des animations uniquement pour décorer.

Privilégier les animations qui améliorent :
- la navigation ;
- la compréhension ;
- le feedback utilisateur ;
- la hiérarchie visuelle.

Respecter également `prefers-reduced-motion` lorsque cela est pertinent.

## 7. Responsive

Toute nouvelle interface doit être conçue pour :
- mobile ;
- tablette ;
- desktop.

Ne jamais considérer le desktop comme la seule version principale.

Les interactions tactiles doivent être suffisamment grandes et accessibles sur mobile.

## 8. Qualité avant quantité

Ne pas ajouter plusieurs fonctionnalités simplement pour rendre une page plus riche.

Chaque élément doit avoir une utilité réelle.

Si une fonctionnalité n'est pas nécessaire au besoin demandé, ne pas l'ajouter.

## 9. Avant chaque modification

Avant de coder :

1. Comprendre le besoin.
2. Examiner le code concerné.
3. Identifier les composants existants réutilisables.
4. Identifier les dépendances déjà disponibles.
5. Choisir la modification la plus simple et la plus sûre.
6. Implémenter.
7. Vérifier le résultat.
8. Corriger les éventuelles régressions.

## 10. Principe essentiel

Moziik doit être développé comme un véritable produit professionnel, pas comme une démonstration technique.

Le résultat final doit donner l'impression d'avoir été conçu et développé par une équipe produit expérimentée, avec une attention particulière portée à l'UX, au détail visuel, aux performances et à la cohérence générale.