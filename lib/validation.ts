import { z } from "zod";
import { ApiError } from "@/lib/apiError";
import { IDS_RESEAUX, urlSocialeValide } from "@/lib/socialPlatforms";
import { IDS_FONCTIONNALITES_IA } from "@/lib/ai/features";
import { IDS_RECETTES } from "@/lib/curation/labels";

/**
 * Valide `data` contre `schema` et lève une ApiError 400 lisible en cas
 * d'échec, plutôt que de laisser remonter une erreur Zod brute (ou pire,
 * de laisser passer des données non validées comme c'était le cas avant).
 */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new ApiError(firstIssue ? firstIssue.message : "Données invalides.", 400);
  }
  return result.data;
}

// ---- Auth ----------------------------------------------------------------

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(80),
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(254),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(200),
});

export const mobileLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(254),
  password: z.string().min(1, "Mot de passe requis."),
  device: z.string().trim().max(120).optional(),
});

export const mobileRefreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token requis."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(254),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requis."),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(200),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token requis."),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(254),
});

// ---- Contact ---------------------------------------------------------------

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(120),
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(254),
  subject: z.string().trim().max(150).optional(),
  message: z.string().trim().min(1, "Le message est requis.").max(5000),
  attachmentUrl: z.string().trim().url("Lien de pièce jointe invalide.").max(500).optional().or(z.literal("")),
});

// ---- Songs -----------------------------------------------------------------

export const createSongSchema = z.object({
  title: z.string().trim().min(1, "Titre requis.").max(200),
  audioUrl: z.string().url("URL audio invalide."),
  coverUrl: z.string().url("URL de pochette invalide."),
  // Message orienté action : la durée n'est pas saisie à la main, elle
  // vient de Cloudinary ou, à défaut, des métadonnées lues par le
  // navigateur. Quand les deux échouent, le formulaire envoie 0 et
  // « Durée invalide » ne disait pas quoi faire.
  duration: z.number().positive("Durée du fichier audio introuvable — relance l'envoi du fichier."),
  genre: z.string().trim().min(1, "Genre requis.").max(60),
  albumId: z.string().optional(),
  releaseDate: z.coerce.date(),
  explicit: z.boolean().optional().default(false),
  lyrics: z.string().max(20000).optional(),
  featuringIds: z.array(z.string()).optional().default([]),
  artistId: z.string().optional(),
  // Mêmes champs optionnels que la modification (PATCH /api/songs/[id]),
  // pour que la page de publication offre la même richesse que l'édition.
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  language: z.string().optional(),
  composer: z.string().optional(),
  producer: z.string().optional(),
  bpm: z.number().optional(),
  musicalKey: z.string().optional(),
  isrc: z.string().optional(),
  copyright: z.string().optional(),
  // Un admin peut forcer l'enregistrement en brouillon plutôt que de
  // publier/planifier immédiatement (symétrique avec PATCH, qui l'autorise
  // déjà). Ignoré pour un artiste : sa soumission est toujours un brouillon
  // en attente de validation, quel que soit ce champ.
  saveAsDraft: z.boolean().optional().default(false),
});

export const songPlaySchema = z.object({
  secondsListened: z.number().min(0).max(6 * 60 * 60).optional().default(0),
  completed: z.boolean().optional().default(false),
  device: z.enum(["mobile", "desktop", "pwa"]).optional(),
});

// ---- Admin -----------------------------------------------------------------

export const adminUserPatchSchema = z.object({
  role: z.enum(["member", "artist", "admin"]).optional(),
  verifiedArtist: z.boolean().optional(),
  suspended: z.boolean().optional(),
  badges: z.array(z.string()).optional(),
});

// ---- Homepage hub cards ("Pour vous") --------------------------------------

export const hubCardSchema = z.object({
  title: z.string().trim().min(1, "Titre requis.").max(60),
  subtitle: z.string().trim().max(140).optional(),
  badge: z.string().trim().max(10).optional(),
  coverUrl: z.string().url("URL de pochette invalide.").optional().or(z.literal("")),
  linkHref: z.string().trim().min(1, "Lien requis.").max(300),
  enabled: z.boolean().optional().default(true),
});

