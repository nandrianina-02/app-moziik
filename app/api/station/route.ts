import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { getAuthUser } from "@/lib/mobileAuth";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { estMoment, momentDeLHeure, type Moment } from "@/lib/taste/context";
import { libelleMotif } from "@/lib/taste/motifs";
import { profilDe, profilVide, genresPreferes } from "@/lib/taste/profile";
import { construireStation, PAR_TOUR } from "@/lib/taste/station";
import { presenterStation } from "@/lib/ai/dj";

/**
 * La station personnalisée d'un auditeur.
 *
 * GET /api/station?heure=14&exclus=<id,id,…>&suite=1
 *
 * POURQUOI L'HEURE VIENT DU CLIENT
 *
 * Le serveur ne sait pas quelle heure il est *chez l'auditeur*. Lire
 * l'horloge du serveur proposerait de la musique de nuit à quelqu'un qui
 * prend son petit-déjeuner, selon l'endroit où l'application est
 * déployée. Le navigateur envoie donc son heure locale ; une valeur
 * absente ou aberrante retombe simplement sur « dans la journée ».
 *
 * `exclus` porte ce que l'auditeur a déjà dans sa file, ce qui permet de
 * prolonger la station indéfiniment sans jamais resservir un morceau.
 *
 * `suite=1` demande la suite d'une station déjà lancée : on saute alors
 * la présentation, qui est déjà affichée et coûterait un appel au modèle
 * à chaque prolongement.
 */

/** Au-delà, la liste d'exclusion vient d'ailleurs que d'une file d'écoute. */
const EXCLUS_MAX = 400;

function lireExclus(brut: string | null): Set<string> {
  if (!brut) return new Set();
  return new Set(
    brut
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^[0-9a-fA-F]{24}$/.test(s))
      .slice(0, EXCLUS_MAX)
  );
}

function lireMoment(brut: string | null): Moment {
  if (brut && estMoment(brut)) return brut;
  const heure = Number(brut);
  return Number.isFinite(heure) ? momentDeLHeure(heure) : "journee";
}

export const GET = withApiErrors(async (req: Request) => {
  // Une station coûte plusieurs agrégations : sans plafond, un
  // rechargement en boucle suffirait à occuper la base.
  checkRateLimitByIp("station", { limit: 60, windowMs: 10 * 60 * 1000 });

  const { searchParams } = new URL(req.url);
  const moment = lireMoment(searchParams.get("heure") ?? searchParams.get("moment"));
  const exclus = lireExclus(searchParams.get("exclus"));
  const suite = searchParams.get("suite") === "1";
  const taille = Math.min(Math.max(Number(searchParams.get("limit")) || PAR_TOUR, 5), 40);

  const authUser = await getAuthUser(req);
  // Un visiteur non connecté n'a pas d'historique : la station existe
  // quand même, elle est simplement la même pour tout le monde — et le
  // dit (`personnalisee: false`).
  const profil = authUser ? await profilDe(authUser.id) : profilVide();

  const station = await construireStation({ profil, moment, exclus, taille });

  const songs = station.titres.map((t) => t.song);
  const motifs = station.titres.map((t) => ({
    songId: String((t.song as { _id: unknown })._id),
    motif: t.motif,
    // Rendu côté serveur pour que le client n'ait rien à recomposer, et
    // que l'explication affichée soit exactement celle du moteur.
    libelle: libelleMotif(t.motif),
  }));

  if (suite) {
    return NextResponse.json(
      { songs, motifs, personnalisee: station.personnalisee, moment },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const noms = [
    ...new Set(
      songs
        .map((s) => (s as { artist?: { stageName?: string } | null }).artist?.stageName)
        .filter((n): n is string => Boolean(n))
    ),
  ];

  const presentation = await presenterStation({
    genres: profil.assezDeDonnees ? genresPreferes(profil, 5) : [],
    artistes: noms,
    moment,
    personnalisee: station.personnalisee,
    compte: authUser?.id ?? "anonyme",
  });

  return NextResponse.json(
    { songs, motifs, personnalisee: station.personnalisee, moment, presentation },
    { headers: { "Cache-Control": "no-store" } }
  );
});
