import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { connectDB } from "@/lib/db";
import SessionEcoute from "@/models/SessionEcoute";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

/** Sans 0, O, 1, I ni L : un code se dicte et se recopie sans se tromper. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const DUREE_MS = 6 * 60 * 60 * 1000;

function nouveauCode(): string {
  return Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

/**
 * Ouvre une écoute à plusieurs : le compte connecté en devient l'hôte et
 * reçoit un code à partager. Un hôte n'a qu'une session à la fois : en
 * ouvrir une nouvelle ferme la précédente.
 */
export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  await connectDB();
  await SessionEcoute.deleteMany({ hote: authUser.id });
  for (let essai = 0; essai < 5; essai++) {
    try {
      const session = await SessionEcoute.create({
        code: nouveauCode(),
        hote: authUser.id,
        expireLe: new Date(Date.now() + DUREE_MS),
      });
      return NextResponse.json({ code: session.code }, { status: 201 });
    } catch (err) {
      // Code déjà pris (index unique) : on en tire un autre.
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
  throw new ApiError("Impossible de créer la session, réessayez.", 503);
});
