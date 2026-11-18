import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, RefreshCw, Trash2, X } from "lucide-react";
import { adresseSite, api } from "../api";
import { Bouton, Chargement, EnTete, Erreur, Pagination, Pastille, Table, Vide, formatDate, usePages , BarreCollante } from "../composants";
import { BarreSelection, annoncer, classeChoisi, copier, ouvrirMenu, useSelection } from "../interactions";
import clsx from "../clsx";

interface Commentaire {
  _id: string;
  text: string;
  createdAt: string;
  flagged?: boolean;
  sentiment?: string;
  user?: { _id: string; name?: string } | null;
  song?: { _id: string; title?: string } | null;
}

interface Evenement {
  _id: string;
  title: string;
  status: string;
  startDate?: string;
  date?: string;
  city?: string;
  location?: string;
  organizer?: { name?: string } | string | null;
  artist?: { stageName?: string } | null;
}

/**
 * La modération : les commentaires signalés par l'analyse automatique du
 * site, et les évènements proposés par les artistes. Chaque décision passe
 * par les mêmes routes que l'administration du site.
 */
export function Moderation() {
  const [onglet, setOnglet] = useState<"commentaires" | "evenements">("commentaires");
  return (
    <>
      <EnTete titre="Modération" />
      <BarreCollante className="animate-monter decale-1">
<div className="animate-monter decale-1 mb-5 flex w-fit rounded-lg border border-filet bg-surface p-0.5">
        {(["commentaires", "evenements"] as const).map((o) => (
          <button
            key={o}
            onClick={() => setOnglet(o)}
            className={`rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${onglet === o ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte"}`}
          >
            {o === "commentaires" ? "Commentaires signalés" : "Évènements à valider"}
          </button>
        ))}
      </div>
      </BarreCollante>
      {onglet === "commentaires" ? <Commentaires /> : <Evenements />}
    </>
  );
}

