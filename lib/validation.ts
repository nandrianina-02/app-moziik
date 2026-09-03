import { z } from "zod";
import { ApiError } from "@/lib/apiError";
import { IDS_RESEAUX, urlSocialeValide } from "@/lib/socialPlatforms";
import { IDS_FONCTIONNALITES_IA } from "@/lib/ai/features";
import { IDS_RECETTES, IDS_SELECTIONS } from "@/lib/curation/labels";
import {
  CORPS_MAX as MESSAGERIE_CORPS_MAX,
  MEMBRES_MAX as MESSAGERIE_MEMBRES_MAX,
  PIECES_MAX as MESSAGERIE_PIECES_MAX,
  TITRE_GROUPE_MAX as MESSAGERIE_TITRE_MAX,
} from "@/lib/messagerie";

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
  videoUrl: z.string().url("URL vidéo invalide.").optional().or(z.literal("")),
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
  bpmSource: z.enum(["manuel", "balise", "analyse"]).optional(),
  trimStart: z.number().min(0).nullable().optional(),
  trimEnd: z.number().min(0).nullable().optional(),
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
  type: z.enum(["album", "ep", "single", "podcast"]).optional().default("album"),
  releaseDate: z.coerce.date(),
});

export const patchAlbumSchema = z.object({
  title: z.string().trim().min(1, "Titre requis.").max(200).optional(),
  coverUrl: z.string().url("URL de pochette invalide.").optional(),
  bannerUrl: z.string().url("URL de bannière invalide.").optional().or(z.literal("")),
  description: z.string().max(2000).optional(),
  type: z.enum(["album", "ep", "single", "podcast"]).optional(),
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

/** Identifiant Mongo, tel qu'il circule en JSON. */
const identifiant = z.string().regex(/^[a-f\d]{24}$/i, "Identifiant invalide.");

/** Liste de courtes phrases : pastilles, puces, bon à savoir. */
const listeDeTextes = (max: number, longueur = 120) =>
  z.array(z.string().trim().min(1).max(longueur)).max(max).optional();

const ticketTierSchema = z.object({
  name: z.string().trim().min(1, "Nom de billet requis.").max(60),
  price: z.number().min(0, "Le prix ne peut pas être négatif."),
  description: z.string().trim().max(160).optional(),
  originalPrice: z.number().min(0).optional(),
  availableUntil: z.coerce.date().optional(),
  soldOut: z.boolean().optional(),
});

const programSlotSchema = z.object({
  time: z.string().trim().min(1, "Heure requise.").max(20),
  title: z.string().trim().min(1, "Intitulé requis.").max(120),
  detail: z.string().trim().max(300).optional(),
});

/**
 * Champs facultatifs de la fiche détaillée, partagés par la création et la
 * modification : les mêmes règles des deux côtés, écrites une seule fois.
 */
const champsFicheEvenement = {
  category: z.enum(["musique", "concert", "festival", "culte", "conference", "atelier", "autre"]).optional(),
  endDate: z.coerce.date().optional(),
  gallery: z.array(z.string().url("URL de photo invalide.")).max(20).optional(),
  lineup: z.array(identifiant).max(50).optional(),
  highlights: listeDeTextes(8, 60),
  inclusions: listeDeTextes(12),
  program: z.array(programSlotSchema).max(30).optional(),
  practicalInfo: listeDeTextes(12, 200),
  tickets: z.array(ticketTierSchema).max(10).optional(),
  address: z.string().trim().max(300).optional(),
  postalCode: z.string().trim().max(20).optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  mapsUrl: z.string().trim().url("Lien de carte invalide.").max(500).optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  // Un âge minimum au-delà de 21 ans ne correspond à aucune réglementation
  // courante : la borne attrape surtout les saisies erronées (année de
  // naissance tapée dans le champ).
  minAge: z.number().int().min(0).max(21).optional(),
  visibility: z.enum(["public", "unlisted"]).optional(),
  organizer: z
    .object({
      name: z.string().trim().max(120).optional(),
      email: z.string().trim().email("Adresse email invalide.").max(254).optional().or(z.literal("")),
      phone: z.string().trim().max(40).optional(),
      website: z.string().trim().url("Site web invalide.").max(300).optional().or(z.literal("")),
    })
    .optional(),
};

export const createEventSchema = z.object({
  title: z.string().trim().min(1, "Titre requis.").max(200),
  description: z.string().trim().min(1, "Description requise.").max(5000),
  coverUrl: z.string().url("URL de pochette invalide.").optional().or(z.literal("")),
  location: z.string().trim().min(1, "Lieu requis.").max(200),
  date: z.coerce.date(),
  ticketUrl: z.string().trim().url("Lien de billetterie invalide.").max(500).optional().or(z.literal("")),
  price: z.number().min(0).optional(),
  ...champsFicheEvenement,
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
  ...champsFicheEvenement,
});

// ---- Accès premium offert par l'administration --------------------------------

/**
 * Une durée d'accès, telle que l'administration la choisit.
 *
 * `illimite` n'écrit aucune échéance : c'est l'absence de date qui dit
 * « sans fin », pas une date lointaine qui mentirait à l'affichage.
 */
export const dureePremiumSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("illimite") }),
  z.object({ type: z.literal("jours"), jours: z.number().int().min(1).max(3650) }),
  z.object({ type: z.literal("jusqu_au"), date: z.coerce.date() }),
]);

