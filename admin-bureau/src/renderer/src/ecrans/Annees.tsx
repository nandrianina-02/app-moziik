import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarClock, ChevronLeft, ChevronRight, Disc3, ExternalLink, Headphones, Music, RefreshCw, User } from "lucide-react";
import { adresseSite, api } from "../api";
import { BarreCollante, Bouton, Carte, Chargement, EnTete, Erreur, Vide, formatDate, formatNombre } from "../composants";
import { annoncer, confirmer } from "../interactions";
import { BoutonEcoute } from "../lecture";
import { adresseImage } from "../session";
import clsx from "../clsx";

interface TitreGroupe {
  _id: string;
  title: string;
  coverUrl?: string;
  genre?: string;
  releaseDate?: string;
  createdAt?: string;
}

interface Groupe {
  _id: string;
  album?: { title?: string } | null;
  artist?: { stageName?: string } | null;
  titres: TitreGroupe[];
  ecoutes?: number;
}

interface Reponse {
  groupes: Groupe[];
  suite: boolean;
  page: number;
  compte?: number;
}

const ANNEE_MIN = 1950;

/**
 * Les années de sortie douteuses : des titres importés dont la date est
 * celle de l'envoi, ou une date par défaut. Regroupés par album (sinon par
 * artiste), ils se corrigent d'un coup. Une date juste se confirme pour ne
 * plus être proposée.
 */
