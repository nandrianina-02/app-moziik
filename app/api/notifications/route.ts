import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import { withApiErrors } from "@/lib/apiError";
import { requireAdmin } from "@/lib/requireAdmin";
import { parseOrThrow, createNotificationSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

const PAGE_SIZE = 20;

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before"); // createdAt ISO du dernier élément déjà chargé

  await connectDB();
  const query: Record<string, unknown> = { recipient: authUser.id };
  if (before) query.createdAt = { $lt: new Date(before) };

  // On demande une page de plus que nécessaire pour savoir s'il reste
  // du contenu à charger, sans avoir à faire un countDocuments séparé.
  const page = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(PAGE_SIZE + 1);

  const hasMore = page.length > PAGE_SIZE;
  const notifications = page.slice(0, PAGE_SIZE);

  return NextResponse.json({ notifications, hasMore });
});

// Supprime définitivement toutes les notifications de l'utilisateur courant.
export const DELETE = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  await Notification.deleteMany({ recipient: authUser.id });

  return NextResponse.json({ message: "Toutes les notifications ont été supprimées." });
});

// Toutes les créations internes (nouveau son publié, nouvel abonné, etc.)
// passent par lib/notify.ts, qui appelle Notification.create() directement
// sans transiter par cette route HTTP. Cette route n'a donc aucun
// consommateur légitime et ne doit surtout pas être ouverte au public :
// sans authentification, n'importe qui pourrait spammer un utilisateur
// arbitraire avec une notification forgée (ex: fausse notif "paiement"
// avec un lien de phishing). Réservée aux admins par précaution.
export const POST = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  const { recipient, type, title, message, link } = parseOrThrow(createNotificationSchema, await req.json());

  await connectDB();
  const notification = await Notification.create({ recipient, type, title, message, link });
  return NextResponse.json({ notification }, { status: 201 });
});
