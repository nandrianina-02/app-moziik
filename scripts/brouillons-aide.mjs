/**
 * Dépose au centre d'aide des brouillons d'articles, NON PUBLIÉS.
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * L'assistant du support ne sait que ce que le centre d'aide dit. Douze
 * articles totalisant 4 400 caractères décrivaient toute la plateforme :
 * chaque question sortant de ces douze sujets partait à l'équipe, quel
 * que soit le modèle employé. Le corpus était le plafond.
 *
 * CE QUE CES BROUILLONS SONT
 *
 * Ce que le code fait réellement, mis en phrases. Chaque affirmation a
 * été relue dans les sources : les débits viennent de lib/acces.ts, les
 * univers de lib/univers.ts, la découpe de lib/cloudinaryAudio.ts. Rien
 * n'est déduit d'une intention.
 *
 * CE QU'ILS NE SONT PAS
 *
 * Des articles prêts à publier. Ils sont déposés en `published: false`,
 * et le resteront : un article d'aide engage le site sur des tarifs, des
 * délais et des procédures, et cet engagement n'appartient qu'à
 * l'exploitant. Les passages que le code ne permet pas de trancher —
 * disponibilité de l'application, opérateurs de paiement mobile, délais
 * de versement — portent la mention « À COMPLÉTER » en clair.
 *
 * Relisez-les dans /admin/aide, corrigez, publiez ce qui vous convient,
 * supprimez le reste.
 *
 * Idempotent : un article dont le slug existe déjà n'est ni écrasé ni
 * dupliqué. Vos corrections ne peuvent donc pas être perdues par une
 * seconde exécution.
 *
 * Usage :
 *   node scripts/brouillons-aide.mjs --essai
 *   node scripts/brouillons-aide.mjs
 *   node scripts/brouillons-aide.mjs --retirer   (supprime les brouillons non publiés déposés ici)
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

function chargerUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  for (const fichier of [".env.local", ".env"]) {
    const complet = path.resolve(process.cwd(), fichier);
    if (!fs.existsSync(complet)) continue;
    for (const ligne of fs.readFileSync(complet, "utf8").split(/\r?\n/)) {
      if (!ligne.includes("=") || ligne.trim().startsWith("#")) continue;
      const i = ligne.indexOf("=");
      if (ligne.slice(0, i).trim() === "MONGODB_URI") {
        return ligne.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      }
    }
  }
  throw new Error("MONGODB_URI introuvable (ni dans l'environnement, ni dans .env.local / .env).");
}

const ESSAI = process.argv.includes("--essai");
const RETIRER = process.argv.includes("--retirer");

const slug = (titre) =>
  titre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);

/** Marqueur repris tel quel dans le corps : il doit sauter aux yeux en relecture. */
const A_COMPLETER = "[À COMPLÉTER]";

