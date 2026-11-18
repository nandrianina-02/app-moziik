import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Pencil, Play, RotateCcw, Square, Tag, Trash2, Upload, X } from "lucide-react";
import { api } from "../api";
import { Barres, Bouton, Chargement, EnTete, Erreur, Pagination, Pastille, Selection, Table, Vide, formatDuree, usePages , BarreCollante } from "../composants";
import { SelecteurVue, coteVignette, largeurCarte, nomTransition, useRaccourciVue, useVue } from "../vues";
import clsx from "../clsx";
import { BarreSelection, annoncer, classeChoisi, ouvrirMenu, useSelection } from "../interactions";
import { adresseImage } from "../session";
import { STATUTS, useTeleversements, type ArtisteOption, type Ligne, type Statut } from "../televersements";

/*
 * La vue des téléversements. L'état et les envois vivent dans
 * televersements.tsx, au niveau de la coquille : quitter cette page ne les
 * interrompt pas, et y revenir montre où ils en sont.
 */

export function Import() {
  const { dossier, lignes, genres, phase, erreur, avancement, choisir, envoyerTout, arreter, modifier, retirer, vider } = useTeleversements();
  const [selection, setSelection] = useState<string | null>(null);

  const compte = useMemo(() => {
    const c: Partial<Record<Statut, number>> = {};
    for (const l of lignes) c[l.statut] = (c[l.statut] ?? 0) + 1;
    return c;
  }, [lignes]);
  const ligneOuverte = lignes.find((l) => l.id === selection) ?? null;
  // Un dossier peut compter des centaines de fichiers : 50 par page, et la
  // page ne bouge pas pendant l'envoi (les statuts changent, pas la liste).
  const pages = usePages(lignes, 50, dossier ?? "");
  const [vue, changerVue] = useVue("import", { mode: "liste", taille: "moyenne" });
  useRaccourciVue(vue, changerVue);

  // Clic : sélectionner ; double-clic ou Entrée : corriger la ligne ; clic droit : actions.
  const sel = useSelection(
    pages.tranche.map((l) => l.id),
    (id) => setSelection(id),
  );
  const verrou = phase === "envoi";

  function changerGenre(ids: string[], genre: string) {
    for (const id of ids) modifier(id, { genre });
    annoncer(`Genre « ${genre} » donné à ${ids.length} ligne${ids.length > 1 ? "s" : ""}`);
  }
  function reessayer(ids: string[]) {
    // Une ligne en erreur repart « prête » ; le recalcul la remet « à compléter » s'il lui manque quelque chose.
    const cibles = lignes.filter((l) => ids.includes(l.id) && l.statut === "erreur");
    for (const l of cibles) modifier(l.id, { statut: "pret", erreur: undefined, progression: 0 });
    annoncer(`${cibles.length} ligne${cibles.length > 1 ? "s" : ""} à renvoyer`);
  }
  function importerQuandMeme(ids: string[]) {
    for (const l of lignes.filter((x) => ids.includes(x.id) && x.statut === "doublon")) modifier(l.id, { importerQuandMeme: true });
  }
  function enlever(ids: string[]) {
    retirer(ids);
    sel.vider();
    annoncer(`${ids.length} ligne${ids.length > 1 ? "s" : ""} retirée${ids.length > 1 ? "s" : ""} de la liste`);
  }

  function menuLigne(e: React.MouseEvent, rang: number) {
    const ids = sel.surMenu(rang);
    const cibles = lignes.filter((l) => ids.includes(l.id));
    if (cibles.length === 0) return;
    const erreurs = cibles.filter((l) => l.statut === "erreur").length;
    const doublons = cibles.filter((l) => l.statut === "doublon").length;
    const genresMenu = genres.slice(0, 8).map((g) => ({ libelle: `Genre : ${g}`, icone: Tag, desactive: verrou, action: () => changerGenre(ids, g) }));
    ouvrirMenu(
      e,
      [
        cibles.length === 1 && { libelle: "Corriger", icone: Pencil, raccourci: "Entrée", action: () => setSelection(cibles[0].id) },
        doublons > 0 && { libelle: `Importer quand même${cibles.length > 1 ? ` (${doublons})` : ""}`, icone: Upload, desactive: verrou, action: () => importerQuandMeme(ids) },
        erreurs > 0 && { libelle: `Réessayer${cibles.length > 1 ? ` (${erreurs})` : ""}`, icone: RotateCcw, desactive: verrou, action: () => reessayer(ids) },
        "separateur",
        ...genresMenu,
        "separateur",
        { libelle: cibles.length > 1 ? `Retirer de la liste (${cibles.length})` : "Retirer de la liste", icone: Trash2, danger: true, desactive: verrou, action: () => enlever(ids) },
      ],
      cibles.length > 1 ? `${cibles.length} lignes sélectionnées` : cibles[0].titre || cibles[0].fichier.nom,
    );
  }
  const pagination = <Pagination page={pages.page} pages={pages.pages} total={pages.total} taille={pages.taille} onPage={pages.setPage} />;
  const global = avancement.aFaire > 0 ? Math.round(((avancement.faits + avancement.enCours / 100) / avancement.aFaire) * 100) : 0;

  return (
    <>
      <EnTete
        titre="Téléversements"
        texte={dossier ?? "Choisissez un dossier : ses fichiers audio sont lus, rapprochés du catalogue, puis publiés."}
        action={
          <>
            {dossier && phase === "repos" && (
              <Bouton variante="discret" onClick={vider} title="Fermer ce dossier">
                <X size={14} /> Fermer
              </Bouton>
            )}
            <Bouton variante="trait" disabled={phase !== "repos"} onClick={() => void choisir()}>
              <FolderOpen size={14} /> Choisir un dossier
            </Bouton>
            {phase === "envoi" ? (
              <Bouton variante="danger" onClick={arreter}>
                <Square size={14} /> Arrêter après ce titre
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

      {phase !== "repos" && (
        <div className="animate-monter mb-5 rounded-2xl border border-filet bg-surface p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Barres />
              <div className="min-w-0">
                <div className="font-titre text-[15px] font-semibold">
                  {phase === "analyse" ? `Lecture du dossier : ${avancement.faits} / ${avancement.aFaire} fichiers` : `Envoi : ${avancement.faits} / ${avancement.aFaire} titres`}
                </div>
                <div className="truncate text-[12.5px] text-texte-3">
                  {phase === "envoi" && avancement.titreEnCours
                    ? `En cours : ${avancement.titreEnCours}${avancement.etape ? `, ${avancement.etape.toLowerCase()}` : ""} (${avancement.enCours} %)`
                    : "Vous pouvez changer de page : le travail continue."}
                </div>
              </div>
            </div>
            <span className="font-titre text-[22px] font-semibold tabular-nums">{phase === "envoi" ? `${global} %` : ""}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${phase === "envoi" ? global : avancement.aFaire ? (avancement.faits / avancement.aFaire) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {lignes.length > 0 && (
        <BarreCollante className="justify-between">
          <p className="text-[13px] text-texte-2">
            {lignes.length} fichiers · {compte.pret ?? 0} prêts · {compte.incomplet ?? 0} à compléter · {compte.doublon ?? 0} doublons · {compte.termine ?? 0} publiés
            {compte.erreur ? ` · ${compte.erreur} en erreur` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <SelecteurVue vue={vue} onChange={changerVue} />
            {pagination}
          </div>
        </BarreCollante>
      )}
      {phase === "analyse" && lignes.length === 0 ? (
        <Chargement texte="Lecture du dossier" />
      ) : lignes.length === 0 ? (
        <Vide texte="Aucun dossier choisi." />
      ) : (
        vue.mode === "grille" ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${largeurCarte[vue.taille]}px, 1fr))` }}>
            {pages.tranche.map((l, rang) => (
              <button
                key={l.id}
                onClick={(e) => sel.surClic(e, rang)}
                onDoubleClick={(e) => sel.surDoubleClic(e, rang)}
                onContextMenu={(e) => menuLigne(e, rang)}
                className={clsx("rounded-2xl border border-filet bg-surface p-2.5 text-left transition-colors hover:border-texte-3/40", classeChoisi(sel.estChoisi(l.id), "carte"))}
              >
                <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-2" style={nomTransition("c", l.id, rang)}>
                  <Pochette ligne={l} />
                  {l.statut === "envoi" && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/65 px-2.5 py-2 text-white">
                      <div className="mb-1 flex justify-between text-[11px]">
                        <span>{l.etape ?? "Envoi"}</span>
                        <span className="tabular-nums">{l.progression} %</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-white/25">
                        <div className="h-full bg-accent transition-[width]" style={{ width: `${l.progression}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-2.5 px-0.5">
                  <div className="truncate text-[13px] font-semibold">
                    {l.titre || l.fichier.nom}
                  </div>
                  <div className={clsx("truncate text-[12px]", l.artiste ? "text-texte-3" : "text-attention")}>{l.artiste?.stageName ?? (l.artisteNom || "artiste inconnu")}</div>
                  {l.statut !== "envoi" && (
                    <div className="mt-1.5" title={l.erreur ?? l.note}>
                      <Pastille texte={l.statut === "termine" && l.note ? "Publié*" : STATUTS[l.statut].libelle} ton={l.statut === "termine" && l.note ? "attention" : STATUTS[l.statut].ton} />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
        <Table densite={vue.taille} entetes={["", "Fichier", "Titre", "Artiste", "Album", { libelle: "Année", largeur: "70px" }, { libelle: "Durée", droite: true, largeur: "70px" }, { libelle: "État", largeur: "140px" }]}>
          {pages.tranche.map((l, rang) => (
            <tr
              key={l.id}
              onClick={(e) => sel.surClic(e, rang)}
              onDoubleClick={(e) => sel.surDoubleClic(e, rang)}
              onContextMenu={(e) => menuLigne(e, rang)}
              className={clsx("cursor-default", classeChoisi(sel.estChoisi(l.id), "ligne"))}
            >
              <td style={{ width: coteVignette[vue.taille] + 24 }}>
                <div className="overflow-hidden rounded-md bg-surface-2" style={{ width: coteVignette[vue.taille], height: coteVignette[vue.taille], ...nomTransition("c", l.id, rang) }}>
                  <Pochette ligne={l} />
                </div>
              </td>
              <td className="max-w-[220px] truncate text-texte-3" title={l.fichier.nom}>
                {l.fichier.nom}
              </td>
              <td className="font-medium">
                <span>{l.titre || "—"}</span>
              </td>
              <td>
                {l.artiste ? (
                  <span>{l.artiste.stageName}</span>
                ) : (
                  <span className="text-attention">
                    {l.artisteNom || "inconnu"} <span className="text-texte-3">(à rapprocher)</span>
                  </span>
                )}
              </td>
              <td className="text-texte-2">{l.album || "—"}</td>
              <td className="text-texte-2 tabular-nums">{l.annee || "—"}</td>
              <td className="text-right text-texte-2 tabular-nums">{l.etiquettes?.duree ? formatDuree(l.etiquettes.duree) : "—"}</td>
              <td>
                {l.statut === "envoi" ? (
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-texte-3">
                      <span>{l.etape ?? "Envoi"}</span>
                      <span className="tabular-nums">{l.progression} %</span>
                    </div>
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full bg-accent transition-[width]" style={{ width: `${l.progression}%` }} />
                    </div>
                  </div>
                ) : (
                  <span title={l.erreur ?? l.note}>
                    <Pastille
                      texte={l.statut === "termine" && l.note ? "Publié*" : STATUTS[l.statut].libelle}
                      ton={l.statut === "termine" && l.note ? "attention" : STATUTS[l.statut].ton}
                    />
                  </span>
                )}
              </td>
            </tr>
          ))}
        </Table>
        )
      )}
      {lignes.length > 0 && <div className="mt-4">{pagination}</div>}
      <BarreSelection nombre={sel.nombre} libelle={(n) => `${n} lignes sélectionnées`} onVider={sel.vider}>
        <Selection
          value=""
          disabled={verrou}
          onChange={(e) => e.target.value && changerGenre([...sel.choisis], e.target.value)}
          className="w-44"
        >
          <option value="">Changer le genre…</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Selection>
        <Bouton variante="trait" className="h-9" disabled={verrou} onClick={() => reessayer([...sel.choisis])}>
          <RotateCcw size={14} /> Réessayer
        </Bouton>
        <Bouton variante="danger" className="h-9" disabled={verrou} onClick={() => enlever([...sel.choisis])}>
          <Trash2 size={14} /> Retirer
        </Bouton>
      </BarreSelection>
      {ligneOuverte && <FicheLigne ligne={ligneOuverte} genres={genres} verrouillee={phase === "envoi"} onChange={(patch) => modifier(ligneOuverte.id, patch)} onFermer={() => setSelection(null)} />}
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
          <p className="mb-3 rounded-lg border border-attention/40 bg-attention/10 px-3 py-2 text-[13px]">
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
            <input value={ligne.titre} disabled={verrouillee} onChange={(e) => onChange({ titre: e.target.value })} className="h-9 w-full rounded-lg border border-filet bg-surface-2 px-3 text-[13px] outline-none focus:border-accent" />
          </label>
          <div>
            <span className="mb-1 block text-[12px] font-medium text-texte-2">Artiste</span>
            {ligne.artiste ? (
              <div className="flex items-center justify-between rounded-lg border border-filet px-3 py-2 text-[13px]">
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
                <input value={recherche} disabled={verrouillee} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom d'artiste" className="h-9 w-full rounded-lg border border-filet bg-surface-2 px-3 text-[13px] outline-none focus:border-accent" />
                <ul className="mt-1 divide-y divide-filet rounded-lg border border-filet">
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
              <input value={ligne.album} disabled={verrouillee} onChange={(e) => onChange({ album: e.target.value })} placeholder="Single si vide" className="h-9 w-full rounded-lg border border-filet bg-surface-2 px-3 text-[13px] outline-none focus:border-accent" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-texte-2">Année de sortie</span>
              <input value={ligne.annee} disabled={verrouillee} onChange={(e) => onChange({ annee: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="Sans : aujourd'hui" className="h-9 w-full rounded-lg border border-filet bg-surface-2 px-3 text-[13px] outline-none focus:border-accent" />
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

/** La pochette d'un fichier : celle des balises, sinon la photo de l'artiste rapproché. */
function Pochette({ ligne }: { ligne: Ligne }) {
  if (ligne.etiquettes?.pochette) return <img src={`data:${ligne.etiquettes.pochette.mime};base64,${ligne.etiquettes.pochette.base64}`} alt="" className="h-full w-full object-cover" />;
  if (ligne.artiste?.coverUrl) return <img src={adresseImage(ligne.artiste.coverUrl) ?? undefined} alt="" className="h-full w-full object-cover" />;
  return null;
}
