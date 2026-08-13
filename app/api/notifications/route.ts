import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import { ApiError, withApiErrors } from "@/lib/apiError";

const PAGE_SIZE = 20;

export const GET = withApiErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before"); // createdAt ISO du dernier élément déjà chargé

  await connectDB();
  const query: Record<string, unknown> = { recipient: session.user.id };
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
export const DELETE = withApiErrors(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  await connectDB();
  await Notification.deleteMany({ recipient: session.user.id });

  return NextResponse.json({ message: "Toutes les notifications ont été supprimées." });
});

// Création interne (appelée par d'autres routes serveur : nouveau
// son publié, nouvel abonné, etc.), pas exposée aux clients publics.
export const POST = withApiErrors(async (req: Request) => {
  const { recipient, type, title, message, link } = await req.json();
  if (!recipient || !type || !title || !message) {
    throw new ApiError("Champs manquants pour créer la notification.");
  }

  await connectDB();
  const notification = await Notification.create({ recipient, type, title, message, link });
  return NextResponse.json({ notification }, { status: 201 });
});
