import { normaliser } from "@/lib/searchText";

/**
 * Les mots que le public emploie, et ceux que le centre d'aide emploie.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * La recherche d'articles compte les mots communs entre la question et
 * l'article. Elle est donc aveugle dès que les deux ne se disent pas
 * pareil : quelqu'un qui écrit « fandoavana » ne trouvera jamais
 * l'article « Moyens de paiement acceptés », et « je n'arrive pas à me
 * connecter » ne trouvera pas « Mot de passe oublié ». Ce ne sont pas des
 * cas tordus : c'est la moitié des questions réelles sur une plateforme
 * où l'on écrit en malgache, en français et en anglais dans la même
 * phrase.
 *
 * POURQUOI PAS DES VECTEURS
 *
 * Une recherche sémantique réglerait cela, et bien plus. Elle demande un
 * modèle d'embeddings, un stockage des vecteurs et un recalcul à chaque
 * modification d'article — pour un corpus qui tient aujourd'hui en une
 * page. Cette table coûte cent fois moins et couvre l'essentiel du
 * besoin. Le jour où le centre d'aide dépassera la centaine d'articles,
 * elle deviendra le mauvais outil, et il faudra en changer.
 *
 * COMMENT ELLE EST ÉCRITE
 *
 * Chaque ligne regroupe des mots interchangeables *pour la recherche*.
 * L'appartenance est symétrique : peu importe lequel apparaît dans la
 * question et lequel dans l'article. Les mots sont écrits sans accent ni
 * majuscule, comme les produit `normaliser`.
 *
 * Ce n'est pas un dictionnaire : « mpanakanto » et « artiste » ne sont
 * pas synonymes en malgache courant, ils le sont pour retrouver le bon
 * article. C'est le seul critère.
 */

const FAMILLES: string[][] = [
  // --- Compte et connexion
  ["compte", "kaonty", "profil", "account"],
  ["connexion", "connecter", "identifier", "login", "hiditra", "miditra"],
  ["deconnexion", "deconnecter", "logout", "hivoaka"],
  ["motdepasse", "mot de passe", "password", "tenimiafina", "passe"],
  ["email", "mail", "adresse", "courriel", "mailaka"],
  ["inscription", "inscrire", "creer", "hisoratra", "misoratra", "register"],
  ["supprimer", "effacer", "fafana", "mamafa", "delete", "resilier", "cloturer"],
  ["modifier", "changer", "editer", "manova", "ovaina", "update"],

  // --- Argent
  ["paiement", "payer", "paye", "fandoavana", "mandoa", "payment", "reglement"],
  ["abonnement", "premium", "souscription", "subscription", "famandrihana"],
  ["prix", "tarif", "cout", "combien", "vidiny", "ohatrinona", "price"],
  ["gratuit", "maimaimpoana", "free"],
  ["remboursement", "rembourser", "refund", "averina"],
  ["mvola", "mobile money", "orange money", "airtel money", "telephone"],
  ["carte", "visa", "mastercard", "bancaire", "stripe"],
  ["revenu", "remuneration", "royalties", "gain", "karama", "vola", "paye"],
  ["facture", "recu", "justificatif", "invoice"],

  // --- Écoute
  ["ecouter", "ecoute", "lecture", "jouer", "mihaino", "mandefa", "play", "listen"],
  ["telecharger", "telechargement", "download", "misintona", "hors ligne", "offline"],
  ["qualite", "bitrate", "debit", "son", "kalitao"],
  ["playlist", "liste", "selection", "lisitra"],
  ["radio", "station", "onjam-peo"],
  ["podcast", "episode", "emission"],
  ["parole", "paroles", "lyrics", "tononkira"],
  ["coupure", "coupe", "saccade", "saute", "bloque", "lent", "buffer", "tapaka"],

  // --- Espace artiste
  ["artiste", "chanteur", "musicien", "mpanakanto", "mpihira", "artist"],
  ["publier", "publication", "mettre en ligne", "envoyer", "upload", "mampiditra"],
  ["verifie", "verification", "certifie", "badge", "voamarina"],
  ["album", "disque", "ep", "single"],
  ["titre", "morceau", "chanson", "musique", "son", "hira", "track", "song"],
  ["statistique", "stats", "chiffres", "audience", "ecoutes"],

  // --- Contenu et modération
  ["signaler", "signalement", "plainte", "abus", "report", "mitoroka"],
  ["droit", "droits", "copyright", "auteur", "zo"],
  ["evenement", "concert", "spectacle", "hetsika", "event"],

  // --- Application
  ["application", "appli", "android", "mobile", "telephone", "app", "installer"],
  ["notification", "alerte", "fampandrenesana"],
  ["message", "messagerie", "discussion", "chat", "hafatra"],

  // --- Données personnelles
  ["donnees", "personnelles", "confidentialite", "vie privee", "rgpd", "privacy"],
  ["securite", "pirate", "vol", "suspect", "fiarovana"],
];

/**
 * Index inversé : un mot vers tous ceux de sa famille.
 *
 * Construit une fois au chargement du module. Le reconstruire à chaque
 * question ferait quarante boucles pour un résultat identique.
 */
const INDEX = new Map<string, string[]>();
for (const famille of FAMILLES) {
  const normalisee = famille.map((m) => normaliser(m));
  for (const mot of normalisee) {
    const deja = INDEX.get(mot);
    if (deja) deja.push(...normalisee.filter((x) => x !== mot));
    else INDEX.set(mot, normalisee.filter((x) => x !== mot));
  }
}

/**
 * Étend une liste de mots avec leurs équivalents connus.
 *
 * Les mots d'origine restent en tête : ils pèsent autant que les autres
 * dans le comptage, mais leur présence garantit qu'une question déjà
 * bien formulée ne soit pas noyée par ses propres synonymes.
 *
 * Un mot composé de la table (« mot de passe », « hors ligne ») ne peut
 * pas être retrouvé mot à mot ; il est cherché dans la phrase entière,
 * avant découpage.
 */
export function etendre(mots: string[], phrase?: string): string[] {
  const sortie = new Set(mots);

  for (const mot of mots) {
    for (const equivalent of INDEX.get(mot) ?? []) sortie.add(equivalent);
  }

  if (phrase) {
    const texte = normaliser(phrase);
    for (const [cle, equivalents] of INDEX) {
      if (!cle.includes(" ")) continue;
      if (texte.includes(cle)) {
        sortie.add(cle);
        for (const e of equivalents) sortie.add(e);
      }
    }
  }

  // Les mots d'une lettre ou deux issus de l'expansion ne discriminent
  // rien et feraient remonter n'importe quel article.
  return [...sortie].filter((m) => m.length >= 3);
}

/** Nombre de familles couvertes — affiché en administration. */
export const NOMBRE_FAMILLES = FAMILLES.length;