export function Annees() {
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [videeALaMain, setVideeALaMain] = useState(false);

  const charger = () => {
    setVideeALaMain(false);
    setDonnees(null);
    setErreur(null);
    api<Reponse>(`/api/admin/annees?page=${page}`)
      .then((r) => setDonnees({ ...r, groupes: r.groupes ?? [] }))
      .catch((e) => setErreur(e instanceof Error ? e.message : "Chargement impossible."));
  };
  useEffect(charger, [page]);

  // Un groupe traité sort de la requête du site : la page vidée se recharge
  // pour faire remonter les suivants.
  useEffect(() => {
    if (videeALaMain && donnees && donnees.groupes.length === 0 && (donnees.suite || page > 1)) {
      setVideeALaMain(false);
      if (page > 1 && !donnees.suite) setPage((p) => p - 1);
      else charger();
    }
  }, [videeALaMain, donnees]);

  function retirer(id: string) {
    setVideeALaMain(true);
    setDonnees((d) => (d ? { ...d, groupes: d.groupes.filter((g) => g._id !== id), compte: typeof d.compte === "number" ? Math.max(0, d.compte - 1) : d.compte } : d));
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

  return (
    <>
      <EnTete
        titre="Années de sortie"
        texte={
          typeof donnees?.compte === "number"
            ? `${formatNombre(donnees.compte)} groupe${donnees.compte > 1 ? "s" : ""} à vérifier`
            : "Titres dont l'année de sortie paraît douteuse."
        }
        action={
          <Bouton variante="trait" onClick={charger}>
            <RefreshCw size={14} /> Actualiser
          </Bouton>
        }
      />
      <BarreCollante className="animate-monter decale-1">
        <p className="flex items-center gap-2 text-[12.5px] text-texte-2">
          <CalendarClock size={14} className="text-texte-3" />
          L'année appliquée vaut aussi pour l'album des titres cochés. Elle sert aux Nouveautés et à la Nostalgie.
        </p>
        <div className="ml-auto">{pagination}</div>
      </BarreCollante>
      <Erreur message={erreur} />
      {!donnees ? (
        !erreur && <Chargement />
      ) : donnees.groupes.length === 0 ? (
        <Vide texte={page > 1 ? "Plus rien sur cette page." : "Aucune année douteuse."} />
      ) : (
        <div className="space-y-4">
          {donnees.groupes.map((g, i) => (
            <CarteGroupe key={g._id} groupe={g} rang={i} onTraite={() => retirer(g._id)} onErreur={setErreur} />
          ))}
        </div>
      )}
      {donnees && (precedent || suivant) && <div className="mt-4 flex justify-end">{pagination}</div>}
    </>
  );
}

function CarteGroupe({ groupe, rang, onTraite, onErreur }: { groupe: Groupe; rang: number; onTraite: () => void; onErreur: (m: string | null) => void }) {
  const [coches, setCoches] = useState<Set<string>>(() => new Set(groupe.titres.map((t) => t._id)));
  // Champ vide au départ : la date actuelle est justement celle qui est
  // douteuse, la proposer reviendrait à la valider sans réfléchir.
  const [annee, setAnnee] = useState("");
  const [enCours, setEnCours] = useState<"annee" | "confirmer" | null>(null);
  const anneeMax = new Date().getFullYear();
  const valeur = Number(annee);
  const anneeValide = /^\d{4}$/.test(annee) && valeur >= ANNEE_MIN && valeur <= anneeMax;
  const ids = useMemo(() => groupe.titres.filter((t) => coches.has(t._id)).map((t) => t._id), [groupe.titres, coches]);
  const tous = ids.length === groupe.titres.length;
  const nom = groupe.album?.title ?? groupe.artist?.stageName ?? "Sans album";
  const quoi = ids.length > 1 ? `ces ${ids.length} titres` : "ce titre";
  const decale = rang < 6 ? `decale-${rang + 1}` : undefined;

  function basculer(id: string) {
    setCoches((avant) => {
      const n = new Set(avant);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function envoyer(corps: { annee: number } | { confirmer: true }, cle: "annee" | "confirmer", message: string) {
    setEnCours(cle);
    onErreur(null);
    try {
      // Le site accepte au plus 200 identifiants par appel ; un groupe en
      // contient rarement autant, mais un artiste prolifique sans album si.
      for (let i = 0; i < ids.length; i += 200) {
        await api(`/api/admin/annees`, { methode: "PATCH", corps: { ids: ids.slice(i, i + 200), ...corps } });
      }
      annoncer(message);
      onTraite();
    } catch (e) {
      onErreur(e instanceof Error ? e.message : "Modification non enregistrée.");
      setEnCours(null);
    }
  }

  async function appliquer() {
    if (!anneeValide || ids.length === 0) return;
    const ok = await confirmer({
      titre: `Mettre ${quoi} en ${valeur} ?`,
      message: `La date de sortie de ${quoi}${groupe.album?.title ? ` et de l'album « ${groupe.album.title} »` : " et de leur album"} passe à l'année ${valeur}.${tous ? "" : ` Les ${groupe.titres.length - ids.length} titres décochés ne changent pas.`}`,
      confirmer: `Appliquer ${valeur}`,
    });
    if (!ok) return;
    await envoyer({ annee: valeur }, "annee", `Année ${valeur} appliquée à ${ids.length} titre${ids.length > 1 ? "s" : ""}`);
  }

  async function garderDate() {
    if (ids.length === 0) return;
    const ok = await confirmer({
      titre: `Garder la date actuelle de ${quoi} ?`,
      message: "La date est confirmée telle quelle et ne sera plus proposée à la vérification.",
      confirmer: "Garder la date",
    });
    if (!ok) return;
    await envoyer({ confirmer: true }, "confirmer", `Date confirmée pour ${ids.length} titre${ids.length > 1 ? "s" : ""}`);
  }

  return (
    <Carte
      className={clsx("animate-monter", decale)}
      corps="px-5 pb-5 pt-3"
      titre={
        <span className="flex items-center gap-2">
          {groupe.album?.title ? <Disc3 size={15} className="text-texte-3" /> : <User size={15} className="text-texte-3" />}
          <span className="truncate">{nom}</span>
          {groupe.album?.title && groupe.artist?.stageName && <span className="truncate text-[13px] font-normal text-texte-3">{groupe.artist.stageName}</span>}
        </span>
      }
      action={
        <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-texte-3 tabular-nums">
          <Headphones size={13} /> {formatNombre(groupe.ecoutes ?? 0)} écoutes
        </span>
      }
    >
      <ul className="divide-y divide-filet border-y border-filet">
        {groupe.titres.map((t) => (
          <li key={t._id} className={clsx("flex items-center gap-3 py-2 transition-opacity", !coches.has(t._id) && "opacity-50")}>
            <input
              type="checkbox"
              checked={coches.has(t._id)}
              onChange={() => basculer(t._id)}
              className="h-4 w-4 shrink-0 accent-[var(--accent)]"
              aria-label={`Inclure ${t.title}`}
            />
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-surface-2">
              {t.coverUrl ? (
                <img src={adresseImage(t.coverUrl) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-texte-3">
                  <Music size={14} />
                </span>
              )}
            </div>
            <BoutonEcoute id={t._id} depart={0.35} taille={28} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{t.title}</div>
              {t.genre && <div className="truncate text-[12px] text-texte-3">{t.genre}</div>}
            </div>
            <div className="w-40 shrink-0 text-[12px] text-texte-2 tabular-nums">
              <div>Sortie {formatDate(t.releaseDate)}</div>
              <div className="text-texte-3">Ajouté {formatDate(t.createdAt)}</div>
            </div>
            <button
              onClick={() => void window.bureau.ouvrirExterne(`${adresseSite()}/son/${t._id}`)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-texte-3 hover:bg-surface-2 hover:text-accent"
              title="Voir sur le site"
            >
              <ExternalLink size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-texte-2">Année de sortie</span>
          <input
            type="number"
            inputMode="numeric"
            min={ANNEE_MIN}
            max={anneeMax}
            value={annee}
            onChange={(e) => setAnnee(e.target.value.slice(0, 4))}
            onKeyDown={(e) => e.key === "Enter" && void appliquer()}
            placeholder={String(anneeMax)}
            className={clsx(
              "h-9 w-28 rounded-lg border bg-surface-2 px-3 text-[13px] text-texte tabular-nums outline-none placeholder:text-texte-3 focus:border-accent",
              annee && !anneeValide ? "border-danger" : "border-filet",
            )}
          />
        </label>
        <Bouton enCours={enCours === "annee"} disabled={!anneeValide || ids.length === 0 || enCours !== null} onClick={() => void appliquer()}>
          <CalendarCheck size={14} /> Appliquer l'année
        </Bouton>
        <Bouton variante="trait" enCours={enCours === "confirmer"} disabled={ids.length === 0 || enCours !== null} onClick={() => void garderDate()}>
          Garder la date actuelle
        </Bouton>
        <span className="ml-auto self-center text-[12px] text-texte-3 tabular-nums">
          {annee && !anneeValide ? `Entre ${ANNEE_MIN} et ${anneeMax}.` : `${ids.length} sur ${groupe.titres.length} titre${groupe.titres.length > 1 ? "s" : ""}`}
        </span>
      </div>
    </Carte>
  );
}
