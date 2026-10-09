import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { getAuthUser } from "@/lib/mobileAuth";
import { checkRateLimit, checkRateLimitByIp } from "@/lib/rateLimit";
import { dossierStockage, ouvrirEnvoi, stockageActif } from "@/lib/karaksStorage";
import { DOSSIERS_ENVOI, extensionPourType, regleEnvoi } from "@/lib/envoiRegles";

/**
 * Ouverture d'un envoi de fichier vers Karaks Storage.
 *
 * Le navigateur annonce le fichier (nom, type, taille) sans l'envoyer ; le
 * serveur vérifie qui envoie quoi, ouvre la session avec la clé du projet et
 * renvoie une adresse à jeton où le navigateur dépose lui-même les octets,
 * par morceaux. Le fichier ne transite pas par Moziik : un clip de plusieurs
 * centaines de mégaoctets dépasserait la limite d'une fonction.
 *
 * Tant que Karaks Storage n'est pas configuré, la réponse `cloudinary`
 * renvoie le navigateur vers l'envoi historique.
 */

const schema = z.object({
  nom: z.string().trim().min(1).max(255),
  type: z.string().trim().min(1).max(100),
  taille: z.number().int().positive(),
  dossier: z.enum(DOSSIERS_ENVOI),
  duree: z.number().min(0).max(86_400).optional(),
});

export const POST = withApiErrors(async (req: Request) => {
  if (!stockageActif()) return NextResponse.json({ mode: "cloudinary" });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new ApiError("Fichier annoncé invalide.", 400);
  const fichier = parsed.data;
  const regle = regleEnvoi(fichier.dossier);

  // Seule la pièce jointe du formulaire de contact est ouverte aux
  // visiteurs : tout le reste suppose un compte.
  const utilisateur = await getAuthUser(req);
  if (!utilisateur && !regle.anonyme) throw new ApiError("Connecte-toi pour envoyer un fichier.", 401);
  if (regle.admin && utilisateur?.role !== "admin") throw new ApiError("Réservé à l'administration.", 403);
  if (utilisateur) checkRateLimit(`envoi:${utilisateur.id}`, { limit: 120, windowMs: 60 * 60_000 });
  else checkRateLimitByIp("envoi-anonyme", { limit: 10, windowMs: 60 * 60_000 });

  const type = fichier.type.split(";")[0].trim().toLowerCase();
  if (!regle.types.some((accepte) => (accepte.endsWith("/") ? type.startsWith(accepte) : type === accepte))) {
    throw new ApiError(regle.messageType, 415);
  }
  const extension = extensionPourType(type);
  if (!extension) throw new ApiError("Ce format de fichier n'est pas accepté.", 415);
  if (fichier.taille > regle.tailleMax) {
    throw new ApiError(`Fichier trop lourd : ${Math.round(regle.tailleMax / 1024 / 1024)} Mo au plus.`, 413);
  }

  // Nom lisible dans le stockage, avec l'extension qui correspond au type :
  // c'est elle qui fixe le type servi ensuite.
  const base = fichier.nom.replace(/\.[A-Za-z0-9]{1,8}$/, "").slice(0, 160) || "fichier";
  const envoi = await ouvrirEnvoi({
    nom: `${base}.${extension}`,
    type,
    taille: fichier.taille,
    dossierId: await dossierStockage(fichier.dossier),
    duree: fichier.duree,
  });

  return NextResponse.json({
    mode: "karaks-storage",
    fichierId: envoi.fichierId,
    adresseEnvoi: envoi.adresseEnvoi,
    tailleMorceau: envoi.tailleMorceau,
  });
});

/** GET /api/fichiers/envoi — où partent les fichiers : le navigateur prépare les qualités d'un titre seulement pour Karaks Storage. */
export const GET = withApiErrors(async () => {
  return NextResponse.json({ mode: stockageActif() ? "karaks-storage" : "cloudinary" }, { headers: { "Cache-Control": "no-store" } });
});
