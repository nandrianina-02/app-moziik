import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, Play, Square } from "lucide-react";
import { api, ErreurApi } from "../api";
import { Bouton, Chargement, EnTete, Erreur, Pastille, Selection, Table, Vide, formatDuree } from "../composants";
import { adresseImage } from "../session";
import type { Etiquettes, FichierAudio } from "../../../partage/types";

/*
 * L'import d'un dossier de musique, en quatre temps : lire les balises de
 * chaque fichier, demander au site qui est l'artiste et si le titre existe
 * déjà, laisser l'administration corriger, puis envoyer et publier. Les
 * mêmes routes que l'import du site (inspect, fichiers/envoi, songs) : rien
 * n'entre au catalogue par une autre porte.
 */

type Statut = "lecture" | "inspection" | "pret" | "incomplet" | "doublon" | "envoi" | "termine" | "erreur";

interface ArtisteOption {
  _id: string;
  stageName: string;
  verified?: boolean;
  coverUrl?: string | null;
}

interface Ligne {
  id: string;
  fichier: FichierAudio;
  etiquettes: Etiquettes | null;
  statut: Statut;
  erreur?: string;
  titre: string;
  artisteNom: string;
  artiste: ArtisteOption | null;
  album: string;
  genre: string;
  annee: string;
  doublon: { title: string; artistName: string; certain: boolean } | null;
  importerQuandMeme: boolean;
  progression: number;
  songId?: string;
}

const STATUTS: Record<Statut, { libelle: string; ton: "neutre" | "succes" | "attention" | "danger" | "accent" }> = {
  lecture: { libelle: "Lecture", ton: "neutre" },
  inspection: { libelle: "Rapprochement", ton: "neutre" },
  pret: { libelle: "Prêt", ton: "succes" },
  incomplet: { libelle: "À compléter", ton: "attention" },
  doublon: { libelle: "Doublon", ton: "attention" },
  envoi: { libelle: "Envoi", ton: "accent" },
  termine: { libelle: "Publié", ton: "succes" },
  erreur: { libelle: "Erreur", ton: "danger" },
};

const GENRE_PAR_DEFAUT = "Afrobeat";

