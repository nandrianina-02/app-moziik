import { NextResponse } from "next/server";
import { preparePageSections, type HomepageViewer } from "@/lib/homeContentEngine";
import type { SectionPage } from "@/models/HomepageSection";

/**
 * Diffuse les sections d'une page en NDJSON : une ligne JSON par
 * évènement, envoyée dès qu'elle est prête.
 *
 *   {"type":"meta","sections":[{"key":"new_releases","title":"Nouveautés"},...]}
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
 * Une seule requête HTTP : pas de démarrage à froid supplémentaire par
 * section, contrairement à un point d'entrée par section.
 */
export async function streamPageSections(page: SectionPage, viewer: HomepageViewer): Promise<NextResponse> {
  // Volontairement avant la création du flux : une base injoignable doit
  // encore produire un vrai 503 via withApiErrors. Une fois les en-têtes
  // envoyés, il n'est plus possible de changer le code de statut.
  const prepared = await preparePageSections(page, viewer);

  // Les calculs sont déjà lancés. On leur attache un gestionnaire dans la
  // même continuation que le `await` ci-dessus : sans cela, une section qui
  // échoue avant l'ouverture du flux déclencherait un rejet non géré.
  const hero = prepared.hero.then(
    (data) => ({ ok: true as const, data }),
    () => ({ ok: false as const, data: null })
  );
  const sections = prepared.sections.map((section) => ({
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
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }

      send({ type: "meta", sections: prepared.sections.map((s) => ({ key: s.key, title: s.title })) });

      await Promise.all([
        hero.then((res) => {
          if (res.ok) send({ type: "hero", data: res.data });
          else send({ type: "failed", key: "hero" });
        }),
        ...sections.map(({ key, result }) =>
          result.then((res) => {
            // `data` nul = section volontairement omise (contenu vide ou en
            // échec, déjà journalisé côté moteur). Le client doit retirer
            // son squelette dans les deux cas, d'où l'évènement.
            if (res.ok && res.data) send({ type: "section", key, title: res.data.title, data: res.data.data });
            else send({ type: "failed", key });
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