export const octroiPremiumSchema = z.object({
  action: z.enum(["offrir", "retirer"]),
  duree: dureePremiumSchema.optional(),
  cible: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("selection"),
      ids: z.array(z.string().regex(/^[a-f\d]{24}$/i, "Identifiant invalide.")).min(1).max(500),
    }),
    z.object({
      type: z.literal("filtre"),
      filtres: z
        .object({
          role: z.string().max(20).optional(),
          status: z.string().max(20).optional(),
          verified: z.string().max(5).optional(),
          search: z.string().max(200).optional(),
        })
        .default({}),
    }),
  ]),
});

export const moderateDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"], { errorMap: () => ({ message: "Décision invalide." }) }),
});

// ---- Compte (mon profil) ------------------------------------------------------

/** Réglages régionaux d un compte : les mêmes catalogues que le site. */
export const preferencesSchema = z.object({
  language: z.string().trim().max(10).optional(),
  timezone: z.string().trim().max(60).optional(),
  dateFormat: z.string().trim().max(20).optional(),
});

export const patchMeProfileSchema = z.object({
  name: z.string().trim().min(1, "Le nom ne peut pas être vide.").max(80).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9._]{3,20}$/,
      "3 à 20 caractères : lettres sans accent, chiffres, point ou tiret bas."
    )
    .optional(),
  avatarUrl: z.string().trim().url("URL d'avatar invalide.").max(500).optional(),
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(254).optional(),
  // Le vide est accepté : c'est ainsi qu'on retire un numéro déjà enregistré.
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || /^[+0-9 ().-]{6,30}$/.test(v), "Numéro de téléphone invalide.")
    .optional(),
  preferences: preferencesSchema.optional(),
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
  // La chaîne vide retire le clip : c'est le seul moyen de dire
  // « il n'y en a plus » dans un PATCH partiel.
  videoUrl: z.string().url("URL vidéo invalide.").optional().or(z.literal("")),
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
  bpmSource: z.enum(["manuel", "balise", "analyse"]).optional(),
  // La découpe : `null` l'annule et rend le morceau entier. Les bornes
  // sont recoupées côté serveur contre la durée réelle du fichier.
  trimStart: z.number().min(0).nullable().optional(),
  trimEnd: z.number().min(0).nullable().optional(),
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

/**
 * Ce qu'un administrateur peut changer sur un profil artiste.
 *
 * Reprend les champs que l'artiste modifie lui-même (`patchArtistMeSchema`)
 * et y ajoute ce que lui seul décide : nom de scène, vérification,
 * monétisation, droit de publier des évènements. Un artiste injoignable ou
 * une faute dans un nom de scène ne devaient plus attendre que l'intéressé
 * s'en occupe.
 */
