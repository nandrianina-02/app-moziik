"use client";

import { ImportWorkbench } from "@/components/import/ImportWorkbench";

/**
 * Import par lot, côté administration : n'importe quel artiste, avec le
 * rapprochement par nom lu dans les balises.
 *
 * Le poste lui-même est partagé avec l'espace artiste
 * (`components/import/ImportWorkbench.tsx`) : lecture des balises,
 * détection des doublons, pochettes intégrées et envoi en parallèle sont
 * le même travail des deux côtés.
 */
export default function AdminImportPage() {
  return <ImportWorkbench estAdmin />;
}
