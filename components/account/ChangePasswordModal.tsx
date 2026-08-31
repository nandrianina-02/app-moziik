"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { useToast } from "@/context/ToastProvider";

/**
 * Changement — ou première définition — du mot de passe.
 *
 * Un compte lié à Google n'en a pas : on ne lui demande alors rien
 * d'autre que le nouveau. Le serveur applique la même règle, c'est lui qui
 * décide (voir /api/me/password) ; cet écran ne fait que ne pas réclamer
 * une information qui n'existe pas.
 */
export function ChangePasswordModal({
  aDejaUnMotDePasse,
  onClose,
  onDone,
}: {
  aDejaUnMotDePasse: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const pushToast = useToast();
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);

  const discordance = confirmation.length > 0 && nouveau !== confirmation;

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (discordance) return;
    setEnCours(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(aDejaUnMotDePasse ? { currentPassword: actuel } : {}),
          newPassword: nouveau,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error);
      pushToast("success", aDejaUnMotDePasse ? "Mot de passe modifié." : "Mot de passe défini.");
      onDone();
    } catch (err) {
      pushToast("error", err instanceof Error && err.message ? err.message : "La modification a échoué.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <ModalSheet
      titre={aDejaUnMotDePasse ? "Modifier le mot de passe" : "Définir un mot de passe"}
      sousTitre={
        aDejaUnMotDePasse
          ? "Huit caractères minimum. Les liens de réinitialisation en cours seront annulés."
          : "Il s'ajoute à la connexion Google, sans la remplacer."
      }
      largeur="sm:max-w-md"
      onClose={onClose}
    >
      <form onSubmit={envoyer} className="space-y-4">
        {aDejaUnMotDePasse && (
          <FormField
            label="Mot de passe actuel"
            type="password"
            value={actuel}
            required
            autoComplete="current-password"
            onChange={(e) => setActuel(e.target.value)}
          />
        )}
        <FormField
          label="Nouveau mot de passe"
          type="password"
          value={nouveau}
          required
          minLength={8}
          autoComplete="new-password"
          onChange={(e) => setNouveau(e.target.value)}
        />
        <div>
          <FormField
            label="Confirmer le nouveau mot de passe"
            type="password"
            value={confirmation}
            required
            minLength={8}
            autoComplete="new-password"
            onChange={(e) => setConfirmation(e.target.value)}
          />
          {discordance && <p className="mt-1 text-xs text-danger">Les deux saisies ne correspondent pas.</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={enCours || discordance}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {enCours ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Valider
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
          >
            Annuler
          </button>
        </div>
      </form>
    </ModalSheet>
  );
}
