import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Artist from "@/models/Artist";
import Song from "@/models/Song";
import Subscription from "@/models/Subscription";
import { getSiteConfig } from "@/lib/siteConfig";
import { hasPremiumAccess } from "@/lib/premium";
import { ECOUTES_ANONYMES_PAR_DEFAUT } from "@/lib/acces";
import { UNIVERS_INFO } from "@/lib/univers";

/**
 * Ce que l'assistant a le droit de savoir du site, et de la personne.
 *
 * DEUX SOURCES QUI NE SE VALENT PAS
 *
 * Les FAITS DU SITE — prix, devise, taux de rémunération, limite d'écoute
 * — sont des réglages, lus dans SiteConfig. Ils étaient jusqu'ici absents
 * du savoir de l'assistant : il ne pouvait les connaître que si un
 * article les répétait, et cet article se serait désynchronisé au premier
 * changement de tarif. Les lire à la source rend la réponse exacte par
 * construction.
 *
 * Le CONTEXTE DU COMPTE — abonnement, rôle, catalogue publié — est une
 * donnée personnelle. Il transforme la catégorie de questions la plus
 * fréquente : « pourquoi je ne peux pas télécharger ? » a une réponse
 * dans le compte, et l'assistant passait la main faute de la voir.
 *
 * CE QUI N'EN FAIT JAMAIS PARTIE
 *
 * Rien qui puisse nuire s'il était répété à voix haute, recopié dans une
 * réponse, ou lu par-dessus l'épaule : ni adresse email, ni téléphone, ni
 * montant payé, ni moyen de paiement, ni identifiant de transaction, ni
 * historique d'écoute. La règle n'est pas « ce dont l'assistant pourrait
 * avoir besoin » mais « ce qu'on accepterait de voir affiché en clair
 * dans le fil ».
 *
 * Et jamais rien sur QUELQU'UN D'AUTRE. Le contexte est celui de la
 * personne qui écrit, lu depuis sa session — pas depuis un identifiant
 * qu'elle aurait fourni.
 */

/* ----------------------------------------------------------- le site -- */

/**
 * Les faits du site, mis en forme pour le message système.
 *
 * Tout est tiré de la configuration vivante. Un champ vide est omis
 * plutôt que rendu avec une valeur de repli : mieux vaut que l'assistant
 * ignore le prix annuel que d'annoncer zéro.
 */
export async function faitsDuSite(): Promise<string> {
  const config = await getSiteConfig();

  const prix = (plan: "premium" | "premium_annual") => {
    const ligne = config.plans?.find((p) => p.plan === plan);
    if (!ligne) return null;
    const morceaux: string[] = [];
    if (ligne.amountUSD > 0) morceaux.push(`${ligne.amountUSD} USD`);
    if (ligne.amountMGA > 0) morceaux.push(`${ligne.amountMGA.toLocaleString("fr-FR")} MGA`);
    return morceaux.length ? morceaux.join(" / ") : null;
  };

  const mensuel = prix("premium");
  const annuel = prix("premium_annual");
  const limite = config.anonymousDailyPlays ?? ECOUTES_ANONYMES_PAR_DEFAUT;

  const lignes = [
    `Nom du site : ${config.siteName}`,
    config.tagline ? `Accroche : ${config.tagline}` : null,
    config.supportEmail ? `Adresse de contact : ${config.supportEmail}` : null,
    `Devise d'affichage : ${config.currency}`,
    `Fuseau horaire de référence : ${config.timezone}`,
    mensuel ? `Abonnement Premium mensuel : ${mensuel}` : null,
    annuel ? `Abonnement Premium annuel : ${annuel}` : null,
    config.trialDays > 0 ? `Essai gratuit : ${config.trialDays} jours` : "Aucun essai gratuit.",
    limite > 0
      ? `Visiteur sans compte : ${limite} titres différents par jour, puis inscription demandée.`
      : "Visiteur sans compte : écoute non limitée.",
    "Compte gratuit connecté : écoute en 128 kb/s maximum, pas de téléchargement hors ligne.",
    "Compte Premium : écoute en 320 kb/s et téléchargement hors ligne.",
    config.payPerListenRateUSD > 0
      ? `Rémunération de l'artiste : ${config.payPerListenRateUSD} USD par écoute complète.`
      : null,
    `Deux univers séparés : ${UNIVERS_INFO.general.label} et ${UNIVERS_INFO.christian.label}. Chacun a ses artistes, ses recommandations et ses playlists.`,
    config.genres?.length ? `Genres proposés à la publication : ${config.genres.join(", ")}.` : null,
  ].filter(Boolean);

  return lignes.join("\n");
}

/* --------------------------------------------------------- le compte -- */

