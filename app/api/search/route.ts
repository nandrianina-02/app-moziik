import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { withApiErrors } from "@/lib/apiError";
import {
  rechercheGlobale,
  type TriRecherche,
  type TypeFiltre,
} from "@/lib/search";
import { universDeLaRequete } from "@/lib/universServer";

/**
 * Recherche globale : GET /api/search?q=…
 *
 * Paramètres
 *   q        la saisie (2 caractères minimum)
 *   type     all | songs | artists | albums | playlists | events | genres | users
 *   page     à partir de 1 — n'a d'effet que si `type` n'est pas « all »
 *   limit    taille de page (max 50)
 *   sort     relevance (défaut) | popularity | date
 *   genre    filtre supplémentaire sur les titres
 *   artist   filtre supplémentaire (identifiant d'artiste)
 *   album    filtre supplémentaire (identifiant d'album)
 *
 * La réponse est structurée en sections (voir lib/search.ts), auxquelles
 * s'ajoutent deux tableaux à plat, `songs` et `artists` : c'est le format
 * que renvoyait cette route auparavant, et deux écrans l'utilisent encore
 * (modale d'ajout à une playlist, recherche hors-ligne). Les retirer
 * aurait cassé des fonctionnalités qui marchent.
 */

const TYPES: TypeFiltre[] = ["all", "songs", "artists", "albums", "playlists", "events", "genres", "users"];
const TRIS: TriRecherche[] = ["relevance", "popularity", "date"];

export const GET = withApiErrors(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().slice(0, 100) ?? "";

  const typeDemande = searchParams.get("type") as TypeFiltre | null;
  const type: TypeFiltre = typeDemande && TYPES.includes(typeDemande) ? typeDemande : "all";
  const triDemande = searchParams.get("sort") as TriRecherche | null;
  const sort: TriRecherche = triDemande && TRIS.includes(triDemande) ? triDemande : "relevance";

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

  if (q.length < 2) {
    return NextResponse.json({
      q,
      type,
      page,
      limit,
      focus: null,
      top: null,
      sections: [],
      counts: {},
      genresDisponibles: [],
      approximatif: false,
      songs: [],
      artists: [],
    });
  }

  await connectDB();

  const resultat = await rechercheGlobale({
    q,
    type,
    page,
    limit,
    sort,
    genre: searchParams.get("genre") ?? undefined,
    artistId: searchParams.get("artist") ?? undefined,
    albumId: searchParams.get("album") ?? undefined,
    univers: await universDeLaRequete(req),
  });

  // Compatibilité : les appelants historiques lisent `songs` / `artists`.
  const plat = (kind: string) =>
    resultat.sections.filter((sec) => sec.kind === kind).flatMap((sec) => sec.items);
  const parId = <T extends { _id?: unknown }>(items: T[]) => {
    const vus = new Set<string>();
    return items.filter((i) => {
      const cle = String(i._id ?? "");
      if (!cle || vus.has(cle)) return false;
      vus.add(cle);
      return true;
    });
  };

  return NextResponse.json({
    ...resultat,
    songs: parId(plat("song")).slice(0, 30),
    artists: parId(plat("artist")).slice(0, 20),
  });
});
