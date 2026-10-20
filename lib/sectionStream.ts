import { NextResponse } from "next/server";
import {
  preparePageSections,
  type FenetreSections,
  type HomepageViewer,
} from "@/lib/homeContentEngine";
import type { SectionPage } from "@/models/HomepageSection";
import { masquerAudio } from "@/lib/audioPublic";
import type { Univers } from "@/lib/univers";
import type { Mode } from "@/lib/modes";

/**
 * Diffuse les sections d'une page en NDJSON : une ligne JSON par
 * évènement, envoyée dès qu'elle est prête.
 *
 *   {"type":"meta","sections":[{"key":"new_releases","title":"Nouveautés"},...],"depuis":0,"suivant":6,"encore":true}
 *   {"type":"hero","data":{...}}
 *   {"type":"section","key":"genres","data":[...]}
 *   {"type":"end"}
 *
 * La ligne `meta` part immédiatement : le navigateur connaît donc l'ordre
 * et les titres définitifs avant qu'aucune donnée ne soit calculée, et
 * peut dessiner la page complète en squelettes — plus de saut de mise en
 * page quand les données arrivent. Chaque section remplace ensuite son
 * squelette à son propre rythme.
 *
 * Une seule requête HTTP par lot : pas de démarrage à froid supplémentaire
 * par section, contrairement à un point d'entrée par section.
 *
 * PAR LOTS, ET POURQUOI
 *
 * L'accueil peut porter plusieurs dizaines de sections activées. Les
 * calculer toutes à chaque visite coûte autant de requêtes MongoDB pour
 * du contenu que la plupart des visiteurs ne feront jamais défiler. Avec
 * `?depuis=`, le serveur n'en calcule qu'une tranche et dit par `encore`
 * s'il en reste ; le navigateur redemande la suivante quand le bas de la
 * page approche.
 *
 * Sans `?depuis=`, tout est calculé comme avant : c'est ce que fait un
 * client déjà en production dont le JavaScript n'a pas encore été
 * remplacé, et il continue donc de voir la page entière.
 */

/**
 * Taille d'un lot. Six sections remplissent environ deux écrans de
 * téléphone : assez pour qu'un défilement normal n'attende jamais le
 * réseau, assez peu pour qu'une visite sans défilement ne paie pas le
 * calcul de trente sections.
 */
export const TRANCHE_SECTIONS = 6;

/** Rang de départ demandé par le client, ou `undefined` s'il veut tout. */
export function fenetreDemandee(req: Request): FenetreSections | undefined {
  const brut = new URL(req.url).searchParams.get("depuis");
  if (brut === null) return undefined;
  const depuis = Number.parseInt(brut, 10);
  return { depuis: Number.isFinite(depuis) && depuis > 0 ? depuis : 0, combien: TRANCHE_SECTIONS };
}

export async function streamPageSections(
  page: SectionPage,
  viewer: HomepageViewer,
  univers: Univers,
  mode: Mode,
  fenetre?: FenetreSections
): Promise<NextResponse> {
  // Volontairement avant la création du flux : une base injoignable doit
  // encore produire un vrai 503 via withApiErrors. Une fois les en-têtes
  // envoyés, il n'est plus possible de changer le code de statut.
  const prepared = await preparePageSections(page, viewer, univers, mode, fenetre);

  // Les calculs sont déjà lancés. On leur attache un gestionnaire dans la
  // même continuation que le `await` ci-dessus : sans cela, une section qui
  // échoue avant l'ouverture du flux déclencherait un rejet non géré.
  const hero = prepared.hero.then(
    (data) => ({ ok: true as const, data }),
    () => ({ ok: false as const, data: null })
  );
  const sections = prepared.sections.map((section) => ({
    id: section.id,
    key: section.key,
    result: section.payload.then(
      (data) => ({ ok: true as const, data }),
      () => ({ ok: false as const, data: null })
    ),
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: unknown) {
        // Un flux ne passe pas par withApiErrors : l'audio brut des titres est retiré ici.
        const ligne = JSON.stringify(event);
        const propre = ligne.includes('"audioUrl"') ? JSON.stringify(masquerAudio(JSON.parse(ligne))) : ligne;
        controller.enqueue(encoder.encode(`${propre}\n`));
      }

      send({
        type: "meta",
        sections: prepared.sections.map((s) => ({ id: s.id, key: s.key, title: s.title })),
        depuis: prepared.depuis,
        suivant: prepared.suivant,
        encore: prepared.encore,
      });

      await Promise.all([
        // Un lot suivant n'annonce pas de héros : envoyer `data: []` ici
        // effacerait la bannière déjà affichée.
        ...(prepared.avecHero
          ? [
              hero.then((res) => {
                if (res.ok) send({ type: "hero", data: res.data });
                else send({ type: "failed", id: "hero", key: "hero" });
              }),
            ]
          : []),
        ...sections.map(({ id, key, result }) =>
          result.then((res) => {
            // `data` nul = section volontairement omise (contenu vide ou en
            // échec, déjà journalisé côté moteur). Le client doit retirer
            // son squelette dans les deux cas, d'où l'évènement.
            if (res.ok && res.data) send({ type: "section", id, key, title: res.data.title, data: res.data.data });
            else send({ type: "failed", id, key });
          })
        ),
      ]);

      send({ type: "end" });
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Empêche un proxy nginx d'accumuler la réponse avant de la
      // transmettre — ce qui annulerait tout l'intérêt du flux.
      "X-Accel-Buffering": "no",
    },
  });
}
