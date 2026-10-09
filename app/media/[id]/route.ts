import { NextResponse } from "next/server";
import { estIdentifiantFichier } from "@/lib/fichiers";
import { dossierStockage, infosFichier, lienLecture, stockageActif } from "@/lib/karaksStorage";

/**
 * Adresse stable d'un fichier rangé sur Karaks Storage (voir lib/fichiers.ts).
 *
 * - Une image est relayée, avec une mise en cache d'un an : un fichier ne
 *   change jamais sous un même identifiant (le remplacer en crée un autre),
 *   et le réseau de Vercel la garde au plus près des visiteurs. Elle passe
 *   aussi par `next/image`, qui la redimensionne.
 * - Un clip ou une pièce jointe est servi par redirection vers un lien
 *   signé : les octets ne passent pas par une fonction, et la lecture par
 *   plages fonctionne.
 * - La source d'un titre n'est jamais servie ici : elle s'écoute par
 *   `/api/stream`, qui applique la qualité de l'abonnement et le quota.
 */

const INTROUVABLE = () => new NextResponse("Fichier introuvable.", { status: 404 });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!stockageActif() || !estIdentifiantFichier(params.id)) return INTROUVABLE();

  try {
    const fichier = await infosFichier(params.id);
    if (!fichier || fichier.statut !== "active") return INTROUVABLE();
    if (fichier.dossierId && fichier.dossierId === (await dossierStockage("songs"))) return INTROUVABLE();

    if (fichier.type.startsWith("image/")) {
      const source = await fetch(await lienLecture(params.id), { cache: "no-store" });
      if (!source.ok || !source.body) return INTROUVABLE();
      const entetes = new Headers({
        "Content-Type": fichier.type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      });
      const longueur = source.headers.get("content-length");
      if (longueur) entetes.set("Content-Length", longueur);
      // Un SVG ouvert directement ne doit rien exécuter.
      if (fichier.type === "image/svg+xml") entetes.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      return new NextResponse(source.body, { status: 200, headers: entetes });
    }

    return NextResponse.redirect(await lienLecture(params.id), {
      status: 302,
      headers: { "Cache-Control": "private, max-age=600" },
    });
  } catch (erreur) {
    console.error("[media]", erreur instanceof Error ? erreur.message : erreur);
    return new NextResponse("Le service de stockage est momentanément indisponible.", { status: 503 });
  }
}
