import { headers } from "next/headers";
import { ApiError } from "@/lib/apiError";

/**
 * Rate limiting en mémoire (fenêtre glissante simplifiée).
 *
 * Limite connue : sur un déploiement serverless multi-instances (Vercel),
 * ce compteur n'est PAS partagé entre les instances — chaque instance a
 * sa propre mémoire. C'est donc une protection "best effort" qui réduit
 * fortement les abus (brute force, spam), mais qui n'est pas une garantie
 * stricte à grande échelle. Pour une garantie forte en production avec
 * plusieurs instances actives, migrer vers un store partagé (ex: Upstash
 * Redis + @upstash/ratelimit) sans changer l'API de `checkRateLimit`.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Nettoyage périodique pour éviter une fuite mémoire sur les clés expirées.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();
function cleanupIfNeeded() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Retourne un identifiant best-effort du client (IP en priorité, sinon
 * "unknown" — dans ce dernier cas la limite s'applique globalement à
 * tous les clients sans IP détectable, ce qui reste plus sûr que pas de
 * limite du tout).
 */
export function getClientIp(): string {
  const headerList = headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = headerList.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Vérifie et incrémente le compteur pour `key` (déjà composée, ex:
 * `register:1.2.3.4`). Lève une ApiError 429 si la limite est dépassée.
 */
export function checkRateLimit(key: string, { limit, windowMs }: { limit: number; windowMs: number }) {
  cleanupIfNeeded();

  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    throw new ApiError(
      `Trop de tentatives. Réessaie dans ${retryAfterSeconds} seconde(s).`,
      429
    );
  }

  bucket.count += 1;
}

/** Raccourci : rate limit basé sur l'IP du client courant. */
export function checkRateLimitByIp(prefix: string, options: { limit: number; windowMs: number }) {
  checkRateLimit(`${prefix}:${getClientIp()}`, options);
}
