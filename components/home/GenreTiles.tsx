import Link from "next/link";

const palette = [
  "from-orange-500/80 to-rose-500/80",
  "from-emerald-500/80 to-teal-600/80",
  "from-pink-500/80 to-rose-600/80",
  "from-indigo-500/80 to-violet-600/80",
  "from-amber-600/80 to-orange-700/80",
  "from-fuchsia-600/80 to-purple-700/80",
  "from-sky-500/80 to-blue-600/80",
  "from-lime-600/80 to-emerald-700/80",
];

export function GenreTiles({ genres }: { genres: { genre: string; count: number }[] }) {
  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {genres.map((g, i) => (
        <Link
          key={g.genre}
          href={`/recherche?genre=${encodeURIComponent(g.genre)}`}
          className={`flex aspect-[4/3] flex-col justify-end rounded-xl2 bg-gradient-to-br p-3 text-white transition-transform hover:scale-[1.02] ${
            palette[i % palette.length]
          }`}
        >
          <span className="font-display text-sm">{g.genre}</span>
          <span className="text-xs text-white/80">{g.count} titres</span>
        </Link>
      ))}
    </div>
  );
}
