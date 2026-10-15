"use client";

import { useState } from "react";
import { BadgeCheck, Copy, Loader2, Mail, UserPlus } from "lucide-react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { FormField } from "@/components/ui/FormField";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";

export type ArtisteCree = { _id: string; stageName: string };

/**
 * Créer un artiste sans quitter le formulaire de publication.
 *
 * POURQUOI UN COMPTE, ET PAS SEULEMENT UN PROFIL
 *
 * Un `Artist` porte une référence vers un `User`, et elle est obligatoire
 * (models/Artist.ts). Un profil sans compte n'existe donc pas : il
 * n'apparaîtrait nulle part, et personne ne pourrait jamais en reprendre
 * la main. On crée le compte, le profil suit — exactement ce que fait
 * l'administration depuis sa page des membres, par la même route.
 *
 * D'OÙ L'ADRESSE EMAIL OBLIGATOIRE
 *
 * C'est la clé du compte, et le seul moyen pour l'artiste de s'y
 * connecter un jour. Le mot de passe, lui, est tiré au hasard par le
 * serveur et montré une seule fois : il n'est stocké nulle part en clair,
 * et le refermer sans l'avoir noté oblige à passer par « mot de passe
 * oublié ». On le dit, plutôt que de le laisser découvrir.
 */
export function CreateArtistModal({
  nomInitial = "",
  onCree,
  onClose,
}: {
  /** Nom lu dans les balises du fichier, le plus souvent. */
  nomInitial?: string;
  onCree: (artiste: ArtisteCree) => void;
  onClose: () => void;
}) {
  const pushToast = useToast();
  const [nom, setNom] = useState(nomInitial);
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState<{ artiste: ArtisteCree; motDePasse: string } | null>(null);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    if (envoi) return;
    setEnvoi(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nom.trim(), email: email.trim(), role: "artist" }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "La création a échoué."));

      const data = (await res.json()) as {
        artist?: ArtisteCree;
        temporaryPassword?: string;
      };
      if (!data.artist) throw new Error("Le profil artiste n'a pas été créé.");

      // Sélectionné tout de suite : on est venu ici pour publier, pas pour
      // administrer. L'écran de mot de passe s'affiche par-dessus, le
      // formulaire est déjà prêt derrière.
      onCree(data.artist);
      setResultat({ artiste: data.artist, motDePasse: data.temporaryPassword ?? "" });
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "La création a échoué.");
    } finally {
      setEnvoi(false);
    }
  }

  if (resultat) {
    return (
      <ModalSheet titre="Artiste créé" onClose={onClose} largeur="sm:max-w-md">
        <div className="animate-fade-in-up space-y-4">
          <p className="flex items-center gap-2 text-sm text-ink">
            <BadgeCheck size={16} className="shrink-0 text-verified" />
            <span>
              <span className="font-medium">{resultat.artiste.stageName}</span> est sélectionné pour
              cette publication.
            </span>
          </p>

          {resultat.motDePasse && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
              <p className="text-sm font-medium text-ink">Mot de passe provisoire</p>
              <p className="mt-1 text-xs text-ink-muted">
                Montré une seule fois. Transmettez-le à l&apos;artiste pour qu&apos;il reprenne la
                main sur son compte.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="selectionnable flex-1 truncate rounded-lg bg-base px-3 py-2 font-mono text-sm">
                  {resultat.motDePasse}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(resultat.motDePasse)
                      .then(() => pushToast("success", "Mot de passe copié."))
                      .catch(() => pushToast("error", "La copie a échoué."));
                  }}
                  aria-label="Copier le mot de passe"
                  className="pressable grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent"
                >
                  <Copy size={15} />
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="pressable w-full rounded-xl bg-accent py-3 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
          >
            Revenir à la publication
          </button>
        </div>
      </ModalSheet>
    );
  }

  const pret = nom.trim().length >= 2 && email.trim().length > 3;

  return (
    <ModalSheet
      titre="Nouvel artiste"
      sousTitre="Crée le compte et son profil public, puis le sélectionne pour ce titre."
      onClose={onClose}
      largeur="sm:max-w-md"
    >
      <form onSubmit={creer} className="animate-fade-in-up space-y-4">
        <FormField
          label="Nom de scène"
          icon={UserPlus}
          required
          autoFocus
          maxLength={80}
          placeholder="Tel qu'il apparaîtra sur Moziik"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
        <FormField
          label="Adresse email"
          type="email"
          icon={Mail}
          required
          maxLength={254}
          placeholder="Pour que l'artiste puisse se connecter"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          type="submit"
          disabled={!pret || envoi}
          className="pressable flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {envoi ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          Créer l&apos;artiste
        </button>
      </form>
    </ModalSheet>
  );
}
