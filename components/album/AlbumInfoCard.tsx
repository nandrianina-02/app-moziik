import { Info, CalendarDays, Music2, Disc3, Download } from "lucide-react";
import type { AlbumDetail } from "@/components/album/types";
import { libelleTypeAlbum } from "@/lib/albums";


export function AlbumInfoCard({ album }: { album: AlbumDetail }) {
  const rows: { icon: typeof CalendarDays; label: string; value: string }[] = [
    {
      icon: CalendarDays,
      label: "Date de sortie",
      value: new Date(album.releaseDate).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    },
    { icon: Disc3, label: "Type", value: libelleTypeAlbum(album.type) },
    { icon: Music2, label: "Titres", value: String(album.songs.length) },
  ];
  if (typeof album.downloadsCount === "number") {
    rows.push({
      icon: Download,
      label: "Téléchargements",
      value: album.downloadsCount.toLocaleString("fr-FR"),
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