export const hubCardPatchSchema = hubCardSchema.partial();

export const hubCardsReorderSchema = z.object({
  order: z.array(z.object({ id: z.string(), position: z.number().int().min(0) })),
});

// ---- Contenu épinglé (hero et autres sections en mode manuel) --------------

const pinnedBaseFields = {
  section: z.string().trim().min(1, "Section requise."),
  priority: z.coerce.number().int().optional().default(0),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
};

export const pinnedContentSchema = z.discriminatedUnion("contentType", [
  z.object({
    contentType: z.enum(["song", "album", "artist", "playlist", "event"]),
    contentId: z.string().min(1, "Contenu requis."),
    ...pinnedBaseFields,
  }),
  z.object({
    contentType: z.literal("custom"),
    customTitle: z.string().trim().min(1, "Titre requis.").max(80),
    customSubtitle: z.string().trim().max(160).optional(),
    customCoverUrl: z.string().url("URL de pochette invalide.").optional().or(z.literal("")),
    customHref: z.string().trim().min(1, "Lien requis.").max(300),
    ...pinnedBaseFields,
  }),
]);

export const contentSearchQuerySchema = z.object({
  type: z.enum(["song", "album", "artist", "playlist", "event"]),
  q: z.string().trim().max(100).optional().default(""),
});

// ---- Albums ------------------------------------------------------------------

export const createAlbumSchema = z.object({
  title: z.string().trim().min(1, "Titre requis.").max(200),
  coverUrl: z.string().url("URL de pochette invalide."),
  type: z.enum(["album", "ep", "single"]).optional().default("album"),
  releaseDate: z.coerce.date(),
});

export const patchAlbumSchema = z.object({
  title: z.string().trim().min(1, "Titre requis.").max(200).optional(),
  coverUrl: z.string().url("URL de pochette invalide.").optional(),
  bannerUrl: z.string().url("URL de bannière invalide.").optional().or(z.literal("")),
  description: z.string().max(2000).optional(),
  type: z.enum(["album", "ep", "single"]).optional(),
  releaseDate: z.coerce.date().optional(),
  songs: z.array(z.string()).max(500).optional(),
});

// ---- Profil artiste (mon espace) --------------------------------------------

export const patchArtistMeSchema = z.object({
  bio: z.string().max(2000).optional(),
  coverUrl: z.string().url("URL de couverture invalide.").optional().or(z.literal("")),
  bannerUrl: z.string().url("URL de bannière invalide.").optional().or(z.literal("")),
  genres: z.array(z.string().trim().max(60)).max(10).optional(),
  socialLinks: z
    .array(z.object({ platform: z.string().trim().max(40), url: z.string().trim().max(300) }))
    .max(8)
    .optional(),
});

// ---- Badges ------------------------------------------------------------------

export const createBadgeSchema = z.object({
  key: z.string().trim().min(1, "Clé requise.").max(60),
  label: z.string().trim().min(1, "Libellé requis.").max(80),
  description: z.string().trim().min(1, "Description requise.").max(300),
  icon: z.string().trim().min(1, "Icône requise.").max(60),
  category: z.enum(["member", "artist", "achievement"]).optional().default("member"),
});

export const assignBadgeSchema = z.object({
  userId: z.string().min(1, "userId requis."),
  badgeKey: z.string().trim().min(1, "badgeKey requis.").max(60),
  badgeLabel: z.string().trim().max(80).optional(),
});

// ---- Évènements ---------------------------------------------------------------

export const createEventSchema = z.object({
  title: z.string().trim().min(1, "Titre requis.").max(200),
  description: z.string().trim().min(1, "Description requise.").max(5000),
  coverUrl: z.string().url("URL de pochette invalide.").optional().or(z.literal("")),
  location: z.string().trim().min(1, "Lieu requis.").max(200),
  date: z.coerce.date(),
  ticketUrl: z.string().trim().url("Lien de billetterie invalide.").max(500).optional().or(z.literal("")),
  price: z.number().min(0).optional(),
});

