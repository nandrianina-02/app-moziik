import { Disc3, Download, Headphones, ListMusic, Mic2, Music, Radio, Users, type LucideIcon } from "lucide-react";

/*
 * Les visuels de Moziik faits de texte et de pictogrammes, sans photo :
 * le panneau de la page de connexion et les bannières par défaut. Une
 * photo d'illustration vieillit, pèse lourd et ressemble à toutes les
 * autres ; une composition typographique dit ce que fait Moziik et reste
 * légère. Une seule couleur d'accent, des filets, pas de dégradé décoratif.
 */

const FONCTIONS: { icone: LucideIcon; titre: string; texte: string }[] = [
  { icone: Headphones, titre: "Écoute", texte: "Des milliers de titres, en continu." },
  { icone: Download, titre: "Hors connexion", texte: "Tes titres gardés sur le téléphone." },
  { icone: Mic2, titre: "Paroles", texte: "Synchronisées, ligne après ligne." },
  { icone: Users, titre: "À plusieurs", texte: "La même musique, au même moment." },
  { icone: Radio, titre: "Radios", texte: "Des stations qui ne s'arrêtent pas." },
  { icone: ListMusic, titre: "Playlists", texte: "À toi, ou à plusieurs mains." },
];

const GENRES = ["Gospel", "Afro", "Salegy", "Rap", "Jazz", "Pop", "Reggae", "Zouk"];

/** Le panneau gauche des pages de connexion et d'inscription. */
export function AfficheConnexion() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-8">
      <div className="animate-fade-in-up">
        <h1 className="font-display text-4xl leading-[1.05] xl:text-5xl">
          Toute ta musique.
          <br />
          <span className="text-accent">Partout.</span>
        </h1>
        <p className="mt-4 max-w-sm text-ink-muted">Tes playlists, tes artistes et tes écoutes te suivent, du téléphone à l&apos;ordinateur.</p>
      </div>

      <ul className="stagger grid grid-cols-2 border-t border-border">
        {FONCTIONS.map(({ icone: Icone, titre, texte }, i) => (
          <li key={titre} className={`border-b border-border py-4 ${i % 2 === 0 ? "border-r pr-5" : "pl-5"}`}>
            <Icone size={20} strokeWidth={1.6} className="mb-2 text-accent" />
            <p className="text-sm font-semibold">{titre}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{texte}</p>
          </li>
        ))}
      </ul>

      {/* Seulement si la hauteur le permet : sur un écran court, elle pousserait la grille hors de vue. */}
      <p aria-hidden className="hidden font-display text-2xl leading-snug text-ink/[0.18] [@media(min-height:900px)]:block">
        {GENRES.join(" · ")}
      </p>
    </div>
  );
}

/**
 * Une bannière sans image : le texte donné (le nom de l'artiste, le titre
 * mis en avant) en très grand, en filigrane, et trois pictogrammes alignés
 * sur un filet. Elle remplit son parent, positionné.
 */
export function BanniereTexte({ texte, icones = [Mic2, Disc3, Music] }: { texte: string; icones?: LucideIcon[] }) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-surface">
      {/* Deux lignes décalées : le mot déborde, on lit une affiche plutôt qu'un intitulé. */}
      <div className="absolute inset-x-0 top-[8%] select-none whitespace-nowrap font-display leading-[0.85] text-ink/[0.07]">
        <p className="-ml-4 text-[7rem] sm:text-[10rem] md:text-[12rem]">{texte}</p>
        <p className="ml-24 text-[7rem] sm:text-[10rem] md:text-[12rem]">{texte}</p>
      </div>
      <div className="absolute right-6 top-6 flex items-center gap-4 md:right-10 md:top-8">
        <span className="h-px w-16 bg-border md:w-28" />
        {icones.map((Icone, i) => (
          <Icone key={i} size={22} strokeWidth={1.5} className={i === 0 ? "text-accent" : "text-ink-muted"} />
        ))}
      </div>
    </div>
  );
}
