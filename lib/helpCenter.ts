/**
 * Centre d'aide : catégories, contenu de départ et petits utilitaires.
 *
 * Les articles vivent en base et s'éditent dans /admin/aide. Ce fichier ne
 * porte que ce qui doit exister avant qu'un seul article n'ait été écrit :
 * la liste des catégories proposées, et un jeu d'articles de départ que
 * l'administration installe d'un clic. Rien n'est écrit en base sans cette
 * action explicite.
 */

export const CATEGORIES_AIDE = [
  "Compte",
  "Abonnement & paiement",
  "Écoute & téléchargement",
  "Espace artiste",
  "Confidentialité & sécurité",
];

/** Identifiant d'URL : sans accents, sans ponctuation, borné. */
export function slugAide(titre: string): string {
  return (
    titre
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 70) || "article"
  );
}

/** Résumé de repli : la première phrase du corps, coupée proprement. */
export function resumeAuto(corps: string, limite = 160): string {
  const plat = corps.replace(/\s+/g, " ").trim();
  if (plat.length <= limite) return plat;
  const coupe = plat.slice(0, limite);
  const dernierEspace = coupe.lastIndexOf(" ");
  return (dernierEspace > 40 ? coupe.slice(0, dernierEspace) : coupe).trimEnd() + "…";
}

export type ArticleDepart = {
  title: string;
  category: string;
  excerpt: string;
  body: string;
};

/**
 * Contenu de départ, repris et développé à partir de la FAQ qui vivait en
 * dur dans la page de contact. L'administration peut tout réécrire ensuite
 * — ce n'est qu'un point de départ pour que le centre d'aide ne s'ouvre
 * pas sur une page vide.
 */