export const patchEventSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  coverUrl: z.string().url("URL de pochette invalide.").optional().or(z.literal("")),
  location: z.string().trim().min(1).max(200).optional(),
  date: z.coerce.date().optional(),
  ticketUrl: z.string().trim().url("Lien de billetterie invalide.").max(500).optional().or(z.literal("")),
  price: z.number().min(0).optional(),
  status: z.enum(["pending", "published", "rejected"]).optional(),
});

export const moderateDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"], { errorMap: () => ({ message: "Décision invalide." }) }),
});

// ---- Compte (mon profil) ------------------------------------------------------

export const patchMeProfileSchema = z.object({
  name: z.string().trim().min(1, "Le nom ne peut pas être vide.").max(80).optional(),
  avatarUrl: z.string().trim().url("URL d'avatar invalide.").max(500).optional(),
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(254).optional(),
});

export const toggleSavedAlbumSchema = z.object({
  albumId: z.string().min(1, "Album manquant."),
});

// ---- Notifications -------------------------------------------------------------

export const createNotificationSchema = z.object({
  recipient: z.string().min(1, "Destinataire requis."),
  type: z.enum(["new_song", "new_follower", "comment", "event", "payment", "system"]),
  title: z.string().trim().min(1, "Titre requis.").max(150),
  message: z.string().trim().min(1, "Message requis.").max(1000),
  link: z.string().trim().max(300).optional(),
});

// ---- Playlists ------------------------------------------------------------------

export const createPlaylistSchema = z.object({
  title: z.string().trim().min(1, "Le titre est requis.").max(150),
  description: z.string().max(1000).optional(),
  coverUrl: z.string().url("URL de pochette invalide.").optional().or(z.literal("")),
  isPublic: z.boolean().optional().default(false),
  // Creation avec son contenu, en une seule requete. Sans cela, une
  // playlist composee ailleurs (proposition de l'IA) demanderait deux
  // appels, et un echec entre les deux laisserait une playlist vide.
  songIds: z.array(z.string().min(1)).max(100).optional(),
});

export const patchPlaylistSchema = z.object({
  title: z.string().trim().min(1, "Le titre est requis.").max(150).optional(),
  description: z.string().max(1000).optional(),
  coverUrl: z.string().url("URL de pochette invalide.").optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  isPublic: z.boolean().optional(),
});

export const playlistSongSchema = z.object({
  songId: z.string().min(1, "songId requis."),
});

// Ajout et retrait acceptent un morceau seul ou un lot : la page playlist
// permet de cocher plusieurs titres puis de les traiter en une action.
// `songId` reste accepté pour ne pas casser les appels existants
// (menu contextuel, modale « Ajouter à une playlist », application mobile).
export const playlistSongsSchema = z
  .object({
    songId: z.string().min(1).optional(),
    songIds: z.array(z.string().min(1)).min(1).max(500).optional(),
  })
  .refine((data) => data.songId || data.songIds?.length, {
    message: "songId ou songIds requis.",
  });

// L'ordre de lecture est la position dans le tableau `songs` : le
// glisser-déposer renvoie donc la liste complète, réordonnée.
export const playlistReorderSchema = z.object({
  songIds: z.array(z.string().min(1)).max(1000),
});

// ---- Commentaires ---------------------------------------------------------------

export const createCommentSchema = z.object({
  text: z.string().trim().min(1, "Le commentaire ne peut pas être vide.").max(2000),
  timestampInSong: z.number().min(0).optional(),
  parentComment: z.string().optional(),
});

// ---- Featuring ------------------------------------------------------------------

export const featuringDecisionSchema = z.object({
  decision: z.enum(["confirm", "remove"], { errorMap: () => ({ message: "Décision invalide." }) }),
});

// ---- Modification d'un son (PATCH /api/songs/[id]) -------------------------------

