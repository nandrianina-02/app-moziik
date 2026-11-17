import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Camera, Disc3, ExternalLink, Headphones, Heart, Music, RefreshCw, Search, Sparkles } from "lucide-react";
import { api, adresseSite } from "../api";
import { adresseImage } from "../session";
import { televerser } from "../envoi";
import { Bascule, Bouton, Champ, Chargement, EnTete, Erreur, Tiroir, Vide, ZoneTexte, formatCompact, formatNombre } from "../composants";
import clsx from "../clsx";

interface CompteArtiste {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
  suspended?: boolean;
  verifiedArtist?: boolean;
  artistId: string | null;
  stageName: string | null;
  artistCoverUrl: string | null;
  songsCount: number;
  albumsCount: number;
}

interface Reponse {
  users: CompteArtiste[];
  total: number;
  page: number;
  pages: number;
}

interface Profil {
  _id: string;
  stageName: string;
  bio?: string;
  coverUrl?: string;
  photoAuto?: boolean;
  genres?: string[];
  verified?: boolean;
  eventPublishingAuthorized?: boolean;
  monetizationEnabled?: boolean;
  totalPlays?: number;
  followers?: string[];
  user?: { name: string; email: string } | null;
}

const TAILLE = 24;
type Filtre = "" | "yes" | "no";

/**
 * Les artistes : la recherche et le filtre « vérifié » passent par le site
 * (/api/admin/users, rôle artiste), qui rend aussi le nombre de titres et
 * d'albums. La fiche se modifie par /api/admin/artists/{id}, la même route
 * que l'éditeur de l'administration web.
 */
