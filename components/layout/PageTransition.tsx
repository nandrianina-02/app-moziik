"use client";

import { usePathname } from "next/navigation";

/**
 * Fait rejouer une animation d'entrée à chaque changement de route.
 * La key={pathname} force React à remonter le conteneur, ce qui relance
 * l'animation CSS — sans ça, changer de page ne rejouerait rien.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade-in-up">
      {children}
    </div>
  );
}
