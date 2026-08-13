import {
  Info,
  CalendarDays,
  Clock,
  Tag,
  Disc3,
  Globe2,
  Building2,
  PenLine,
  Download,
} from "lucide-react";
import type { SongDetail, AlbumSummary } from "@/components/song/types";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SongInfoCard({
  song,
  album,
}: {
  song: SongDetail;
  album: AlbumSummary | null;
}) {
  const rows: { icon: typeof CalendarDays; label: string; value: string }[] = [
    {
      icon: CalendarDays,
      label: "Date de sortie",
      value: song.releaseDate
        ? new Date(song.releaseDate).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "—",
    },
    { icon: Clock, label: "Durée", value: formatDuration(song.duration) },
  ];
  if (song.genre) rows.push({ icon: Tag, label: "Genre", value: song.genre });
  if (album) rows.push({ icon: Disc3, label: "Album", value: album.title });

  // Champs pas encore présents dans le modèle Song — s'affichent
  // automatiquement dès que l'API les renverra, sans autre changement.
  if (song.label)
    rows.push({ icon: Building2, label: "Label", value: song.label });
  if (song.composer)
    rows.push({ icon: PenLine, label: "Compositeur", value: song.composer });
  if (song.language)
    rows.push({ icon: Globe2, label: "Langue", value: song.language });
  if (typeof song.downloadsCount === "number") {
    rows.push({
      icon: Download,
      label: "Téléchargements",
      value: song.downloadsCount.toLocaleString("fr-FR"),
    });
  }

  return (
    <div className="rounded-xl2 border border-border bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <Info size={15} className="text-accent" /> Informations
      </h3>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-3.5">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[11px] text-ink-muted">
              <row.icon size={12} /> {row.label}
            </dt>
            <dd className="mt-0.5 truncate text-sm">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