const BROUILLONS = [
  {
    title: "Ce que change l'abonnement Premium",
    category: "Abonnement & paiement",
    excerpt: "Écoute en 320 kb/s, téléchargement hors connexion, thème personnalisé.",
    body: `Trois différences séparent un compte gratuit d'un compte Premium.

**La qualité d'écoute.** Un compte gratuit reçoit le son en 128 kb/s au maximum. Un compte Premium accède au 320 kb/s. Le plafond s'applique au fichier réellement servi, pas seulement au menu des réglages : choisir « haute qualité » sans abonnement ne change rien à ce qui arrive dans vos oreilles.

**Le téléchargement hors connexion.** Garder un titre sur l'appareil pour l'écouter sans réseau demande un abonnement. Sans lui, l'écoute passe toujours par la connexion.

**Le thème.** Les couleurs et l'apparence personnalisées sont réservées aux abonnés.

Ce que l'abonnement ne change pas : le catalogue est le même pour tout le monde, et il n'y a pas de titre réservé aux abonnés.

${A_COMPLETER} Précisez ici s'il existe d'autres avantages que vous voulez annoncer, et retirez ceux que vous ne voulez pas promettre.`,
  },

  {
    title: "Écouter sans compte : ce qui est possible",
    category: "Écoute & téléchargement",
    excerpt: "Un nombre de titres par jour, puis l'inscription.",
    body: `Vous pouvez écouter sans créer de compte, dans une limite quotidienne de titres différents.

Réécouter un titre déjà entendu dans la journée ne consomme rien de plus : c'est le nombre de titres *distincts* qui compte. Une fois la limite atteinte, la lecture s'arrête et l'inscription est proposée.

La limite se remet à zéro chaque jour, et elle est comptée par appareil et par connexion — pas par compte, puisqu'il n'y en a pas.

Créer un compte lève cette limite. C'est gratuit, et cela suffit : l'abonnement Premium n'est nécessaire que pour la haute qualité et le hors connexion.

${A_COMPLETER} Le nombre exact de titres par jour se règle dans l'administration. Indiquez-le ici si vous voulez l'annoncer, ou laissez la formulation générale si vous préférez pouvoir le changer sans réécrire l'article.`,
  },

  {
    title: "Écouter hors connexion",
    category: "Écoute & téléchargement",
    excerpt: "Télécharger des titres sur l'appareil, et régler ce qui se télécharge.",
    body: `Le téléchargement hors connexion est réservé aux comptes Premium.

**Télécharger un titre.** Depuis la fiche d'un morceau ou le menu d'une liste, choisissez « Télécharger ». Le fichier est gardé sur l'appareil et reste écoutable sans réseau, depuis la bibliothèque.

**Les réglages.** Dans votre compte, vous pouvez choisir :

- la qualité des téléchargements — 64, 128 ou 320 kb/s. Une qualité plus basse occupe moins de place et consomme moins de données ;
- le téléchargement par Wi-Fi seulement, pour ne pas entamer un forfait mobile ;
- le téléchargement automatique de vos favoris et de vos vingt derniers titres écoutés ;
- une limite d'espace occupé sur l'appareil.

**Ce qui se passe si l'abonnement s'arrête.** Les titres déjà sur l'appareil cessent d'être lisibles hors connexion. Ils restent écoutables en ligne, comme tout le catalogue.

${A_COMPLETER} Vérifiez la dernière phrase : c'est le comportement voulu, confirmez qu'il correspond à ce que vous voulez annoncer.`,
  },

  {
    title: "Qualité audio et consommation de données",
    category: "Écoute & téléchargement",
    excerpt: "Trois débits, ce qu'ils changent, et lequel choisir.",
    body: `Moziik sert le son en trois débits.

- **64 kb/s** — la plus économe. Convient à une connexion mobile lente ou à un forfait limité. La différence s'entend surtout au casque.
- **128 kb/s** — l'équilibre par défaut. C'est aussi le maximum d'un compte gratuit.
- **320 kb/s** — la plus fidèle. Réservée aux comptes Premium.

Le réglage se trouve dans votre compte, et s'applique à l'écoute en ligne comme aux téléchargements.

**Un ordre de grandeur.** Une heure d'écoute représente environ 29 Mo en 64 kb/s, 58 Mo en 128 kb/s et 144 Mo en 320 kb/s. Sur un forfait mobile, la différence compte.

Si votre connexion est instable, descendre en qualité règle la plupart des coupures.`,
  },

  {
    title: "Payer avec Mobile Money",
    category: "Abonnement & paiement",
    excerpt: "Souscrire depuis un téléphone, sans carte bancaire.",
    body: `L'abonnement peut être réglé par paiement mobile, sans carte bancaire.

**Comment cela se passe.** Vous choisissez l'abonnement, vous saisissez votre numéro, puis vous confirmez la demande sur votre téléphone. Le compte passe en Premium une fois le paiement confirmé par l'opérateur — pas au moment où vous validez le formulaire.

**Si rien ne se passe.** La confirmation peut prendre un moment. Si votre compte n'est pas passé en Premium après quelques minutes alors que le montant a été débité, écrivez-nous : ne relancez pas un second paiement.

${A_COMPLETER} Précisez ici : quels opérateurs sont acceptés, le format du numéro attendu, le délai habituel de confirmation, et ce qu'il faut faire en cas de débit sans activation. Ces informations dépendent de votre contrat opérateur — je ne peux pas les déduire du code.`,
  },

  {
    title: "Général et Évangélique : les deux univers",
    category: "Écoute & téléchargement",
    excerpt: "Deux catalogues séparés, et comment passer de l'un à l'autre.",
    body: `Moziik tient deux univers musicaux séparés : **Général** et **Évangélique**.

Ce ne sont pas deux filtres posés sur un même catalogue. Chacun a ses artistes, ses recommandations, sa lecture automatique, son historique et ses playlists. Quelqu'un venu pour la louange ne verra pas un titre de club entre deux cantiques, et l'inverse est vrai aussi.

**Changer d'univers.** Le sélecteur est en haut de l'écran. Le choix vous suit d'un appareil à l'autre si vous êtes connecté, et reste mémorisé un an sur le même navigateur si vous ne l'êtes pas.

**Pour les artistes.** Un artiste appartient à un univers, et ses titres y naissent avec lui. Un titre isolé peut être déplacé dans l'autre univers par l'équipe — le cas du morceau de gospel d'un artiste de variété — sans que le reste de sa discographie ne bouge.

Si un de vos titres est classé du mauvais côté, signalez-le : le classement se corrige.`,
  },

  {
    title: "Les radios et la station personnalisée",
    category: "Écoute & téléchargement",
    excerpt: "Lancer une station par genre, ou celle qui vous ressemble.",
    body: `La page Radio propose deux choses.

**Les stations.** Tendances, Nouveautés, Mes favoris, et une station par genre du catalogue. Une station se lance d'un clic et enchaîne les titres sans intervention.

**La station personnalisée.** Elle se compose à partir de ce que vous écoutez réellement : vos genres, vos artistes, l'heure de la journée. Elle demande un peu d'historique pour dire quelque chose — les premiers jours, elle ressemblera aux tendances.

Vous pouvez partager une station dans un message : la personne qui la reçoit ouvre exactement la même.`,
  },

  {
    title: "Envoyer des messages et partager de la musique",
    category: "Compte",
    excerpt: "Conversations privées, groupes, et partage de titres jouables.",
    body: `La messagerie permet d'écrire à une personne ou à plusieurs, et de partager ce que vous écoutez.

**Conversations et groupes.** Ouvrez une conversation depuis « Messages ». Cocher plusieurs personnes crée un groupe, que vous nommez. Un gestionnaire de groupe peut le renommer, ajouter et exclure des membres ; chacun peut mettre le fil en sourdine ou le quitter.

**Partager du contenu.** Un titre, un album, un podcast, une playlist, un artiste, un évènement ou une radio s'envoient sous forme de carte. Un titre et une radio se lancent directement depuis la conversation ; le reste ouvre sa page. Vous pouvez aussi passer par le bouton « Partager » d'un contenu, puis « Envoyer dans un message ».

**Ce qu'on peut faire d'un message.** Y répondre, y réagir avec un emoji, le corriger ou le supprimer — vos propres messages seulement. Vous pouvez joindre une photo ou enregistrer un message vocal.

**Ce que voient les autres.** Une pastille verte signale une personne active récemment, et « écrit… » apparaît pendant qu'elle tape. Vos messages portent deux coches une fois lus.`,
  },

  {
    title: "L'assistant d'écoute",
    category: "Écoute & téléchargement",
    excerpt: "Lui demander de lancer un titre, une playlist ou une radio.",
    body: `L'assistant d'écoute se trouve en tête de vos messages. Vous lui écrivez ce que vous voulez entendre, il le lance.

« Mets du salegy », « la radio gospel », « joue Mandigny », « quelque chose de calme » : il comprend la demande, choisit dans le catalogue et démarre la lecture. Quand vous lui posez une question plutôt qu'une demande d'écoute, il répond sans rien lancer.

**Ce qu'il ne fait pas.** Il ne peut proposer que ce qui existe réellement dans le catalogue — il ne vous parlera pas d'un morceau qui n'y est pas. Il ne connaît ni votre compte, ni votre historique détaillé, ni vos statistiques : il ne peut donc rien en dire.

**C'est une machine, et elle le dit.** Chacune de ses réponses porte la mention « automatique ». Pour toute question qui demande une décision — un remboursement, un problème de compte — écrivez plutôt au support.`,
  },

  {
    title: "Suivre un évènement",
    category: "Compte",
    excerpt: "Trouver un concert, marquer son intérêt, s'y rendre.",
    body: `La page Évènements réunit les concerts et les rendez-vous annoncés par les artistes.

**Sur la fiche d'un évènement**, vous trouvez la date, le lieu, le programme quand il est renseigné, les artistes à l'affiche et une carte pour s'y rendre.

**Marquer son intérêt** prévient l'organisateur du nombre de personnes intéressées, et vous permet de retrouver l'évènement facilement.

Vous pouvez partager un évènement dans un message ou sur vos réseaux.

${A_COMPLETER} Si la billetterie est gérée ailleurs, dites ici où l'on achète sa place. Le site n'en vend pas.`,
  },

  {
    title: "Suivre ses écoutes et ses revenus (artistes)",
    category: "Espace artiste",
    excerpt: "Où lire ses statistiques, et comment les droits sont versés.",
    body: `Votre espace artiste réunit deux écrans.

**Les statistiques** montrent vos écoutes, vos titres les plus joués et vos abonnés. Une écoute compte quand le morceau a été écouté en entier.

**Les revenus** listent vos relevés. Chaque relevé regroupe vos écoutes complètes qui n'avaient pas encore été payées, au tarif en vigueur au moment du calcul. Un relevé émis n'est jamais recalculé : un changement de tarif ne modifie pas ce qui a déjà été établi.

**Ce qui n'est pas compté** : une écoute interrompue avant la fin, et les écoutes déjà incluses dans un relevé précédent.

${A_COMPLETER} Ajoutez ici : à quelle fréquence les relevés sont établis, par quel moyen les sommes sont versées, à partir de quel montant minimum, et sous quel délai. Ces informations relèvent de votre organisation, pas du code.`,
  },

  {
    title: "Régler le tempo et découper un titre (artistes)",
    category: "Espace artiste",
    excerpt: "Mesurer le BPM, couper une intro ou une fin, sans réenvoyer le fichier.",
    body: `Deux réglages accompagnent la publication d'un titre.

**Le tempo (BPM).** Il est mesuré automatiquement à l'envoi, dans votre navigateur. Vous pouvez le corriger à la main : une valeur saisie par vous n'est jamais écrasée par une mesure ultérieure. Le tempo sert au classement du titre et aux modes d'écoute — un morceau sans tempo est absent de plusieurs sélections.

Sur un titre déjà publié, « Mesurer depuis l'audio » relance le calcul sans avoir à renvoyer le fichier.

**La découpe.** Vous pouvez retirer un silence en début de piste ou une fin qui traîne, en déplaçant deux poignées sur la forme d'onde. Rien n'est réencodé : le fichier d'origine reste entier, et la découpe se corrige ou s'annule à tout moment, y compris des mois après la publication.

Attention : remplacer le fichier audio annule la découpe. C'est voulu — les bornes portaient sur l'ancien fichier.`,
  },

  {
    title: "L'application Android",
    category: "Compte",
    excerpt: "Installer Moziik sur son téléphone.",
    body: `${A_COMPLETER} Cet article demande votre décision avant d'être publié.

Le site fonctionne dans le navigateur d'un téléphone, et peut y être installé comme une application : depuis le menu du navigateur, « Ajouter à l'écran d'accueil ». L'icône se comporte alors comme une application, hors connexion compris.

Une application Android est par ailleurs préparée dans le projet, sous l'identifiant com.moziik.app.

Ce que je ne peux pas déduire du code, et qu'il faut trancher ici :
- l'application est-elle publiée sur le Play Store, et à quelle adresse ;
- si elle ne l'est pas, faut-il en parler du tout ;
- existe-t-il une version iOS.

Tant que ce n'est pas décidé, cet article ne doit pas être publié : annoncer une application introuvable coûte plus qu'un article manquant.`,
  },

  {
    title: "Podcasts",
    category: "Écoute & téléchargement",
    excerpt: "Où les trouver, et comment ils fonctionnent.",
    body: `Les podcasts se trouvent dans l'onglet dédié de votre bibliothèque.

Un podcast est publié comme une série d'épisodes. Il s'écoute, se télécharge et se partage exactement comme un album — la reprise de lecture, le hors connexion et le partage fonctionnent de la même façon.

${A_COMPLETER} Précisez si les podcasts sont ouverts à tous les artistes ou sur demande, et s'il existe une règle de durée ou de format.`,
  },
];

