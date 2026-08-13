import { Music2, Disc3, Mic2, ListMusic } from "lucide-react";
import { SongInfoCard } from "@/components/song/SongInfoCard";
import { SidebarSection } from "@/components/song/SidebarSection";
import { CompactSongRow } from "@/components/song/CompactSongRow";
import { CompactAlbumRow } from "@/components/song/CompactAlbumRow";
import type {
  SongDetail,
  AlbumSummary,
  PlaylistSummary,
} from "@/components/song/types";
import type { PlayableSong } from "@/context/PlayerProvider";

export function SongSidebar({
  song,
  album,
  similarSongs,
  artistSongs,
  artistAlbums,
  playlists,
  isAuthenticated,
}: {
  song: SongDetail;
  album: AlbumSummary | null;
  similarSongs: PlayableSong[];
  artistSongs: PlayableSong[];
  artistAlbums: AlbumSummary[];
  playlists: PlaylistSummary[];
  isAuthenticated: boolean;
}) {
  return (
    <div className="space-y-4">
      <SongInfoCard song={song} album={album} />

      <SidebarSection
        icon={Music2}
        title="Titres similaires"
        isEmpty={similarSongs.length === 0}
        emptyLabel="Aucun autre titre dans ce genre pour le moment."
      >
        {similarSongs.map((s) => (
          <CompactSongRow key={s._id} song={s} queue={similarSongs} />
        ))}
      </SidebarSection>

      {song.artist && (
        <SidebarSection
          icon={Mic2}
          title={`Plus de ${song.artist.stageName}`}
          viewAllHref={`/artiste/${song.artist._id}`}
          isEmpty={artistSongs.length === 0}
          emptyLabel="Aucun autre titre publié pour l'instant."
        >
          {artistSongs.map((s) => (
            <CompactSongRow key={s._id} song={s} queue={artistSongs} />
          ))}
        </SidebarSection>
      )}

      {song.artist && artistAlbums.length > 0 && (
        <SidebarSection
          icon={Disc3}
          title="Albums de l'artiste"
          viewAllHref={`/artiste/${song.artist._id}`}
        >
          {artistAlbums.map((a) => (
            <CompactAlbumRow key={a._id} album={a} />
          ))}
        </SidebarSection>
      )}

      {isAuthenticated && (
        <SidebarSection
          icon={ListMusic}
          title="Dans tes playlists"
          isEmpty={playlists.length === 0}
          emptyLabel="Ce titre n'est encore dans aucune de tes playlists."
        >
          {playlists.map((p) => (
            <a
              key={p._id}
              href={`/playlist/${p._id}`}
              className="block truncate rounded-lg p-1 text-sm text-ink transition-colors hover:bg-base hover:text-accent"
            >
              {p.title}
            </a>
          ))}
        </SidebarSection>
      )}
    </div>
  );
}
