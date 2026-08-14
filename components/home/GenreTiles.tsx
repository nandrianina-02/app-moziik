import Link from "next/link";
import { Music2 } from "lucide-react";

// Dégradés attribués par position, répétés au-delà. Les couleurs sont
// volontairement en dur (et non issues des tokens de thème) : ce sont des
// visuels décoratifs à fort contraste, lisibles en clair comme en sombre,
// avec du texte blanc par-dessus dans les deux cas.
const palette = [
  "from-rose-500 to-pink-600",
  "from-sky-500 to-blue-600",
  "from-amber-500 to-orange-600",
  "from-indigo-500 to-violet-600",
  "from-emerald-500 to-teal-600",
  "from-fuchsia-500 to-purple-600",
  "from-cyan-500 to-sky-600",
  "from-lime-500 to-emerald-600",
];

export function GenreTiles({ genres }: { genres: { genre: string; count: number }[] }) {
  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {genres.map((g, i) => (
        <Link
          key={g.genre}
          href={`/titres?genre=${encodeURIComponent(g.genre)}`}
          className={`group relative flex aspect-[16/10] flex-col justify-between overflow-hidden rounded-xl2 bg-gradient-to-br p-3.5 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
            palette[i % palette.length]
          }`}
        >
          {/* Icône décorative en filigrane, décalée hors cadre pour donner
              de la profondeur sans gêner la lecture du libellé. */}
          <Music2
            size={72}
            className="pointer-events-none absolute -bottom-4 -right-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:opacity-25"
          />
          <span className="relative font-display text-sm leading-tight drop-shadow-sm">{g.genre}</span>
          <span className="relative text-[11px] font-medium text-white/85">
            {g.count} titre{g.count > 1 ? "s" : ""}
          </span>
        </Link>
      ))}
    </div>
  );
}
