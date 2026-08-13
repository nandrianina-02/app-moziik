import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User, { UserRole } from "@/models/User";
import RefreshToken from "@/models/RefreshToken";
import { ApiError } from "@/lib/apiError";

const JWT_SECRET = process.env.MOBILE_JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("La variable d'environnement MOBILE_JWT_SECRET est manquante.");
}

// Court volontairement : un access token volé (log client, device compromis)
// n'est exploitable que 15 minutes. Le refresh token (long, révocable en
// base) est ce qui permet à l'app de rester connectée sans redemander le
// mot de passe.
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export type MobileTokenPayload = {
  sub: string; // user._id
  role: UserRole;
};

export type AuthUser = {
  id: string;
  role: UserRole;
};

export function signAccessToken(payload: MobileTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function hashToken(token: string): string {
  // sha256 suffit ici : le token brut est déjà 256 bits d'aléa
  // (randomBytes), on hash seulement pour ne jamais stocker le secret en
  // clair — pas besoin d'un algo lent type bcrypt (pas un mot de passe
  // choisi par un humain, donc pas de risque de brute force par dictionnaire).
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Crée un nouveau refresh token pour l'utilisateur/l'appareil donné et le
 * persiste (hashé) en base. Retourne le token en clair — la seule fois où
 * il existe hors de son hash.
 */
export async function issueRefreshToken(userId: string, device?: string): Promise<string> {
  await connectDB();
  const token = randomBytes(48).toString("hex");
  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(token),
    device,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
  return token;
}

/**
 * Échange un refresh token valide contre un nouvel access token. Ne
 * "tourne" pas le refresh token (même token réutilisable jusqu'à
 * expiration/déconnexion) — plus simple côté client mobile, au prix d'une
 * fenêtre de rejeu légèrement plus longue en cas de vol, acceptable pour
 * ce produit.
 */
export async function rotateAccessToken(refreshToken: string): Promise<{ accessToken: string; user: AuthUser }> {
  await connectDB();
  const record = await RefreshToken.findOne({
    tokenHash: hashToken(refreshToken),
    revoked: false,
    expiresAt: { $gt: new Date() },
  });
  if (!record) {
    throw new ApiError("Session mobile expirée, reconnecte-toi.", 401);
  }

  const user = await User.findById(record.user).select("role suspended");
  if (!user || user.suspended) {
    throw new ApiError("Compte introuvable ou suspendu.", 401);
  }

  const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role });
  return { accessToken, user: { id: user._id.toString(), role: user.role } };
}

/** Révoque un refresh token précis (déconnexion de l'appareil courant). */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  await connectDB();
  await RefreshToken.updateOne({ tokenHash: hashToken(refreshToken) }, { revoked: true });
}

/**
 * Résout l'utilisateur courant à partir soit d'une session NextAuth (web,
 * cookie), soit d'un header `Authorization: Bearer <accessToken>` (mobile).
 * Les routes API existantes qui appelaient `getServerSession` directement
 * peuvent basculer sur cette fonction pour accepter les deux sans dupliquer
 * de logique.
 */
export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    try {
      const payload = jwt.verify(token, JWT_SECRET) as MobileTokenPayload & jwt.JwtPayload;
      return { id: payload.sub, role: payload.role };
    } catch {
      throw new ApiError("Token invalide ou expiré.", 401);
    }
  }

  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    return { id: session.user.id, role: session.user.role ?? "member" };
  }

  return null;
}

/** Comme getAuthUser, mais lève une 401 si personne n'est connecté. */
export async function requireAuthUser(req: Request): Promise<AuthUser> {
  const user = await getAuthUser(req);
  if (!user) throw new ApiError("Authentification requise.", 401);
  return user;
}