export const ARTICLES_DEPART: ArticleDepart[] = [
  {
    title: "Créer un compte",
    category: "Compte",
    excerpt: "Inscription, confirmation de l'adresse email et première connexion.",
    body: `Depuis la page de connexion, cliquez sur « S'inscrire », renseignez votre adresse email et un mot de passe.

Un email de confirmation vous est envoyé immédiatement. Ouvrez-le et cliquez sur le lien qu'il contient : tant que l'adresse n'est pas confirmée, certaines fonctions restent inaccessibles.

Vous ne trouvez pas l'email ? Regardez dans les courriers indésirables, puis utilisez « Renvoyer l'email de vérification » depuis la page de connexion.`,
  },
  {
    title: "Changer mon adresse email",
    category: "Compte",
    excerpt: "La modification passe par une confirmation sur la nouvelle adresse.",
    body: `Rendez-vous dans « Mon compte », puis « Modifier le profil ».

Après validation, un email de confirmation part vers la nouvelle adresse. L'ancienne reste active tant que le changement n'est pas confirmé : si vous perdez l'accès à la nouvelle boîte, rien n'est perdu.`,
  },
  {
    title: "Mot de passe oublié",
    category: "Compte",
    excerpt: "Réinitialisation par email, valable une heure.",
    body: `Sur la page de connexion, cliquez sur « Mot de passe oublié ». Indiquez l'adresse de votre compte.

Si un compte existe avec cette adresse, vous recevez un lien de réinitialisation valable une heure. Passé ce délai, refaites la demande.

Pour votre sécurité, le message affiché est le même que l'adresse existe ou non : cela évite qu'un tiers puisse deviner quels comptes existent.`,
  },
  {
    title: "Moyens de paiement acceptés",
    category: "Abonnement & paiement",
    excerpt: "Carte bancaire à l'international, Mobile Money à Madagascar.",
    body: `Deux moyens de paiement sont acceptés :

— La carte bancaire, via Stripe, pour les paiements internationaux.
— Le Mobile Money, pour les paiements locaux à Madagascar.

Le prix affiché s'adapte à votre région. Aucune donnée bancaire ne transite par nos serveurs : le paiement se fait chez l'opérateur.`,
  },
  {
    title: "Gérer ou annuler mon abonnement",
    category: "Abonnement & paiement",
    excerpt: "Résiliation à tout moment, sans perte d'accès immédiate.",
    body: `L'abonnement se gère depuis « Mon compte ».

Une résiliation prend effet à la fin de la période déjà réglée : vous conservez l'accès Premium jusqu'à cette date, sans reconduction ensuite.

Aucun remboursement partiel n'est fait sur une période entamée.`,
  },
  {
    title: "Télécharger une musique",
    category: "Écoute & téléchargement",
    excerpt: "Réservé aux membres Premium, écoutable ensuite sans connexion.",
    body: `Depuis la page d'un son ou d'un album, ouvrez le menu contextuel (les trois points) puis « Télécharger ». La fonction est réservée aux membres Premium.

Les titres téléchargés se retrouvent dans « Ma bibliothèque », onglet « Téléchargements », et restent écoutables sans connexion.

Ils sont stockés dans votre navigateur, sur cet appareil uniquement : un téléchargement fait sur téléphone n'apparaît pas sur ordinateur.`,
  },
  {
    title: "L'écoute s'arrête ou saute",
    category: "Écoute & téléchargement",
    excerpt: "Ce qu'il faut vérifier quand la lecture se coupe.",
    body: `Vérifiez d'abord votre connexion : en réseau instable, seuls les titres téléchargés continuent de jouer.

Réglez ensuite la qualité audio dans les paramètres du lecteur. Une qualité élevée demande un débit que toutes les connexions n'ont pas.

Si le problème persiste sur un titre précis, signalez-le depuis la page de contact en indiquant son nom : il peut s'agir d'un fichier défectueux à remplacer.`,
  },
  {
    title: "Devenir artiste vérifié",
    category: "Espace artiste",
    excerpt: "Demande depuis l'espace artiste, examinée sous quelques jours.",
    body: `Rendez-vous dans votre espace artiste, puis « Demander la vérification », et suivez les étapes indiquées.

Notre équipe examine chaque demande sous quelques jours. Un profil complet — photo, biographie, au moins un titre publié — accélère nettement l'examen.

Le badge vérifié atteste que le compte appartient bien à l'artiste. Il ne conditionne ni la mise en avant, ni la rémunération.`,
  },
  {
    title: "Publier un titre",
    category: "Espace artiste",
    excerpt: "Fichier audio, pochette, métadonnées et validation.",
    body: `Depuis votre espace artiste, choisissez « Publier un titre ».

Déposez le fichier audio : les informations écrites dans ses balises (titre, artiste, album, genre, année, paroles) remplissent automatiquement le formulaire. Vous pouvez tout corriger avant d'envoyer.

Ajoutez une pochette carrée, d'au moins 1000 × 1000 pixels.

Un titre envoyé par un artiste passe en validation avant d'être publié. Vous êtes notifié dès qu'il est en ligne.`,
  },
  {
    title: "Comment la rémunération est calculée",
    category: "Espace artiste",
    excerpt: "Par écoute complète, au taux affiché dans votre espace revenus.",
    body: `La rémunération se compte à l'écoute complète : une écoute interrompue au bout de quelques secondes n'est pas comptabilisée.

Le taux appliqué est visible dans votre espace « Revenus », qui détaille aussi vos écoutes par titre et par période.

Les montants sont consolidés à intervalle régulier : un chiffre du jour même peut encore bouger.`,
  },
  {
    title: "Signaler un contenu",
    category: "Confidentialité & sécurité",
    excerpt: "Contenu illicite, atteinte au droit d'auteur, commentaire abusif.",
    body: `Utilisez le formulaire de contact en choisissant le sujet « Signalement de contenu ».

Indiquez le lien exact du contenu concerné et la raison du signalement. Pour une atteinte au droit d'auteur, précisez le titre revendiqué et à quel titre vous agissez.

Chaque signalement est examiné. Les contenus manifestement illicites sont retirés sans attendre.`,
  },
  {
    title: "Mes données personnelles",
    category: "Confidentialité & sécurité",
    excerpt: "Ce qui est conservé, et comment demander une suppression.",
    body: `Nous conservons votre adresse email, vos informations de profil, votre historique d'écoute et vos préférences — ce qui est nécessaire au fonctionnement du service.

Vos écoutes servent à établir vos recommandations et à calculer la rémunération des artistes.

Pour demander l'export ou la suppression de vos données, écrivez-nous depuis la page de contact. Une suppression de compte est définitive et entraîne la perte de vos playlists et de vos favoris.`,
  },
];
