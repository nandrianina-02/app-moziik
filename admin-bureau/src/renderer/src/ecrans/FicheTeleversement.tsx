import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, Check, Clapperboard, Gauge, ImagePlus, Loader2, Pause, Play, Plus, Search, Sparkles, Trash2, UserPlus, X } from "lucide-react";
import { api } from "../api";
import { Bascule, Bouton, Champ, Erreur, Pastille, Selection, Tiroir, ZoneTexte, formatDuree } from "../composants";
import { annoncer, confirmer } from "../interactions";
import { adresseImage } from "../session";
import { arreter as arreterExtrait } from "../lecture";
import { estimerTempo } from "../bpm";
import { chercherArtistes, creerArtiste, type ArtisteOption } from "../artistes";
import { LANGUES, genreCorrespondant, tagsPropres } from "../metadonnees";
import { STATUTS, albumsDe, manques, pochetteDe, type Ligne } from "../televersements";
import clsx from "../clsx";

/*
 * La fiche d'un fichier à téléverser : tous les champs du formulaire de
 * publication du site (app/son/nouveau/page.tsx) et ses outils, remplis à
 * l'avance depuis les balises. Rien ne part tant qu'on n'a pas lancé la
 * publication : chaque champ modifie la ligne, que l'envoi lira.
 */

interface Props {
  ligne: Ligne;
  genres: string[];
  fonctionsIA: string[];
  verrouillee: boolean;
  onChange: (patch: Partial<Ligne>) => void;
  onFermer: () => void;
}

