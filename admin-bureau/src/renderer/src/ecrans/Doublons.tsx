import { useEffect, useState } from "react";
import { AudioLines, Calendar, ChevronLeft, ChevronRight, Clock, Disc3, ExternalLink, Heart, Headphones, Music, RefreshCw, Shield, Split, Type } from "lucide-react";
import { ErreurApi, adresseSite, api } from "../api";
import { BarreCollante, Bouton, Carte, Chargement, EnTete, Erreur, Pastille, Vide, formatDate, formatDuree, formatNombre } from "../composants";
import { annoncer, confirmer } from "../interactions";
import { BoutonEcoute } from "../lecture";
import { adresseImage } from "../session";
import clsx from "../clsx";

interface Titre {
  _id: string;
  title: string;
  coverUrl?: string;
  duration?: number;
  playsCount?: number;
  likesCount?: number;
  status?: "draft" | "scheduled" | "published" | "rejected";
  createdAt?: string;
  releaseDate?: string;
  album?: { title?: string } | null;
  artist?: { stageName?: string } | null;
}

interface Paire {
  _id: string;
  a: Titre | null;
  b: Titre | null;
  similarite?: number;
  raison: "empreinte" | "titre";
}

interface Reponse {
  paires: Paire[];
  suite: boolean;
  page: number;
  compteurs: { aTraiter: number; traitees: number };
}

const STATUTS: Record<NonNullable<Titre["status"]>, { libelle: string; ton: "neutre" | "succes" | "attention" | "danger" }> = {
  published: { libelle: "Publié", ton: "succes" },
  scheduled: { libelle: "Programmé", ton: "attention" },
  draft: { libelle: "En attente", ton: "attention" },
  rejected: { libelle: "Refusé", ton: "danger" },
};

const nomTitre = (t: Titre) => `« ${t.title} »${t.artist?.stageName ? ` de ${t.artist.stageName}` : ""}`;

/**
 * Les doublons possibles : deux titres à la même empreinte audio ou au
 * titre presque identique. On écoute les deux, puis on garde le bon (ses
 * écoutes, likes et entrées de playlists absorbent celles de l'autre) ou
 * on déclare que ce sont deux morceaux différents.
 */
