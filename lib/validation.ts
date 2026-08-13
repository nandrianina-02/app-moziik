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