export type ContexteCompte = {
  nom: string;
  role: "member" | "artist" | "admin";
  premium: boolean;
  /** Fin de la période en cours, quand elle est connue. */
  finAbonnement?: string;
  /** « stripe », « mobile_money » ou « offert » — le moyen, jamais les identifiants. */
  moyenAbonnement?: string;
  statutAbonnement?: string;
  /** Artistes seulement. */
  nomDeScene?: string;
  verifie?: boolean;
  titresPublies?: number;
  titresEnAttente?: number;
};

/**
 * Ce que le site sait de la personne qui écrit, réduit à l'utile.
 *
 * `null` pour un visiteur non connecté : l'assistant répondra alors avec
 * les seuls faits généraux, ce qui est exactement ce qu'il faut.
 */
export async function contexteDuCompte(userId?: string | null): Promise<ContexteCompte | null> {
  if (!userId) return null;
  await connectDB();

  const compte = await User.findById(userId).select("name role").lean();
  if (!compte) return null;

  const abonnement = await Subscription.findOne({ user: userId })
    .sort({ startedAt: -1 })
    .select("status paymentMethod currentPeriodEnd")
    .lean();

  const contexte: ContexteCompte = {
    nom: compte.name ?? "",
    role: (compte.role as ContexteCompte["role"]) ?? "member",
    premium: hasPremiumAccess({ role: compte.role, subscription: abonnement }),
    ...(abonnement?.status ? { statutAbonnement: abonnement.status } : {}),
    ...(abonnement?.paymentMethod ? { moyenAbonnement: abonnement.paymentMethod } : {}),
    ...(abonnement?.currentPeriodEnd
      ? {
          finAbonnement: new Date(abonnement.currentPeriodEnd).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        }
      : {}),
  };

  if (contexte.role === "artist") {
    const artiste = await Artist.findOne({ user: userId }).select("stageName verified").lean();
    if (artiste) {
      contexte.nomDeScene = artiste.stageName;
      contexte.verifie = Boolean(artiste.verified);
      const [publies, attente] = await Promise.all([
        Song.countDocuments({ artist: artiste._id, status: "published" }),
        Song.countDocuments({ artist: artiste._id, status: { $in: ["draft", "scheduled"] } }),
      ]);
      contexte.titresPublies = publies;
      contexte.titresEnAttente = attente;
    }
  }

  return contexte;
}

/**
 * Le contexte, mis en forme pour le message système.
 *
 * L'entête compte autant que les lignes : elle dit au modèle que ces
 * faits servent à répondre juste, pas à être récités. Sans elle, un
 * modèle serviable commence sa réponse par « Bonjour Hery, votre
 * abonnement Premium se termine le 4 octobre » à une question sur les
 * paroles d'une chanson.
 */
export function contexteEnTexte(contexte: ContexteCompte | null): string {
  if (!contexte) {
    return "LA PERSONNE N'EST PAS CONNECTÉE.\nTu ne sais rien d'elle. Pour toute question qui dépend de son compte, demande-lui de se connecter.";
  }

  const lignes = [
    `Prénom ou nom affiché : ${contexte.nom}`,
    `Type de compte : ${
      contexte.role === "admin"
        ? "administrateur du site"
        : contexte.role === "artist"
          ? "artiste"
          : "membre"
    }`,
    contexte.premium ? "Abonnement Premium : ACTIF" : "Abonnement Premium : AUCUN (compte gratuit)",
    contexte.statutAbonnement ? `Statut de l'abonnement : ${contexte.statutAbonnement}` : null,
    contexte.finAbonnement ? `Période en cours jusqu'au : ${contexte.finAbonnement}` : null,
    contexte.moyenAbonnement ? `Souscrit via : ${contexte.moyenAbonnement}` : null,
    contexte.nomDeScene ? `Nom de scène : ${contexte.nomDeScene}` : null,
    contexte.verifie === undefined
      ? null
      : contexte.verifie
        ? "Artiste vérifié : oui"
        : "Artiste vérifié : non",
    contexte.titresPublies === undefined ? null : `Titres publiés : ${contexte.titresPublies}`,
    contexte.titresEnAttente ? `Titres en brouillon ou programmés : ${contexte.titresEnAttente}` : null,
  ].filter(Boolean);

  return [
    "CE QUE TU SAIS DE LA PERSONNE QUI T'ÉCRIT",
    "",
    "Ces faits viennent de son compte. Ils servent à répondre juste — pas à être récités : ne les énumère pas, n'en cite un que s'il explique ta réponse.",
    "Tu ne sais rien de plus : ni son adresse, ni ses paiements, ni ce qu'elle écoute. Pour tout le reste, l'équipe prend le relais.",
    "",
    ...lignes,
  ].join("\n");
}