export const patchSongSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  coverUrl: z.string().url("URL de pochette invalide.").optional(),
  audioUrl: z.string().url("URL audio invalide.").optional(),
  // `min(0)` et non `positive()` : la page de modification renvoie la
  // durée déjà en base quand on ne remplace pas le fichier audio. Or
  // Cloudinary ne renvoie pas toujours `duration` à l'upload, donc des
  // titres existent avec `duration: 0` — les refuser ici rendrait ces
  // titres définitivement non modifiables. Idem pour bpm, aligné sur
  // createSongSchema qui ne contraint pas le signe non plus.
  duration: z.number().min(0).optional(),
  genre: z.string().trim().min(1).max(60).optional(),
  lyrics: z.string().max(20000).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(40)).max(30).optional(),
  language: z.string().max(40).optional(),
  composer: z.string().max(200).optional(),
  producer: z.string().max(200).optional(),
  bpm: z.number().min(0).optional(),
  musicalKey: z.string().max(20).optional(),
  isrc: z.string().max(20).optional(),
  copyright: z.string().max(300).optional(),
  explicit: z.boolean().optional(),
  releaseDate: z.coerce.date().optional(),
  status: z.enum(["draft", "scheduled", "published", "rejected"]).optional(),
  albumId: z.string().optional().or(z.literal("")),
  featuringIds: z.array(z.string()).max(20).optional(),
  artistId: z.string().optional(),
});

// ---- Abonnements -------------------------------------------------------------

export const checkoutSchema = z.object({
  plan: z.enum(["premium", "premium_annual"], { errorMap: () => ({ message: "Plan invalide." }) }),
});

export const mobileMoneySchema = z.object({
  plan: z.enum(["premium", "premium_annual"], { errorMap: () => ({ message: "Plan invalide." }) }),
  phoneNumber: z.string().trim().min(6, "Numéro de téléphone requis.").max(20),
});

// ---- Admin : artistes / homepage / site-config ---------------------------------

export const adminArtistPatchSchema = z.object({
  eventPublishingAuthorized: z.boolean().optional(),
  monetizationEnabled: z.boolean().optional(),
});

export const adminHomepageSettingsSchema = z.object({
  heroMode: z.enum(["auto", "manual"]).optional(),
  theme: z.string().max(60).optional(),
  recommendationMode: z.enum(["auto", "manual"]).optional(),
});

export const adminHomepageSectionPatchSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
  mode: z.enum(["auto", "manual"]).optional(),
  limit: z.number().int().positive().max(100).optional(),
  filters: z
    .object({
      publicOnly: z.boolean().optional(),
      verifiedOnly: z.boolean().optional(),
      premiumOnly: z.boolean().optional(),
    })
    .optional(),
});

export const adminHomepageSectionReorderSchema = z.object({
  order: z.array(z.object({ id: z.string(), position: z.number().int().min(0) })),
});

export const adminHomepageSectionCreateSchema = z.object({
  title: z.string().trim().min(1, "Le titre de la section est obligatoire.").max(80),
  limit: z.number().int().positive().max(100).optional(),
  // Groupe de pages destinataire ; absent = accueil.
  page: z.enum(["home", "discover", "radio", "library", "detail"]).optional(),
});

// Chat de support. Corps en texte brut, borne : un message est ecrit par
// un inconnu et s affiche dans le navigateur de l equipe.
export const supportMessageSchema = z.object({
  body: z.string().trim().min(1, "Le message est vide.").max(4000),
});

export const supportThreadPatchSchema = z.object({
  status: z.enum(["open", "closed"]),
});

// Centre d aide. Le corps est du texte brut : il est rendu paragraphe par
// paragraphe, jamais interprete comme du HTML, pour qu un article redige en
// administration ne puisse pas injecter de balise sur une page publique.
export const helpArticleCreateSchema = z.object({
  title: z.string().trim().min(3, "Le titre est requis.").max(160),
  category: z.string().trim().min(1, "La categorie est requise.").max(60),
  excerpt: z.string().trim().max(300).optional(),
  body: z.string().trim().min(10, "Le contenu est requis.").max(20000),
  position: z.number().int().min(0).max(999).optional(),
  published: z.boolean().optional(),
});

export const helpArticlePatchSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  excerpt: z.string().trim().max(300).optional(),
  body: z.string().trim().min(10).max(20000).optional(),
  position: z.number().int().min(0).max(999).optional(),
  published: z.boolean().optional(),
});