export function FicheTeleversement({ ligne: l, genres, fonctionsIA, verrouillee, onChange, onFermer }: Props) {
  const restant = manques(l);
  const statut = STATUTS[l.statut];
  return (
    <Tiroir
      titre={l.titre || l.fichier.nom}
      sousTitre={l.fichier.nom}
      largeur={620}
      onFermer={onFermer}
      pied={
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-[12.5px] text-texte-2" title={restant.join(", ")}>
            {l.statut === "termine" ? "Publié sur Moziik." : restant.length ? `Manque : ${restant.join(", ")}.` : l.brouillon ? "Prêt : sera enregistré comme brouillon." : "Prêt à publier."}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {l.songId && (
              <Bouton variante="trait" onClick={() => void window.bureau.ouvrirExterne(`${adresseImage("")}`.replace(/\/$/, "") + `/son/${l.songId}`)}>
                Voir sur le site
              </Bouton>
            )}
            <Bouton onClick={onFermer}>Fermer</Bouton>
          </div>
        </div>
      }
    >
      <fieldset disabled={verrouillee} className="min-w-0 space-y-7">
        <div className="flex gap-5">
          <ZonePochette ligne={l} onChange={onChange} />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Pastille texte={statut.libelle} ton={statut.ton} />
              {l.etiquettes?.duree ? <span className="text-[12.5px] text-texte-2 tabular-nums">{formatDuree(l.etiquettes.duree)}</span> : null}
              {l.etiquettes?.debit ? <span className="text-[12.5px] text-texte-3">{l.etiquettes.debit} kb/s</span> : null}
              <span className="text-[12.5px] text-texte-3">{(l.fichier.taille / 1048576).toFixed(1)} Mo</span>
            </div>
            <Ecouteur ligne={l} />
            {l.erreur && <Erreur message={l.erreur} />}
            {l.doublon && (
              <div className="rounded-lg border border-attention/40 bg-attention/10 px-3 py-2 text-[12.5px]">
                {l.doublon.certain ? "Ce titre existe déjà chez cet artiste" : `Un titre du même nom existe chez ${l.doublon.artistName}`} : « {l.doublon.title} ».
                {l.doublon.certain && (
                  <label className="mt-1.5 flex items-center gap-2">
                    <input type="checkbox" checked={l.importerQuandMeme} onChange={(e) => onChange({ importerQuandMeme: e.target.checked })} className="accent-[var(--accent)]" />
                    Importer quand même
                  </label>
                )}
              </div>
            )}
          </div>
        </div>

        <Section titre="Identité">
          <Champ libelle="Titre" value={l.titre} maxLength={200} onChange={(e) => onChange({ titre: e.target.value })} />
          <DoublonEnDirect ligne={l} />
          <div>
            <Libelle>Artiste principal</Libelle>
            {l.artiste ? (
              <ArtisteChoisi artiste={l.artiste} onRetirer={() => onChange({ artiste: null })} />
            ) : (
              <ChoixArtiste initial={l.artisteNom} onChoisir={(a) => onChange({ artiste: a, artisteNom: a.stageName, featuring: l.featuring.filter((f) => f._id !== a._id) })} />
            )}
          </div>
          <Invites ligne={l} onChange={onChange} />
        </Section>

        <Section titre="Publication">
          <div className="grid grid-cols-2 gap-3">
            <Selection libelle="Genre" value={l.genre} onChange={(e) => onChange({ genre: e.target.value })}>
              {!genres.includes(l.genre) && <option value={l.genre}>{l.genre || "Choisir"}</option>}
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Selection>
            <Selection libelle="Langue" value={l.langue} onChange={(e) => onChange({ langue: e.target.value })}>
              {LANGUES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Selection>
          </div>
          <ChoixAlbum ligne={l} onChange={onChange} />
          <Champ
            libelle="Date de sortie"
            type="date"
            value={l.dateSortie}
            onChange={(e) => onChange({ dateSortie: e.target.value })}
            aide={
              !l.dateSortie
                ? "Vide : publié maintenant."
                : new Date(`${l.dateSortie}T00:00:00+03:00`).getTime() > Date.now()
                  ? "Date à venir : la sortie est programmée, le titre paraît ce jour-là."
                  : "Date passée : le titre paraît maintenant, avec cette date de sortie."
            }
          />
          <div className="divide-y divide-filet border-y border-filet">
            <Bascule libelle="Enregistrer comme brouillon" aide="Le titre attend la validation dans le catalogue au lieu de paraître." valeur={l.brouillon} onChange={(v) => onChange({ brouillon: v })} disabled={verrouillee} />
            <Bascule libelle="Contenu explicite" aide="Paroles réservées à un public averti." valeur={l.explicite} onChange={(v) => onChange({ explicite: v })} disabled={verrouillee} />
          </div>
        </Section>

        {fonctionsIA.includes("publication") && <AssistanceIA ligne={l} genres={genres} onChange={onChange} />}

        <Section titre="Présentation">
          <div>
            <ZoneTexte libelle="Description" value={l.description} maxLength={1000} onChange={(e) => onChange({ description: e.target.value })} placeholder="L'histoire du titre, son contexte, les musiciens…" />
            <Compteur valeur={l.description.length} max={1000} />
          </div>
          <SaisieTags tags={l.tags} onChange={(tags) => onChange({ tags })} />
          <div>
            <div className="flex items-center justify-between">
              <Libelle>Paroles</Libelle>
              {/^\s*\[\d{1,2}:\d{2}/m.test(l.paroles) && <Pastille texte="synchronisées (LRC)" ton="accent" />}
            </div>
            <textarea
              value={l.paroles}
              maxLength={20000}
              onChange={(e) => onChange({ paroles: e.target.value })}
              placeholder="Texte brut, ou LRC horodaté pour le défilement synchronisé."
              className="min-h-[150px] w-full resize-y rounded-lg border border-filet bg-surface-2 px-3 py-2 font-mono text-[12.5px] leading-relaxed outline-none placeholder:font-sans placeholder:text-texte-3 focus:border-accent"
            />
            <Compteur valeur={l.paroles.length} max={20000} />
          </div>
        </Section>

        <Section titre="Crédits et données techniques">
          <div className="grid grid-cols-2 gap-3">
            <Champ libelle="Compositeur" value={l.compositeur} maxLength={200} onChange={(e) => onChange({ compositeur: e.target.value })} />
            <Champ libelle="Producteur" value={l.producteur} maxLength={200} onChange={(e) => onChange({ producteur: e.target.value })} />
            <Champ libelle="Copyright" value={l.copyright} maxLength={300} onChange={(e) => onChange({ copyright: e.target.value })} placeholder="© 2026 Label" />
            <Champ libelle="ISRC" value={l.isrc} maxLength={20} onChange={(e) => onChange({ isrc: e.target.value.toUpperCase() })} placeholder="MG-A1B-26-00001" />
            <Champ libelle="Tonalité" value={l.tonalite} maxLength={20} onChange={(e) => onChange({ tonalite: e.target.value })} placeholder="C#m" />
            <Tempo ligne={l} onChange={onChange} />
          </div>
        </Section>

        <Section titre="Découpe et clip">
          <Decoupe ligne={l} onChange={onChange} />
          <Clip ligne={l} onChange={onChange} />
        </Section>
      </fieldset>
    </Tiroir>
  );
}

/* --- Briques ---------------------------------------------------------------- */

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 border-b border-filet pb-2 font-titre text-[14px] font-semibold">{titre}</h3>
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

const Libelle = ({ children }: { children: ReactNode }) => <span className="mb-1.5 block text-[12px] font-medium text-texte-2">{children}</span>;

function Compteur({ valeur, max }: { valeur: number; max: number }) {
  return <div className={clsx("mt-1 text-right text-[11px] tabular-nums", valeur > max * 0.9 ? "text-attention" : "text-texte-3")}>{`${valeur.toLocaleString("fr-FR")} / ${max.toLocaleString("fr-FR")}`}</div>;
}

/** Une image JPEG, PNG ou WebP, choisie ou glissée ; elle remplace celle du fichier. */
function ZonePochette({ ligne: l, onChange }: { ligne: Ligne; onChange: (p: Partial<Ligne>) => void }) {
  const [survol, setSurvol] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const image = pochetteDe(l);
  const apercu = image ? `data:${image.mime};base64,${image.base64}` : l.artiste?.coverUrl ? adresseImage(l.artiste.coverUrl) : null;

  async function prendre(promesse: Promise<Ligne["pochette"]>) {
    setErreur(null);
    try {
      const p = await promesse;
      if (p) onChange({ pochette: p });
    } catch (e) {
      setErreur(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "Image illisible.");
    }
  }
  function deposer(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSurvol(false);
    const fichier = e.dataTransfer.files[0];
    if (fichier) void prendre(window.bureau.lireImage(window.bureau.cheminDe(fichier)));
  }

  return (
    <div className="w-[168px] shrink-0">
      <div
        data-depot
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={deposer}
        onClick={() => void prendre(window.bureau.choisirImage())}
        title="Cliquer ou glisser une image (JPEG, PNG, WebP)"
        className={clsx(
          "relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-xl border bg-surface-2 transition-colors",
          survol ? "border-accent border-dashed" : "border-filet hover:border-texte-3/50",
        )}
      >
        {apercu ? <img src={apercu} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={26} className="text-texte-3" />}
        {survol && <div className="absolute inset-0 grid place-items-center bg-black/55 text-[12px] font-semibold text-white">Déposer l'image</div>}
      </div>
      <div className="mt-1.5 text-[11.5px] text-texte-3">
        {l.pochette ? "Image choisie" : l.etiquettes?.pochette ? "Image du fichier" : l.artiste?.coverUrl ? "Photo de l'artiste" : "Aucune image"}
      </div>
      {l.pochette && (
        <button type="button" onClick={() => onChange({ pochette: null })} className="mt-0.5 text-[11.5px] text-texte-2 hover:text-texte">
          Revenir à l'image du fichier
        </button>
      )}
      {erreur && <p className="mt-1 text-[11.5px] text-danger">{erreur}</p>}
    </div>
  );
}

/** Écouter le fichier local, depuis le début de la découpe ; un seul son à la fois dans le logiciel. */
function Ecouteur({ ligne: l }: { ligne: Ligne }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const [lecture, setLecture] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [position, setPosition] = useState(0);
  // La découpe peut changer pendant l'écoute : l'arrêt en fin de découpe lit la valeur du moment.
  const decoupe = useRef(l.decoupe);
  decoupe.current = l.decoupe;

  useEffect(
    () => () => {
      audio.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  async function basculer() {
    if (lecture) {
      audio.current?.pause();
      return;
    }
    arreterExtrait();
    if (!audio.current) {
      setChargement(true);
      try {
        const octets = await window.bureau.lireFichier(l.fichier.chemin);
        url.current = URL.createObjectURL(new Blob([octets]));
        const a = new Audio(url.current);
        a.ontimeupdate = () => {
          setPosition(a.currentTime);
          const fin = decoupe.current.fin;
          if (fin !== null && a.currentTime >= fin) a.pause();
        };
        a.onplay = () => setLecture(true);
        a.onpause = () => setLecture(false);
        a.onended = () => setLecture(false);
        audio.current = a;
      } finally {
        setChargement(false);
      }
    }
    const a = audio.current!;
    if (l.decoupe.debut !== null && (a.currentTime < l.decoupe.debut || (l.decoupe.fin !== null && a.currentTime >= l.decoupe.fin))) a.currentTime = l.decoupe.debut;
    void a.play();
  }

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={() => void basculer()}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white hover:opacity-90"
        title={lecture ? "Pause" : "Écouter le fichier"}
      >
        {chargement ? <Loader2 size={15} className="animate-spin" /> : lecture ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
      </button>
      <div className="text-[12px] text-texte-2 tabular-nums">
        {position > 0 ? formatDuree(position) : "Écouter"}
        {l.etiquettes?.duree ? ` / ${formatDuree(l.etiquettes.duree)}` : ""}
      </div>
    </div>
  );
}

/** Le doublon, revérifié à chaque changement de titre ou d'artiste, comme sur le site. */
function DoublonEnDirect({ ligne: l }: { ligne: Ligne }) {
  const [doublon, setDoublon] = useState<{ _id: string; title: string; status: string } | null>(null);
  const artisteId = l.artiste?._id;
  const titre = l.titre.trim();
  useEffect(() => {
    if (!artisteId || titre.length < 2) return setDoublon(null);
    let actif = true;
    const minuterie = setTimeout(() => {
      api<{ doublon: { _id: string; title: string; status: string } | null }>(`/api/songs/duplicate?title=${encodeURIComponent(titre)}&artistId=${artisteId}`)
        .then((r) => actif && setDoublon(r.doublon))
        .catch(() => actif && setDoublon(null));
    }, 450);
    return () => {
      actif = false;
      clearTimeout(minuterie);
    };
  }, [artisteId, titre]);
  if (!doublon) return null;
  const etat = { published: "publié", draft: "en attente de validation", scheduled: "programmé", rejected: "refusé" }[doublon.status] ?? doublon.status;
  return (
    <p className="flex items-start gap-2 text-[12.5px] text-attention">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Cet artiste a déjà « {doublon.title} » ({etat}).
    </p>
  );
}

function ArtisteChoisi({ artiste, onRetirer }: { artiste: ArtisteOption; onRetirer: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-y border-filet py-2">
      <span className="flex min-w-0 items-center gap-2.5 text-[13px]">
        {artiste.coverUrl ? <img src={adresseImage(artiste.coverUrl) ?? undefined} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="h-7 w-7 rounded-full bg-surface-2" />}
        <span className="truncate font-medium">{artiste.stageName}</span>
        {artiste.verified && <Pastille texte="vérifié" ton="succes" />}
      </span>
      <button type="button" onClick={onRetirer} className="text-[12px] text-texte-2 hover:text-texte">
        Changer
      </button>
    </div>
  );
}

/**
 * Recherche d'un artiste dans les deux univers ; absent, il se crée (compte
 * artiste vérifié), après confirmation : c'est un compte de plus sur le site.
 */
export function ChoixArtiste({ initial = "", onChoisir, exclure = [] }: { initial?: string; onChoisir: (a: ArtisteOption) => void; exclure?: string[] }) {
  const [q, setQ] = useState(initial);
  const [resultats, setResultats] = useState<ArtisteOption[]>([]);
  const [recherche, setRecherche] = useState(false);
  const [creation, setCreation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const terme = q.trim();
    if (terme.length < 2) return setResultats([]);
    let actif = true;
    setRecherche(true);
    const minuterie = setTimeout(() => {
      void chercherArtistes(terme).then((r) => {
        if (!actif) return;
        setResultats(r.filter((a) => !exclure.includes(a._id)));
        setRecherche(false);
      });
    }, 250);
    return () => {
      actif = false;
      clearTimeout(minuterie);
    };
    // exclure change d'identité à chaque rendu ; la liste suit la saisie.
  }, [q]);

  async function creer() {
    const nom = q.trim();
    const ok = await confirmer({ titre: `Créer l'artiste « ${nom} » ?`, message: "Un compte artiste vérifié est créé sur le site, avec une adresse @moziik.app que personne ne lit. Sa photo sera la pochette de son premier titre.", confirmer: "Créer l'artiste" });
    if (!ok) return;
    setCreation(true);
    setErreur(null);
    try {
      const a = await creerArtiste(nom);
      annoncer(`Artiste « ${a.stageName} » créé`);
      onChoisir(a);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setCreation(false);
    }
  }

  const exact = resultats.some((a) => a.stageName.trim().toLowerCase() === q.trim().toLowerCase());
  return (
    <div>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texte-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom d'artiste" className="h-9 w-full rounded-lg border border-filet bg-surface-2 pr-3 pl-8 text-[13px] outline-none focus:border-accent" />
        {recherche && <Loader2 size={14} className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-texte-3" />}
      </div>
      {q.trim().length >= 2 && (
        <ul className="mt-1 max-h-56 divide-y divide-filet overflow-auto rounded-lg border border-filet">
          {resultats.map((a) => (
            <li key={a._id}>
              <button type="button" onClick={() => onChoisir(a)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-surface-2">
                {a.coverUrl ? <img src={adresseImage(a.coverUrl) ?? undefined} alt="" className="h-6 w-6 rounded-full object-cover" /> : <span className="h-6 w-6 rounded-full bg-surface-2" />}
                <span className="truncate">{a.stageName}</span>
                {a.verified && <Check size={13} className="text-succes" />}
              </button>
            </li>
          ))}
          {!exact && !recherche && (
            <li>
              <button type="button" onClick={() => void creer()} disabled={creation} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-accent hover:bg-surface-2">
                {creation ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Créer l'artiste « {q.trim()} »
              </button>
            </li>
          )}
        </ul>
      )}
      {erreur && <p className="mt-1 text-[12px] text-danger">{erreur}</p>}
    </div>
  );
}

/** Les invités : ceux rattachés, ceux lus dans le fichier sans profil, et l'ajout. */
function Invites({ ligne: l, onChange }: { ligne: Ligne; onChange: (p: Partial<Ligne>) => void }) {
  const [ajout, setAjout] = useState<string | null>(null);
  function ajouter(a: ArtisteOption, nomLu?: string) {
    const restants = nomLu ? l.invitesNonTrouves.filter((n) => n !== nomLu) : l.invitesNonTrouves;
    onChange({
      featuring: l.featuring.some((f) => f._id === a._id) ? l.featuring : [...l.featuring, a],
      invitesNonTrouves: restants,
      // Tous les invités du fichier rattachés : la mention « (feat. X) » peut quitter le titre.
      ...(restants.length === 0 && l.titreSansMention ? { titre: l.titreSansMention, titreSansMention: null } : {}),
    });
    setAjout(null);
  }
  return (
    <div>
      <Libelle>Invités (featuring)</Libelle>
      {(l.featuring.length > 0 || l.invitesNonTrouves.length > 0) && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {l.featuring.map((f) => (
            <span key={f._id} className="inline-flex items-center gap-1.5 rounded-full border border-filet py-1 pr-1.5 pl-2.5 text-[12.5px]">
              {f.stageName}
              <button type="button" onClick={() => onChange({ featuring: l.featuring.filter((x) => x._id !== f._id) })} title="Retirer" className="text-texte-3 hover:text-texte">
                <X size={13} />
              </button>
            </span>
          ))}
          {l.invitesNonTrouves.map((n) => (
            <span key={n} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-attention/60 py-1 pr-1.5 pl-2.5 text-[12.5px] text-attention" title="Lu dans le fichier, sans profil sur Moziik">
              {n}
              <button type="button" onClick={() => setAjout(n)} title="Rattacher ou créer" className="hover:text-texte">
                <Search size={13} />
              </button>
              <button type="button" onClick={() => onChange({ invitesNonTrouves: l.invitesNonTrouves.filter((x) => x !== n) })} title="Ignorer" className="hover:text-texte">
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
      {ajout !== null ? (
        <div className="space-y-1.5">
          <ChoixArtiste key={ajout} initial={ajout} exclure={[...(l.artiste ? [l.artiste._id] : []), ...l.featuring.map((f) => f._id)]} onChoisir={(a) => ajouter(a, ajout || undefined)} />
          <button type="button" onClick={() => setAjout(null)} className="text-[12px] text-texte-2 hover:text-texte">
            Annuler
          </button>
        </div>
      ) : (
        <Bouton variante="trait" className="h-8 text-[12.5px]" onClick={() => setAjout("")}>
          <Plus size={13} /> Ajouter un invité
        </Bouton>
      )}
    </div>
  );
}

/** L'album : un de ceux de l'artiste, ou un nom nouveau (créé à l'envoi). Vide : single. */
function ChoixAlbum({ ligne: l, onChange }: { ligne: Ligne; onChange: (p: Partial<Ligne>) => void }) {
  const [albums, setAlbums] = useState<{ _id: string; title: string; type?: string }[]>([]);
  const artisteId = l.artiste?._id;
  useEffect(() => {
    if (!artisteId) return setAlbums([]);
    let actif = true;
    void albumsDe(artisteId).then((a) => actif && setAlbums(a));
    return () => {
      actif = false;
    };
  }, [artisteId]);
  const cle = (s: string) => s.trim().toLowerCase();
  const existant = albums.find((a) => cle(a.title) === cle(l.album));
  const liste = `albums-${l.id}`;
  return (
    <div>
      <Champ libelle="Album" list={liste} value={l.album} maxLength={200} onChange={(e) => onChange({ album: e.target.value })} placeholder="Vide : le titre sort en single" />
      <datalist id={liste}>
        {albums.map((a) => (
          <option key={a._id} value={a.title} />
        ))}
      </datalist>
      <p className="mt-1 text-[12px] text-texte-3">
        {!l.album.trim()
          ? albums.length
            ? `${albums.length} album${albums.length > 1 ? "s" : ""} chez cet artiste : tapez pour choisir.`
            : "Single."
          : existant
            ? `Album existant (${existant.type ?? "album"}).`
            : "Nouvel album : il sera créé à l'envoi, avec cette pochette."}
      </p>
    </div>
  );
}

/** Les tags comme le site : Entrée ou virgule pour ajouter, Retour arrière pour retirer le dernier, quinze au plus. */
function SaisieTags({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [saisie, setSaisie] = useState("");
  const valider = () => {
    if (!saisie.trim()) return;
    onChange(tagsPropres([...tags, ...saisie.split(",")]));
    setSaisie("");
  };
  function touche(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      valider();
    } else if (e.key === "Backspace" && !saisie && tags.length) onChange(tags.slice(0, -1));
  }
  return (
    <div>
      <Libelle>Tags</Libelle>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-filet bg-surface-2 px-2 py-1.5 focus-within:border-accent">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-[12px]">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-texte-3 hover:text-texte" title="Retirer">
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={touche}
          onBlur={valider}
          disabled={tags.length >= 15}
          placeholder={tags.length >= 15 ? "Quinze tags au plus" : tags.length ? "" : "soirée, mariage, louange…"}
          className="min-w-[120px] flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-texte-3"
        />
      </div>
    </div>
  );
}

/** Le tempo : saisi, lu dans le fichier, ou mesuré ici (lib/bpm.ts du site). */
function Tempo({ ligne: l, onChange }: { ligne: Ligne; onChange: (p: Partial<Ligne>) => void }) {
  const [mesure, setMesure] = useState(false);
  async function mesurer() {
    setMesure(true);
    try {
      const octets = await window.bureau.lireFichier(l.fichier.chemin);
      const r = await estimerTempo(new Blob([octets]));
      if (!r) return annoncer("Tempo introuvable : pas assez de rythme marqué");
      onChange({ bpm: String(r.bpm), bpmSource: "analyse" });
      annoncer(r.ambigu ? `${r.bpm} BPM, à vérifier (moitié ou double possible)` : `${r.bpm} BPM`);
    } catch {
      annoncer("Mesure du tempo impossible pour ce fichier");
    } finally {
      setMesure(false);
    }
  }
  return (
    <div>
      <Libelle>Tempo (BPM)</Libelle>
      <div className="flex gap-1.5">
        <input
          type="number"
          min={0}
          max={400}
          value={l.bpm}
          onChange={(e) => onChange({ bpm: e.target.value, bpmSource: "manuel" })}
          className="h-9 w-full min-w-0 rounded-lg border border-filet bg-surface-2 px-3 text-[13px] tabular-nums outline-none focus:border-accent"
        />
        <Bouton variante="trait" className="h-9 shrink-0 px-2.5" enCours={mesure} onClick={() => void mesurer()} title="Mesurer le tempo dans le fichier">
          <Gauge size={14} />
        </Bouton>
      </div>
      {l.bpmSource && l.bpm && <span className="mt-1 block text-[11.5px] text-texte-3">{{ balise: "Lu dans le fichier", analyse: "Mesuré", manuel: "Saisi" }[l.bpmSource]}</span>}
    </div>
  );
}

/** « 1:23 » ou « 83 » → 83 ; vide → null. */
function lireTemps(texte: string): number | null | undefined {
  const t = texte.trim();
  if (!t) return null;
  const m = /^(?:(\d+):)?(\d{1,2}(?:[.,]\d)?)$/.exec(t);
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 60 + Number(m[2].replace(",", "."));
}
const ecrireTemps = (s: number | null) => (s === null ? "" : `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0").replace(/\.0$/, "")}`);

/**
 * La découpe : seule la partie gardée est écoutée sur le site. La source
 * part entière ; les qualités d'écoute sont encodées découpées.
 */
function Decoupe({ ligne: l, onChange }: { ligne: Ligne; onChange: (p: Partial<Ligne>) => void }) {
  const [debut, setDebut] = useState(ecrireTemps(l.decoupe.debut));
  const [fin, setFin] = useState(ecrireTemps(l.decoupe.fin));
  const duree = l.etiquettes?.duree ?? 0;
  const lu = { debut: lireTemps(debut), fin: lireTemps(fin) };
  const invalide = lu.debut === undefined || lu.fin === undefined || (lu.debut ?? 0) >= duree || (lu.fin !== null && lu.fin !== undefined && (lu.fin > duree || lu.fin - (lu.debut ?? 0) < 1));
  function appliquer() {
    if (invalide) return;
    onChange({ decoupe: { debut: lu.debut && lu.debut > 0 ? lu.debut : null, fin: lu.fin !== null && lu.fin !== undefined && lu.fin < duree ? lu.fin : null } });
  }
  const garde = (l.decoupe.fin ?? duree) - (l.decoupe.debut ?? 0);
  return (
    <div>
      <Libelle>Découpe</Libelle>
      <div className="flex items-end gap-2">
        <Champ libelle="Début" value={debut} onChange={(e) => setDebut(e.target.value)} onBlur={appliquer} placeholder="0:00" className="w-28" />
        <Champ libelle="Fin" value={fin} onChange={(e) => setFin(e.target.value)} onBlur={appliquer} placeholder={duree ? formatDuree(duree) : "fin"} className="w-28" />
        {(l.decoupe.debut !== null || l.decoupe.fin !== null) && (
          <Bouton
            variante="discret"
            className="mb-0.5 h-9"
            onClick={() => {
              setDebut("");
              setFin("");
              onChange({ decoupe: { debut: null, fin: null } });
            }}
          >
            Morceau entier
          </Bouton>
        )}
      </div>
      <p className={clsx("mt-1 text-[12px]", invalide ? "text-danger" : "text-texte-3")}>
        {invalide ? "Temps invalide : m:ss, dans la durée du fichier, une seconde au moins entre début et fin." : l.decoupe.debut === null && l.decoupe.fin === null ? "Le morceau entier est publié. Le bouton d'écoute respecte la découpe." : `${formatDuree(garde)} gardées sur ${formatDuree(duree)}.`}
      </p>
    </div>
  );
}

/** Le clip vidéo, facultatif : choisi ou glissé, envoyé après l'audio. */
function Clip({ ligne: l, onChange }: { ligne: Ligne; onChange: (p: Partial<Ligne>) => void }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);
  async function prendre(promesse: Promise<Ligne["video"]>) {
    setErreur(null);
    try {
      const v = await promesse;
      if (v) onChange({ video: v });
    } catch (e) {
      setErreur(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "Vidéo illisible.");
    }
  }
  return (
    <div>
      <Libelle>Clip vidéo</Libelle>
      {l.video ? (
        <div className="flex items-center justify-between gap-3 border-y border-filet py-2 text-[13px]">
          <span className="flex min-w-0 items-center gap-2">
            <Clapperboard size={15} className="shrink-0 text-texte-3" />
            <span className="truncate">{l.video.nom}</span>
            <span className="shrink-0 text-texte-3">{(l.video.taille / 1048576).toFixed(0)} Mo</span>
          </span>
          <button type="button" onClick={() => onChange({ video: null })} className="flex items-center gap-1 text-[12px] text-texte-2 hover:text-danger">
            <Trash2 size={13} /> Retirer
          </button>
        </div>
      ) : (
        <div
          data-depot
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSurvol(true);
          }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSurvol(false);
            const f = e.dataTransfer.files[0];
            if (f) void prendre(window.bureau.decrireVideo(window.bureau.cheminDe(f)));
          }}
          className={clsx("flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2.5 text-[12.5px] text-texte-2", survol ? "border-accent" : "border-filet")}
        >
          <span>Facultatif. Glissez une vidéo ici (MP4, MOV, WebM).</span>
          <Bouton variante="trait" className="h-8 text-[12.5px]" onClick={() => void prendre(window.bureau.choisirVideo())}>
            <Clapperboard size={13} /> Choisir
          </Bouton>
        </div>
      )}
      {erreur && <p className="mt-1 text-[12px] text-danger">{erreur}</p>}
    </div>
  );
}

interface Proposition {
  genre?: string | null;
  langue?: string | null;
  tags?: string[];
  description?: string | null;
  remarque?: string | null;
}

/**
 * L'assistance du site (POST /api/ai/song-metadata, fonction « publication ») :
 * genre, langue, tags et description proposés d'après le titre et les
 * paroles. Rien n'est appliqué sans un clic.
 */
function AssistanceIA({ ligne: l, genres, onChange }: { ligne: Ligne; genres: string[]; onChange: (p: Partial<Ligne>) => void }) {
  const [proposition, setProposition] = useState<Proposition | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function demander() {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await api<{ proposition: Proposition }>("/api/ai/song-metadata", {
        corps: {
          title: l.titre.trim().slice(0, 200),
          artistName: (l.artiste?.stageName ?? l.artisteNom).slice(0, 200),
          ...(l.paroles.trim() ? { lyrics: l.paroles.slice(0, 8000) } : {}),
          ...(l.album.trim() ? { album: l.album.trim().slice(0, 200) } : {}),
          languages: LANGUES,
        },
      });
      setProposition(r.proposition);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Suggestion impossible.");
    } finally {
      setEnCours(false);
    }
  }

  const genre = proposition?.genre ? genreCorrespondant(proposition.genre, genres) : null;
  const elements: { cle: string; libelle: string; valeur: string; appliquer: Partial<Ligne>; deja: boolean }[] = [];
  if (proposition) {
    if (genre) elements.push({ cle: "genre", libelle: "Genre", valeur: genre, appliquer: { genre }, deja: l.genre === genre });
    const langue = proposition.langue;
    if (langue && LANGUES.includes(langue)) elements.push({ cle: "langue", libelle: "Langue", valeur: langue, appliquer: { langue }, deja: l.langue === langue });
    const tags = proposition.tags ?? [];
    if (tags.length) elements.push({ cle: "tags", libelle: "Tags", valeur: tags.join(", "), appliquer: { tags: tagsPropres([...l.tags, ...tags]) }, deja: tags.every((t) => l.tags.includes(t.toLowerCase())) });
    const description = proposition.description;
    if (description) elements.push({ cle: "description", libelle: "Description", valeur: description, appliquer: { description: description.slice(0, 1000) }, deja: l.description === description });
  }

  return (
    <Section titre="Assistance">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-texte-2">Genre, langue, tags et description proposés d'après le titre et les paroles. Rien n'est appliqué sans votre accord.</p>
        <Bouton variante="trait" className="shrink-0" enCours={enCours} disabled={!l.titre.trim()} onClick={() => void demander()}>
          <Sparkles size={14} /> Proposer
        </Bouton>
      </div>
      {erreur && <Erreur message={erreur} />}
      {proposition && (
        <div className="border-y border-filet">
          {elements.length === 0 && <p className="py-2.5 text-[12.5px] text-texte-3">Aucune proposition exploitable.</p>}
          <ul className="divide-y divide-filet">
            {elements.map((x) => (
              <li key={x.cle} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0 text-[12.5px]">
                  <span className="font-medium">{x.libelle}</span>
                  <p className="mt-0.5 text-texte-2">{x.valeur}</p>
                </div>
                <Bouton variante={x.deja ? "discret" : "trait"} className="h-8 shrink-0 text-[12px]" disabled={x.deja} onClick={() => onChange(x.appliquer)}>
                  {x.deja ? "Appliqué" : "Appliquer"}
                </Bouton>
              </li>
            ))}
          </ul>
          {elements.some((x) => !x.deja) && (
            <div className="flex justify-end py-2.5">
              <Bouton className="h-8 text-[12px]" onClick={() => onChange(Object.assign({}, ...elements.filter((x) => !x.deja).map((x) => x.appliquer)))}>
                Tout appliquer
              </Bouton>
            </div>
          )}
          {proposition.remarque && <p className="pb-2.5 text-[12px] text-texte-3">{proposition.remarque}</p>}
        </div>
      )}
    </Section>
  );
}
