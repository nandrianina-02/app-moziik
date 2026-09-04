import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SupportThread from "@/models/SupportThread";
import SupportMessage from "@/models/SupportMessage";
import HelpArticle from "@/models/HelpArticle";
import { withApiErrors } from "@/lib/apiError";
import { requireAdmin } from "@/lib/requireAdmin";
import { motsDe, normaliser } from "@/lib/searchText";
import { etendre } from "@/lib/ai/synonymes";

/**
 * Ce sur quoi l'assistant a passé la main.
 *
 * POURQUOI CET ÉCRAN EXISTE
 *
 * On savait combien de fils avaient été escaladés, jamais sur quoi. Or
 * c'est la seule information qui dise quel article écrire ensuite : sans
 * elle, on complète le centre d'aide au jugé, et l'on écrit trois fiches
 * sur des sujets que personne ne demande pendant que la vraie question
 * revient chaque semaine.
 *
 * CE QUE MESURE LA COLONNE « COUVERT »
 *
 * Pour chaque mot des questions escaladées, on regarde si un article
 * publié le contient — synonymes compris, sinon « fandoavana » passerait
 * pour un trou alors que l'article « paiement » existe. Un mot fréquent
 * et non couvert est un article à écrire ; un mot fréquent et couvert
 * signale plutôt un article à compléter, ou mal titré.
 *
 * CE QUE ÇA NE DIT PAS
 *
 * Qu'une escalade était évitable. Un remboursement doit être escaladé :
 * c'est une décision, pas une information. L'écran donne la matière, il
 * ne juge pas à la place de l'équipe.
 */

/** Assez de fils pour voir une tendance, pas assez pour peser sur la base. */
const FILS_MAX = 60;
/** Mots trop courants pour rien apprendre. */
const VIDES = new Set([
  "bonjour", "bonsoir", "merci", "svp", "plait", "salut", "oui", "non",
  "pour", "avec", "dans", "sur", "que", "qui", "quoi", "comment", "pourquoi",
  "mon", "mes", "moi", "vous", "nous", "est", "les", "des", "une", "cette",
  "veux", "peux", "fait", "faire", "avoir", "etre", "aide", "aider", "aidez",
  "the", "and", "you", "please", "hello",
]);

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();

  const fils = await SupportThread.find({ humanRequested: true })
    .sort({ lastMessageAt: -1 })
    .limit(FILS_MAX)
    .select("user userName userEmail lastMessageAt status")
    .lean();

  const [articles, questions] = await Promise.all([
    HelpArticle.find({ published: true }).select("title category body").lean(),
    // Toutes les questions des fils escaladés, pas seulement la dernière :
    // l'assistant a souvent répondu deux fois avant de céder, et c'est la
    // question du milieu qui dit ce qui manquait.
    SupportMessage.find({
      thread: { $in: fils.map((f) => f._id) },
      author: "user",
    })
      .sort({ createdAt: -1 })
      .select("thread body createdAt")
      .lean(),
  ]);

  const corpus = normaliser(articles.map((a) => `${a.title} ${a.category} ${a.body}`).join(" "));

  const parFil = new Map<string, { body: string; createdAt: Date }[]>();
  for (const m of questions) {
    const cle = String(m.thread);
    const liste = parFil.get(cle);
    if (liste) liste.push({ body: m.body, createdAt: m.createdAt });
    else parFil.set(cle, [{ body: m.body, createdAt: m.createdAt }]);
  }

  const compte = new Map<string, { occurrences: number; couvert: boolean }>();

  const escalades = fils.map((f) => {
    const messages = (parFil.get(String(f._id)) ?? []).slice(0, 4);
    for (const m of messages) {
      // `etendre` sert ici à la couverture, pas au comptage : c'est le mot
      // écrit par la personne qu'on affiche, mais on le tient pour couvert
      // si l'un de ses équivalents figure dans un article.
      for (const mot of new Set(motsDe(m.body).filter((x) => x.length >= 4 && !VIDES.has(x)))) {
        const deja = compte.get(mot);
        const couvert =
          deja?.couvert ?? etendre([mot]).some((variante) => corpus.includes(variante));
        compte.set(mot, { occurrences: (deja?.occurrences ?? 0) + 1, couvert });
      }
    }

    return {
      _id: String(f._id),
      membre: f.userName || "Membre",
      email: f.userEmail || "",
      statut: f.status,
      dernierMessageLe: f.lastMessageAt ? new Date(f.lastMessageAt).toISOString() : null,
      questions: messages.map((m) => m.body.slice(0, 300)),
    };
  });

  const mots = [...compte.entries()]
    .map(([mot, v]) => ({ mot, ...v }))
    .sort((a, b) => Number(a.couvert) - Number(b.couvert) || b.occurrences - a.occurrences)
    .slice(0, 40);

  const [totalFils, totalEscalades] = await Promise.all([
    SupportThread.countDocuments(),
    SupportThread.countDocuments({ humanRequested: true }),
  ]);

  return NextResponse.json({
    escalades,
    mots,
    resume: {
      fils: totalFils,
      escalades: totalEscalades,
      articles: articles.length,
      // Le taux dit s'il faut s'inquiéter ; les mots disent quoi faire.
      taux: totalFils > 0 ? Math.round((totalEscalades / totalFils) * 100) : 0,
    },
  });
});
