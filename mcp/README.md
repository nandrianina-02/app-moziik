# Moziik Admin MCP

Piloter le catalogue Moziik depuis Claude ou ChatGPT, par la conversation.

Ce serveur n'ajoute **aucune route** à la production et **aucun mécanisme
d'authentification**. Il emprunte celui que l'application Android utilise
déjà : un jeton `Authorization: Bearer`, résolu par `lib/mobileAuth.ts`.
Trois conséquences, toutes voulues :

- aucune surface d'attaque nouvelle sur le site ;
- les droits sont ceux du compte configuré, **appliqués par le serveur**.
  Un compte artiste se verra refuser une route d'administration, quoi que
  demande le modèle ;
- le jeton se révoque depuis **Mon compte → appareils connectés**. Couper
  cet accès ne demande ni redéploiement ni changement de mot de passe.

Le serveur vit dans son propre dossier, avec son propre `package.json` :
il n'alourdit pas le build Vercel du site.

---

## Installation

```bash
cd mcp
npm install
npm run jeton        # demande vos identifiants, affiche le jeton à coller
```

`npm run jeton` se connecte une fois, affiche un jeton de rafraîchissement
valable trente jours, et vous dit quel rôle porte le compte. Il n'écrit
rien sur le disque.

### Claude Code

```bash
claude mcp add moziik -- node c:/dev/moziik/mcp/src/index.js
```

puis renseignez les variables dans la configuration du serveur.

### Claude Desktop — `claude_desktop_config.json`

```json
{
  "mcpServers": {
    "moziik": {
      "command": "node",
      "args": ["c:/dev/moziik/mcp/src/index.js"],
      "env": {
        "MOZIIK_URL": "https://app-moziik.vercel.app",
        "MOZIIK_REFRESH_TOKEN": "le jeton donné par npm run jeton"
      }
    }
  }
}
```

### ChatGPT

L'application de bureau ChatGPT lit la même déclaration de serveurs MCP
en stdio. La configuration ci-dessus s'y transpose telle quelle.

### Variables

| Variable | Rôle |
|---|---|
| `MOZIIK_URL` | Cible. Par défaut `https://app-moziik.vercel.app`. |
| `MOZIIK_REFRESH_TOKEN` | **Recommandé.** Révocable, ne révèle pas le mot de passe. |
| `MOZIIK_EMAIL` / `MOZIIK_PASSWORD` | Repli. Le mot de passe se retrouve alors en clair dans la configuration. |

---

## Les outils

| Outil | Ce qu'il fait | Droits exigés par le serveur |
|---|---|---|
| `moziik_moi` | Le compte connecté, son rôle, et ce qui est hors de portée | connecté |
| `moziik_rechercher` | Recherche globale — l'outil pour retrouver un identifiant | public |
| `moziik_titres_lister` | Les titres, par artiste ou par genre | public |
| `moziik_titre_lire` | La fiche complète d'un titre | public |
| `moziik_titre_modifier` | Métadonnées d'un titre | propriétaire ou admin |
| `moziik_titre_supprimer` | Suppression définitive | propriétaire ou admin |
| `moziik_titres_a_valider` | Ce qui attend une décision | admin |
| `moziik_titre_moderer` | Approuver ou refuser | admin |
| `moziik_paroles_lire` | Paroles structurées, synchronisation comprise | public |
| `moziik_paroles_ecrire` | Texte, LRC, ou lignes horodatées | propriétaire ou admin |
| `moziik_paroles_supprimer` | Retire les paroles | propriétaire ou admin |
| `moziik_artistes_lister` | Les artistes | public |
| `moziik_artiste_lire` | La fiche d'administration | admin |
| `moziik_artiste_modifier` | Nom, bio, genres, vérification, autorisations | admin |
| `moziik_albums_lister` | Les albums d'un artiste | public |
| `moziik_statistiques` | Tableau de bord | admin |
| `moziik_classement` | Palmarès par période | public |
| `moziik_revenus` | Rémunérations **du compte connecté** | connecté |
| `moziik_rapport_lire` | Rapport d'activité archivé | admin |
| `moziik_rapport_generer` | Recalcule et fait relire par l'IA — consomme des crédits | admin |
| `moziik_commentaires_lister` | Repérer ce qui demande une décision | admin |
| `moziik_ia_metadonnees` | Propose genre, tags, description — n'applique rien | connecté |
| `moziik_ia_biographie` | Rédige une biographie — n'applique rien | connecté |

### Les suppressions demandent le titre exact

Le client MCP fait déjà valider chaque appel par un humain. Mais une
validation dans une fenêtre de discussion se donne vite, et un
identifiant erroné ressemble à n'importe quel autre identifiant. Les deux
outils destructifs relisent donc le contenu visé et **refusent** si le
libellé fourni ne correspond pas :

```
> supprime le titre 6a990b30222ebf13451f039c, confirmation « Mauvais titre »
Refus : la confirmation ne correspond pas.
Attendu « Le meilleur Slow Kaiamba Non-Stop Mix », reçu « Mauvais titre ».
```

La comparaison ignore la casse et les espaces : on vérifie que le modèle
sait de quoi il parle, pas qu'il recopie au caractère près.

---

## Ce que ce serveur ne peut pas faire

Dit ici, et rendu aussi par `moziik_moi` — un modèle qui l'ignore essaie,
échoue, et recommence autrement.

**Créer un titre de bout en bout.** `POST /api/songs` exige `audioUrl` et
`coverUrl` déjà hébergées. L'envoi de fichier se fait du navigateur vers
Cloudinary par un préréglage non signé (`lib/cloudinaryClient.ts`) ;
aucune route serveur ne l'accepte, et faire transiter plusieurs mégaoctets
par une route Next.js dépasserait sa limite de charge. Déposer un morceau
reste un geste du formulaire de publication.

**Consulter les royalties de tout le catalogue.** Seule
`/api/artist/revenus` existe, et elle ne rend que celles du compte
connecté. Il n'y a aucune route d'administration sur le modèle `Royalty`.

**Déclencher le calcul des royalties, la publication des titres programmés
ou le rapport hebdomadaire.** Ces routes `/api/cron/*` s'authentifient par
`CRON_SECRET`, pas par un compte. Exposer ce secret ici lui donnerait une
portée bien plus large que ce serveur.

**Lancer la détection automatique de contenus problématiques.**
`/api/cron/moderate-comments` fait ce travail, par `CRON_SECRET` également.
On peut lister et décider ; pas lancer la détection.

---

## Tests

```bash
npm test
```

Cinquante-neuf assertions. Le client HTTP y est remplacé par un double :
ce qu'on vérifie n'est pas que Moziik répond, mais que chaque outil appelle
la **bonne** route avec les **bons** noms de champs, qu'il refuse ce qu'il
doit refuser, et que ni l'adresse audio signée ni les paroles entières ne
sortent dans une réponse.
