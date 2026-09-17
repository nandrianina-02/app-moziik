"use client";

import Link from "next/link";
import { CalendarDays, Mic2, Radio, Tags } from "lucide-react";

/**
 * Quatre portes d'entrée, juste sous le bandeau.
 *
 * L'accueil empile des sections que l'administration compose : parfait
 * pour flâner, inutile quand on sait déjà ce qu'on cherche. Ces quatre
 * pastilles donnent l'accès direct, sans traverser la page ni passer par
 * la recherche.
 *
 * CHACUNE MÈNE À UNE PAGE QUI EXISTE
 *
 * C'est la seule règle qui les a choisies. « Playlists » aurait sa place
 * ici, mais il n'existe aucune page publique qui les liste : /bibliotheque
 * est la collection **du visiteur**, et elle renvoie vers la connexion
 * quand il n'y en a pas. Un raccourci qui mène à un mur d'authentification
 * depuis l'accueil n'est pas un raccourci. Les évènements prennent donc
 * la quatrième place — ils sont publics, et ce catalogue en vit.
 */
const RACCOURCIS = [
  { href: "/classements?type=artists", label: "Artistes", icone: Mic2 },
  { href: "/titres", label: "Genres", icone: Tags },
  { href: "/radio", label: "Ambiances", icone: Radio },
  { href: "/evenements", label: "Évènements", icone: CalendarDays },
];

export function RaccourcisAccueil() {
  return (
    <nav aria-label="Accès rapides">
      <ul className="grid grid-cols-4 gap-2">
        {RACCOURCIS.map(({ href, label, icone: Icone }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex flex-col items-center gap-2 rounded-xl py-1 text-center"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-base transition-transform duration-200 group-hover:scale-105 sm:h-16 sm:w-16">
                <Icone size={24} />
              </span>
              <span className="w-full truncate text-xs font-medium text-ink sm:text-sm">
                {label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
