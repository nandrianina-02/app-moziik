# Changelog des corrections — Moziik

Toutes les corrections listées dans l'audit ont été appliquées et vérifiées (`tsc --noEmit` : 0 erreur). Ce document explique **quoi**, **pourquoi**, et **ce qu'il te reste à faire manuellement**.

---

## ⚠️ Actions manuelles obligatoires (je ne peux pas les faire à ta place)

### 1. Faire tourner TOUS les secrets exposés
Le `.env.example` d'origine contenait de vraies valeurs. Même corrigé maintenant, elles restent lisibles dans l'historique Git tant que tu n'as pas régénéré chaque clé :

- **MongoDB Atlas** : change le mot de passe de l'utilisateur `randriantsoa54_db_user` (ou crée un nouvel utilisateur et supprime l'ancien)
- **Cloudinary** : régénère l'API secret (Settings → Security)
- **NextAuth** : génère un nouveau `NEXTAUTH_SECRET` (`openssl rand -base64 32`)
- **Google OAuth** : régénère le client secret dans Google Cloud Console
- **Gmail SMTP** : révoque le mot de passe d'application existant et crée-en un nouveau
- **Stripe** : régénère la clé secrète et le webhook secret dans le dashboard
- **CRON_SECRET** : génère une nouvelle chaîne aléatoire

### 2. Purger l'historique Git
Un nouveau commit ne suffit pas — les anciennes valeurs restent consultables dans l'historique :
```bash
# Avec git-filter-repo (recommandé)
git filter-repo --path .env.example --invert-paths
# puis re-ajoute un .env.example propre et force-push
```
Ou utilise BFG Repo-Cleaner. **Fais ça après** avoir tourné les clés (pas besoin de courir contre la montre une fois les anciennes clés révoquées).

### 3. Vérifier les accès depuis la publication du dépôt
Consulte les logs d'accès MongoDB Atlas, Cloudinary et Stripe pour détecter un usage suspect.

### 4. Configurer les vraies valeurs en local/production
`cp .env.example .env.local` puis renseigne tes propres clés (nouvellement régénérées).

---

## ✅ Corrections de code appliquées

### Sécurité — critique

| Fichier | Avant | Après |
|---|---|---|
| `.env.example` | Vrais secrets commités | Placeholders uniquement |
| `app/api/webhooks/mvola/route.ts` | Activait l'abonnement sur la foi du payload entrant, sans vérification | Revérifie le statut réel via `getMvolaTransactionStatus()` (nouvelle fonction dans `lib/mvola.ts`) avant toute activation |
| `models/Subscription.ts` | — | Ajout de `mvolaServerCorrelationId` pour permettre cette revérification |
| `app/api/subscriptions/mobile-money/route.ts` | — | Capture et stocke le `serverCorrelationId` retourné par MVola à l'initiation |

### Sécurité — dépendances vulnérables

`npm audit` est passé de **8 vulnérabilités (3 critiques, 3 hautes)** à **2 vulnérabilités hautes** (les 2 restantes nécessitent une migration majeure vers Next.js 15/16, voir section "Recommandation non appliquée" plus bas).

| Paquet | Avant | Après | CVE corrigés |
|---|---|---|---|
| `next` | 14.2.5 | 14.2.35 | Cache poisoning, DoS Server Actions, authorization bypass, information exposure, et une vingtaine d'autres |
| `mongoose` | 8.5.1 | 8.24.2 | **Injection NoSQL critique**, prototype pollution critique |
| `cloudinary` | 2.3.0 | 2.10.0 | Injection d'arguments arbitraires |
| `next-auth` | 4.24.7 | 4.24.15 | Vulnérabilité sur le paquet `cookie` |
| `nodemailer` | 6.9.14 | 9.0.3 (via `overrides` npm) | Injection de commandes SMTP, injection CRLF, SSRF via `raw`/`jsonTransport` |

> **Correctif build Vercel** : `next-auth@4.24.15` déclare `nodemailer` comme peer dependency **optionnel** limité à `^7.0.7` (utilisé seulement par son provider `EmailProvider`, que ce projet n'utilise pas — seuls `Credentials` et `Google` sont configurés). Installer `nodemailer@9.0.3` en dépendance directe provoquait un conflit `ERESOLVE` bloquant sur un `npm install` strict comme celui de Vercel (qui n'utilise pas `--legacy-peer-deps` par défaut). Résolu avec `"overrides": { "nodemailer": "9.0.3" }` dans `package.json`, qui force cette version dans tout l'arbre de dépendances sans déclencher le conflit. Vérifié avec `rm -rf node_modules package-lock.json && npm install` sans flag, à l'identique de Vercel.
| `uuid` | 10.0.0 | *(supprimé — dépendance inutilisée)* | Bug de bornes mémoire (non exploité de toute façon, aucun import trouvé dans le code) |

### Sécurité — absence de rate limiting