/**
 * Un thème, tel qu'il arrive d'un formulaire — celui de l'administration
 * comme celui d'un membre Premium. Les couleurs sont vérifiées ici, à
 * l'entrée : une valeur qui n'est pas un hexadécimal se retrouverait
 * injectée telle quelle dans une variable CSS.
 */
const COULEUR_HEX = /^#[0-9a-fA-F]{6}$/;
const couleurHex = z
  .string()
  .trim()
  .regex(COULEUR_HEX, "Couleur invalide : attendu un hexadécimal comme #FF6B4A.");

export const themePreferenceSchema = z.object({
  preset: z.string().trim().min(1).max(40),
  mode: z.enum(["dark", "light", "system"]),
  accent: couleurHex,
  backgroundDark: couleurHex,
  backgroundLight: couleurHex,
  secondary: couleurHex,
  warning: couleurHex,
  radius: z.number().int().min(0).max(24),
});

/**
 * Création d un compte depuis l administration. Le mot de passe est
 * facultatif : sans lui, le serveur en tire un provisoire et le renvoie une
 * seule fois. Le minimum de huit caractères vaut ici comme à l inscription —
 * un compte créé par l équipe n est pas moins exposé.
 */
export const adminUserCreateSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit faire au moins 2 caractères.").max(80),
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(254),
  role: z.enum(["member", "artist", "admin"]),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères.").max(200).optional(),
});

export const adminSiteConfigPatchSchema = z.object({
  siteName: z.string().trim().min(1).max(80).optional(),
  tagline: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  // Une adresse de site sert à fabriquer des liens absolus : un protocole
  // exotique s'y retrouverait tel quel dans les partages et le sitemap.
  siteUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https?:\/\//.test(v), "L'adresse doit commencer par http:// ou https://.")
    .optional(),
  defaultLanguage: z.string().trim().max(10).optional(),
  currency: z.string().trim().max(10).optional(),
  timezone: z.string().trim().max(60).optional(),
  dateFormat: z.string().trim().max(20).optional(),
  logoUrl: z.string().max(500).optional(),
  logoDarkUrl: z.string().max(500).optional(),
  faviconUrl: z.string().max(500).optional(),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(400).optional(),
  googleAnalyticsId: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v === "" || /^(G-[A-Z0-9]{4,}|UA-\d{4,}-\d+)$/i.test(v), "Identifiant attendu au format G-XXXXXXXXXX.")
    .optional(),
  googleSearchConsoleId: z.string().trim().max(120).optional(),
  trialDays: z.number().int().min(0).max(365).optional(),
  supportEmail: z.string().trim().email("Adresse email invalide.").max(254).optional().or(z.literal("")),
  copyrightText: z.string().max(300).optional(),
  plans: z
    .array(
      z.object({
        plan: z.enum(["premium", "premium_annual"]),
        amountUSD: z.number().min(0),
        amountMGA: z.number().min(0),
      })
    )
    .optional(),
  genres: z.array(z.string().trim().max(60)).max(60).optional(),
  payPerListenRateUSD: z.number().min(0).optional(),
  theme: themePreferenceSchema.optional(),
  legalEntityName: z.string().max(200).optional(),
  legalCapital: z.string().max(60).optional(),
  legalRcsCity: z.string().max(100).optional(),
  legalRcsNumber: z.string().max(60).optional(),
  legalAddress: z.string().max(300).optional(),
  legalWebsite: z.string().max(200).optional(),
  legalUpdatedAt: z.coerce.date().optional(),
  // Le protocole est verrouille cote schema : une URL `javascript:` saisie
  // en administration deviendrait sinon un lien executable pour tous les
  // visiteurs.
  socialLinks: z
    .array(
      z.object({
        platform: z.enum(IDS_RESEAUX),
        url: z
          .string()
          .trim()
          .max(300)
          .refine(urlSocialeValide, "Le lien doit commencer par http:// ou https://."),
      })
    )
    .max(IDS_RESEAUX.length)
    .optional(),
});

