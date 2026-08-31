import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, changePasswordSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";
import { checkRateLimit } from "@/lib/rateLimit";

/**
 * Changement — ou définition — du mot de passe du compte connecté.
 *
 * Un compte créé via Google n'en a pas : il peut s'en donner un ici, sans
 * mot de passe actuel à fournir, ce qui lui ouvre la connexion classique
 * en plus de Google. Un compte qui en a déjà un doit prouver qu'il le
 * connaît — sans quoi une session volée suffirait à s'approprier le
 * compte définitivement.
 */
export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  // Cinq essais par quart d'heure : de quoi se tromper, pas de quoi
  // deviner le mot de passe actuel depuis une session ouverte.
  checkRateLimit(`change-password:${authUser.id}`, { limit: 5, windowMs: 15 * 60 * 1000 });

  const { currentPassword, newPassword } = parseOrThrow(changePasswordSchema, await req.json());

  await connectDB();
  const user = await User.findById(authUser.id);
  if (!user) throw new ApiError("Compte introuvable.", 404);

  if (user.passwordHash) {
    if (!currentPassword) throw new ApiError("Mot de passe actuel requis.", 400);
    const valide = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valide) throw new ApiError("Mot de passe actuel incorrect.", 403);
    if (currentPassword === newPassword) {
      throw new ApiError("Le nouveau mot de passe doit être différent de l'actuel.", 400);
    }
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  // Un lien de réinitialisation encore valide deviendrait une porte
  // dérobée : changer de mot de passe l'annule.
  user.resetToken = undefined;
  user.resetTokenExpires = undefined;
  await user.save();

  return NextResponse.json({ ok: true });
});
