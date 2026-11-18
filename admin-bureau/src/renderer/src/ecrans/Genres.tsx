import { useEffect, useMemo, useState } from "react";
import { AudioLines, Check, ChevronLeft, ChevronRight, CheckCheck, ExternalLink, FileAudio, RefreshCw, Tags, User, X } from "lucide-react";
import { adresseSite, api } from "../api";
import { BarreCollante, Bouton, Chargement, EnTete, Erreur, Pastille, Selection, Table, Vide, formatNombre } from "../composants";
import { BarreSelection, annoncer, classeChoisi, confirmer, ouvrirMenu, useSelection } from "../interactions";
import { BoutonEcoute } from "../lecture";
import { adresseImage } from "../session";
import clsx from "../clsx";

interface Titre {
  _id: string;
  title: string;
  coverUrl?: string;
  genre?: string | null;
  genrePropose?: string | null;
  genreConfiance?: number | null;
  genreSource?: "artiste" | "balise" | "audio" | null;
  artist?: { stageName?: string } | null;
}

type Onglet = "propositions" | "a-classer" | "genre";

interface Reponse {
  titres: Titre[];
  suite: boolean;
  page: number;
  compteurs?: { propositions?: number; aClasser?: number };
  genres?: string[];
}

/** Seuil d'une proposition « sûre » : en dessous, l'œil humain reste nécessaire. */
const SEUIL_SUR = 0.8;

const SOURCES: Record<NonNullable<Titre["genreSource"]>, { libelle: string; icone: typeof User }> = {
  artiste: { libelle: "d'après l'artiste", icone: User },
  balise: { libelle: "d'après les balises du fichier", icone: FileAudio },
  audio: { libelle: "d'après l'analyse audio", icone: AudioLines },
};

const pourcent = (c: number | null | undefined) => (typeof c === "number" ? Math.round(c <= 1 ? c * 100 : c) : null);
const estSure = (t: Titre) => Boolean(t.genrePropose) && (t.genreConfiance ?? 0) >= SEUIL_SUR;

/**
 * Les genres : valider les genres proposés automatiquement (d'après
 * l'artiste, les balises du fichier ou l'écoute), classer les titres sans
 * genre, et revoir le contenu d'un genre. Un genre juste nourrit les
 * radios, les recommandations et les pages de genre du site.
 */