Nouveau : `lib/rateLimit.ts` (limiteur en mémoire, voir limites documentées dans le fichier — best-effort sur déploiement multi-instances, à migrer vers Redis si le trafic grossit). Appliqué sur :

- `app/api/auth/register/route.ts` — 5 / 15 min / IP
- `app/api/auth/forgot-password/route.ts` — 5 / 15 min / IP
- `app/api/auth/reset-password/route.ts` — 10 / 15 min / IP
- `app/api/contact/route.ts` — 5 / 15 min / IP
- `app/api/songs/[id]/play/route.ts` — 60 / min / IP
- `lib/auth.ts` (connexion `Credentials`) — 10 / 15 min / email

### Sécurité — validation des entrées

Nouveau : `lib/validation.ts` avec des schémas Zod (`zod` ajouté aux dépendances). Appliqué sur les routes les plus sensibles : inscription, mot de passe oublié, reset password, contact, création de son, modification utilisateur admin. Les autres routes suivent encore l'ancien pattern de vérification manuelle — **à étendre progressivement** (voir plus bas).

### Sécurité — recherche (ReDoS)

`app/api/search/route.ts` : le terme recherché passe maintenant par `escapeRegex()` (nouveau `lib/regex.ts`) avant d'être injecté dans `$regex`.

### Sécurité — en-têtes HTTP

`next.config.mjs` : ajout de CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`. La CSP autorise explicitement Stripe.js, Google OAuth et Cloudinary — à resserrer si tu retires une de ces intégrations.

### Sécurité — suspension de compte

`lib/auth.ts` : le rôle et le statut `suspended` sont revalidés en base toutes les 5 minutes (pas seulement à la connexion). Un compte suspendu voit sa session invalidée dans ce délai au lieu d'attendre l'expiration du JWT (jusqu'à 30 jours). La connexion Google vérifie désormais aussi `suspended` (avant : seul `Credentials` le faisait). `types/next-auth.d.ts` : `session.user` est devenu optionnel pour représenter proprement ce cas.

### Bugs — comptage non atomique

- `app/api/songs/[id]/play/route.ts` : `playsCount` passe de `read → +1 → save` à `$inc` atomique. Ajout d'une règle anti-fraude : une écoute n'est comptée "complète" (et donc monétisée) que si `secondsListened` couvre au moins 80% de la durée réelle du titre.
- `app/api/songs/[id]/like/route.ts` : le toggle like/unlike utilise maintenant `$pull`/`$addToSet` conditionnels plutôt qu'un read-modify-write, ce qui élimine la course entre deux clics rapprochés.

### Qualité

- `.eslintrc.json` ajouté (`next/core-web-vitals`) + `eslint`/`eslint-config-next` ajoutés aux devDependencies — le script `npm run lint` fonctionne maintenant de façon reproductible pour toute personne qui clone le repo.
- `.gitignore` : ajout de `*.tsbuildinfo` et `.eslintcache` (fichiers de build qui n'ont pas à être versionnés) ; `tsconfig.tsbuildinfo` retiré du suivi Git.

---

## 🟡 Recommandations identifiées mais NON appliquées (nécessitent une décision ou un chantier dédié)

Je ne les ai pas faites car ce sont des refontes ouvertes, pas des correctifs mécaniques — les appliquer sans validation risquerait de casser des choses ou de prendre des décisions à ta place :

1. **Migration Next.js 15/16** : résoudrait les 2 dernières vulnérabilités npm, mais implique des changements cassants (`headers()`/`cookies()` deviennent asynchrones, React 19, etc.) qui touchent plusieurs fichiers (`app/api/songs/[id]/play/route.ts` utilise `headers()` de façon synchrone, par exemple). À prévoir comme chantier dédié avec tests de non-régression.
2. **Validation Zod exhaustive** : appliquée sur les routes les plus sensibles ; les 60 autres routes API suivent encore l'ancien pattern `if (!champ) throw ...`. Le pattern (`parseOrThrow` + schéma dans `lib/validation.ts`) est en place, il reste à le dupliquer route par route.
3. **Découpage des gros fichiers** (`app/admin/accueil/page.tsx` 774 lignes, `components/player/FullPlayerPage.tsx` 626 lignes) : refactor de structure, pas un bug — à faire progressivement.
4. **Tests automatisés** : toujours aucun test dans le repo. Je recommande de commencer par la logique de royalties et les permissions admin, qui sont les zones à plus haut risque financier/sécurité.
5. **Rate limiting distribué** : la solution actuelle est en mémoire (par instance serverless). Suffisant pour limiter les abus au quotidien, mais pas une garantie stricte à grande échelle — migrer vers Upstash Redis si le trafic le justifie.

---

## Comment vérifier par toi-même

```bash
npm install
npx tsc --noEmit    # doit être vide (0 erreur)
npm run lint
npm run build       # nécessite un accès réseau à Google Fonts (bloqué dans mon environnement d'audit, mais devrait fonctionner chez toi/sur Vercel)
```