export function Artistes() {
  const [reponse, setReponse] = useState<Reponse | null>(null);
  const [page, setPage] = useState(1);
  const [saisie, setSaisie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<CompteArtiste | null>(null);
  const [version, setVersion] = useState(0);

  // La recherche part au site après une courte pause de frappe, pas à chaque touche.
  useEffect(() => {
    const t = setTimeout(() => {
      setRecherche(saisie.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  useEffect(() => {
    setReponse(null);
    setErreur(null);
    const p = new URLSearchParams({ role: "artist", page: String(page), limit: String(TAILLE) });
    if (recherche) p.set("search", recherche);
    if (filtre) p.set("verified", filtre);
    api<Reponse>(`/api/admin/users?${p}`)
      .then((r) => setReponse({ ...r, users: r.users ?? [] }))
      .catch((e: Error) => setErreur(e.message));
  }, [page, recherche, filtre, version]);

  return (
    <>
      <EnTete
        titre="Artistes"
        texte={reponse ? `${formatNombre(reponse.total)} artiste${reponse.total > 1 ? "s" : ""}${recherche ? ` pour « ${recherche} »` : ""}` : undefined}
        action={
          <Bouton variante="trait" onClick={() => setVersion((v) => v + 1)}>
            <RefreshCw size={14} /> Actualiser
          </Bouton>
        }
      />

      <div className="animate-monter decale-1 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative w-80">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texte-3" />
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Nom ou e-mail du compte"
            className="h-9 w-full rounded-lg border border-filet bg-surface pr-3 pl-9 text-[13px] outline-none placeholder:text-texte-3 focus:border-accent"
          />
        </div>
        <div className="flex rounded-lg border border-filet bg-surface p-0.5">
          {(
            [
              ["", "Tous"],
              ["yes", "Vérifiés"],
              ["no", "Non vérifiés"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => {
                setFiltre(v);
                setPage(1);
              }}
              className={clsx("rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors", filtre === v ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte")}
            >
              {l}
            </button>
          ))}
        </div>
        {reponse && reponse.pages > 1 && <Pagination page={reponse.page} pages={reponse.pages} onPage={setPage} />}
      </div>

      <Erreur message={erreur} />
      {!reponse && !erreur ? (
        <Chargement />
      ) : reponse && reponse.users.length === 0 ? (
        <Vide texte="Aucun artiste ne correspond." />
      ) : reponse ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-4">
          {reponse.users.map((a, i) => (
            <button
              key={a._id}
              onClick={() => a.artistId && setOuvert(a)}
              disabled={!a.artistId}
              className={clsx(
                "animate-monter group rounded-2xl border border-filet bg-surface p-3 text-left transition-colors hover:border-texte-3/40 disabled:cursor-not-allowed disabled:opacity-60",
                i < 6 && `decale-${i + 1}`,
                a.suspended && "opacity-60",
              )}
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
                {a.artistCoverUrl || a.avatarUrl ? (
                  <img src={adresseImage(a.artistCoverUrl ?? a.avatarUrl) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                ) : (
                  <span className="grid h-full w-full place-items-center font-titre text-[40px] font-semibold text-texte-3">{(a.stageName ?? a.name).charAt(0).toUpperCase()}</span>
                )}
                {a.suspended && <span className="absolute top-2 left-2 rounded-md bg-danger px-1.5 py-0.5 text-[10.5px] font-bold text-white">Suspendu</span>}
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="truncate text-[13.5px] font-semibold">{a.stageName ?? a.name}</span>
                {a.verifiedArtist && <BadgeCheck size={15} className="shrink-0 text-accent" />}
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-[12px] text-texte-3">
                <span className="inline-flex items-center gap-1">
                  <Music size={12} /> {formatNombre(a.songsCount)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Disc3 size={12} /> {formatNombre(a.albumsCount)}
                </span>
                {!a.artistId && <span>sans profil</span>}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {reponse && reponse.pages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination page={reponse.page} pages={reponse.pages} onPage={setPage} />
        </div>
      )}

      {ouvert?.artistId && (
        <FicheArtiste
          artistId={ouvert.artistId}
          onFermer={() => setOuvert(null)}
          onModifie={(p) => {
            setReponse((r) =>
              r
                ? {
                    ...r,
                    users: r.users.map((u) => (u.artistId === p._id ? { ...u, stageName: p.stageName, artistCoverUrl: p.coverUrl || null, verifiedArtist: Boolean(p.verified) } : u)),
                  }
                : r,
            );
          }}
        />
      )}
    </>
  );
}

function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  return (
    <div className="ml-auto flex items-center gap-2 text-[12.5px] text-texte-2">
      <Bouton variante="trait" className="h-8" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Précédente
      </Bouton>
      <span className="tabular-nums">
        {page} / {pages}
      </span>
      <Bouton variante="trait" className="h-8" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Suivante
      </Bouton>
    </div>
  );
}

function FicheArtiste({ artistId, onFermer, onModifie }: { artistId: string; onFermer: () => void; onModifie: (p: Profil) => void }) {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [brouillon, setBrouillon] = useState<Profil | null>(null);
  const [genres, setGenres] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [envoiPhoto, setEnvoiPhoto] = useState<number | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const fichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ artist: Profil }>(`/api/admin/artists/${artistId}`)
      .then(({ artist }) => {
        setProfil(artist);
        setBrouillon(artist);
        setGenres((artist.genres ?? []).join(", "));
      })
      .catch((e: Error) => setErreur(e.message));
  }, [artistId]);

  const maj = (p: Partial<Profil>) => {
    setEnregistre(false);
    setBrouillon((b) => (b ? { ...b, ...p } : b));
  };

  async function changerPhoto(f: File) {
    if (!f.type.startsWith("image/")) return setErreur("Choisissez une image (JPEG, PNG ou WebP).");
    if (f.size > 8 * 1024 * 1024) return setErreur("Image trop lourde : 8 Mo au plus.");
    setErreur(null);
    setEnvoiPhoto(0);
    try {
      const id = await televerser(f, `${brouillon?.stageName ?? "artiste"} - photo.${f.type.split("/")[1] ?? "jpg"}`, f.type, "avatars", undefined, setEnvoiPhoto);
      maj({ coverUrl: `/media/${id}`, photoAuto: false });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Envoi de la photo impossible.");
    } finally {
      setEnvoiPhoto(null);
    }
  }

  async function enregistrer() {
    if (!brouillon || !profil) return;
    setEnCours(true);
    setErreur(null);
    const listeGenres = genres
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean)
      .slice(0, 10);
    // Seuls les champs changés partent : la route ne touche qu'à ce qu'on lui envoie.
    const corps: Record<string, unknown> = {};
    if (brouillon.stageName.trim() !== profil.stageName) corps.stageName = brouillon.stageName.trim();
    if ((brouillon.bio ?? "") !== (profil.bio ?? "")) corps.bio = brouillon.bio ?? "";
    if ((brouillon.coverUrl ?? "") !== (profil.coverUrl ?? "")) corps.coverUrl = brouillon.coverUrl ?? "";
    if (listeGenres.join("|") !== (profil.genres ?? []).join("|")) corps.genres = listeGenres;
    for (const cle of ["verified", "eventPublishingAuthorized", "monetizationEnabled"] as const) if (Boolean(brouillon[cle]) !== Boolean(profil[cle])) corps[cle] = Boolean(brouillon[cle]);
    if (Object.keys(corps).length === 0) {
      setEnCours(false);
      return setEnregistre(true);
    }
    try {
      const { artist } = await api<{ artist: Profil }>(`/api/admin/artists/${artistId}`, { methode: "PATCH", corps });
      const fusion = { ...profil, ...artist };
      setProfil(fusion);
      setBrouillon(fusion);
      setEnregistre(true);
      onModifie(fusion);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement refusé.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Tiroir
      titre={profil?.stageName ?? "Artiste"}
      sousTitre={profil?.user?.email}
      onFermer={onFermer}
      largeur={480}
      pied={
        profil && (
          <>
            {enregistre && <span className="animate-paraitre mr-auto self-center text-[12.5px] text-succes">Modifications enregistrées.</span>}
            <Bouton variante="trait" onClick={() => void window.bureau.ouvrirExterne(`${adresseSite()}/artiste/${artistId}`)}>
              <ExternalLink size={14} /> Voir sur le site
            </Bouton>
            <Bouton enCours={enCours} disabled={envoiPhoto !== null} onClick={() => void enregistrer()}>
              Enregistrer
            </Bouton>
          </>
        )
      }
    >
      <Erreur message={erreur} />
      {!brouillon ? (
        !erreur && <Chargement />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-5">
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
              {brouillon.coverUrl ? (
                <img src={adresseImage(brouillon.coverUrl) ?? undefined} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center font-titre text-[34px] text-texte-3">{brouillon.stageName.charAt(0)}</span>
              )}
              {envoiPhoto !== null && (
                <span className="absolute inset-0 grid place-items-center bg-black/55 text-[13px] font-semibold text-white tabular-nums">{envoiPhoto} %</span>
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <Bouton variante="trait" disabled={envoiPhoto !== null} onClick={() => fichier.current?.click()}>
                <Camera size={14} /> Changer la photo
              </Bouton>
              {brouillon.photoAuto && (
                <p className="flex items-center gap-1.5 text-[12px] text-texte-3">
                  <Sparkles size={13} /> Photo reprise d'une pochette
                </p>
              )}
              <input
                ref={fichier}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void changerPhoto(f);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Mesure icone={Headphones} libelle="Écoutes" valeur={formatCompact(brouillon.totalPlays ?? 0)} />
            <Mesure icone={Heart} libelle="Abonnés" valeur={formatCompact(brouillon.followers?.length ?? 0)} />
          </div>

          <Champ libelle="Nom de scène" value={brouillon.stageName} onChange={(e) => maj({ stageName: e.target.value })} />
          <ZoneTexte libelle="Biographie" value={brouillon.bio ?? ""} maxLength={2000} onChange={(e) => maj({ bio: e.target.value })} placeholder="Quelques lignes sur l'artiste" />
          <Champ libelle="Genres" aide="Séparés par des virgules, dix au plus." value={genres} onChange={(e) => (setEnregistre(false), setGenres(e.target.value))} />

          <div className="divide-y divide-filet rounded-xl border border-filet px-4">
            <Bascule libelle="Artiste vérifié" aide="Le badge apparaît sur le profil et dans les recherches." valeur={Boolean(brouillon.verified)} onChange={(v) => maj({ verified: v })} />
            <Bascule libelle="Monétisation" aide="Les écoutes complètes comptent pour la rémunération." valeur={Boolean(brouillon.monetizationEnabled)} onChange={(v) => maj({ monetizationEnabled: v })} />
            <Bascule libelle="Publication d'évènements" aide="L'artiste peut proposer des évènements, qui passent ensuite en modération." valeur={Boolean(brouillon.eventPublishingAuthorized)} onChange={(v) => maj({ eventPublishingAuthorized: v })} />
          </div>
        </div>
      )}
    </Tiroir>
  );
}

function Mesure({ icone: Icone, libelle, valeur }: { icone: typeof Music; libelle: string; valeur: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
      <Icone size={17} className="text-accent" />
      <div>
        <div className="text-[11.5px] text-texte-3">{libelle}</div>
        <div className="font-titre text-[16px] font-semibold tabular-nums">{valeur}</div>
      </div>
    </div>
  );
}
