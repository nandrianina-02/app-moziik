import { ApiError } from "@/lib/apiError";
import { getAuthUser, type AuthUser } from "@/lib/mobileAuth";

/**
 * Accepte soit une session NextAuth (web, cookie), soit un header
 * `Authorization: Bearer <accessToken>` (mobile) — voir lib/mobileAuth.ts.
 */
export async function requireAdmin(req: Request): Promise<{ user: AuthUser }> {
  const authUser = await getAuthUser(req);
  if (!authUser) throw new ApiError("Non authentifié.", 401);
  if (authUser.role !== "admin") throw new ApiError("Réservé aux administrateurs.", 403);
  return { user: authUser };
}
