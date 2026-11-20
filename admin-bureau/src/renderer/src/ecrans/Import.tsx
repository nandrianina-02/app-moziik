import { useMemo, useState } from "react";
import { FileClock, FilePlus2, FolderOpen, Gauge, PenLine, Pencil, Play, RotateCcw, Square, Tag, Trash2, Upload, X } from "lucide-react";
import { Barres, Bouton, Chargement, EnTete, Erreur, Pagination, Pastille, Selection, Table, formatDuree, usePages , BarreCollante } from "../composants";
import { SelecteurVue, coteVignette, largeurCarte, nomTransition, useRaccourciVue, useVue } from "../vues";
import clsx from "../clsx";
import { BarreSelection, annoncer, classeChoisi, confirmer, ouvrirMenu, useSelection } from "../interactions";
import { adresseImage } from "../session";
import { STATUTS, pochetteDe, useTeleversements, type Ligne, type Statut } from "../televersements";
import { estimerTempo } from "../bpm";
import { FicheTeleversement } from "./FicheTeleversement";
import { ModificationGroupee } from "./ModificationGroupee";

/*
 * La vue des téléversements. L'état et les envois vivent dans
 * televersements.tsx, au niveau de la coquille : quitter cette page ne les
 * interrompt pas, et y revenir montre où ils en sont.
 */

