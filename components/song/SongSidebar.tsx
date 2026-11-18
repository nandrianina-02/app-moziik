import { Music2, Disc3, Mic2, ListMusic } from "lucide-react";
import { SidebarSection } from "@/components/song/SidebarSection";
import { CompactSongRow } from "@/components/song/CompactSongRow";
import { CompactAlbumRow } from "@/components/song/CompactAlbumRow";
import type {
  SongDetail,
  AlbumSummary,
  PlaylistSummary,
} from "@/components/song/types";
import type { PlayableSong } from "@/context/PlayerProvider";

const LIMITE_TITRES = 6;
const LIMITE_ALBUMS = 4;

export function SongSidebar({
  song,
  similarSongs,
  artistSongs,
  artistAlbums,
  playlists,
  isAuthenticated,
}: {
  song: SongDetail;
  similarSongs: PlayableSong[];
  artistSongs: PlayableSong[];
  artistAlbums: AlbumSummary[];
  playlists: PlaylistSummary[];
  isAuthenticated: boolean;
}) {
  // La colonne accompagne la page, elle ne la double pas : les informations
  // du titre sont dans l'onglet « Informations », et chaque liste est
  // bornée. Toute la discographie d'un artiste prolifique étirait la colonne
  // sur des écrans entiers, à côté d'un contenu principal resté court ; les
  // listes complètes sont dans les onglets « Artiste » et « Similaires ».
  const similaires = similarSongs.slice(0, LIMITE_TITRES);
  const duMemeArtiste = artistSongs.slice(0, LIMITE_TITRES);
  return (
    <div className="space-y-4">

      <SidebarSection
        icon={Music2}
        title="Titres similaires"
        isEmpty={similarSongs.length === 0}
        emptyLabel="Aucun autre titre dans ce genre pour le moment."
      >
        {similaires.map((s) => (
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
          {duMemeArtiste.map((s) => (
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
          {artistAlbums.slice(0, LIMITE_ALBUMS).map((a) => (
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