export function Doublons() {
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [videeALaMain, setVideeALaMain] = useState(false);

  const charger = () => {
    setVideeALaMain(false);
    setDonnees(null);
    setErreur(null);
    api<Reponse>(`/api/admin/doublons?page=${page}`)
      .then((r) => setDonnees({ ...r, paires: r.paires ?? [] }))
      .catch((e) => setErreur(e instanceof Error ? e.message : "Chargement impossible."));
  };
  useEffect(charger, [page]);

  // Les paires tranchées sortent de la requête du site : une page vidée à la
  // main se recharge, et la page suivante remonte d'elle-même.
  useEffect(() => {
    if (videeALaMain && donnees && donnees.paires.length === 0 && (donnees.suite || page > 1)) {
      setVideeALaMain(false);
      if (page > 1 && !donnees.suite) setPage((p) => p - 1);
      else charger();
    }
  }, [videeALaMain, donnees]);

  /** Retire la paire de la liste et fait passer le compteur de « à traiter » à « traitées ». */
  function retirer(id: string) {
    setVideeALaMain(true);
    setDonnees((d) =>
      d
        ? {
            ...d,
            paires: d.paires.filter((p) => p._id !== id),
            compteurs: { aTraiter: Math.max(0, d.compteurs.aTraiter - 1), traitees: d.compteurs.traitees + 1 },
          }
        : d,
    );
  }

  async function envoyer(paire: Paire, corps: Record<string, unknown>, cle: string, message: string) {
    setEnCours(`${paire._id}:${cle}`);
    setErreur(null);
    try {
      await api(`/api/admin/doublons`, { methode: "PATCH", corps: { id: paire._id, ...corps } });
      retirer(paire._id);
      annoncer(message);
    } catch (e) {
      // 409 : quelqu'un d'autre (ou un autre poste) a déjà tranché cette paire ;
      // la garder à l'écran inviterait à une décision qui ne compte plus.
      if (e instanceof ErreurApi && e.statut === 409) {
        retirer(paire._id);
        annoncer("Cette paire a déjà été traitée");
      } else setErreur(e instanceof Error ? e.message : "Décision non enregistrée.");
    } finally {
      setEnCours(null);
    }
  }

  async function garder(paire: Paire, garde: Titre, autre: Titre | null) {
    const ok = await confirmer({
      titre: `Garder ${nomTitre(garde)} ?`,
      message: autre ? (
        <>
          {nomTitre(autre)} sera refusé et disparaîtra du site. Ses écoutes, ses likes et ses entrées de playlists sont reportés sur le titre gardé. Cette fusion ne se défait pas.
        </>
      ) : (
        "L'autre titre de la paire n'existe plus ; la paire sera simplement close."
      ),
      confirmer: "Garder et fusionner",
      danger: Boolean(autre),
    });
    if (!ok) return;
    await envoyer(paire, { garder: garde._id }, garde._id, `${garde.title} gardé${autre ? `, ${autre.title} fusionné` : ""}`);
  }

  async function distincts(paire: Paire) {
    const ok = await confirmer({
      titre: "Deux morceaux différents ?",
      message: "Les deux titres restent en ligne tels quels, et cette paire ne sera plus proposée.",
      confirmer: "Ce sont deux morceaux",
    });
    if (!ok) return;
    await envoyer(paire, { distincts: true }, "distincts", "Paire marquée comme deux morceaux différents");
  }

  const compteurs = donnees?.compteurs;
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
        titre="Doublons"
        texte={
          compteurs
            ? `${formatNombre(compteurs.aTraiter)} paire${compteurs.aTraiter > 1 ? "s" : ""} à traiter · ${formatNombre(compteurs.traitees)} traitée${compteurs.traitees > 1 ? "s" : ""}`
            : "Titres probablement envoyés deux fois."
        }
        action={
          <Bouton variante="trait" onClick={charger}>
            <RefreshCw size={14} /> Actualiser
          </Bouton>
        }
      />
      <BarreCollante className="animate-monter decale-1">
        <p className="flex items-center gap-2 text-[12.5px] text-texte-2">
          <Shield size={14} className="text-texte-3" />
          Garder un titre reporte sur lui les écoutes, likes et playlists de l'autre, qui est refusé.
        </p>
        <div className="ml-auto">{pagination}</div>
      </BarreCollante>
      <Erreur message={erreur} />
      {!donnees ? (
        !erreur && <Chargement />
      ) : donnees.paires.length === 0 ? (
        <Vide texte={page > 1 ? "Plus rien sur cette page." : "Aucun doublon à examiner."} />
      ) : (
        <div className="space-y-4">
          {donnees.paires.map((p, i) => (
            <CartePaire
              key={p._id}
              paire={p}
              rang={i}
              enCours={enCours}
              onGarder={(garde, autre) => void garder(p, garde, autre)}
              onDistincts={() => void distincts(p)}
            />
          ))}
        </div>
      )}
      {donnees && (precedent || suivant) && <div className="mt-4 flex justify-end">{pagination}</div>}
    </>
  );
}

