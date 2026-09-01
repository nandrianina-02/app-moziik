import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Artist from "@/models/Artist";
import Song from "@/models/Song";
import Album from "@/models/Album";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, adminUserCreateSchema } from "@/lib/validation";
import { genererUsername } from "@/lib/username";
import Subscription from "@/models/Subscription";
import { construireFiltreComptes, filtresDepuisUrl } from "@/lib/adminUserQuery";
import { hasPremiumAccess } from "@/lib/premium";

const TAILLE_PAGE_MAX = 200;

/**
 * L'annuaire des comptes, tel que l'écran d'administration en a besoin :
 * une page de résultats, les compteurs qui la surplombent, et la file des
 * artistes qui attendent leur vérification.
 *
 * Tout est calculé côté serveur. La version précédente renvoyait la table
 * entière et laissait le navigateur filtrer : passable à cent comptes,
 * intenable à dix mille.
 */
export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const taille = Math.min(TAILLE_PAGE_MAX, Math.max(1, Number(searchParams.get("limit") ?? 10) || 10));

  await connectDB();

  // Le même filtre que celui des actions de masse, pour que « tous les
  // résultats » désigne exactement ce que la table montre.
  const query = construireFiltreComptes(filtresDepuisUrl(searchParams));

  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);
  const debutMoisPrecedent = new Date(debutMois);
  debutMoisPrecedent.setMonth(debutMoisPrecedent.getMonth() - 1);

  const [
    total,
    utilisateurs,
    totalComptes,
    membres,
    artistes,
    admins,
    nouveauxCeMois,
    nouveauxMoisPrecedent,
    actifs,
    enAttente,
    suspendus,
    aVerifier,
  ] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .select("-passwordHash -resetToken -verificationToken")
      .sort({ createdAt: -1 })
      .skip((page - 1) * taille)
      .limit(taille)
      .lean(),
    User.countDocuments({}),
    User.countDocuments({ role: "member" }),
    User.countDocuments({ role: "artist" }),
    User.countDocuments({ role: "admin" }),
    User.countDocuments({ createdAt: { $gte: debutMois } }),
    User.countDocuments({ createdAt: { $gte: debutMoisPrecedent, $lt: debutMois } }),
    User.countDocuments({ suspended: false, emailVerified: true }),
    User.countDocuments({ suspended: false, emailVerified: false }),
    User.countDocuments({ suspended: true }),
    User.find({ role: "artist", verifiedArtist: false, suspended: false })
      .select("name email avatarUrl createdAt")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
  ]);

  // Profils artistes et volumes publiés, pour les seuls comptes affichés.
  const idsArtistes = utilisateurs.filter((u) => u.role === "artist").map((u) => u._id);
  const profils = idsArtistes.length
    ? await Artist.find({ user: { $in: idsArtistes } }).select("user eventPublishingAuthorized").lean()
    : [];
  const profilParUtilisateur = new Map(profils.map((a) => [a.user.toString(), a]));
  const idsProfils = profils.map((a) => a._id);

  const [morceaux, albums] = await Promise.all([
    idsProfils.length
      ? Song.aggregate<{ _id: Types.ObjectId; n: number }>([
          { $match: { artist: { $in: idsProfils } } },
          { $group: { _id: "$artist", n: { $sum: 1 } } },
        ])
      : [],
    idsProfils.length
      ? Album.aggregate<{ _id: Types.ObjectId; n: number }>([
          { $match: { artist: { $in: idsProfils } } },
          { $group: { _id: "$artist", n: { $sum: 1 } } },
        ])
      : [],
  ]);
  const morceauxParArtiste = new Map(morceaux.map((m) => [m._id.toString(), m.n]));
  const albumsParArtiste = new Map(albums.map((a) => [a._id.toString(), a.n]));

  // L'abonnement des seuls comptes affichés : la colonne « Premium » doit
  // dire ce qui est vrai maintenant, échéance comprise.
  const abonnements = await Subscription.find({ user: { $in: utilisateurs.map((u) => u._id) } })
    .select("user plan status paymentMethod currentPeriodEnd grantedBy")
    .sort({ startedAt: -1 })
    .lean();
  const abonnementParUtilisateur = new Map<string, (typeof abonnements)[number]>();
  for (const abonnement of abonnements) {
    // Trié du plus récent au plus ancien : le premier vu fait foi.
    const cle = abonnement.user.toString();
    if (!abonnementParUtilisateur.has(cle)) abonnementParUtilisateur.set(cle, abonnement);
  }

  const enrichis = utilisateurs.map((u) => {
    const profil = profilParUtilisateur.get(u._id.toString());
    const idProfil = profil?._id?.toString();
    const abonnement = abonnementParUtilisateur.get(u._id.toString());
    return {
      ...u,
      artistId: profil?._id ?? null,
      eventPublishingAuthorized: profil?.eventPublishingAuthorized ?? false,
      songsCount: idProfil ? morceauxParArtiste.get(idProfil) ?? 0 : 0,
      albumsCount: idProfil ? albumsParArtiste.get(idProfil) ?? 0 : 0,
      premium: {
        actif: hasPremiumAccess({ role: u.role, subscription: abonnement }),
        offert: abonnement?.paymentMethod === "offert",
        /** Absente = sans échéance. */
        jusquAu: abonnement?.currentPeriodEnd ?? null,
      },
    };
  });

  /** Croissance en pourcentage, sans division par zéro ni infini affiché. */
  const croissance = (nouveaux: number, base: number) =>
    base > 0 ? Math.round((nouveaux / base) * 1000) / 10 : nouveaux > 0 ? 100 : 0;

  return NextResponse.json({
    users: enrichis,
    total,
    page,
    pageSize: taille,
    pages: Math.max(1, Math.ceil(total / taille)),
    stats: {
      total: totalComptes,
      members: membres,
      artists: artistes,
      admins,
      newThisMonth: nouveauxCeMois,
      // Comparé au socle d'avant ce mois-ci pour les trois premiers
      // compteurs, et au même mois précédent pour les nouveaux : ce sont
      // deux questions différentes, elles n'ont pas la même référence.
      growth: {
        total: croissance(nouveauxCeMois, totalComptes - nouveauxCeMois),
        members: croissance(nouveauxCeMois, Math.max(1, membres)),
        artists: croissance(nouveauxCeMois, Math.max(1, artistes)),
        new:
          nouveauxMoisPrecedent > 0
            ? Math.round(((nouveauxCeMois - nouveauxMoisPrecedent) / nouveauxMoisPrecedent) * 1000) / 10
            : nouveauxCeMois > 0
              ? 100
              : 0,
      },
      statuses: { active: actifs, pending: enAttente, suspended: suspendus },
    },
    pending: aVerifier,
  });
});

