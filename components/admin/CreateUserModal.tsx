"use client";

import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { useToast } from "@/context/ToastProvider";

/**
 * Création d'un compte par l'administration.
 *
 * Le mot de passe provisoire n'est montré qu'une fois, à l'écran qui vient
 * de le créer : le serveur ne conserve qu'un haché, personne — pas même
 * l'administration — ne pourra le relire ensuite. D'où l'étape de
 * confirmation plutôt qu'une fermeture immédiate.
 */
export function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const pushToast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "artist" | "admin">("member");
  const [password, setPassword] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<{ email: string; motDePasse: string } | null>(null);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          role,
          // Laissé vide, le serveur en tire un : inutile d'imposer un choix
          // à quelqu'un qui va le transmettre tel quel.
          ...(password.trim() ? { password: password.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error);
      setResultat({ email: data.user.email, motDePasse: data.temporaryPassword });
    } catch (err) {
      pushToast("error", err instanceof Error && err.message ? err.message : "La création a échoué.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <ModalSheet
      titre={resultat ? "Compte créé" : "Ajouter un utilisateur"}
      sousTitre={
        resultat
          ? "Transmettez ces identifiants à la personne concernée."
          : "Le compte est créé avec son adresse déjà confirmée."
      }
      largeur="sm:max-w-md"
      onClose={resultat ? onCreated : onClose}
    >
      {resultat ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-base p-4">
            <p className="text-xs text-ink-muted">Identifiant</p>
            <p className="mt-0.5 break-all text-sm font-medium text-ink">{resultat.email}</p>
            <p className="mt-3 text-xs text-ink-muted">Mot de passe provisoire</p>
            <div className="mt-0.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all font-mono text-sm text-ink">{resultat.motDePasse}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(resultat.motDePasse)
                    .then(() => pushToast("success", "Mot de passe copié."))
                    .catch(() => pushToast("error", "Copie impossible."));
                }}
                aria-label="Copier le mot de passe"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            Il ne sera plus affiché : le serveur n&apos;en garde qu&apos;une empreinte. En cas d&apos;oubli,
            la personne passera par « mot de passe oublié ».
          </p>
          <button
            type="button"
            onClick={onCreated}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover"
          >
            Terminé
          </button>
        </div>
      ) : (
        <form onSubmit={creer} className="space-y-4">
          <FormField
            label="Nom"
            value={name}
            required
            minLength={2}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <FormField
            label="Email"
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-muted">Rôle</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
            >
              <option value="member">Membre</option>
              <option value="artist">Artiste</option>
              <option value="admin">Admin</option>
            </select>
            {role === "artist" && (
              <span className="mt-1 block text-xs text-ink-muted">
                Un profil artiste sera créé avec ce nom comme nom de scène.
              </span>
            )}
          </label>
          <FormField
            label="Mot de passe provisoire (laisser vide pour en générer un)"
            type="text"
            value={password}
            minLength={8}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={enCours}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {enCours ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Créer le compte
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
      )}
    </ModalSheet>
  );
}
