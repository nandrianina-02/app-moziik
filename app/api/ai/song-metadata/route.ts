import { NextResponse } from "next/server";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { getSiteConfig } from "@/lib/siteConfig";
import { parseOrThrow, aiSongMetadataSchema } from "@/lib/validation";
import { proposerMetadonnees } from "@/lib/ai/songMetadata";

/**
 * Propositions de métadonnées pour un titre en cours de publication.
 *
 * Rien n'est enregistré : la réponse remonte au formulaire, qui l'affiche
 * champ par champ. C'est l'artiste qui applique ce qu'il retient, et lui
 * seul qui publie.
 *
 * Les genres proviennent de la configuration du site, pas du navigateur :
 * le formulaire pourrait en envoyer d'autres, et la liste des genres est
 * précisément ce qui empêche la proposition de créer des catégories que
 * le site ne connaît pas.
 */
export const dynamic = "force-dynamic";

export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  if (authUser.role !== "artist" && authUser.role !== "admin") {
    throw new ApiError("Seuls les artistes peuvent publier un son.", 403);
  }

  const { title, artistName, lyrics, album, languages } = parseOrThrow(aiSongMetadataSchema, await req.json());

  const config = await getSiteConfig();

  const proposition = await proposerMetadonnees({
    titre: title,
    artiste: artistName,
    paroles: lyrics,
    album,
    genres: config.genres ?? [],
    langues: languages,
    compte: authUser.id,
  });

  return NextResponse.json({ proposition }, { headers: { "Cache-Control": "no-store" } });
});
