import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import RefreshToken from "@/models/RefreshToken";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

/**
 * Les appareils connectés, et la façon de les déconnecter.
 *
 * Deux natures de session cohabitent, et elles ne se coupent pas de la
 * même manière. L'application mobile détient un jeton de rafraîchissement
 * enregistré en base : il se révoque un par un, effet immédiat. Le site,
 * lui, s'appuie sur des JWT sans état — rien à supprimer côté serveur. La
 * seule prise sur eux est une date : toute session émise avant
 * `sessionsRevokedAt` est refusée à la revalidation (lib/auth.ts), soit au
 * plus tard cinq minutes après la demande.
 */
export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  const [appareils, user] = await Promise.all([
    RefreshToken.find({ user: authUser.id, revoked: false, expiresAt: { $gt: new Date() } })
      .select("device createdAt expiresAt")
      .sort({ createdAt: -1 })
      .lean(),
    User.findById(authUser.id).select("sessionsRevokedAt lastLoginAt").lean(),
  ]);

  return NextResponse.json({
    devices: appareils.map((d) => ({
      id: d._id.toString(),
      device: d.device ?? "Appareil inconnu",
      createdAt: d.createdAt,
      expiresAt: d.expiresAt,
    })),
    sessionsRevokedAt: user?.sessionsRevokedAt ?? null,
    lastLoginAt: user?.lastLoginAt ?? null,
  });
});

/**
 * Déconnexion : d'un appareil précis (`id`), ou de partout.
 *
 * Le « partout » comprend la session qui envoie la demande — c'est bien ce
 * qu'on veut quand on a perdu un téléphone : le navigateur courant se
 * retrouvera déconnecté lui aussi, sans exception à expliquer.
 */
export const DELETE = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  await connectDB();

  if (id) {
    await RefreshToken.updateOne({ _id: id, user: authUser.id }, { revoked: true });
    return NextResponse.json({ ok: true, scope: "device" });
  }

  await Promise.all([
    RefreshToken.updateMany({ user: authUser.id, revoked: false }, { revoked: true }),
    User.updateOne({ _id: authUser.id }, { sessionsRevokedAt: new Date() }),
  ]);

  return NextResponse.json({ ok: true, scope: "all" });
});
