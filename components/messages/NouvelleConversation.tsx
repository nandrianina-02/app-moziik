"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, Users, UserRound, X } from "lucide-react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { AvatarMembre } from "@/components/messages/AvatarMembre";
import { readApiError } from "@/lib/readApiError";
import { libellePresence, MEMBRES_MAX, TITRE_GROUPE_MAX, type ConversationAffichee } from "@/lib/messagerie";

type Personne = {
  _id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  vuLe?: string | null;
};

/**
 * Ouvrir une conversation, à deux ou en groupe.
 *
 * UN SEUL ÉCRAN POUR LES DEUX
 *
 * On ne sait pas toujours, en cliquant « nouveau message », si l'on va
 * écrire à une personne ou à trois. Deux boutons d'entrée obligeraient à
 * décider avant de chercher, et à recommencer quand on change d'avis.
 * Ici, cocher une deuxième personne fait apparaître le champ du nom de
 * groupe : la forme suit ce qu'on fait, elle ne le précède pas.
 */
export function NouvelleConversation({
  onCree,
  onClose,
}: {
  onCree: (conversation: ConversationAffichee) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [personnes, setPersonnes] = useState<Personne[]>([]);
  const [recents, setRecents] = useState(true);
  const [choisis, setChoisis] = useState<Personne[]>([]);
  const [titre, setTitre] = useState("");
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const tour = useRef(0);

  useEffect(() => {
    const mien = ++tour.current;
    const minuteur = setTimeout(async () => {
      setChargement(true);
      try {
        const res = await fetch(`/api/messagerie/destinataires?q=${encodeURIComponent(q.trim())}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { personnes: Personne[]; recents: boolean };
        if (tour.current === mien) {
          setPersonnes(data.personnes);
          setRecents(data.recents);
        }
      } catch {
        if (tour.current === mien) setErreur("Impossible de charger les membres.");
      } finally {
        if (tour.current === mien) setChargement(false);
      }
    }, q ? 300 : 0);
    return () => clearTimeout(minuteur);
  }, [q]);

  const groupe = choisis.length > 1;

  function basculer(p: Personne) {
    setChoisis((prev) =>
      prev.some((x) => x._id === p._id) ? prev.filter((x) => x._id !== p._id) : [...prev, p]
    );
  }

  async function creer() {
    if (choisis.length === 0) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const corps = groupe
        ? { type: "group", membres: choisis.map((p) => p._id), titre: titre.trim() }
        : { type: "direct", destinataire: choisis[0]._id };

      const res = await fetch("/api/messagerie/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      if (!res.ok) throw new Error(await readApiError(res, "La conversation n'a pas pu être créée."));
      const { conversation } = (await res.json()) as { conversation: ConversationAffichee };
      onCree(conversation);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "La conversation n'a pas pu être créée.");
    } finally {
      setEnvoi(false);
    }
  }

  const nomManquant = groupe && !titre.trim();

  return (
    <ModalSheet
      titre="Nouvelle conversation"
      sousTitre={
        groupe
          ? `${choisis.length} personnes — donnez un nom à ce groupe.`
          : "Choisissez une personne, ou plusieurs pour créer un groupe."
      }
      onClose={onClose}
      entete={
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom ou identifiant…"
              autoFocus
              className="w-full rounded-full border border-border bg-base py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-accent"
            />
          </div>

          {choisis.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {choisis.map((p) => (
                <li key={p._id}>
                  <button
                    type="button"
                    onClick={() => basculer(p)}
                    className="flex items-center gap-1.5 rounded-full bg-accent/15 py-1 pl-1 pr-2 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
                  >
                    <AvatarMembre nom={p.name} avatarUrl={p.avatarUrl} taille={20} presence={false} />
                    {p.name}
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {groupe && (
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value.slice(0, TITRE_GROUPE_MAX))}
              placeholder="Nom du groupe"
              className="w-full rounded-xl border border-border bg-base px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
            />
          )}
        </div>
      }
      pied={
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-xs text-ink-muted">
            {erreur ? <span className="text-danger">{erreur}</span> : `Jusqu'à ${MEMBRES_MAX} personnes.`}
          </p>
          <button
            type="button"
            onClick={creer}
            disabled={choisis.length === 0 || nomManquant || envoi}
            className="flex shrink-0 items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {envoi ? <Loader2 size={15} className="animate-spin" /> : groupe ? <Users size={15} /> : <UserRound size={15} />}
            {groupe ? "Créer le groupe" : "Écrire"}
          </button>
        </div>
      }
    >
      {chargement && personnes.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-ink-muted">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : personnes.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink-muted">
          {q ? `Aucun membre ne correspond à « ${q} ».` : "Aucune conversation récente."}
        </p>
      ) : (
        <>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {recents ? "Conversations récentes" : "Résultats"}
          </h3>
          <ul className="space-y-1">
            {personnes.map((p) => {
              const coche = choisis.some((x) => x._id === p._id);
              return (
                <li key={p._id}>
                  <button
                    type="button"
                    onClick={() => basculer(p)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
                      coche ? "bg-accent/10" : "hover:bg-base"
                    }`}
                  >
                    <AvatarMembre nom={p.name} avatarUrl={p.avatarUrl} vuLe={p.vuLe} taille={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {p.username ? `@${p.username} · ` : ""}
                        {libellePresence(p.vuLe)}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={`h-4 w-4 shrink-0 rounded-md border-2 transition-colors ${
                        coche ? "border-accent bg-accent" : "border-border"
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </ModalSheet>
  );
}
