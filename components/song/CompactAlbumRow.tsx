import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import type { AlbumSummary } from "@/components/song/types";

const typeLabel = { album: "Album", ep: "EP", single: "Single" };

export function CompactAlbumRow({ album }: { album: AlbumSummary }) {
  return (
    <Link
      href={`/album/${album._id}`}
      className="group flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-base"
    >
      <SafeImage
        src={album.coverUrl}
        alt={album.title}
        width={36}
        height={36}
        className="shrink-0 rounded-md object-cover"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">{album.title}</span>
        <span className="block truncate text-xs text-ink-muted">
          {typeLabel[album.type]} · {new Date(album.releaseDate).getFullYear()}
        </span>
      </span>
    </Link>
  );
}
