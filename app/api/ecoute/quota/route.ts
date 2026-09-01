import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { connectDB } from "@/lib/db";
import QuotaEcoute from "@/models/QuotaEcoute";
import { getClientIp } from "@/lib/rateLimit";
import { getAuthUser } from "@/lib/mobileAuth";
import { getSiteConfig } from "@/lib/siteConfig";
import { withApiErrors, ApiError } from "@/lib/apiError";
import { ECOUTES_ANONYMES_PAR_DEFAUT } from "@/lib/acces";

/**
 * Le quota d'écoute d'un visiteur non connecté.
 *
 * Compté par adresse IP, côté serveur : un compteur rangé dans le
 * navigateur se remet à zéro en effaçant les données du site, ce qui
 * revenait à ne rien limiter du tout.
 *
 * Ce n'est pas une protection absolue, et ce n'est pas son rôle : un
 * visiteur déterminé change de réseau. C'est un seuil qui invite à créer
 * un compte, pas un verrou.
 */

/** L'empreinte change chaque jour, donc rien ne relie deux journées. */
function empreinte(ip: string, jour: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "moziik";
  return createHash("sha256").update(`${ip}|${jour}|${secret}`).digest("hex");
}

/** Le jour courant dans le fuseau du site, et la fin de ce jour. */
function jourEtEcheance(timezone: string): { jour: string; expireAt: Date } {
  const maintenant = new Date();
  const parties = new Intl.DateTimeFormat("fr-CA", {
    timeZone: timezone || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(maintenant);
  const lire = (t: Intl.DateTimeFormatPartTypes) => parties.find((p) => p.type === t)?.value ?? "";
  const jour = `${lire("year")}-${lire("month")}-${lire("day")}`;

  // Deux jours de conservation plutôt qu'un : l'échéance n'a pas à être
  // à la minute près, et MongoDB ne passe le balai que toutes les minutes.
  return { jour, expireAt: new Date(maintenant.getTime() + 48 * 60 * 60 * 1000) };
}

export const POST = withApiErrors(async (req: Request) => {
  const { songId } = (await req.json().catch(() => ({}))) as { songId?: string };
  if (!songId || typeof songId !== "string") {
    throw new ApiError("Titre manquant.", 400);
  }

  // Un compte connecté n'a pas de quota : la limite vise l'écoute sans
  // inscription, pas les membres.
  const authUser = await getAuthUser(req);
  if (authUser) {
    return NextResponse.json({ autorise: true, illimite: true, restant: null, limite: null });
  }

  const config = await getSiteConfig();
  const limite = config.anonymousDailyPlays ?? ECOUTES_ANONYMES_PAR_DEFAUT;
  if (limite <= 0) {
    // Zéro veut dire « pas de limite » : l'administration peut désactiver
    // le garde-fou sans qu'on ait à toucher au code.
    return NextResponse.json({ autorise: true, illimite: true, restant: null, limite: null });
  }

  await connectDB();
  const { jour, expireAt } = jourEtEcheance(config.timezone);
  const cle = empreinte(getClientIp(), jour);

  const existant = await QuotaEcoute.findOne({ cle }).select("titres").lean();
  const dejaEcoutes = existant?.titres ?? [];

  // Réécouter un titre déjà décompté ne coûte rien de plus.
  if (dejaEcoutes.includes(songId)) {
    return NextResponse.json({
      autorise: true,
      illimite: false,
      restant: Math.max(0, limite - dejaEcoutes.length),
      limite,
    });
  }

  if (dejaEcoutes.length >= limite) {
    return NextResponse.json({ autorise: false, illimite: false, restant: 0, limite });
  }

  // `$addToSet` plutôt qu'un incrément : deux onglets qui démarrent le
  // même titre au même instant ne doivent pas le décompter deux fois.
  await QuotaEcoute.updateOne(
    { cle },
    { $addToSet: { titres: songId }, $set: { expireAt } },
    { upsert: true }
  );

  return NextResponse.json({
    autorise: true,
    illimite: false,
    restant: Math.max(0, limite - (dejaEcoutes.length + 1)),
    limite,
  });
});