export function Genres() {
  const [onglet, setOnglet] = useState<Onglet>("propositions");
  const [genreRevu, setGenreRevu] = useState("");
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [compteurs, setCompteurs] = useState<{ propositions?: number; aClasser?: number }>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [videeALaMain, setVideeALaMain] = useState(false);

  const charger = () => {
    // « Revoir un genre » sans genre choisi n'a rien à demander au site :
    // on attend que la liste des genres soit connue.
    if (onglet === "genre" && !genreRevu) return;
    setVideeALaMain(false);
    setDonnees(null);
    setErreur(null);
    const g = onglet === "genre" ? `&g=${encodeURIComponent(genreRevu)}` : "";
    api<Reponse>(`/api/admin/genres?vue=${onglet}${g}&page=${page}`)
      .then((r) => {
        setDonnees({ ...r, titres: r.titres ?? [] });
        if (r.compteurs) setCompteurs(r.compteurs);
        if (r.genres?.length) setGenres(r.genres);
      })
      .catch((e) => setErreur(e instanceof Error ? e.message : "Chargement impossible."));
  };
  useEffect(charger, [onglet, genreRevu, page]);

  // La liste des genres vient d'ordinaire avec la réponse ; un site plus
  // ancien ne l'envoie pas, on la prend alors dans sa configuration.
  useEffect(() => {
    api<{ genres?: string[] }>("/api/site-config")
      .then((c) => setGenres((avant) => (avant.length > 0 ? avant : (c.genres ?? []))))
      .catch(() => undefined);
  }, []);

  // Passer sur « Revoir un genre » choisit le premier genre de la liste.
  useEffect(() => {
    if (onglet === "genre" && !genreRevu && genres.length > 0) setGenreRevu(genres[0]);
  }, [onglet, genreRevu, genres]);

  // Les titres traités sortent de la requête : une page vidée se recharge.
  useEffect(() => {
    if (videeALaMain && donnees && donnees.titres.length === 0 && (donnees.suite || page > 1)) {
      setVideeALaMain(false);
      if (page > 1 && !donnees.suite) setPage((p) => p - 1);
      else charger();
    }
  }, [videeALaMain, donnees]);

  function changerOnglet(o: Onglet) {
    if (o === onglet) return;
    setOnglet(o);
    setPage(1);
  }

  const titres = donnees?.titres ?? [];
  const sel = useSelection(titres.map((t) => t._id));
  const sures = useMemo(() => titres.filter(estSure), [titres]);

  /**
   * Applique la décision localement : un titre quitte la vue dès qu'il ne
   * répond plus à son critère (plus de proposition, plus « à classer »,
   * plus dans le genre revu).
   */
  function appliquerLocalement(ids: string[], maj: (t: Titre) => Titre) {
    const viser = new Set(ids);
    const reste = (n: Titre) => (onglet === "propositions" ? Boolean(n.genrePropose) : onglet === "a-classer" ? !n.genre : n.genre === genreRevu);
    // Calculé sur la liste affichée, hors de la fonction de mise à jour :
    // React peut différer celle-ci, le compte y serait encore nul.
    const sortis = titres.filter((t) => viser.has(t._id) && !reste(maj(t))).length;
    setDonnees((d) =>
      d
        ? {
            ...d,
            titres: d.titres.flatMap((t) => {
              if (!viser.has(t._id)) return [t];
              const n = maj(t);
              return reste(n) ? [n] : [];
            }),
          }
        : d,
    );
    // Les compteurs des onglets suivent sans attendre un rechargement.
    if (onglet === "propositions") setCompteurs((c) => ({ ...c, propositions: Math.max(0, (c.propositions ?? 0) - sortis) }));
    if (onglet === "a-classer") setCompteurs((c) => ({ ...c, aClasser: Math.max(0, (c.aClasser ?? 0) - sortis) }));
    setVideeALaMain(true);
  }

  async function envoyer(ids: string[], corps: { genre: string } | { accepter: true } | { rejeter: true }, cle: string) {
    setEnCours(cle);
    setErreur(null);
    let modifies = 0;
    try {
      // Le site accepte au plus 200 identifiants par appel.
      for (let i = 0; i < ids.length; i += 200) {
        const r = await api<{ modifies?: number }>(`/api/admin/genres`, { methode: "PATCH", corps: { ids: ids.slice(i, i + 200), ...corps } });
        modifies += r.modifies ?? 0;
      }
      return modifies;
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Modification non enregistrée.");
      return null;
    } finally {
      setEnCours(null);
    }
  }

  const quoi = (ids: string[]) => (ids.length > 1 ? `ces ${ids.length} titres` : `« ${titres.find((t) => t._id === ids[0])?.title ?? "ce titre"} »`);
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

  async function accepter(ids: string[], titreConfirmation?: string) {
    const avecProposition = titres.filter((t) => ids.includes(t._id) && t.genrePropose).map((t) => t._id);
    if (avecProposition.length === 0) return;
    // Confirmé même pour un seul titre : le genre décide des pages de genre
    // et des modes d'écoute où le titre apparaît.
    const seul = avecProposition.length === 1 ? titres.find((t) => t._id === avecProposition[0]) : null;
    const ok = await confirmer({
      titre: titreConfirmation ?? (seul ? `Passer ${quoi(avecProposition)} en ${seul.genrePropose} ?` : `Accepter les propositions de ${quoi(avecProposition)} ?`),
      message: seul ? `Le titre quitte « ${seul.genre || "sans genre"} » pour le genre proposé.` : "Chaque titre prend le genre qui lui est proposé.",
      confirmer: "Accepter",
    });
    if (!ok) return;
    const n = await envoyer(avecProposition, { accepter: true }, avecProposition.length === 1 ? `${avecProposition[0]}:accepter` : "lot");
    if (n === null) return;
    appliquerLocalement(avecProposition, (t) => ({ ...t, genre: t.genrePropose ?? t.genre, genrePropose: null, genreConfiance: null }));
    sel.vider();
    annoncer(`${pluriel(avecProposition.length, "proposition")} acceptée${avecProposition.length > 1 ? "s" : ""}`);
  }

  async function rejeter(ids: string[]) {
    const avecProposition = titres.filter((t) => ids.includes(t._id) && t.genrePropose).map((t) => t._id);
    if (avecProposition.length === 0) return;
    const ok = await confirmer({
      titre: avecProposition.length > 1 ? `Rejeter les propositions de ${quoi(avecProposition)} ?` : `Rejeter la proposition pour ${quoi(avecProposition)} ?`,
      message: "Les titres gardent leur genre actuel et la proposition est écartée.",
      confirmer: "Rejeter",
      danger: true,
    });
    if (!ok) return;
    const n = await envoyer(avecProposition, { rejeter: true }, avecProposition.length === 1 ? `${avecProposition[0]}:rejeter` : "lot");
    if (n === null) return;
    appliquerLocalement(avecProposition, (t) => ({ ...t, genrePropose: null, genreConfiance: null }));
    sel.vider();
    annoncer(`${pluriel(avecProposition.length, "proposition")} rejetée${avecProposition.length > 1 ? "s" : ""}`);
  }

  async function classer(ids: string[], genre: string) {
    if (!genre || ids.length === 0) return;
    const ok = await confirmer({
      titre: `Classer ${quoi(ids)} en ${genre} ?`,
      message: "Le genre choisi remplace le genre actuel et toute proposition en attente.",
      confirmer: `Classer en ${genre}`,
    });
    if (!ok) return;
    const n = await envoyer(ids, { genre }, ids.length === 1 ? `${ids[0]}:classer` : "lot");
    if (n === null) return;
    appliquerLocalement(ids, (t) => ({ ...t, genre, genrePropose: null, genreConfiance: null }));
    sel.vider();
    annoncer(`${pluriel(ids.length, "titre")} classé${ids.length > 1 ? "s" : ""} en ${genre}`);
  }

  function menuTitre(e: React.MouseEvent, rang: number) {
    const ids = sel.surMenu(rang);
    const cibles = titres.filter((t) => ids.includes(t._id));
    if (cibles.length === 0) return;
    const proposes = cibles.filter((t) => t.genrePropose).length;
    ouvrirMenu(
      e,
      [
        cibles.length === 1 && { libelle: "Voir sur le site", icone: ExternalLink, action: () => void window.bureau.ouvrirExterne(`${adresseSite()}/son/${cibles[0]._id}`) },
        "separateur",
        proposes > 0 && { libelle: cibles.length > 1 ? `Accepter (${proposes})` : `Accepter ${cibles[0].genrePropose}`, icone: Check, action: () => void accepter(ids) },
        proposes > 0 && { libelle: cibles.length > 1 ? `Rejeter (${proposes})` : "Rejeter la proposition", icone: X, danger: true, action: () => void rejeter(ids) },
      ],
      cibles.length === 1 ? cibles[0].title : `${cibles.length} titres sélectionnés`,
    );
  }

  const precedent = page > 1;
  const suivant = Boolean(donnees?.suite);
  const pagination = (
    <div className="flex items-center gap-1 text-[12.5px]">
      <span className="mr-2 text-texte-3 tabular-nums">Page {page}</span>
      <button
        onClick={() => setPage((p) => p - 1)}
        disabled={!precedent || !donnees}
        className="grid h-8 w-8 place-items-center rounded-lg border border-filet bg-surface text-texte-2 hover:text-texte disabled:opacity-40"
        title="Page précédente"
      >
        <ChevronLeft size={15} />
      </button>
      <button
        onClick={() => setPage((p) => p + 1)}
        disabled={!suivant}
        className="grid h-8 w-8 place-items-center rounded-lg border border-filet bg-surface text-texte-2 hover:text-texte disabled:opacity-40"
        title="Page suivante"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );

  const ONGLETS: [Onglet, string, number | undefined][] = [
    ["propositions", "Propositions", compteurs.propositions],
    ["a-classer", "À classer", compteurs.aClasser],
    ["genre", "Revoir un genre", undefined],
  ];
  const optionsGenres = (actuel?: string | null) => (
    <>
      {actuel && !genres.includes(actuel) && <option value={actuel}>{actuel}</option>}
      {genres.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </>
  );

  return (
    <>
      <EnTete
        titre="Genres"
        texte="Genres proposés automatiquement, titres sans genre, et contenu de chaque genre."
        action={
          <>
            {sures.length > 0 && (
              <Bouton enCours={enCours === "lot"} onClick={() => void accepter(sures.map((t) => t._id), `Accepter les ${sures.length} propositions sûres ?`)}>
                <CheckCheck size={14} /> Accepter les {sures.length} proposition{sures.length > 1 ? "s" : ""} sûre{sures.length > 1 ? "s" : ""}
              </Bouton>
            )}
            <Bouton variante="trait" onClick={charger}>
              <RefreshCw size={14} /> Actualiser
            </Bouton>
          </>
        }
      />
      <BarreCollante className="animate-monter decale-1">
        <div className="flex rounded-lg border border-filet bg-surface p-0.5">
          {ONGLETS.map(([o, libelle, n]) => (
            <button
              key={o}
              onClick={() => changerOnglet(o)}
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                onglet === o ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte",
              )}
            >
              {libelle}
              {typeof n === "number" && <span className={clsx("tabular-nums", onglet === o ? "opacity-80" : "text-texte-3")}>{formatNombre(n)}</span>}
            </button>
          ))}
        </div>
        {onglet === "genre" && (
          <Selection
            className="w-48"
            value={genreRevu}
            onChange={(e) => {
              setGenreRevu(e.target.value);
              setPage(1);
            }}
            aria-label="Genre à revoir"
          >
            {!genreRevu && <option value="">Choisir un genre</option>}
            {optionsGenres(genreRevu)}
          </Selection>
        )}
        <div className="ml-auto">{pagination}</div>
      </BarreCollante>
      <Erreur message={erreur} />
      {onglet === "genre" && !genreRevu && genres.length === 0 ? (
        <Vide texte="La liste des genres n'est pas encore chargée." />
      ) : !donnees ? (
        !erreur && <Chargement />
      ) : titres.length === 0 ? (
        <Vide
          texte={
            page > 1
              ? "Plus rien sur cette page."
              : onglet === "propositions"
                ? "Aucune proposition en attente."
                : onglet === "a-classer"
                  ? "Tous les titres ont un genre."
                  : `Aucun titre en ${genreRevu}.`
          }
        />
      ) : (
        <Table
          entetes={[
            { libelle: "", largeur: "92px" },
            "Titre",
            { libelle: "Genre actuel", largeur: "150px" },
            { libelle: "Proposition", largeur: "240px" },
            { libelle: "", largeur: onglet === "propositions" ? "330px" : "220px" },
          ]}
        >
          {titres.map((t, rang) => {
            const source = t.genreSource ? SOURCES[t.genreSource] : undefined;
            const IconeSource = source?.icone;
            const p = pourcent(t.genreConfiance);
            return (
              <tr
                key={t._id}
                data-rang={rang}
                onClick={(e) => sel.surClic(e, rang)}
                onContextMenu={(e) => menuTitre(e, rang)}
                className={clsx("cursor-default", classeChoisi(sel.estChoisi(t._id), "ligne"))}
              >
                <td>
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-surface-2">
                      {t.coverUrl && <img src={adresseImage(t.coverUrl) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    </div>
                    <BoutonEcoute id={t._id} depart={0.35} taille={30} />
                  </div>
                </td>
                <td className="min-w-0">
                  <div className="flex items-center gap-1 font-medium">
                    <span className="truncate">{t.title}</span>
                    <button
                      onClick={() => void window.bureau.ouvrirExterne(`${adresseSite()}/son/${t._id}`)}
                      className="shrink-0 text-texte-3 hover:text-accent"
                      title="Voir sur le site"
                    >
                      <ExternalLink size={12} />
                    </button>
                  </div>
                  <div className="truncate text-[12px] text-texte-3">{t.artist?.stageName ?? "—"}</div>
                </td>
                <td className="text-texte-2">{t.genre || <span className="text-texte-3">Aucun</span>}</td>
                <td>
                  {t.genrePropose ? (
                    <div>
                      <div className="flex items-center font-medium">
                        {t.genrePropose}
                        {p !== null && <Pastille texte={`${p} %`} ton={estSure(t) ? "succes" : p >= 50 ? "attention" : "neutre"} />}
                      </div>
                      {source && IconeSource && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-texte-3">
                          <IconeSource size={11} /> {source.libelle}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-texte-3">—</span>
                  )}
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1.5">
                    {t.genrePropose && (
                      <>
                        <Bouton variante="trait" enCours={enCours === `${t._id}:accepter`} onClick={() => void accepter([t._id])} title={`Classer en ${t.genrePropose}`}>
                          <Check size={14} /> Accepter
                        </Bouton>
                        {onglet === "propositions" && (
                          <Bouton variante="discret" enCours={enCours === `${t._id}:rejeter`} onClick={() => void rejeter([t._id])} title="Garder le genre actuel">
                            <X size={14} /> Rejeter
                          </Bouton>
                        )}
                      </>
                    )}
                    <Selection
                      className="w-36"
                      value=""
                      disabled={enCours === `${t._id}:classer`}
                      onChange={(e) => void classer([t._id], e.target.value)}
                      aria-label={`Classer ${t.title}`}
                    >
                      <option value="">Classer en…</option>
                      {genres
                        .filter((g) => g !== t.genre)
                        .map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                    </Selection>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
      {donnees && titres.length > 0 && (precedent || suivant) && <div className="mt-4 flex justify-end">{pagination}</div>}
      <BarreSelection nombre={sel.nombre} libelle={(n) => `${n} titres sélectionnés`} onVider={sel.vider}>
        {titres.some((t) => sel.estChoisi(t._id) && t.genrePropose) && (
          <>
            <Bouton className="h-9" enCours={enCours === "lot"} onClick={() => void accepter([...sel.choisis])}>
              <Check size={14} /> Accepter
            </Bouton>
            <Bouton variante="danger" className="h-9" disabled={enCours === "lot"} onClick={() => void rejeter([...sel.choisis])}>
              <X size={14} /> Rejeter
            </Bouton>
          </>
        )}
        <span className="flex items-center gap-1.5">
          <Tags size={14} className="text-texte-3" />
          <Selection className="w-44" value="" disabled={enCours === "lot"} onChange={(e) => void classer([...sel.choisis], e.target.value)} aria-label="Classer la sélection">
            <option value="">Classer en…</option>
            {optionsGenres()}
          </Selection>
        </span>
      </BarreSelection>
    </>
  );
}
