"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Loader2, LogOut, Users } from "lucide-react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { useEcouteEnsemble } from "@/context/EcouteEnsembleProvider";

/**
 * La fenêtre « Écouter à plusieurs » : lancer une écoute et partager son
 * code, ou en rejoindre une avec le code d'un ami (créé sur le site ou
 * dans l'application).
 */
export function FenetreEcouteEnsemble({ onClose }: { onClose: () => void }) {
  const { status } = useSession();
  const { etat, lancer, rejoindre, quitter } = useEcouteEnsemble();
  const [code, setCode] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function agir(action: () => Promise<void>) {
    setEnCours(true);
    setErreur(null);
    try {
      await action();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Échec.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <ModalSheet titre="Écouter à plusieurs" sousTitre="La même musique au même moment, chacun sur son appareil." onClose={onClose}>
      {status !== "authenticated" ? (
        <p className="text-sm text-ink-muted">
          <Link href="/connexion" className="font-medium text-accent hover:underline">
            Connectez-vous
          </Link>{" "}
          pour écouter à plusieurs.
        </p>
      ) : etat?.role === "hote" ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-ink-muted">Votre code, à donner à vos amis</p>
            <p className="font-display text-5xl font-bold tracking-[0.2em] text-accent">{etat.code}</p>
          </div>
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Users size={15} />
            {etat.participants === 0 ? "Personne n'a encore rejoint." : `${etat.participants} personne${etat.participants > 1 ? "s" : ""} vous écoute${etat.participants > 1 ? "nt" : ""}.`}
          </p>
          <p className="text-xs text-ink-muted">Ce que vous lancez, mettez en pause ou passez, vos amis l&apos;entendent aussi.</p>
          <button onClick={() => agir(quitter)} disabled={enCours} className="flex items-center gap-2 rounded-full bg-ink/[0.08] px-4 py-2 text-sm font-medium hover:bg-ink/[0.14]">
            <LogOut size={15} /> Arrêter l&apos;écoute à plusieurs
          </button>
        </div>
      ) : etat?.role === "invite" ? (
        <div className="space-y-4">
          <p className="text-sm">
            Vous écoutez avec <span className="font-semibold">{etat.hote ?? "votre hôte"}</span> (code {etat.code}).
          </p>
          <p className="text-xs text-ink-muted">Le titre, la position et les pauses suivent ceux de l&apos;hôte.</p>
          <button onClick={() => agir(quitter)} disabled={enCours} className="flex items-center gap-2 rounded-full bg-ink/[0.08] px-4 py-2 text-sm font-medium hover:bg-ink/[0.14]">
            <LogOut size={15} /> Quitter
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <button
            onClick={() => agir(lancer)}
            disabled={enCours}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-bold text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {enCours ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
            Lancer une écoute
          </button>
          <div>
            <p className="mb-2 text-xs text-ink-muted">ou rejoindre avec un code</p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length === 6) agir(() => rejoindre(code));
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                placeholder="Code à six caractères"
                aria-label="Code de l'écoute"
                className="min-w-0 flex-1 rounded-full bg-ink/[0.08] px-4 py-2.5 text-sm font-semibold tracking-[0.2em] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-muted"
              />
              <button type="submit" disabled={code.length !== 6 || enCours} className="rounded-full bg-ink px-5 text-sm font-semibold text-base disabled:opacity-40">
                Rejoindre
              </button>
            </form>
          </div>
        </div>
      )}
      {erreur && <p className="mt-3 text-sm text-danger">{erreur}</p>}
    </ModalSheet>
  );
}
