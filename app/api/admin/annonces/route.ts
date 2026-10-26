import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import Annonce from "@/models/Annonce";
import User from "@/models/User";
import Subscription from "@/models/Subscription";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAdmin } from "@/lib/requireAdmin";
import { notifyMany } from "@/lib/notify";
import { adresseAcceptee } from "@/lib/annonceTexte";
import { hasPremiumAccess } from "@/lib/premium";

const schema = z.object({
  titre: z.string().trim().min(1, "Le titre est requis.").max(120, "Titre trop long (120 caractères au plus)."),
  message: z.string().trim().min(1, "Le message est requis.").max(4000, "Message trop long (4000 caractères au plus)."),
  lien: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || adresseAcceptee(v), "Lien invalide : une page du site (/…) ou une adresse https://."),
  public: z.enum(["tous", "artistes", "premium"]),
});

/**
 * Les comptes d'artistes créés par l'administration pour peupler le
 * catalogue portent une adresse @moziik.app que personne ne lit : une
 * annonce n'a rien à y faire.
 */
const COMPTE_REEL = { suspended: { $ne: true }, email: { $not: /@moziik\.app$/i } };

async function destinataires(cible: "tous" | "artistes" | "premium"): Promise<string[]> {
  if (cible === "tous") return (await User.find(COMPTE_REEL).select("_id").lean()).map((u) => String(u._id));
  if (cible === "artistes") return (await User.find({ ...COMPTE_REEL, role: "artist" }).select("_id").lean()).map((u) => String(u._id));
  // Premium : la même règle que partout ailleurs (lib/premium.ts), échéance comprise.
  const abonnements = await Subscription.find({ status: "active" }).select("user status currentPeriodEnd").lean();
  const ids = [...new Set(abonnements.filter((a) => hasPremiumAccess({ subscription: a })).map((a) => String(a.user)))];
  if (ids.length === 0) return [];
  return (await User.find({ _id: { $in: ids }, ...COMPTE_REEL }).select("_id").lean()).map((u) => String(u._id));
}

/** GET /api/admin/annonces — les 50 dernières annonces envoyées. */
export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();
  const annonces = await Annonce.find().sort({ createdAt: -1 }).limit(50).populate("auteur", "name").lean();
  const comptes = await Promise.all((["tous", "artistes", "premium"] as const).map(async (c) => [c, (await destinataires(c)).length] as const));
  return NextResponse.json({ annonces, publics: Object.fromEntries(comptes) });
});

/**
 * POST /api/admin/annonces — envoie une annonce : une notification
 * « Annonce » (format riche) à chaque destinataire, et un push sur ses
 * téléphones (texte sans mise en forme).
 */
export const POST = withApiErrors(async (req: Request) => {
  const { user } = await requireAdmin(req);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "Annonce invalide.", 400);
  const { titre, message, lien, public: cible } = parsed.data;

  await connectDB();
  const ids = await destinataires(cible);
  if (ids.length === 0) throw new ApiError("Personne ne correspond à ce public pour le moment.", 400);

  await notifyMany(ids, { type: "system", title: titre, message, link: lien, format: "riche" });
  const annonce = await Annonce.create({ titre, message, lien, public: cible, destinataires: ids.length, auteur: user.id });
  return NextResponse.json({ annonce }, { status: 201 });
});