export const adminArtistPatchSchema = z.object({
  stageName: z.string().trim().min(1, "Nom de scène requis.").max(80).optional(),
  bio: z.string().max(2000).optional(),
  coverUrl: z.string().url("URL de photo invalide.").optional().or(z.literal("")),
  bannerUrl: z.string().url("URL de bannière invalide.").optional().or(z.literal("")),
  genres: z.array(z.string().trim().max(60)).max(10).optional(),
  socialLinks: z
    .array(z.object({ platform: z.string().trim().max(40), url: z.string().trim().max(300) }))
    .max(8)
    .optional(),
  verified: z.boolean().optional(),
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
/**
 * Changement de mot de passe depuis le compte.
 *
 * `currentPassword` est facultatif ici, mais exigé par la route dès que le
 * compte en a déjà un : un compte créé via Google n'en a pas, et devoir
 * saisir un mot de passe qu'on n'a jamais eu empêcherait d'en définir un.
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().max(200).optional(),
  newPassword: z
    .string()
    .min(8, "Le mot de passe doit faire au moins 8 caractères.")
    .max(200),
});

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
  defaultUnivers: z.enum(["general", "christian"]).optional(),
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
  // Même parti pris que pour l'IA : un identifiant inconnu est refusé,
  // pas ignoré. Éteindre en silence une recette mal orthographiée la
  // ferait disparaître sans que personne ne sache pourquoi.
  //
  // La liste couvre trois choses : les recettes globales, les modes
  // d'écoute entiers (« sommeil » éteint ses trois playlists d'un coup),
  // et une sélection de mode isolée (« mode:sommeil:nouveautes »).
  disabled: z
    .array(z.enum(IDS_SELECTIONS as [string, ...string[]]))
    .max(IDS_SELECTIONS.length)
    .optional(),
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

// ---- Messagerie ----------------------------------------------------------

/**
 * Un message doit porter quelque chose : du texte, ou un contenu partagé.
 *
 * Le `refine` est là parce que les deux champs sont facultatifs pris
 * séparément — sans lui, un message vide passerait, et la liste des
 * conversations afficherait un aperçu vide sans qu'on sache pourquoi.
 */
const pieceJointeSchema = z.object({
  type: z.enum(["image", "audio"]),
  // Le fichier est déjà chez Cloudinary quand il arrive ici : le
  // navigateur l'y envoie directement, parce qu'un mémo vocal de
  // plusieurs mégaoctets dépasserait la charge utile d'une route Next.
  // On vérifie donc l'hébergeur, faute de pouvoir vérifier le contenu.
  url: z.string().trim().url().max(600),
  nom: z.string().trim().max(200).default(""),
  taille: z.number().int().nonnegative().optional(),
  duree: z.number().nonnegative().optional(),
  largeur: z.number().int().positive().optional(),
  hauteur: z.number().int().positive().optional(),
});

export const envoiMessageSchema = z
  .object({
    corps: z.string().max(MESSAGERIE_CORPS_MAX, "Message trop long.").default(""),
    partage: z
      .object({
        type: z.enum(["song", "album", "podcast", "playlist", "artist", "event", "radio"]),
        refId: z.string().trim().min(1).max(120),
      })
      .optional(),
    pieces: z.array(pieceJointeSchema).max(MESSAGERIE_PIECES_MAX).default([]),
    /** Identifiant du message auquel celui-ci répond. */
    repondA: z.string().trim().length(24).optional(),
  })
  .refine((v) => v.corps.trim().length > 0 || Boolean(v.partage) || v.pieces.length > 0, {
    message: "Écrivez un message, joignez un contenu ou un fichier.",
    path: ["corps"],
  });

export const assistantSchema = z.object({
  demande: z
    .string()
    .trim()
    .min(2, "Dites-lui ce que vous cherchez.")
    .max(600, "Message trop long pour l'assistant."),
});

export const nouvelleConversationSchema = z
  .object({
    type: z.enum(["direct", "group"]),
    /** Tête-à-tête : la personne à qui on écrit. */
    destinataire: z.string().trim().length(24).optional(),
    /** Groupe : les membres, l'auteur non compris. */
    membres: z.array(z.string().trim().length(24)).max(MESSAGERIE_MEMBRES_MAX).optional(),
    titre: z.string().trim().max(MESSAGERIE_TITRE_MAX).optional(),
  })
  .refine((v) => (v.type === "direct" ? Boolean(v.destinataire) : (v.membres?.length ?? 0) > 0), {
    message: "Choisissez au moins une personne.",
    path: ["membres"],
  })
  .refine((v) => v.type === "direct" || Boolean(v.titre?.trim()), {
    message: "Donnez un nom au groupe.",
    path: ["titre"],
  });

export const majConversationSchema = z.object({
  titre: z.string().trim().min(1).max(MESSAGERIE_TITRE_MAX).optional(),
  coverUrl: z.string().trim().url().max(500).optional(),
  /** Comptes à ajouter au groupe. */
  ajouter: z.array(z.string().trim().length(24)).max(MESSAGERIE_MEMBRES_MAX).optional(),
  /** Compte à exclure — un seul à la fois, l'action est nominative. */
  exclure: z.string().trim().length(24).optional(),
  /** Promotion ou rétrogradation d'un membre en gestionnaire. */
  gestionnaire: z.object({ user: z.string().trim().length(24), actif: z.boolean() }).optional(),
  silencieux: z.boolean().optional(),
});

export const reactionSchema = z.object({
  /** Un emoji, éventuellement composé — d'où la longueur généreuse. */
  emoji: z.string().trim().min(1).max(16),
});

export const editionMessageSchema = z.object({
  corps: z.string().trim().min(1, "Un message modifié ne peut pas être vide.").max(MESSAGERIE_CORPS_MAX),
});
