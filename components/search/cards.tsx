"use client";

import Link from "next/link";
import { BadgeCheck, CalendarDays, ListMusic, MapPin, Music2, Radio, User as UserIcon } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { libelleTypeAlbum } from "@/lib/albums";

/**
 * Cartes de résultats de recherche.
 *
 * Une carte par nature de contenu, toutes de même gabarit : la page de
 * résultats aligne des sections hétérogènes (artistes, albums, playlists,
 * évènements…) et elles doivent se lire comme une seule grille.
 */

export type ArtisteResultat = {
  _id: string;
  stageName: string;
  verified?: boolean;
  coverUrl?: string;
  genres?: string[];
  totalPlays?: number;
  followers?: unknown[];
};

export type AlbumResultat = {
  _id: string;
  title: string;
  coverUrl?: string;
  type?: string;
  releaseDate?: string;
  songs?: unknown[];
  trackCount?: number;
  artist?: { _id: string; stageName: string; verified?: boolean } | null;
};

export type PlaylistResultat = {
  _id: string;
  title: string;
  coverUrl?: string;
  songs?: unknown[];
  followers?: unknown[];
  owner?: { _id: string; name: string; avatarUrl?: string } | null;
};

export type EvenementResultat = {
  _id: string;
  title: string;
  coverUrl?: string;
  location?: string;
  date?: string;
  price?: number;
  artist?: { _id: string; stageName: string; verified?: boolean } | null;
};

export type UtilisateurResultat = {
  _id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  role?: string;
};

export type GenreResultat = { _id: string; name: string; count: number };


function annee(date?: string) {
  if (!date) return null;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

/** Enveloppe commune : même largeur, même comportement au survol. */
function Carte({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group block w-40 shrink-0 rounded-xl2 border border-transparent p-2 transition-colors hover:border-border hover:bg-surface sm:w-44"
    >
      {children}
    </Link>
  );
}

export function CarteArtiste({ artiste }: { artiste: ArtisteResultat }) {
  return (
    <Carte href={`/artiste/${artiste._id}`}>
      <SafeImage
        src={artiste.coverUrl}
        alt={artiste.stageName}
        width={160}
        height={160}
        className="mb-2.5 aspect-square w-full rounded-full object-cover"
      />
      <p className="flex items-center justify-center gap-1 truncate text-center text-sm font-medium text-ink">
        <span className="truncate">{artiste.stageName}</span>
        {artiste.verified && <BadgeCheck size={12} className="shrink-0 text-verified" />}
      </p>
      <p className="truncate text-center text-xs text-ink-muted">
        {artiste.genres?.length ? artiste.genres.slice(0, 2).join(", ") : "Artiste"}
      </p>
    </Carte>
  );
}

export function CarteAlbum({ album }: { album: AlbumResultat }) {
  const nb = album.trackCount ?? album.songs?.length ?? 0;
  return (
    <Carte href={`/album/${album._id}`}>
      <SafeImage
        src={album.coverUrl}
        alt={album.title}
        width={160}
        height={160}
        className="mb-2.5 aspect-square w-full rounded-xl object-cover"
      />
      <p className="truncate text-sm font-medium text-ink">{album.title}</p>
      <p className="truncate text-xs text-ink-muted">
        {libelleTypeAlbum(album.type)}
        {annee(album.releaseDate) ? ` · ${annee(album.releaseDate)}` : ""}
        {album.artist ? ` · ${album.artist.stageName}` : nb ? ` · ${nb} titre${nb > 1 ? "s" : ""}` : ""}
      </p>
    </Carte>
  );
}

export function CartePlaylist({ playlist }: { playlist: PlaylistResultat }) {
  const nb = playlist.songs?.length ?? 0;
  return (
    <Carte href={`/playlist/${playlist._id}`}>
      <span className="relative mb-2.5 block">
        <SafeImage
          src={playlist.coverUrl}
          alt={playlist.title}
          width={160}
          height={160}
          className="aspect-square w-full rounded-xl object-cover"
        />
        <span className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm">
          <ListMusic size={13} />
        </span>
      </span>
      <p className="truncate text-sm font-medium text-ink">{playlist.title}</p>
      <p className="truncate text-xs text-ink-muted">
        {nb} titre{nb > 1 ? "s" : ""}
        {playlist.owner?.name ? ` · ${playlist.owner.name}` : ""}
      </p>
    </Carte>
  );
}

export function CarteEvenement({ evenement }: { evenement: EvenementResultat }) {
  const d = evenement.date ? new Date(evenement.date) : null;
  return (
    <Carte href={`/evenements/${evenement._id}`}>
      <SafeImage
        src={evenement.coverUrl}
        alt={evenement.title}
        width={160}
        height={160}
        className="mb-2.5 aspect-square w-full rounded-xl object-cover"
      />
      <p className="truncate text-sm font-medium text-ink">{evenement.title}</p>
      <p className="flex items-center gap-1 truncate text-xs text-ink-muted">
        <CalendarDays size={11} className="shrink-0" />
        {d && !Number.isNaN(d.getTime())
          ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
          : "Date à venir"}
      </p>
      {evenement.location && (
        <p className="flex items-center gap-1 truncate text-xs text-ink-muted">
          <MapPin size={11} className="shrink-0" /> {evenement.location}
        </p>
      )}
    </Carte>
  );
}

/**
 * Un profil mène désormais quelque part : /membre/<username>. Les comptes
 * antérieurs au nom d'utilisateur n'en ont pas encore — la carte reste
 * alors muette plutôt que de renvoyer vers une page introuvable.
 */
export function CarteUtilisateur({ utilisateur }: { utilisateur: UtilisateurResultat }) {
  const contenu = (
    <>
      <SafeImage
        src={utilisateur.avatarUrl}
        alt={utilisateur.name}
        width={160}
        height={160}
        className="mb-2.5 aspect-square w-full rounded-full object-cover"
      />
      <p className="truncate text-center text-sm font-medium text-ink">{utilisateur.name}</p>
      <p className="flex items-center justify-center gap-1 truncate text-center text-xs text-ink-muted">
        <UserIcon size={11} />
        {utilisateur.username ? `@${utilisateur.username}` : "Profil"}
      </p>
    </>
  );

  const classes =
    "group block w-40 shrink-0 rounded-xl2 border border-transparent p-2 transition-colors hover:border-border hover:bg-surface sm:w-44";

  if (!utilisateur.username) return <span className={classes}>{contenu}</span>;
  return (
    <Link href={`/membre/${utilisateur.username}`} className={classes}>
      {contenu}
    </Link>
  );
}

/**
 * Un genre est aussi une station de radio : la page /radio lance une
 * station à partir d'un genre, on y renvoie donc directement plutôt que
 * de créer une page « genre » qui n'existe pas.
 */
export function CarteGenre({ genre }: { genre: GenreResultat }) {
  return (
    <Link
      href={`/recherche?q=${encodeURIComponent(genre.name)}&type=songs&genre=${encodeURIComponent(genre.name)}`}
      className="flex items-center gap-3 rounded-xl2 border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
        <Radio size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{genre.name}</span>
        <span className="block truncate text-xs text-ink-muted">
          {genre.count} titre{genre.count > 1 ? "s" : ""} · station radio
        </span>
      </span>
      <Music2 size={15} className="shrink-0 text-ink-muted" />
    </Link>
  );
}