function Commentaires() {
  const [liste, setListe] = useState<Commentaire[] | null>(null);
  const [compteurs, setCompteurs] = useState<{ enAttente: number; totalSignales: number } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tous, setTous] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = () => {
    setListe(null);
    api<{ comments: Commentaire[]; enAttente: number; totalSignales: number }>(`/api/admin/comments${tous ? "" : "?flagged=1"}`)
      .then((r) => {
        setListe(r.comments ?? []);
        setCompteurs({ enAttente: r.enAttente, totalSignales: r.totalSignales });
      })
      .catch((e) => setErreur(e.message));
  };
  useEffect(charger, [tous]);
  const pages = usePages(liste, 20, String(tous));
  const sel = useSelection(pages.tranche.map((c) => c._id));

  /** Suppression de plusieurs commentaires : définitive, donc confirmée. */
  async function supprimerLot(ids: string[]) {
    if (ids.length > 1 && !window.confirm(`Supprimer définitivement ces ${ids.length} commentaires ?`)) return;
    for (const id of ids) await supprimer(id);
    sel.vider();
    annoncer(`${ids.length} commentaire${ids.length > 1 ? "s" : ""} supprimé${ids.length > 1 ? "s" : ""}`);
  }

  function menuCommentaire(e: React.MouseEvent, rang: number) {
    const ids = sel.surMenu(rang);
    const cibles = (liste ?? []).filter((c) => ids.includes(c._id));
    if (cibles.length === 0) return;
    const c = cibles[0];
    ouvrirMenu(
      e,
      cibles.length === 1
        ? [
            c.song?._id && { libelle: "Ouvrir le titre sur le site", icone: ExternalLink, action: () => void window.bureau.ouvrirExterne(`${adresseSite()}/son/${c.song!._id}`) },
            { libelle: "Copier le texte", icone: Copy, action: () => void copier(c.text).then(() => annoncer("Texte copié")) },
            "separateur",
            { libelle: "Supprimer", icone: Trash2, danger: true, action: () => void supprimerLot([c._id]) },
          ]
        : [
            { libelle: `Copier les ${cibles.length} textes`, icone: Copy, action: () => void copier(cibles.map((x) => x.text).join("\n\n")).then(() => annoncer("Textes copiés")) },
            "separateur",
            { libelle: `Supprimer (${cibles.length})`, icone: Trash2, danger: true, action: () => void supprimerLot(ids) },
          ],
      cibles.length === 1 ? c.user?.name ?? "Commentaire" : `${cibles.length} commentaires sélectionnés`,
    );
  }

  async function supprimer(id: string) {
    setEnCours(id);
    try {
      await api(`/api/comments/${id}`, { methode: "DELETE" });
      setListe((l) => (l ?? []).filter((c) => c._id !== id));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between text-[13px] text-texte-2">
        <span>
          {compteurs ? `${compteurs.totalSignales} signalé${compteurs.totalSignales > 1 ? "s" : ""} · ${compteurs.enAttente} en attente d'analyse` : ""}
        </span>
        <div className="flex gap-2">
          <Bouton variante="discret" onClick={() => setTous((v) => !v)}>
            {tous ? "Seulement les signalés" : "Voir tous les commentaires"}
          </Bouton>
          <Bouton variante="trait" onClick={charger}>
            <RefreshCw size={14} /> Actualiser
          </Bouton>
        </div>
      </div>
      <Erreur message={erreur} />
      {!liste ? (
        <Chargement />
      ) : liste.length === 0 ? (
        <Vide texte={tous ? "Aucun commentaire." : "Aucun commentaire signalé."} />
      ) : (
        <Table entetes={["Commentaire", { libelle: "Auteur", largeur: "160px" }, { libelle: "Titre", largeur: "200px" }, { libelle: "Date", largeur: "110px" }, { libelle: "", largeur: "110px" }]}>
          {pages.tranche.map((c, rang) => (
            <tr
              key={c._id}
              data-rang={rang}
              onClick={(ev) => sel.surClic(ev, rang)}
              onContextMenu={(ev) => menuCommentaire(ev, rang)}
              className={clsx("align-top", classeChoisi(sel.estChoisi(c._id), "ligne"))}
            >
              <td className="px-3 py-2" data-selectionnable>
                {c.flagged && <Pastille texte="signalé" ton="danger" />} <span className="whitespace-pre-line">{c.text}</span>
              </td>
              <td className="px-3 py-2 text-texte-2">{c.user?.name ?? "—"}</td>
              <td className="px-3 py-2 text-texte-2">
                {c.song?.title ?? "—"}
                {c.song?._id && (
                  <button onClick={() => void window.bureau.ouvrirExterne(`${adresseSite()}/son/${c.song!._id}`)} className="ml-1 align-middle text-texte-3 hover:text-accent">
                    <ExternalLink size={12} />
                  </button>
                )}
              </td>
              <td className="px-3 py-2 text-texte-2 tabular-nums">{formatDate(c.createdAt)}</td>
              <td className="px-3 py-2 text-right">
                <Bouton variante="danger" enCours={enCours === c._id} onClick={() => void supprimer(c._id)}>
                  Supprimer
                </Bouton>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {liste && <Pagination className="mt-4" page={pages.page} pages={pages.pages} total={pages.total} taille={pages.taille} onPage={pages.setPage} />}
      <BarreSelection nombre={sel.nombre} libelle={(n) => `${n} commentaires sélectionnés`} onVider={sel.vider}>
        <Bouton variante="danger" className="h-9" onClick={() => void supprimerLot([...sel.choisis])}>
          <Trash2 size={14} /> Supprimer
        </Bouton>
      </BarreSelection>
    </>
  );
}

function Evenements() {
  const [liste, setListe] = useState<Evenement[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = () => {
    setListe(null);
    api<{ events: Evenement[] }>("/api/admin/events?status=pending&limit=100")
      .then((r) => setListe(r.events ?? []))
      .catch((e) => setErreur(e.message));
  };
  useEffect(charger, []);
  const pages = usePages(liste, 20);
  const sel = useSelection(pages.tranche.map((e) => e._id));

  /** Publier ou refuser plusieurs évènements ; confirmation au-delà d'un seul. */
  async function deciderLot(ids: string[], decision: "approve" | "reject") {
    if (ids.length > 1 && !window.confirm(`${decision === "approve" ? "Publier" : "Refuser"} ces ${ids.length} évènements ?`)) return;
    for (const id of ids) await decider(id, decision);
    sel.vider();
    annoncer(`${ids.length} évènement${ids.length > 1 ? "s" : ""} ${decision === "approve" ? "publié" : "refusé"}${ids.length > 1 ? "s" : ""}`);
  }

  function menuEvenement(ev: React.MouseEvent, rang: number) {
    const ids = sel.surMenu(rang);
    const cibles = (liste ?? []).filter((x) => ids.includes(x._id));
    if (cibles.length === 0) return;
    ouvrirMenu(
      ev,
      [
        cibles.length === 1 && { libelle: "Voir sur le site", icone: ExternalLink, action: () => void window.bureau.ouvrirExterne(`${adresseSite()}/evenements/${cibles[0]._id}`) },
        "separateur",
        { libelle: cibles.length > 1 ? `Publier (${cibles.length})` : "Publier", icone: Check, action: () => void deciderLot(ids, "approve") },
        { libelle: cibles.length > 1 ? `Refuser (${cibles.length})` : "Refuser", icone: X, danger: true, action: () => void deciderLot(ids, "reject") },
      ],
      cibles.length === 1 ? cibles[0].title : `${cibles.length} évènements sélectionnés`,
    );
  }

  async function decider(id: string, decision: "approve" | "reject") {
    setEnCours(`${id}:${decision}`);
    try {
      await api(`/api/admin/events/${id}/moderate`, { corps: { decision } });
      setListe((l) => (l ?? []).filter((e) => e._id !== id));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Décision non enregistrée.");
    } finally {
      setEnCours(null);
    }
  }

  const organisateur = (e: Evenement) => (typeof e.organizer === "string" ? e.organizer : e.organizer?.name) ?? e.artist?.stageName ?? "—";

  return (
    <>
      <Erreur message={erreur} />
      {!liste ? (
        <Chargement />
      ) : liste.length === 0 ? (
        <Vide texte="Aucun évènement en attente." />
      ) : (
        <Table entetes={["Évènement", { libelle: "Organisateur", largeur: "180px" }, { libelle: "Date", largeur: "110px" }, { libelle: "Lieu", largeur: "160px" }, { libelle: "", largeur: "190px" }]}>
          {pages.tranche.map((e, rang) => (
            <tr
              key={e._id}
              data-rang={rang}
              onClick={(ev) => sel.surClic(ev, rang)}
              onContextMenu={(ev) => menuEvenement(ev, rang)}
              className={classeChoisi(sel.estChoisi(e._id), "ligne")}
            >
              <td className="px-3 py-2 font-medium">
                {e.title}
                <button onClick={() => void window.bureau.ouvrirExterne(`${adresseSite()}/evenements/${e._id}`)} className="ml-1 align-middle text-texte-3 hover:text-accent">
                  <ExternalLink size={12} />
                </button>
              </td>
              <td className="px-3 py-2 text-texte-2">{organisateur(e)}</td>
              <td className="px-3 py-2 text-texte-2 tabular-nums">{formatDate(e.startDate ?? e.date)}</td>
              <td className="px-3 py-2 text-texte-2">{e.city ?? e.location ?? "—"}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-2">
                  <Bouton variante="trait" enCours={enCours === `${e._id}:approve`} onClick={() => void decider(e._id, "approve")}>
                    Publier
                  </Bouton>
                  <Bouton variante="danger" enCours={enCours === `${e._id}:reject`} onClick={() => void decider(e._id, "reject")}>
                    Refuser
                  </Bouton>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {liste && <Pagination className="mt-4" page={pages.page} pages={pages.pages} total={pages.total} taille={pages.taille} onPage={pages.setPage} />}
      <BarreSelection nombre={sel.nombre} libelle={(n) => `${n} évènements sélectionnés`} onVider={sel.vider}>
        <Bouton className="h-9" onClick={() => void deciderLot([...sel.choisis], "approve")}>
          <Check size={14} /> Publier
        </Bouton>
        <Bouton variante="danger" className="h-9" onClick={() => void deciderLot([...sel.choisis], "reject")}>
          <X size={14} /> Refuser
        </Bouton>
      </BarreSelection>
    </>
  );
}
