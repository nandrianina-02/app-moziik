import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { adresseSite, api } from "../api";
import { Bouton, Chargement, EnTete, Erreur, Pastille, Table, Vide, formatDate } from "../composants";

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
      <div className="mb-4 flex gap-1 border-b border-filet">
        {(["commentaires", "evenements"] as const).map((o) => (
          <button
            key={o}
            onClick={() => setOnglet(o)}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] ${onglet === o ? "border-accent font-medium text-texte" : "border-transparent text-texte-2 hover:text-texte"}`}
          >
            {o === "commentaires" ? "Commentaires signalés" : "Évènements à valider"}
          </button>
        ))}
      </div>
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
        setListe(r.comments);
        setCompteurs({ enAttente: r.enAttente, totalSignales: r.totalSignales });
      })
      .catch((e) => setErreur(e.message));
  };
  useEffect(charger, [tous]);

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
          {liste.map((c) => (
            <tr key={c._id} className="align-top">
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
      .then((r) => setListe(r.events))
      .catch((e) => setErreur(e.message));
  };
  useEffect(charger, []);

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
          {liste.map((e) => (
            <tr key={e._id}>
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
    </>
  );
}