/**
 * Création d'un compte par l'administration.
 *
 * L'adresse est considérée comme vérifiée : c'est un humain de l'équipe qui
 * la saisit, pas un inconnu qui s'inscrit. Le mot de passe provisoire est
 * renvoyé une seule fois, en clair, dans cette réponse — il n'est stocké
 * que haché, et personne ne pourra le relire ensuite.
 */
export const POST = withApiErrors(async (req: Request) => {
  await requireAdmin(req);

  const { name, email, role, password } = parseOrThrow(adminUserCreateSchema, await req.json());

  await connectDB();
  const existant = await User.findOne({ email });
  if (existant) throw new ApiError("Un compte existe déjà avec cet email.", 409);

  const motDePasse = password?.trim() || randomUUID().slice(0, 12);
  const passwordHash = await bcrypt.hash(motDePasse, 12);

  const user = await User.create({
    name,
    username: await genererUsername(name),
    email,
    passwordHash,
    role,
    emailVerified: true,
  });

  // Un compte artiste sans profil n'apparaîtrait nulle part côté public :
  // on le crée dans la foulée, comme le fait la promotion de rôle.
  if (role === "artist") {
    await Artist.create({ user: user._id, stageName: name });
  }

  return NextResponse.json(
    {
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
      temporaryPassword: motDePasse,
    },
    { status: 201 }
  );
});
