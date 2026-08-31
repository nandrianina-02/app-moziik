import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { getSiteConfig } from "@/lib/siteConfig";
import { parseOrThrow, aiPlaylistSchema } from "@/lib/validation";
import { composerPlaylist } from "@/lib/ai/playlistBuilder";
import { universDeLaRequete } from "@/lib/universServer";

/**
 * Une playlist proposée à partir d'une phrase.
 *
 * Rien n'est enregistré : la réponse est un aperçu, avec les morceaux
 * réels et leurs pochettes. La playlist n'existe qu'après le clic de
 * l'auditeur, sur /api/playlists — une proposition qui créerait
 * directement remplirait la bibliothèque d'essais abandonnés.
 *
 * `proposition: null` n'est pas une erreur : c'est un catalogue trop
 * maigre pour composer quoi que ce soit, ou une demande dont rien de
 * musical ne ressort. Le message le dit tel quel.
 */
export const dynamic = "force-dynamic";

export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  const { demande } = parseOrThrow(aiPlaylistSchema, await req.json());

  const config = await getSiteConfig();

  const proposition = await composerPlaylist({
    demande,
    genresConnus: config.genres ?? [],
    compte: authUser.id,
    univers: await universDeLaRequete(req, { compte: authUser.id }),
  });

  return NextResponse.json({ proposition }, { headers: { "Cache-Control": "no-store" } });
});