export function Import() {
  const { dossier, lignes, genres, fonctionsIA, phase, erreur, avancement, choisir, choisirFichiers, envoyerTout, arreter, modifier, modifierPlusieurs, retirer, vider } = useTeleversements();
  const [selection, setSelection] = useState<string | null>(null);
  // La modification groupée : les lignes visées, tant que le panneau est ouvert.
  const [groupe, setGroupe] = useState<string[] | null>(null);
  const [mesure, setMesure] = useState<string | null>(null);

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
  /** Le tempo mesuré dans chaque fichier qui n'en a pas, l'un après l'autre (lib/bpm.ts du site). */
  async function mesurerTempo(ids: string[]) {
    const cibles = lignes.filter((l) => ids.includes(l.id) && !l.bpm && l.statut !== "envoi" && l.statut !== "termine");
    if (cibles.length === 0) return annoncer("Ces lignes ont déjà un tempo");
    let trouves = 0;
    for (const [i, l] of cibles.entries()) {
      setMesure(`Tempo ${i + 1}/${cibles.length}`);
      try {
        const r = await estimerTempo(new Blob([await window.bureau.lireFichier(l.fichier.chemin)]));
        // Un résultat ambigu (moitié ou double) n'est pas posé d'office, comme sur le site.
        if (r && !r.ambigu) {
          modifier(l.id, { bpm: String(r.bpm), bpmSource: "analyse" });
          trouves++;
        }
      } catch {
        // Un fichier que le décodeur ne lit pas garde un tempo vide.
      }
    }
    setMesure(null);
    annoncer(`Tempo mesuré pour ${trouves} titre${trouves > 1 ? "s" : ""} sur ${cibles.length}`);
  }
  function basculerBrouillon(ids: string[], brouillon: boolean) {
    modifierPlusieurs(ids, { brouillon });
    annoncer(brouillon ? `${ids.length} titre${ids.length > 1 ? "s" : ""} en brouillon` : `${ids.length} titre${ids.length > 1 ? "s" : ""} à publier directement`);
  }
  function importerQuandMeme(ids: string[]) {
    for (const l of lignes.filter((x) => ids.includes(x.id) && x.statut === "doublon")) modifier(l.id, { importerQuandMeme: true });
  }
  async function enlever(ids: string[]) {
    const ok = await confirmer({
      titre: ids.length > 1 ? `Retirer ces ${ids.length} lignes de la liste ?` : "Retirer cette ligne de la liste ?",
      message: "Le fichier reste sur le disque et rien ne change sur le site ; il faudra rouvrir le dossier pour le retrouver ici.",
      confirmer: "Retirer",
    });
    if (!ok) return;
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
        cibles.length === 1 && { libelle: "Ouvrir la fiche", icone: Pencil, raccourci: "Entrée", action: () => setSelection(cibles[0].id) },
        { libelle: cibles.length > 1 ? `Modifier ensemble (${cibles.length})` : "Modifier plusieurs champs", icone: PenLine, desactive: verrou, action: () => setGroupe(ids) },
        doublons > 0 && { libelle: `Importer quand même${cibles.length > 1 ? ` (${doublons})` : ""}`, icone: Upload, desactive: verrou, action: () => importerQuandMeme(ids) },
        erreurs > 0 && { libelle: `Réessayer${cibles.length > 1 ? ` (${erreurs})` : ""}`, icone: RotateCcw, desactive: verrou, action: () => reessayer(ids) },
        "separateur",
        { libelle: cibles.every((l) => l.brouillon) ? "Publier directement" : "Enregistrer comme brouillon", icone: FileClock, desactive: verrou, action: () => basculerBrouillon(ids, !cibles.every((l) => l.brouillon)) },
        { libelle: "Mesurer le tempo", icone: Gauge, desactive: verrou || mesure !== null, action: () => void mesurerTempo(ids) },
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
        texte={dossier ? `Dernier ajout : ${dossier}` : "Ajoutez des fichiers, un dossier, ou glissez-les dans la fenêtre : ils sont lus, rapprochés du catalogue, puis publiés."}
        action={
          <>
            {dossier && phase === "repos" && (
              <Bouton variante="discret" onClick={vider} title="Vider la liste (rien n'est supprimé du disque ni du site)">
                <X size={14} /> Vider la liste
              </Bouton>
            )}
            <Bouton variante="trait" disabled={phase !== "repos"} onClick={() => void choisirFichiers()} title="Ajouter des fichiers audio à la liste">
              <FilePlus2 size={14} /> Ajouter des fichiers
            </Bouton>
            <Bouton variante="trait" disabled={phase !== "repos"} onClick={() => void choisir()} title="Ajouter tous les fichiers audio d'un dossier et de ses sous-dossiers">
              <FolderOpen size={14} /> Ajouter un dossier
            </Bouton>
            {phase === "envoi" ? (
              <Bouton variante="danger" onClick={arreter}>
                <Square size={14} /> Arrêter après ce titre
              </Bouton>
            ) : (
              <Bouton disabled={!compte.pret || phase !== "repos"} onClick={() =>
                  void confirmer({
                    titre: `Publier ${compte.pret ?? 0} titre${(compte.pret ?? 0) > 1 ? "s" : ""} ?`,
                    message: "Les fichiers partent vers le stockage, puis les titres sont publiés sur Moziik avec leur artiste, leur genre et leur album. Vous pourrez changer de page pendant l'envoi.",
                    confirmer: "Publier",
                  }).then((ok) => ok && void envoyerTout())
                }>
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
        <ZoneDepotVide onFichiers={() => void choisirFichiers()} onDossier={() => void choisir()} />
      ) : (
        vue.mode === "grille" ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${largeurCarte[vue.taille]}px, 1fr))` }}>
            {pages.tranche.map((l, rang) => (
              <button
                key={l.id}
                data-rang={rang}
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
        <Table densite={vue.taille} entetes={["", "Fichier", "Titre", "Artiste", "Album", { libelle: "Sortie", largeur: "70px" }, { libelle: "Durée", droite: true, largeur: "70px" }, { libelle: "État", largeur: "140px" }]}>
          {pages.tranche.map((l, rang) => (
            <tr
              key={l.id}
              data-rang={rang}
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
              <td className="text-texte-2 tabular-nums" title={l.dateSortie ? `Sortie le ${l.dateSortie}` : "Sortie maintenant"}>{l.dateSortie ? l.dateSortie.slice(0, 4) : "—"}</td>
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
        <Bouton variante="trait" className="h-9" disabled={verrou} onClick={() => setGroupe([...sel.choisis])}>
          <PenLine size={14} /> Modifier ensemble
        </Bouton>
        <Bouton variante="trait" className="h-9" disabled={verrou || mesure !== null} enCours={mesure !== null} onClick={() => void mesurerTempo([...sel.choisis])} title="Mesurer le tempo des fichiers qui n'en ont pas">
          <Gauge size={14} /> {mesure ?? "Tempo"}
        </Bouton>
        <Bouton variante="trait" className="h-9" disabled={verrou} onClick={() => reessayer([...sel.choisis])}>
          <RotateCcw size={14} /> Réessayer
        </Bouton>
        <Bouton variante="danger" className="h-9" disabled={verrou} onClick={() => enlever([...sel.choisis])}>
          <Trash2 size={14} /> Retirer
        </Bouton>
      </BarreSelection>
      {ligneOuverte && <FicheTeleversement key={ligneOuverte.id} ligne={ligneOuverte} genres={genres} fonctionsIA={fonctionsIA} verrouillee={phase === "envoi" || ligneOuverte.statut === "termine"} onChange={(patch) => modifier(ligneOuverte.id, patch)} onFermer={() => setSelection(null)} />}
      {groupe && (
        <ModificationGroupee
          nombre={groupe.length}
          genres={genres}
          onAppliquer={(patch) => {
            modifierPlusieurs(groupe, patch);
            annoncer(`${groupe.length} ligne${groupe.length > 1 ? "s" : ""} modifiée${groupe.length > 1 ? "s" : ""}`);
            setGroupe(null);
          }}
          onFermer={() => setGroupe(null)}
        />
      )}
    </>
  );
}

/**
 * La liste vide : les trois manières d'ajouter, dont le glisser-déposer,
 * reçu par la coquille partout dans la fenêtre (le cadre pointillé n'est
 * qu'une invitation).
 */
function ZoneDepotVide({ onFichiers, onDossier }: { onFichiers: () => void; onDossier: () => void }) {
  return (
    <div className="animate-monter flex flex-col items-center rounded-2xl border-2 border-dashed border-filet px-8 py-16 text-center">
      <Upload size={30} className="text-texte-3" />
      <div className="mt-4 font-titre text-[17px] font-semibold">Glissez ici des fichiers audio ou des dossiers</div>
      <p className="mt-1.5 max-w-[460px] text-[13px] text-texte-2">
        MP3, M4A, FLAC, WAV, OGG, OPUS ou WMA. Les balises, la pochette et la durée sont lues, l'artiste est rapproché du catalogue et les doublons sont signalés avant tout envoi.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Bouton onClick={onFichiers}>
          <FilePlus2 size={14} /> Ajouter des fichiers
        </Bouton>
        <Bouton variante="trait" onClick={onDossier}>
          <FolderOpen size={14} /> Ajouter un dossier
        </Bouton>
      </div>
    </div>
  );
}

/** La pochette d'un fichier : celle des balises, sinon la photo de l'artiste rapproché. */
function Pochette({ ligne }: { ligne: Ligne }) {
  const image = pochetteDe(ligne);
  if (image) return <img src={`data:${image.mime};base64,${image.base64}`} alt="" className="h-full w-full object-cover" />;
  if (ligne.artiste?.coverUrl) return <img src={adresseImage(ligne.artiste.coverUrl) ?? undefined} alt="" className="h-full w-full object-cover" />;
  return null;
}
