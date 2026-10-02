import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { activiteDuCompte } from "@/lib/activiteServer";
import { estTypeActivite } from "@/lib/activite";

/**
 * L'historique d'activité du compte connecté, et de lui seul.
 *
 * Aucun paramètre ne désigne un utilisateur : l'identité vient de la
 * session, jamais de l'URL. C'est ce qui rend impossible de lire
 * l'historique de quelqu'un d'autre en changeant un chiffre — un
 * administrateur compris, qui n'a ici aucun privilège particulier.
 *
 * `no-store` : un historique personnel n'a rien à faire dans un cache
 * partagé, et deux comptes sur un même appareil ne doivent pas se
 * rencontrer.
 */
export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  await connectDB();

  const params = new URL(req.url).searchParams;

  const avantBrut = params.get("avant");
  let avant: Date | undefined;
  if (avantBrut) {
    const d = new Date(avantBrut);
    if (Number.isNaN(d.getTime())) throw new ApiError("Curseur invalide.", 400);
    avant = d;
  }

  const typeBrut = params.get("type");
  // Un type inconnu est ignoré plutôt que refusé : l'historique est une
  // page de consultation, et un filtre mal orthographié dans une URL
  // partagée doit montrer tout, pas une erreur.
  const type = typeBrut && estTypeActivite(typeBrut) ? typeBrut : undefined;

  const limite = Number(params.get("limite")) || 30;

  const page = await activiteDuCompte(authUser.id, { avant, type, limite });

  return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
});
