import { useEffect, useRef, useState } from "react";
import { BadgeCheck, BadgeX, Camera, Disc3, ExternalLink, FolderOpen, Headphones, Heart, Link2, Mail, Music, RefreshCw, Search, Sparkles } from "lucide-react";
import { api, adresseSite } from "../api";
import { adresseImage } from "../session";
import { televerser } from "../envoi";
import { Bascule, Bouton, Champ, Chargement, EnTete, Erreur, Pagination, Pastille, Table, Tiroir, Vide, ZoneTexte, formatCompact, formatDate, formatNombre , BarreCollante } from "../composants";
import { SelecteurVue, coteVignette, largeurCarte, nomTransition, useRaccourciVue, useVue } from "../vues";
import clsx from "../clsx";
import { BarreSelection, annoncer, classeChoisi, copier, ouvrirMenu, useSelection } from "../interactions";

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
  const [vue, changerVue] = useVue("artistes", { mode: "grille", taille: "moyenne" });
  useRaccourciVue(vue, changerVue);

  // Clic : sélectionner ; double-clic ou Entrée : ouvrir la fiche ; clic droit : actions.
  const comptes = reponse?.users ?? [];
  const sel = useSelection(
    comptes.map((a) => a._id),
    (id) => {
      const a = comptes.find((x) => x._id === id);
      if (a?.artistId) setOuvert(a);
    },
  );
  const lienArtiste = (a: CompteArtiste) => `${adresseSite()}/artiste/${a.artistId}`;

  /** Le badge vérifié, pour un ou plusieurs artistes : la même route que la fiche. */
  async function badge(ids: string[], verifie: boolean) {
    const cibles = comptes.filter((a) => ids.includes(a._id) && a.artistId && Boolean(a.verifiedArtist) !== verifie);
    if (cibles.length === 0) return;
    if (cibles.length > 1 && !window.confirm(`${verifie ? "Vérifier" : "Retirer le badge de"} ${cibles.length} artistes ?`)) return;
    let faits = 0;
    for (const a of cibles) {
      try {
        await api(`/api/admin/artists/${a.artistId}`, { methode: "PATCH", corps: { verified: verifie } });
        setReponse((r) => (r ? { ...r, users: r.users.map((u) => (u._id === a._id ? { ...u, verifiedArtist: verifie } : u)) } : r));
        faits++;
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Modification refusée.");
      }
    }
    annoncer(`${faits} artiste${faits > 1 ? "s" : ""} ${verifie ? "vérifié" : "sans badge"}${faits > 1 && verifie ? "s" : ""}`);
  }

  function menuArtiste(e: React.MouseEvent, rang: number) {
    const ids = sel.surMenu(rang);
    const cibles = comptes.filter((a) => ids.includes(a._id));
    if (cibles.length === 0) return;
    if (cibles.length === 1) {
      const a = cibles[0];
      return ouvrirMenu(
        e,
        [
          { libelle: "Ouvrir la fiche", icone: FolderOpen, raccourci: "Entrée", desactive: !a.artistId, action: () => setOuvert(a) },
          { libelle: "Voir sur le site", icone: ExternalLink, desactive: !a.artistId, action: () => void window.bureau.ouvrirExterne(lienArtiste(a)) },
          "separateur",
          a.verifiedArtist
            ? { libelle: "Retirer le badge", icone: BadgeX, desactive: !a.artistId, action: () => void badge([a._id], false) }
            : { libelle: "Vérifier l'artiste", icone: BadgeCheck, desactive: !a.artistId, action: () => void badge([a._id], true) },
          "separateur",
          { libelle: "Copier le lien", icone: Link2, desactive: !a.artistId, action: () => void copier(lienArtiste(a)).then(() => annoncer("Lien copié")) },
          { libelle: "Copier l'e-mail", icone: Mail, action: () => void copier(a.email).then(() => annoncer("E-mail copié")) },
        ],
        a.stageName ?? a.name,
      );
    }
    ouvrirMenu(
      e,
      [
        { libelle: `Vérifier (${cibles.length})`, icone: BadgeCheck, action: () => void badge(ids, true) },
        { libelle: `Retirer le badge (${cibles.length})`, icone: BadgeX, action: () => void badge(ids, false) },
        "separateur",
        { libelle: `Copier les ${cibles.length} liens`, icone: Link2, action: () => void copier(cibles.filter((a) => a.artistId).map(lienArtiste).join("\n")).then(() => annoncer("Liens copiés")) },
      ],
      `${cibles.length} artistes sélectionnés`,
    );
  }

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

      <BarreCollante className="animate-monter decale-1">
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
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <SelecteurVue vue={vue} onChange={changerVue} />
          {reponse && <Pagination page={reponse.page} pages={reponse.pages} total={reponse.total} taille={TAILLE} onPage={setPage} />}
        </div>
      </BarreCollante>

      <Erreur message={erreur} />
      {!reponse && !erreur ? (
        <Chargement />
      ) : reponse && reponse.users.length === 0 ? (
        <Vide texte="Aucun artiste ne correspond." />
      ) : reponse ? (
        vue.mode === "grille" ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${largeurCarte[vue.taille]}px, 1fr))` }}>
            {reponse.users.map((a, rang) => (
              <button
                key={a._id}
                onClick={(e) => sel.surClic(e, rang)}
                onDoubleClick={(e) => sel.surDoubleClic(e, rang)}
                onContextMenu={(e) => menuArtiste(e, rang)}
                className={clsx(
                  "group rounded-2xl border border-filet bg-surface p-3 text-left transition-colors hover:border-texte-3/40",
                  (a.suspended || !a.artistId) && "opacity-60",
                  classeChoisi(sel.estChoisi(a._id), "carte"),
                )}
              >
                <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-2" style={nomTransition("c", a._id, rang)}>
                  <PhotoArtiste a={a} grande={vue.taille !== "petite"} />
                  {a.suspended && <span className="absolute top-2 left-2 rounded-md bg-danger px-1.5 py-0.5 text-[10.5px] font-bold text-white">Suspendu</span>}
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className={clsx("truncate font-semibold", vue.taille === "petite" ? "text-[12.5px]" : "text-[13.5px]")}>
                    {a.stageName ?? a.name}
                  </span>
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
        ) : (
          <Table densite={vue.taille} entetes={["", "Artiste", "Compte", { libelle: "Titres", droite: true, largeur: "90px" }, { libelle: "Albums", droite: true, largeur: "90px" }, { libelle: "Inscrit", largeur: "120px" }, { libelle: "État", largeur: "110px" }]}>
            {reponse.users.map((a, rang) => (
              <tr
                key={a._id}
                onClick={(e) => sel.surClic(e, rang)}
                onDoubleClick={(e) => sel.surDoubleClic(e, rang)}
                onContextMenu={(e) => menuArtiste(e, rang)}
                className={clsx("cursor-default", a.suspended && "opacity-60", classeChoisi(sel.estChoisi(a._id), "ligne"))}
              >
                <td style={{ width: coteVignette[vue.taille] + 24 }}>
                  <div className="overflow-hidden rounded-full bg-surface-2" style={{ width: coteVignette[vue.taille], height: coteVignette[vue.taille], ...nomTransition("c", a._id, rang) }}>
                    <PhotoArtiste a={a} grande={false} />
                  </div>
                </td>
                <td>
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <span>{a.stageName ?? a.name}</span>
                    {a.verifiedArtist && <BadgeCheck size={14} className="text-accent" />}
                  </span>
                </td>
                <td className="text-texte-3" data-selectionnable>
                  {a.email}
                </td>
                <td className="text-right tabular-nums">{formatNombre(a.songsCount)}</td>
                <td className="text-right tabular-nums">{formatNombre(a.albumsCount)}</td>
                <td className="text-texte-2 tabular-nums">{formatDate(a.createdAt)}</td>
                <td>{a.suspended ? <Pastille texte="suspendu" ton="danger" /> : !a.artistId ? <Pastille texte="sans profil" /> : <Pastille texte="actif" ton="succes" />}</td>
              </tr>
            ))}
          </Table>
        )
      ) : null}

      {reponse && reponse.users.length > 0 && <Pagination className="mt-6" page={reponse.page} pages={reponse.pages} total={reponse.total} taille={TAILLE} onPage={setPage} />}

      <BarreSelection nombre={sel.nombre} libelle={(n) => `${n} artistes sélectionnés`} onVider={sel.vider}>
        <Bouton className="h-9" onClick={() => void badge([...sel.choisis], true)}>
          <BadgeCheck size={14} /> Vérifier
        </Bouton>
        <Bouton variante="trait" className="h-9" onClick={() => void badge([...sel.choisis], false)}>
          <BadgeX size={14} /> Retirer le badge
        </Bouton>
      </BarreSelection>
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

/** La photo du profil public, sinon celle du compte, sinon l'initiale. */
function PhotoArtiste({ a, grande }: { a: CompteArtiste; grande: boolean }) {
  const src = a.artistCoverUrl ?? a.avatarUrl;
  return src ? (
    <img src={adresseImage(src) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
  ) : (
    <span className={clsx("grid h-full w-full place-items-center font-titre font-semibold text-texte-3", grande ? "text-[40px]" : "text-[13px]")}>{(a.stageName ?? a.name).charAt(0).toUpperCase()}</span>
  );
}