function CartePaire({
  paire,
  rang,
  enCours,
  onGarder,
  onDistincts,
}: {
  paire: Paire;
  rang: number;
  enCours: string | null;
  onGarder: (garde: Titre, autre: Titre | null) => void;
  onDistincts: () => void;
}) {
  const empreinte = paire.raison === "empreinte";
  const pourcent = typeof paire.similarite === "number" ? Math.round((paire.similarite <= 1 ? paire.similarite * 100 : paire.similarite)) : null;
  // Au-delà de six, la cascade ferait attendre : les suivantes entrent sans décalage.
  const decale = rang < 6 ? `decale-${rang + 1}` : undefined;
  return (
    <Carte
      className={clsx("animate-monter", decale)}
      corps="px-5 pb-5 pt-4"
      titre={
        <span className="flex items-center gap-2">
          {empreinte ? <AudioLines size={15} className="text-accent" /> : <Type size={15} className="text-texte-3" />}
          {empreinte ? "Même empreinte audio" : "Titre semblable"}
          {pourcent !== null && <Pastille texte={`${pourcent} %`} ton={pourcent >= 90 ? "accent" : "neutre"} />}
        </span>
      }
      action={
        <Bouton variante="trait" enCours={enCours === `${paire._id}:distincts`} onClick={onDistincts}>
          <Split size={14} /> Deux morceaux différents
        </Bouton>
      }
    >
      <p className="mb-4 text-[12px] text-texte-3">
        {empreinte
          ? "Le son des deux fichiers est quasiment identique : très probablement le même enregistrement envoyé deux fois."
          : "Les titres et l'artiste se ressemblent, mais le son n'a pas été comparé : écoutez avant de trancher."}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Cote titre={paire.a} autre={paire.b} enCours={enCours === `${paire._id}:${paire.a?._id}`} onGarder={onGarder} />
        <Cote titre={paire.b} autre={paire.a} enCours={enCours === `${paire._id}:${paire.b?._id}`} onGarder={onGarder} />
      </div>
    </Carte>
  );
}

function Cote({ titre, autre, enCours, onGarder }: { titre: Titre | null; autre: Titre | null; enCours: boolean; onGarder: (garde: Titre, autre: Titre | null) => void }) {
  if (!titre)
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-filet p-6 text-[12.5px] text-texte-3">Ce titre a été supprimé depuis.</div>
    );
  const statut = titre.status ? STATUTS[titre.status] : undefined;
  return (
    <div className="flex flex-col rounded-xl border border-filet p-4">
      <div className="flex gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-2">
          {titre.coverUrl ? (
            <img src={adresseImage(titre.coverUrl) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-texte-3">
              <Music size={24} />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold" title={titre.title}>
                {titre.title}
              </div>
              <div className="truncate text-[12.5px] text-texte-2">{titre.artist?.stageName ?? "Artiste inconnu"}</div>
              <div className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-texte-3">
                <Disc3 size={12} className="shrink-0" />
                <span className="truncate">{titre.album?.title ?? "Single"}</span>
              </div>
            </div>
            <BoutonEcoute id={titre._id} depart={0.35} taille={34} />
          </div>
          {statut && (
            <div className="mt-1.5 -ml-1.5">
              <Pastille texte={statut.libelle} ton={statut.ton} />
            </div>
          )}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-filet pt-3 text-[12px]">
        <Info icone={Clock} libelle="Durée" valeur={typeof titre.duration === "number" ? formatDuree(titre.duration) : "—"} />
        <Info icone={Headphones} libelle="Écoutes" valeur={formatNombre(titre.playsCount)} />
        <Info icone={Heart} libelle="Likes" valeur={formatNombre(titre.likesCount)} />
        <Info icone={Calendar} libelle="Sortie" valeur={formatDate(titre.releaseDate)} />
        <Info icone={Calendar} libelle="Ajouté" valeur={formatDate(titre.createdAt)} />
      </dl>
      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          onClick={() => void window.bureau.ouvrirExterne(`${adresseSite()}/son/${titre._id}`)}
          className="inline-flex items-center gap-1 text-[12px] text-texte-3 hover:text-accent"
        >
          Voir sur le site <ExternalLink size={12} />
        </button>
        <Bouton enCours={enCours} onClick={() => onGarder(titre, autre)}>
          Garder celui-ci
        </Bouton>
      </div>
    </div>
  );
}

function Info({ icone: Icone, libelle, valeur }: { icone: typeof Clock; libelle: string; valeur: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-1.5 text-texte-3">
        <Icone size={12} /> {libelle}
      </dt>
      <dd className="text-texte-2 tabular-nums">{valeur}</dd>
    </div>
  );
}
