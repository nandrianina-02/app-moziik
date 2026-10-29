"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, LogOut, RefreshCw, UserMinus, Users } from "lucide-react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";
import type { Collaborateur } from "@/components/playlist/types";

type Etat = { collaborative: boolean; jeton: string | null; collaborateurs: Collaborateur[] };

/**
 * Propriétaire : active la collaboration, partage le lien d'invitation,
 * retire des collaborateurs. Collaborateur : voit qui participe et peut
 * se retirer.
 */
export function FenetreCollaboration({
  playlistId,
  estProprietaire,
  collaborateurs,
  onChange,
  onQuitte,
  onClose,
}: {
  playlistId: string;
  estProprietaire: boolean;
  collaborateurs: Collaborateur[];
  onChange: (etat: { collaborative: boolean; collaborateurs: Collaborateur[] }) => void;
  onQuitte: () => void;
  onClose: () => void;
}) {
  const pushToast = useToast();
  const [etat, setEtat] = useState<Etat | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    if (!estProprietaire) return;
    fetch(`/api/playlists/${playlistId}/collaboration`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setEtat)
      .catch(() => pushToast("error", "La collaboration n'a pas pu être chargée."));
  }, [playlistId, estProprietaire, pushToast]);

  async function envoyer(methode: "PATCH" | "DELETE", corps: object) {
    setEnCours(true);
    try {
      const r = await fetch(`/api/playlists/${playlistId}/collaboration`, {
        method: methode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      if (!r.ok) throw new Error();
      return r.json();
    } catch {
      pushToast("error", "L'action n'a pas abouti. Réessayez.");
      return null;
    } finally {
      setEnCours(false);
    }
  }

  async function modifier(corps: object, methode: "PATCH" | "DELETE" = "PATCH") {
    const suivant = (await envoyer(methode, corps)) as Etat | null;
    if (!suivant) return;
    setEtat(suivant);
    onChange({ collaborative: suivant.collaborative, collaborateurs: suivant.collaborateurs });
  }

  async function quitter() {
    if (await envoyer("DELETE", {})) {
      pushToast("success", "Vous ne participez plus à cette playlist.");
      onQuitte();
    }
  }

  const lien = etat?.jeton ? `${window.location.origin}/playlist/${playlistId}/rejoindre?jeton=${etat.jeton}` : "";
  const liste = etat?.collaborateurs ?? collaborateurs;

  return (
    <ModalSheet
      titre="Playlist collaborative"
      sousTitre="Les collaborateurs ajoutent, retirent et réordonnent les titres. Le titre, la pochette et la visibilité restent les vôtres."
      onClose={onClose}
    >
      {estProprietaire && !etat ? (
        <Loader2 size={18} className="animate-spin text-ink-muted" />
      ) : (
        <div className="space-y-5">
          {estProprietaire && etat && (
            <>
              <button
                role="switch"
                aria-checked={etat.collaborative}
                disabled={enCours}
                onClick={() => modifier({ collaborative: !etat.collaborative })}
                className="flex w-full items-center justify-between gap-4 text-left"
              >
                <span>
                  <span className="block text-sm font-semibold">Collaboration</span>
                  <span className="block text-xs text-ink-muted">
                    {etat.collaborative ? "Activée : les collaborateurs peuvent modifier les titres." : "Suspendue : personne d'autre que vous ne modifie la playlist."}
                  </span>
                </span>
                <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${etat.collaborative ? "bg-accent" : "bg-ink/20"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${etat.collaborative ? "left-[22px]" : "left-0.5"}`} />
                </span>
              </button>

              {etat.collaborative && lien && (
                <div className="border-t border-border pt-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                    <Link2 size={13} /> Lien d&apos;invitation
                  </p>
                  <div className="flex gap-2">
                    <input readOnly value={lien} aria-label="Lien d'invitation" onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-full bg-ink/[0.08] px-4 py-2 text-xs outline-none" />
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(lien).catch(() => {});
                        setCopie(true);
                        window.setTimeout(() => setCopie(false), 1800);
                      }}
                      className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-xs font-semibold text-base"
                    >
                      {copie ? <Check size={13} /> : <Copy size={13} />}
                      {copie ? "Copié" : "Copier"}
                    </button>
                  </div>
                  <button
                    onClick={() => modifier({ renouvelerLien: true })}
                    disabled={enCours}
                    className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
                  >
                    <RefreshCw size={12} /> Renouveler le lien (l&apos;ancien ne fonctionnera plus)
                  </button>
                </div>
              )}
            </>
          )}

          <div className={estProprietaire ? "border-t border-border pt-4" : ""}>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
              <Users size={13} /> Collaborateurs
            </p>
            {liste.length === 0 ? (
              <p className="text-sm text-ink-muted">Personne pour l&apos;instant. Partagez le lien d&apos;invitation.</p>
            ) : (
              <ul className="space-y-1">
                {liste.map((c) => (
                  <li key={c._id} className="flex items-center gap-3 py-1">
                    <SafeImage src={c.avatarUrl} alt={c.name} width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                    {estProprietaire && (
                      <button
                        onClick={() => modifier({ userId: c._id }, "DELETE")}
                        disabled={enCours}
                        aria-label={`Retirer ${c.name}`}
                        title="Retirer"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-ink/[0.08] hover:text-danger"
                      >
                        <UserMinus size={15} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!estProprietaire && (
            <button onClick={quitter} disabled={enCours} className="flex items-center gap-2 rounded-full bg-ink/[0.08] px-4 py-2 text-sm font-medium hover:bg-ink/[0.14]">
              <LogOut size={15} /> Ne plus participer
            </button>
          )}
        </div>
      )}
    </ModalSheet>
  );
}