/** Le titre d'après le nom du fichier quand la balise manque : « Artiste - Titre (Clip officiel).mp3 ». */
function titreDuNom(nom: string): { artiste: string | null; titre: string } {
  const base = nom
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\((MP3|M4A)_\d+K\)(_\d+)?$/i, "")
    .replace(/\((?:[^()]*)\)|\[(?:[^\][]*)\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = /^(.*?)\s+-\s+(.*)$/.exec(base);
  return m ? { artiste: m[1].trim(), titre: m[2].trim() } : { artiste: null, titre: base };
}

const complet = (l: Ligne): Statut => {
  if (l.doublon && l.doublon.certain && !l.importerQuandMeme) return "doublon";
  return l.titre.trim() && l.artiste && l.genre && (l.etiquettes?.pochette || l.artiste.coverUrl) && l.etiquettes?.duree ? "pret" : "incomplet";
};

export function Import() {
  const [dossier, setDossier] = useState<string | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [phase, setPhase] = useState<"repos" | "analyse" | "envoi">("repos");
  const [erreur, setErreur] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const arret = useRef(false);

  useEffect(() => {
    api<{ genres?: string[] }>("/api/site-config").then((c) => setGenres(c.genres ?? [])).catch(() => undefined);
  }, []);

  const maj = (id: string, patch: Partial<Ligne>) =>
    setLignes((liste) => liste.map((l) => (l.id === id ? recalculer({ ...l, ...patch }) : l)));
  const recalculer = (l: Ligne): Ligne => (["pret", "incomplet", "doublon"].includes(l.statut) ? { ...l, statut: complet(l) } : l);

  async function choisir() {
    const choisi = await window.bureau.choisirDossier();
    if (!choisi) return;
    setDossier(choisi);
    setErreur(null);
    setPhase("analyse");
    const fichiers = await window.bureau.listerAudio(choisi);
    const initiales: Ligne[] = fichiers.map((f, i) => ({
      id: `${i}-${f.chemin}`,
      fichier: f,
      etiquettes: null,
      statut: "lecture",
      titre: "",
      artisteNom: "",
      artiste: null,
      album: "",
      genre: GENRE_PAR_DEFAUT,
      annee: "",
      doublon: null,
      importerQuandMeme: false,
      progression: 0,
    }));
    setLignes(initiales);
    // 1. Les balises, fichier par fichier.
    const lues: Ligne[] = [];
    for (const l of initiales) {
      let ligne: Ligne;
      try {
        const e = await window.bureau.lireEtiquettes(l.fichier.chemin);
        const duNom = titreDuNom(l.fichier.nom);
        ligne = {
          ...l,
          etiquettes: e,
          titre: (e.titre && !/ - /.test(e.titre) ? e.titre : duNom.titre).trim(),
          artisteNom: (duNom.artiste ?? e.artiste ?? "").trim(),
          album: e.album ?? "",
          annee: e.annee ? String(e.annee) : "",
          genre: e.genre && genres.includes(e.genre) ? e.genre : GENRE_PAR_DEFAUT,
          statut: "inspection",
        };
      } catch (err) {
        ligne = { ...l, statut: "erreur", erreur: err instanceof Error ? err.message : "Fichier illisible." };
      }
      lues.push(ligne);
      setLignes((liste) => liste.map((x) => (x.id === ligne.id ? ligne : x)));
    }
    // 2. Le rapprochement, par lots de cent.
    const aInspecter = lues.filter((l) => l.statut === "inspection");
    for (let i = 0; i < aInspecter.length; i += 100) {
      const lot = aInspecter.slice(i, i + 100);
      try {
        const { resultats } = await api<{ resultats: { artiste: ArtisteOption | null; doublon: Ligne["doublon"] }[] }>("/api/import/inspect", {
          corps: { items: lot.map((l) => ({ titre: l.titre || l.fichier.nom, artiste: l.artisteNom || undefined })) },
        });
        setLignes((liste) =>
          liste.map((l) => {
            const k = lot.findIndex((x) => x.id === l.id);
            if (k < 0) return l;
            const r = resultats[k];
            const avec: Ligne = { ...l, artiste: r.artiste, doublon: r.doublon, statut: "pret" };
            return { ...avec, statut: complet(avec) };
          }),
        );
      } catch (err) {
        setErreur(err instanceof Error ? err.message : "Le rapprochement a échoué.");
        setLignes((liste) => liste.map((l) => (lot.some((x) => x.id === l.id) ? { ...l, statut: complet(l) } : l)));
      }
    }
    setPhase("repos");
  }

  async function envoyerTout() {
    arret.current = false;
    setPhase("envoi");
    setErreur(null);
    for (const l of lignes) {
      if (arret.current) break;
      if (l.statut !== "pret") continue;
      await envoyerLigne(l);
    }
    setPhase("repos");
  }

  async function envoyerLigne(l: Ligne) {
    maj(l.id, { statut: "envoi", progression: 0 });
    try {
      const e = l.etiquettes!;
      // La pochette : celle du fichier, sinon la photo de l'artiste.
      let coverUrl = l.artiste!.coverUrl ?? "";
      if (e.pochette) {
        const octets = Uint8Array.from(atob(e.pochette.base64), (c) => c.charCodeAt(0));
        const id = await televerser(new Blob([octets], { type: e.pochette.mime }), `${l.artiste!.stageName} - ${l.titre}.${e.pochette.mime.includes("png") ? "png" : "jpg"}`, e.pochette.mime, "covers", undefined, () => undefined);
        coverUrl = `/media/${id}`;
      }
      const audio = await window.bureau.lireFichier(l.fichier.chemin);
      const type = /\.m4a$|\.aac$/i.test(l.fichier.nom) ? "audio/mp4" : /\.flac$/i.test(l.fichier.nom) ? "audio/flac" : /\.wav$/i.test(l.fichier.nom) ? "audio/wav" : /\.ogg$|\.opus$/i.test(l.fichier.nom) ? "audio/ogg" : "audio/mpeg";
      const ext = type === "audio/mpeg" ? "mp3" : l.fichier.nom.slice(l.fichier.nom.lastIndexOf(".") + 1).toLowerCase();
      const fichierId = await televerser(new Blob([audio], { type }), `${l.artiste!.stageName} - ${l.titre}.${ext}`, type, "songs", e.duree ?? undefined, (p) => maj(l.id, { progression: p }));
      const albumId = await albumExistant(l.artiste!._id, l.album);
      const annee = Number(l.annee);
      const releaseDate = annee >= 1950 && annee <= new Date().getFullYear() + 1 ? `${annee}-01-01T00:00:00+03:00` : new Date().toISOString();
      const { song } = await api<{ song: { _id: string } }>("/api/songs", {
        corps: {
          title: l.titre.trim(),
          audioUrl: `ks:${fichierId}`,
          coverUrl,
          duration: e.duree,
          genre: l.genre,
          releaseDate,
          artistId: l.artiste!._id,
          featuringIds: [],
          ...(albumId ? { albumId } : {}),
          ...(e.compositeur ? { composer: e.compositeur } : {}),
          ...(e.bpm ? { bpm: e.bpm, bpmSource: "balise" } : {}),
        },
      });
      maj(l.id, { statut: "termine", progression: 100, songId: song._id });
    } catch (err) {
      maj(l.id, { statut: "erreur", erreur: err instanceof ErreurApi ? err.message : err instanceof Error ? err.message : "Envoi impossible." });
    }
  }

  const compte = useMemo(() => {
    const c: Partial<Record<Statut, number>> = {};
    for (const l of lignes) c[l.statut] = (c[l.statut] ?? 0) + 1;
    return c;
  }, [lignes]);
  const ligneOuverte = lignes.find((l) => l.id === selection) ?? null;

  return (
    <>
      <EnTete
        titre="Importer de la musique"
        texte={dossier ?? "Choisissez un dossier : ses fichiers audio sont lus, rapprochés du catalogue, puis publiés."}
        action={
          <>
            <Bouton variante="trait" disabled={phase !== "repos"} onClick={() => void choisir()}>
              <FolderOpen size={14} /> Choisir un dossier
            </Bouton>
            {phase === "envoi" ? (
              <Bouton variante="danger" onClick={() => (arret.current = true)}>
                <Square size={14} /> Arrêter
              </Bouton>
            ) : (
              <Bouton disabled={!compte.pret || phase !== "repos"} onClick={() => void envoyerTout()}>
                <Play size={14} /> Publier {compte.pret ?? 0} titre{(compte.pret ?? 0) > 1 ? "s" : ""}
              </Bouton>
            )}
          </>
        }
      />
      <Erreur message={erreur} />
      {lignes.length > 0 && (
        <p className="mb-3 text-[13px] text-texte-2">
          {lignes.length} fichiers · {compte.pret ?? 0} prêts · {compte.incomplet ?? 0} à compléter · {compte.doublon ?? 0} doublons · {compte.termine ?? 0} publiés
          {compte.erreur ? ` · ${compte.erreur} en erreur` : ""}
        </p>
      )}
      {phase === "analyse" && lignes.length === 0 ? (
        <Chargement texte="Lecture du dossier" />
      ) : lignes.length === 0 ? (
        <Vide texte="Aucun dossier choisi." />
      ) : (
        <Table entetes={["", "Fichier", "Titre", "Artiste", "Album", { libelle: "Année", largeur: "70px" }, { libelle: "Durée", droite: true, largeur: "70px" }, { libelle: "État", largeur: "130px" }]}>
          {lignes.map((l) => (
            <tr key={l.id} onClick={() => setSelection(l.id)} className={`cursor-pointer hover:bg-surface-2 ${selection === l.id ? "bg-surface-2" : ""}`}>
              <td className="w-10 px-2 py-1.5">
                {l.etiquettes?.pochette ? (
                  <img src={`data:${l.etiquettes.pochette.mime};base64,${l.etiquettes.pochette.base64}`} alt="" className="h-8 w-8 rounded object-cover" />
                ) : l.artiste?.coverUrl ? (
                  <img src={adresseImage(l.artiste.coverUrl) ?? undefined} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded bg-surface-2" />
                )}
              </td>
              <td className="max-w-[220px] truncate px-3 py-1.5 text-texte-3" title={l.fichier.nom}>
                {l.fichier.nom}
              </td>
              <td className="px-3 py-1.5 font-medium">{l.titre || "—"}</td>
              <td className="px-3 py-1.5">
                {l.artiste ? (
                  <span>{l.artiste.stageName}</span>
                ) : (
                  <span className="text-attention">{l.artisteNom || "inconnu"} <span className="text-texte-3">(à rapprocher)</span></span>
                )}
              </td>
              <td className="px-3 py-1.5 text-texte-2">{l.album || "—"}</td>
              <td className="px-3 py-1.5 text-texte-2 tabular-nums">{l.annee || "—"}</td>
              <td className="px-3 py-1.5 text-right text-texte-2 tabular-nums">{l.etiquettes?.duree ? formatDuree(l.etiquettes.duree) : "—"}</td>
              <td className="px-3 py-1.5">
                {l.statut === "envoi" ? (
                  <div className="h-1.5 w-24 overflow-hidden rounded bg-surface-2">
                    <div className="h-full bg-accent transition-[width]" style={{ width: `${l.progression}%` }} />
                  </div>
                ) : (
                  <Pastille texte={STATUTS[l.statut].libelle} ton={STATUTS[l.statut].ton} />
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {ligneOuverte && (
        <FicheLigne
          ligne={ligneOuverte}
          genres={genres}
          verrouillee={phase === "envoi"}
          onChange={(patch) => maj(ligneOuverte.id, patch)}
          onFermer={() => setSelection(null)}
        />
      )}
    </>
  );
}

/** Le panneau d'une ligne : ce que l'administration corrige avant l'envoi. */
function FicheLigne({ ligne, genres, verrouillee, onChange, onFermer }: { ligne: Ligne; genres: string[]; verrouillee: boolean; onChange: (p: Partial<Ligne>) => void; onFermer: () => void }) {
  const [recherche, setRecherche] = useState(ligne.artisteNom);
  const [propositions, setPropositions] = useState<ArtisteOption[]>([]);
  const [creation, setCreation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const q = recherche.trim();
    if (q.length < 2) return setPropositions([]);
    const minuterie = setTimeout(() => {
      api<{ artists: ArtisteOption[] }>(`/api/artists?search=${encodeURIComponent(q)}`)
        .then((r) => setPropositions(r.artists))
        .catch(() => setPropositions([]));
    }, 250);
    return () => clearTimeout(minuterie);
  }, [recherche]);

  /** Un artiste absent du catalogue : un compte artiste vérifié, comme le fait le site, avec une adresse que personne ne lit. */
  async function creerArtiste() {
    const nom = recherche.trim();
    if (nom.length < 2) return;
    setCreation(true);
    setErreur(null);
    try {
      const slug = nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const { artist } = await api<{ artist: { _id: string; stageName: string } }>("/api/admin/users", {
        corps: { name: nom, email: `${slug}-${Date.now().toString(36)}@moziik.app`, role: "artist" },
      });
      onChange({ artiste: { _id: artist._id, stageName: artist.stageName, verified: true }, artisteNom: nom });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setCreation(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={onFermer}>
      <aside className="animate-monter h-full w-[440px] overflow-auto border-l border-filet bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 truncate text-[12px] text-texte-3" title={ligne.fichier.chemin}>
          {ligne.fichier.nom}
        </div>
        {ligne.erreur && <Erreur message={ligne.erreur} />}
        {ligne.doublon && (
          <p className="mb-3 rounded-md border border-attention/40 bg-attention/10 px-3 py-2 text-[13px]">
            {ligne.doublon.certain ? "Ce titre existe déjà chez cet artiste" : `Un titre du même nom existe chez ${ligne.doublon.artistName}`} : « {ligne.doublon.title} ».
            {ligne.doublon.certain && (
              <label className="mt-1 flex items-center gap-2">
                <input type="checkbox" checked={ligne.importerQuandMeme} disabled={verrouillee} onChange={(e) => onChange({ importerQuandMeme: e.target.checked })} className="accent-[var(--accent)]" />
                Importer quand même
              </label>
            )}
          </p>
        )}
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-texte-2">Titre</span>
            <input value={ligne.titre} disabled={verrouillee} onChange={(e) => onChange({ titre: e.target.value })} className="h-8 w-full rounded-md border border-filet bg-surface px-2.5 text-[13px] outline-none focus:border-accent" />
          </label>
          <div>
            <span className="mb-1 block text-[12px] font-medium text-texte-2">Artiste</span>
            {ligne.artiste ? (
              <div className="flex items-center justify-between rounded-md border border-filet px-2.5 py-1.5 text-[13px]">
                <span>
                  {ligne.artiste.stageName} {ligne.artiste.verified && <Pastille texte="vérifié" ton="succes" />}
                </span>
                {!verrouillee && (
                  <button onClick={() => onChange({ artiste: null })} className="text-[12px] text-texte-2 hover:text-texte">
                    changer
                  </button>
                )}
              </div>
            ) : (
              <>
                <input value={recherche} disabled={verrouillee} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom d'artiste" className="h-8 w-full rounded-md border border-filet bg-surface px-2.5 text-[13px] outline-none focus:border-accent" />
                <ul className="mt-1 divide-y divide-filet rounded-md border border-filet">
                  {propositions.map((a) => (
                    <li key={a._id}>
                      <button onClick={() => onChange({ artiste: a, artisteNom: a.stageName })} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-2">
                        {a.coverUrl ? <img src={adresseImage(a.coverUrl) ?? undefined} alt="" className="h-6 w-6 rounded-full object-cover" /> : <span className="h-6 w-6 rounded-full bg-surface-2" />}
                        {a.stageName}
                      </button>
                    </li>
                  ))}
                  {recherche.trim().length >= 2 && !propositions.some((a) => a.stageName.toLowerCase() === recherche.trim().toLowerCase()) && (
                    <li>
                      <button onClick={() => void creerArtiste()} disabled={creation} className="w-full px-2.5 py-1.5 text-left text-[13px] text-accent hover:bg-surface-2">
                        {creation ? "Création…" : `Créer l'artiste « ${recherche.trim()} »`}
                      </button>
                    </li>
                  )}
                </ul>
              </>
            )}
          </div>
          <Selection libelle="Genre" value={ligne.genre} disabled={verrouillee} onChange={(e) => onChange({ genre: e.target.value })}>
            {!genres.includes(ligne.genre) && <option value={ligne.genre}>{ligne.genre}</option>}
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Selection>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-texte-2">Album (existant)</span>
              <input value={ligne.album} disabled={verrouillee} onChange={(e) => onChange({ album: e.target.value })} placeholder="Single si vide" className="h-8 w-full rounded-md border border-filet bg-surface px-2.5 text-[13px] outline-none focus:border-accent" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-texte-2">Année de sortie</span>
              <input value={ligne.annee} disabled={verrouillee} onChange={(e) => onChange({ annee: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="Sans : aujourd'hui" className="h-8 w-full rounded-md border border-filet bg-surface px-2.5 text-[13px] outline-none focus:border-accent" />
            </label>
          </div>
          {!ligne.etiquettes?.pochette && !ligne.artiste?.coverUrl && <p className="text-[12px] text-attention">Aucune pochette dans le fichier et l'artiste n'a pas de photo : le titre ne peut pas être publié sans image.</p>}
          <Erreur message={erreur} />
          {ligne.songId && (
            <Bouton variante="trait" onClick={() => void window.bureau.ouvrirExterne(`${adresseImage("")}`.replace(/\/$/, "") + `/son/${ligne.songId}`)}>
              Voir sur le site
            </Bouton>
          )}
          <Bouton variante="discret" onClick={onFermer}>
            Fermer
          </Bouton>
        </div>
      </aside>
    </div>
  );
}

/** Un album déjà présent chez l'artiste, retrouvé par son titre ; sinon aucun (le titre sera un single). */
async function albumExistant(artisteId: string, titre: string): Promise<string | null> {
  if (!titre.trim()) return null;
  try {
    const { albums } = await api<{ albums: { _id: string; title: string }[] }>(`/api/albums?artist=${artisteId}`);
    const cle = (s: string) => s.trim().toLowerCase();
    return albums.find((a) => cle(a.title) === cle(titre))?._id ?? null;
  } catch {
    return null;
  }
}

/**
 * Envoi d'un fichier vers Karaks Storage par la porte du site : le site
 * ouvre l'envoi avec sa clé et rend une adresse à jeton où les morceaux
 * partent directement. Rend l'identifiant du fichier.
 */
async function televerser(contenu: Blob, nom: string, type: string, dossier: "songs" | "covers", duree: number | undefined, surProgression: (p: number) => void): Promise<string> {
  const ouverture = await api<{ mode: string; fichierId: string; adresseEnvoi: string; tailleMorceau: number }>("/api/fichiers/envoi", {
    corps: { nom, type, taille: contenu.size, dossier, ...(duree ? { duree } : {}) },
  });
  if (ouverture.mode !== "karaks-storage") throw new ErreurApi("Le stockage Karaks Storage n'est pas configuré sur le site.", 503);
  const taille = ouverture.tailleMorceau;
  for (let debut = 0; debut < contenu.size; debut += taille) {
    const fin = Math.min(debut + taille, contenu.size);
    let dernier: Error | null = null;
    for (let essai = 0; essai < 4; essai++) {
      try {
        const r = await fetch(ouverture.adresseEnvoi, { method: "PUT", headers: { "Content-Range": `bytes ${debut}-${fin - 1}/${contenu.size}` }, body: contenu.slice(debut, fin) });
        if (r.status === 200 || r.status === 202) {
          dernier = null;
          break;
        }
        const corps = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
        dernier = new Error(corps?.error?.message ?? `Le stockage a répondu ${r.status}.`);
        if (r.status < 500 && r.status !== 429) break;
      } catch (e) {
        dernier = e instanceof Error ? e : new Error("Envoi interrompu.");
      }
      await new Promise((res) => setTimeout(res, 1500 * (essai + 1)));
    }
    if (dernier) throw dernier;
    surProgression(Math.round((fin / contenu.size) * 100));
  }
  return ouverture.fichierId;
}
