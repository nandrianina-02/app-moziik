import { Suspense } from "react";
import type { Metadata } from "next";
import { MessagerieClient } from "@/components/messages/MessagerieClient";

export const metadata: Metadata = {
  title: "Messages",
  description: "Vos conversations privées et de groupe sur Moziik.",
  // Une messagerie n'a rien à faire dans un index : les pages sont
  // vides pour qui n'est pas connecté, et leur adresse porte un
  // identifiant de conversation.
  robots: { index: false, follow: false },
};

export default function MessagesPage() {
  // useSearchParams impose une frontière de suspense en rendu statique ;
  // sans elle, la construction échoue sur cette page.
  return (
    <Suspense fallback={null}>
      <MessagerieClient />
    </Suspense>
  );
}
