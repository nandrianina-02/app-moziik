import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SupportThread from "@/models/SupportThread";
import SupportMessage from "@/models/SupportMessage";
import User from "@/models/User";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { parseOrThrow, supportMessageSchema } from "@/lib/validation";

/**
 * Le fil de support du membre connecté.
 *
 * Une seule route pour lire et écrire : côté membre il n'existe qu'un fil,
 * celui-ci, et le distinguer d'un identifiant n'apporterait rien.
 *
 * Le panneau de discussion rappelle cette route toutes les quelques
 * secondes avec `after` : le serveur ne renvoie alors que les messages
 * postérieurs, et la conversation ne se recharge pas en entier à chaque
 * battement. Le service worker ne met jamais `/api/` en cache, donc ces
 * réponses sont toujours fraîches et ne fuient pas d'un compte à l'autre.
 */
export const dynamic = "force-dynamic";

const APERCU_MAX = 120;
const SANS_CACHE = { "Cache-Control": "no-store" };

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  const { searchParams } = new URL(req.url);
  const after = searchParams.get("after");
  // Le panneau est ouvert sous les yeux du membre : ce qui arrive est lu.
  const panneauOuvert = searchParams.get("open") === "1";

  await connectDB();

  const thread = await SupportThread.findOne({ user: authUser.id });
  if (!thread) return NextResponse.json({ thread: null, messages: [] }, { headers: SANS_CACHE });

  const query: Record<string, unknown> = { thread: thread._id };
  const depuis = after ? new Date(after) : null;
  if (depuis && !Number.isNaN(depuis.getTime())) query.createdAt = { $gt: depuis };

  const messages = await SupportMessage.find(query).sort({ createdAt: 1 }).limit(200);

  if (panneauOuvert && thread.unreadForUser > 0) {
    thread.unreadForUser = 0;
    await thread.save();
  }

  return NextResponse.json(
    {
      thread: {
        _id: String(thread._id),
        status: thread.status,
        unreadForUser: panneauOuvert ? 0 : thread.unreadForUser,
        lastMessageAt: thread.lastMessageAt,
      },
      messages,
    },
    { headers: SANS_CACHE }
  );
});

export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  // Par compte, pas par IP : plusieurs membres partagent souvent une même
  // sortie réseau, et l'un ne doit pas faire taire les autres.
  checkRateLimit(`support:${authUser.id}`, { limit: 20, windowMs: 5 * 60 * 1000 });

  const { body } = parseOrThrow(supportMessageSchema, await req.json());

  await connectDB();

  const compte = await User.findById(authUser.id).select("name email");
  const apercu = body.replace(/\s+/g, " ").slice(0, APERCU_MAX);

  // Upsert : deux envois simultanés depuis deux onglets créeraient sinon
  // deux fils pour le même membre, et l'index unique ferait échouer le
  // second au lieu de le rattacher au fil existant.
  const thread = await SupportThread.findOneAndUpdate(
    { user: authUser.id },
    {
      $set: {
        userName: compte?.name ?? "",
        userEmail: compte?.email ?? "",
        // Écrire rouvre un fil clos : demander au membre de le rouvrir
        // lui-même serait une étape sans objet.
        status: "open",
        lastMessageAt: new Date(),
        lastMessagePreview: apercu,
        lastMessageFrom: "user",
      },
      $inc: { unreadForAdmin: 1 },
      $setOnInsert: { user: authUser.id, unreadForUser: 0, createdAt: new Date() },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const message = await SupportMessage.create({
    thread: thread._id,
    author: "user",
    authorUser: authUser.id,
    authorName: compte?.name ?? "",
    body,
  });

  return NextResponse.json({ message, thread: { _id: String(thread._id), status: thread.status } }, { status: 201 });
});