/* ------------------------------------------------------------ exécution -- */

await mongoose.connect(chargerUri(), { autoIndex: false });
const db = mongoose.connection.db;
const collection = db.collection("helparticles");

console.log(`Base « ${mongoose.connection.name} » — ${ESSAI ? "SIMULATION" : "ÉCRITURE"}\n`);

if (RETIRER) {
  const slugs = BROUILLONS.map((b) => slug(b.title));
  const cibles = await collection.find({ slug: { $in: slugs }, published: false }).toArray();
  console.log(`${cibles.length} brouillon(s) non publié(s) à retirer.`);
  for (const c of cibles) console.log(`  ${ESSAI ? "·" : "ok"} ${c.title}`);
  if (!ESSAI && cibles.length > 0) {
    await collection.deleteMany({ slug: { $in: cibles.map((c) => c.slug) }, published: false });
  }
  // Les articles publiés ne sont jamais touchés : une fois relu et publié,
  // un texte appartient à l'exploitant, pas à ce script.
  console.log("\nLes articles publiés n'ont pas été touchés.");
  await mongoose.disconnect();
  process.exit(0);
}

let crees = 0;
let ignores = 0;

for (const brouillon of BROUILLONS) {
  const identifiant = slug(brouillon.title);
  const existant = await collection.findOne({ slug: identifiant });

  if (existant) {
    ignores++;
    console.log(`  · ${brouillon.title} — existe déjà (${existant.published ? "publié" : "brouillon"}), inchangé`);
    continue;
  }

  if (!ESSAI) {
    await collection.insertOne({
      title: brouillon.title,
      slug: identifiant,
      category: brouillon.category,
      excerpt: brouillon.excerpt,
      body: brouillon.body,
      published: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  crees++;
  const aRelire = brouillon.body.includes(A_COMPLETER);
  console.log(`  ${ESSAI ? "·" : "ok"} ${brouillon.title}${aRelire ? "   ← contient un passage à compléter" : ""}`);
}

console.log(`\n${crees} brouillon(s) ${ESSAI ? "à déposer" : "déposés"}, ${ignores} déjà présent(s).`);
console.log("Aucun n'est publié. Relisez-les dans /admin/aide, corrigez, puis publiez ce qui vous convient.");
console.log(`${BROUILLONS.filter((b) => b.body.includes(A_COMPLETER)).length} contiennent un passage « À COMPLÉTER » qui demande une décision de votre part.`);

await mongoose.disconnect();
process.exit(0);
