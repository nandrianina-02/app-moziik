import { z } from "zod";
import { ApiError } from "@/lib/apiError";

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
  duration: z.number().positive("Durée invalide."),
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
});

export const patchPlaylistSchema = z.object({
  title: z.string().trim().min(1, "Le titre est requis.").max(150).optional(),
  description: z.string().max(1000).optional(),
  coverUrl: z.string().url("URL de pochette invalide.").optional().or(z.literal("")),
  isPublic: z.boolean().optional(),
});

export const playlistSongSchema = z.object({
  songId: z.string().min(1, "songId requis."),
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
  duration: z.number().positive().optional(),
  genre: z.string().trim().min(1).max(60).optional(),
  lyrics: z.string().max(20000).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(40)).max(30).optional(),
  language: z.string().max(40).optional(),
  composer: z.string().max(200).optional(),
  producer: z.string().max(200).optional(),
  bpm: z.number().positive().optional(),
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
});

export const adminSiteConfigPatchSchema = z.object({
  siteName: z.string().trim().min(1).max(80).optional(),
  tagline: z.string().max(200).optional(),
  logoUrl: z.string().max(500).optional(),
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
  defaultTheme: z.enum(["dark", "light"]).optional(),
  legalEntityName: z.string().max(200).optional(),
  legalCapital: z.string().max(60).optional(),
  legalRcsCity: z.string().max(100).optional(),
  legalRcsNumber: z.string().max(60).optional(),
  legalAddress: z.string().max(300).optional(),
  legalWebsite: z.string().max(200).optional(),
  legalUpdatedAt: z.coerce.date().optional(),
});
