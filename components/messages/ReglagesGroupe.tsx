"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, LogOut, Search, Shield, ShieldOff, UserMinus, UserPlus, BellOff, Bell } from "lucide-react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AvatarMembre } from "@/components/messages/AvatarMembre";
import { readApiError } from "@/lib/readApiError";
import {
  libellePresence,
  TITRE_GROUPE_MAX,
  type ConversationAffichee,
  type ParticipantAffiche,
} from "@/lib/messagerie";

type Personne = { _id: string; name: string; username?: string; avatarUrl?: string; vuLe?: string | null };

/**
 * Les réglages d'une conversation.
 *
 * CE QUI EST OFFERT DÉPEND DE CE QUI EST PERMIS
 *
 * Un membre ordinaire voit les participants et sa propre sourdine, rien
 * de plus. Afficher des boutons grisés « renommer » et « exclure » à qui
 * n'y a pas droit informe surtout de ce qu'on ne peut pas faire ; la
 * route refuserait de toute façon, et le refus serait alors une surprise
 * plutôt qu'une règle.
 *
 * Une conversation à deux n'a ni nom, ni membres à gérer, ni sortie : le
 * panneau s'y réduit à la fiche de l'autre et à la sourdine.
 */
export function ReglagesGroupe({
  conversation,
  moiId,
  onMaj,
  onQuitte,
  onClose,
}: {
  conversation: ConversationAffichee;
  moiId: string;
  onMaj: (c: ConversationAffichee) => void;
  onQuitte: () => void;
  onClose: () => void;
}) {
  const estGroupe = conversation.type === "group";
  const [titre, setTitre] = useState(conversation.titre);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [confirmation, setConfirmation] = useState<null | "quitter" | { exclure: ParticipantAffiche }>(null);

  async function envoyer(corps: Record<string, unknown>) {
    setOccupe(true);
    setErreur(null);
    try {
      const res = await fetch(`/api/messagerie/conversations/${conversation._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Modification impossible."));
      const { conversation: frais } = (await res.json()) as { conversation: ConversationAffichee };
      onMaj(frais);
      return true;
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Modification impossible.");
      return false;
    } finally {
      setOccupe(false);
    }
  }

  async function quitter() {
    setOccupe(true);
    try {
      const res = await fetch(`/api/messagerie/conversations/${conversation._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readApiError(res, "Impossible de quitter le groupe."));
      onQuitte();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Impossible de quitter le groupe.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <ModalSheet
      titre={estGroupe ? "Réglages du groupe" : conversation.titre}
      sousTitre={
        estGroupe
          ? `${conversation.participants.length} participant${conversation.participants.length > 1 ? "s" : ""}`
          : libellePresence(conversation.interlocuteur?.vuLe)
      }
      onClose={onClose}
    >
      <div className="space-y-6">
        {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}

        {estGroupe && conversation.gestionnaire && (
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Nom du groupe
            </h3>
            <div className="flex gap-2">
              <input
                value={titre}
                onChange={(e) => setTitre(e.target.value.slice(0, TITRE_GROUPE_MAX))}
                className="flex-1 rounded-xl border border-border bg-base px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
              />
              <button
                type="button"
                onClick={() => envoyer({ titre: titre.trim() })}
                disabled={occupe || !titre.trim() || titre.trim() === conversation.titre}
                className="rounded-xl bg-accent px-4 text-sm font-semibold text-base transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                Renommer
              </button>
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Notifications
          </h3>
          <button
            type="button"
            onClick={() => envoyer({ silencieux: !conversation.silencieux })}
            disabled={occupe}
            className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left text-sm transition-colors hover:bg-base disabled:opacity-60"
          >
            {conversation.silencieux ? (
              <BellOff size={16} className="shrink-0 text-ink-muted" />
            ) : (
              <Bell size={16} className="shrink-0 text-accent" />
            )}
            <span className="flex-1">
              {conversation.silencieux ? "Conversation en sourdine" : "Notifications activées"}
              <span className="block text-xs text-ink-muted">
                {conversation.silencieux
                  ? "Les messages arrivent toujours, sans notification."
                  : "Vous êtes prévenu de chaque nouveau message."}
              </span>
            </span>
          </button>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              {estGroupe ? "Participants" : "Interlocuteur"}
            </h3>
            {estGroupe && conversation.gestionnaire && (
              <button
                type="button"
                onClick={() => setAjoutOuvert(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:underline"
              >
                <UserPlus size={13} /> Ajouter
              </button>
            )}
          </div>

          <ul className="space-y-1">
            {conversation.participants.map((p) => (
              <li key={p._id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-base">
                <AvatarMembre nom={p.name} avatarUrl={p.avatarUrl} vuLe={p.vuLe} taille={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {p.name}
                    {p._id === moiId && <span className="text-ink-muted"> (vous)</span>}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {p.gestionnaire && estGroupe ? "Gestionnaire · " : ""}
                    {libellePresence(p.vuLe)}
                  </p>
                </div>

                {estGroupe && conversation.gestionnaire && p._id !== moiId && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => envoyer({ gestionnaire: { user: p._id, actif: !p.gestionnaire } })}
                      disabled={occupe}
                      className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface hover:text-accent disabled:opacity-50"
                      title={p.gestionnaire ? "Retirer la gestion" : "Nommer gestionnaire"}
                      aria-label={p.gestionnaire ? "Retirer la gestion" : "Nommer gestionnaire"}
                    >
                      {p.gestionnaire ? <ShieldOff size={15} /> : <Shield size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmation({ exclure: p })}
                      disabled={occupe}
                      className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface hover:text-danger disabled:opacity-50"
                      title="Exclure du groupe"
                      aria-label={`Exclure ${p.name}`}
                    >
                      <UserMinus size={15} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {estGroupe && (
          <section className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setConfirmation("quitter")}
              disabled={occupe}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/40 px-3 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
            >
              {occupe ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
              Quitter le groupe
            </button>
            <p className="mt-2 text-center text-xs text-ink-muted">
              La conversation reste visible pour les autres participants.
            </p>
          </section>
        )}
      </div>

      {ajoutOuvert && (
        <AjoutMembres
          exclus={conversation.participants.map((p) => p._id)}
          onValider={async (ids) => {
            const ok = await envoyer({ ajouter: ids });
            if (ok) setAjoutOuvert(false);
          }}
          onClose={() => setAjoutOuvert(false)}
        />
      )}

      {confirmation === "quitter" && (
        <ConfirmDialog
          title="Quitter le groupe ?"
          description="Vous ne recevrez plus ses messages. Un gestionnaire pourra vous y réinviter."
          confirmLabel="Quitter"
          onConfirm={() => {
            setConfirmation(null);
            void quitter();
          }}
          onCancel={() => setConfirmation(null)}
        />
      )}

      {confirmation && typeof confirmation === "object" && (
        <ConfirmDialog
          title={`Exclure ${confirmation.exclure.name} ?`}
          description="Cette personne ne verra plus les nouveaux messages. Son historique reste visible pour le groupe."
          confirmLabel="Exclure"
          onConfirm={() => {
            const cible = confirmation.exclure._id;
            setConfirmation(null);
            void envoyer({ exclure: cible });
          }}
          onCancel={() => setConfirmation(null)}
        />
      )}
    </ModalSheet>
  );
}

/** Sélection de membres à ajouter — même source que « Nouvelle conversation ». */
function AjoutMembres({
  exclus,
  onValider,
  onClose,
}: {
  exclus: string[];
  onValider: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [personnes, setPersonnes] = useState<Personne[]>([]);
  const [choisis, setChoisis] = useState<string[]>([]);
  const [chargement, setChargement] = useState(true);
  const tour = useRef(0);

  useEffect(() => {
    const mien = ++tour.current;
    const minuteur = setTimeout(async () => {
      setChargement(true);
      try {
        const res = await fetch(`/api/messagerie/destinataires?q=${encodeURIComponent(q.trim())}`);
        const data = (await res.json()) as { personnes: Personne[] };
        if (tour.current === mien) {
          setPersonnes(data.personnes.filter((p) => !exclus.includes(p._id)));
        }
      } finally {
        if (tour.current === mien) setChargement(false);
      }
    }, q ? 300 : 0);
    return () => clearTimeout(minuteur);
  }, [q, exclus]);

  return (
    <ModalSheet
      titre="Ajouter au groupe"
      onClose={onClose}
      entete={
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
      }
      pied={
        <button
          type="button"
          onClick={() => onValider(choisis)}
          disabled={choisis.length === 0}
          className="w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          Ajouter {choisis.length > 0 ? `(${choisis.length})` : ""}
        </button>
      }
    >
      {chargement ? (
        <div className="flex justify-center py-10 text-ink-muted">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : personnes.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Personne à ajouter.</p>
      ) : (
        <ul className="space-y-1">
          {personnes.map((p) => {
            const coche = choisis.includes(p._id);
            return (
              <li key={p._id}>
                <button
                  type="button"
                  onClick={() =>
                    setChoisis((prev) => (coche ? prev.filter((x) => x !== p._id) : [...prev, p._id]))
                  }
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
                    coche ? "bg-accent/10" : "hover:bg-base"
                  }`}
                >
                  <AvatarMembre nom={p.name} avatarUrl={p.avatarUrl} vuLe={p.vuLe} taille={38} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                  <span
                    aria-hidden
                    className={`h-4 w-4 shrink-0 rounded-md border-2 ${
                      coche ? "border-accent bg-accent" : "border-border"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </ModalSheet>
  );
}
