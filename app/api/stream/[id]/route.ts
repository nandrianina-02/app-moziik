import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import Subscription from "@/models/Subscription";
import QuotaEcoute from "@/models/QuotaEcoute";
import { getAuthUser } from "@/lib/mobileAuth";
import { getSiteConfig } from "@/lib/siteConfig";
import { getClientIp } from "@/lib/rateLimit";
import { hasPremiumAccess } from "@/lib/premium";
import { ECOUTES_ANONYMES_PAR_DEFAUT, limiterQualite } from "@/lib/acces";
import { adresseAudio } from "@/lib/cloudinaryAudio";
import type { AudioQuality } from "@/lib/offlineSettings";
import { withApiErrors, ApiError } from "@/lib/apiError";

/**
 * Le point de passage de tout ce qui s'écoute.
 *
 * Le lecteur ne connaît plus que cette adresse : c'est ici, et nulle part
 * ailleurs, que se décide en quelle qualité le morceau part et si le
 * visiteur a encore le droit de l'entendre. Avant, le plafond de qualité
 * et le quota vivaient dans le navigateur — donc à la portée de qui ouvre
 * l'onglet réseau.
 *
 * La réponse est une redirection plutôt qu'un flux relayé : faire transiter
 * chaque octet par une fonction serverless coûterait la bande passante de
 * tout le catalogue, et casserait les requêtes par plage que le lecteur
 * utilise pour se déplacer dans un morceau.
 */

const QUALITES: AudioQuality[] = ["low", "medium", "high"];

function estQualite(valeur: string | null): valeur is AudioQuality {
  return valeur !== null && (QUALITES as string[]).includes(valeur);
}

/** Même empreinte que /api/ecoute/quota : les deux comptent la même chose. */
function empreinte(ip: string, jour: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "moziik";
  return createHash("sha256").update(`${ip}|${jour}|${secret}`).digest("hex");
}

function jourCourant(timezone: string): string {
  const parties = new Intl.DateTimeFormat("fr-CA", {
    timeZone: timezone || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const lire = (t: Intl.DateTimeFormatPartTypes) => parties.find((p) => p.type === t)?.value ?? "";
  return `${lire("year")}-${lire("month")}-${lire("day")}`;
}

export const GET = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  await connectDB();
  const song = await Song.findById(params.id).select("audioUrl status trimStart trimEnd artist");
  if (!song?.audioUrl) throw new ApiError("Titre introuvable.", 404);

  const authUser = await getAuthUser(req);

  /**
   * Le fichier entier, sans découpe.
   *
   * Demandé par l'éditeur de découpe : il doit montrer ce qui existe, pas
   * ce qui est déjà retenu — sinon chaque passage rognerait la portion
   * précédente. Réservé à qui peut modifier le titre, puisque c'est
   * précisément la partie que le public n'entend plus.
   */
  const brut = req.url ? new URL(req.url).searchParams.get("brut") === "1" : false;
  if (brut) {
    const artiste = authUser?.role === "artist" ? await Artist.findOne({ user: authUser.id }) : null;
    const proprietaire = artiste && String(song.artist) === String(artiste._id);
    if (authUser?.role !== "admin" && !proprietaire) {
      throw new ApiError("Réservé au propriétaire du titre.", 403);
    }
  }

  // Un titre non publié reste accessible à qui le gère : c'est ce qui
  // permet d'écouter un brouillon avant de le mettre en ligne.
  if (song.status !== "published" && !brut) {
    throw new ApiError("Ce titre n'est pas disponible.", 403);
  }
  const abonnement = authUser
    ? await Subscription.findOne({ user: authUser.id }).sort({ startedAt: -1 }).lean()
    : null;
  const visiteur = {
    connecte: Boolean(authUser),
    premium: hasPremiumAccess({ role: authUser?.role, subscription: abonnement }),
  };

  // Le quota des visiteurs, vérifié ici aussi : le contrôle du lecteur
  // avertit poliment, celui-ci refuse réellement de servir le fichier.
  if (!visiteur.connecte) {
    const config = await getSiteConfig();
    const limite = config.anonymousDailyPlays ?? ECOUTES_ANONYMES_PAR_DEFAUT;

    if (limite > 0) {
      const cle = empreinte(getClientIp(), jourCourant(config.timezone));
      const quota = await QuotaEcoute.findOne({ cle }).select("titres").lean();
      const titres = quota?.titres ?? [];

      // Un titre déjà décompté reste écoutable : sans quoi une simple
      // reprise après une pause serait refusée.
      if (!titres.includes(params.id) && titres.length >= limite) {
        throw new ApiError("Limite d'écoute atteinte. Crée un compte pour continuer.", 402);
      }
    }
  }

  // La qualité demandée est un souhait, jamais une autorisation : le
  // plafond de l'abonnement s'applique ensuite.
  const demandee = req.url ? new URL(req.url).searchParams.get("q") : null;
  const qualite = limiterQualite(estQualite(demandee) ? demandee : "high", visiteur);

  const adresse = brut
    ? adresseAudio(song.audioUrl, qualite)
    : adresseAudio(song.audioUrl, qualite, { debut: song.trimStart, fin: song.trimEnd });

  // `no-store` : la redirection dépend de qui demande et de son quota du
  // jour. Mise en cache par un intermédiaire, elle servirait la qualité
  // d'un abonné à un compte gratuit.
  return NextResponse.redirect(adresse, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  });
});
