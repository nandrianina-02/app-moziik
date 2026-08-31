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
  const role = searchParams.get("role") ?? "";
  const statut = searchParams.get("status") ?? "";
  const verifie = searchParams.get("verified") ?? "";
  const search = (searchParams.get("search") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const taille = Math.min(TAILLE_PAGE_MAX, Math.max(1, Number(searchParams.get("limit") ?? 10) || 10));

  await connectDB();

  const query: Record<string, unknown> = {};
  if (role === "member" || role === "artist" || role === "admin") query.role = role;

  // Les trois états d'un compte, tels qu'ils existent vraiment : en attente
  // tant que l'adresse n'est pas confirmée, suspendu si l'administration l'a
  // décidé, actif sinon.
  if (statut === "active") Object.assign(query, { suspended: false, emailVerified: true });
  if (statut === "pending") Object.assign(query, { emailVerified: false, suspended: false });
  if (statut === "suspended") query.suspended = true;

  if (verifie === "yes") query.verifiedArtist = true;
  if (verifie === "no") query.verifiedArtist = false;

  if (search) {
    // Les caractères spéciaux d'une recherche sont échappés : « a+b » ne doit
    // pas devenir une expression régulière qui ne trouve rien, ou pire, qui
    // fait travailler la base pour rien.
    const motif = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { name: { $regex: motif, $options: "i" } },
      { email: { $regex: motif, $options: "i" } },
    ];
  }

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

  const enrichis = utilisateurs.map((u) => {
    const profil = profilParUtilisateur.get(u._id.toString());
    const idProfil = profil?._id?.toString();
    return {
      ...u,
      artistId: profil?._id ?? null,
      eventPublishingAuthorized: profil?.eventPublishingAuthorized ?? false,
      songsCount: idProfil ? morceauxParArtiste.get(idProfil) ?? 0 : 0,
      albumsCount: idProfil ? albumsParArtiste.get(idProfil) ?? 0 : 0,
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