// Import groupé de l'administration : le navigateur envoie les titres et
// noms d'artiste lus dans les balises des fichiers, le serveur répond avec
// l'artiste correspondant et l'éventuel doublon déjà en catalogue.
export const inspectImportSchema = z.object({
  items: z
    .array(
      z.object({
        titre: z.string().trim().min(1).max(200),
        artiste: z.string().trim().max(200).optional(),
      })
    )
    .min(1)
    .max(100),
});

// ---- Assistance par IA ---------------------------------------------------

export const adminAiSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  // Les identifiants inconnus sont rejetes plutot qu'ignores : accepter
  // « moderatoin » en silence eteindrait une fonctionnalite que personne
  // ne retrouverait ensuite dans la liste.
  disabled: z.array(z.enum(IDS_FONCTIONNALITES_IA as [string, ...string[]])).max(IDS_FONCTIONNALITES_IA.length).optional(),
  dailyCallCap: z
    .number()
    .int("Le plafond doit être un nombre entier.")
    .min(0, "Le plafond ne peut pas être négatif.")
    .max(100000)
    .optional(),
});

export const adminCurationSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  autoPublish: z.boolean().optional(),
  retentionWeeks: z
    .number()
    .int("La durée de conservation doit être un nombre entier de semaines.")
    .min(1, "Il faut conserver les sélections au moins une semaine.")
    .max(52)
    .optional(),
  // Même parti pris que pour l'IA : un identifiant de recette inconnu
  // est refusé, pas ignoré. Éteindre en silence une recette mal
  // orthographiée la ferait disparaître sans que personne ne sache
  // pourquoi.
  disabled: z.array(z.enum(IDS_RECETTES as [string, ...string[]])).max(IDS_RECETTES.length).optional(),
  sectionPosition: z.number().int().min(0).max(50).optional(),
});

export const adminCurationActionSchema = z.object({
  action: z.enum(["analyser", "publier", "annuler", "retirer"]),
  /** Requis pour tout ce qui ne crée pas une analyse. */
  runId: z.string().length(24, "Identifiant d'analyse invalide.").optional(),
});

export const adminCurationPlaylistPatchSchema = z
  .object({
    title: z.string().trim().min(1, "Le titre ne peut pas être vide.").max(120).optional(),
    description: z.string().trim().max(400).optional(),
    /** Faux écarte la playlist de la publication à venir. */
    inclure: z.boolean().optional(),
    rang: z.number().int().min(0).max(50).optional(),
    /** Identifiant du titre à retirer de la sélection. */
    retirerTitre: z.string().length(24, "Identifiant de titre invalide.").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Aucune modification fournie." });

export const supportHumanSchema = z.object({
  humanRequested: z.literal(true),
});

export const aiSongMetadataSchema = z.object({
  title: z.string().trim().min(1, "Le titre est requis.").max(200),
  artistName: z.string().trim().max(200).default(""),
  // Bornees ici et pas seulement a la lecture : ce sont ces textes qui
  // partent chez le fournisseur, et leur longueur est ce qui fait le prix
  // de l'appel.
  lyrics: z.string().max(8000).optional(),
  album: z.string().trim().max(200).optional(),
  languages: z.array(z.string().trim().max(40)).min(1).max(12),
});

export const aiArtistBioSchema = z.object({
  /** Ce que l'artiste raconte de lui : la seule source biographique. */
  notes: z.string().max(3000).default(""),
  /** Biographie en cours de saisie, a reprendre plutot qu'a remplacer. */
  bio: z.string().max(2000).optional(),
});

export const aiPlaylistSchema = z.object({
  demande: z
    .string()
    .trim()
    .min(3, "Décrivez en quelques mots la playlist voulue.")
    .max(400),
});

export const aiSearchSchema = z.object({
  demande: z.string().trim().min(3, "Recherche trop courte.").max(300),
});

export const aiHelpDraftSchema = z.object({
  title: z.string().trim().min(3, "Indiquez d'abord le titre de l'article.").max(160),
  category: z.string().trim().max(60).default(""),
  notes: z.string().max(4000).default(""),
  /** Contenu deja saisi, a reprendre plutot qu'a remplacer. */
  body: z.string().max(6000).optional(),
});
