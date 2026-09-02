import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, inspectImportSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

/**
 * Deux questions posées d'un coup pour tout un lot de fichiers, afin de
 * n'avoir qu'un aller-retour quel que soit le nombre de morceaux :
 *   1. à quel profil Artist correspond le nom lu dans les balises ?
 *   2. ce titre existe-t-il déjà au catalogue ?
 *
 * La comparaison passe par une collation MongoDB de force 2 : insensible à
 * la casse, sensible aux accents. « HIALAO » retrouve « Hialao », mais
 * « Mamela » et « Maméla » restent deux morceaux distincts — c'est le bon
 * arbitrage pour un catalogue malgache et francophone.
 *
 * ---
 *
 * **Deux appelants, deux portées.**
 *
 * L'administration importe pour n'importe quel artiste : elle a besoin du
 * rapprochement par nom, et des homonymes de tout le catalogue.
 *
 * Un artiste, lui, n'importe que pour lui-même. Le nom lu dans les balises
 * n'a plus à être rapproché — c'est forcément lui — et les doublons ne se
 * cherchent que dans son propre catalogue. Signaler qu'un autre artiste a
 * un morceau du même nom ne l'aiderait pas, et lui apprendrait au passage
 * ce que contient le catalogue des autres.
 */
const COLLATION = { locale: "fr", strength: 2 as const };

export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  const { items } = parseOrThrow(inspectImportSchema, await req.json());

  await connectDB();

  const estAdmin = authUser.role === "admin";
  const profil = estAdmin ? null : await Artist.findOne({ user: authUser.id });

  // Un compte sans profil artiste n'a rien à importer. Le droit de
  // publier, lui, est vérifié par /api/songs : cette route ne fait que
  // renseigner, elle n'écrit rien.
  if (!estAdmin && !profil) throw new ApiError("Profil artiste introuvable.", 403);

  const cle = (v: string) => v.trim().toLowerCase();
  const titres = [...new Set(items.map((i) => i.titre))];

  const filtreTitres = profil
    ? { title: { $in: titres }, artist: profil._id }
    : { title: { $in: titres } };

  const nomsDartistes = estAdmin
    ? [...new Set(items.map((i) => i.artiste).filter((n): n is string => !!n))]
    : [];

  const [artistes, chansons] = await Promise.all([
    nomsDartistes.length > 0
      ? Artist.find({ stageName: { $in: nomsDartistes } })
          .collation(COLLATION)
          .select("stageName verified coverUrl")
      : Promise.resolve([]),
    Song.find(filtreTitres)
      .collation(COLLATION)
      .select("title artist status")
      .populate("artist", "stageName"),
  ]);

  const parNom = new Map(artistes.map((a) => [cle(a.stageName), a]));

  const resultats = items.map((item) => {
    // Pour un artiste, le rapprochement est déjà fait : c'est lui.
    const artiste = profil ?? (item.artiste ? parNom.get(cle(item.artiste)) : undefined);

    // Un doublon, c'est le même titre chez le même artiste. Quand l'artiste
    // du fichier n'est pas reconnu, on signale quand même les titres
    // homonymes — mais en renvoyant le nom de leur artiste, pour que
    // l'administration tranche au lieu de subir un blocage aveugle.
    const homonymes = chansons.filter((s) => cle(s.title) === cle(item.titre));
    const correspondance = artiste
      ? homonymes.find(
          (s) => String((s.artist as { _id?: unknown } | null)?._id ?? s.artist) === String(artiste._id)
        )
      : homonymes[0];

    return {
      artiste: artiste
        ? { _id: String(artiste._id), stageName: artiste.stageName, verified: !!artiste.verified }
        : null,
      doublon: correspondance
        ? {
            _id: String(correspondance._id),
            title: correspondance.title,
            status: correspondance.status,
            artistName:
              (correspondance.artist as { stageName?: string } | null)?.stageName ?? "Artiste inconnu",
            // Sans artiste reconnu, l'homonymie ne prouve rien : c'est une
            // alerte, pas un constat.
            certain: !!artiste,
          }
        : null,
    };
  });

  return NextResponse.json({ resultats });
});
