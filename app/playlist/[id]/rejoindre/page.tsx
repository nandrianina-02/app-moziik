"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Link2Off, Loader2, Users } from "lucide-react";

/**
 * Le lien d'invitation d'une playlist collaborative mène ici : on
 * rejoint, puis on est renvoyé sur la playlist elle-même.
 */
export default function RejoindrePlaylist() {
  const { id } = useParams<{ id: string }>();
  const jeton = useSearchParams().get("jeton") ?? "";
  const router = useRouter();
  const { status } = useSession();
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/playlists/${id}/collaboration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jeton }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Ce lien n'est plus valable.");
        router.replace(`/playlist/${id}`);
      })
      .catch((e: Error) => setErreur(e.message));
  }, [status, id, jeton, router]);

  const retour = encodeURIComponent(`/playlist/${id}/rejoindre?jeton=${jeton}`);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 animate-fade-in-up">
      {status === "unauthenticated" ? (
        <>
          <Users size={26} className="mb-3 text-accent" />
          <h1 className="font-display text-2xl font-bold">Rejoindre une playlist</h1>
          <p className="mt-1 text-sm text-ink-muted">Connectez-vous pour participer à cette playlist collaborative.</p>
          <Link href={`/connexion?retour=${retour}`} className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-base hover:bg-accent-hover">
            Se connecter
          </Link>
        </>
      ) : erreur ? (
        <>
          <Link2Off size={26} className="mb-3 text-ink-muted" />
          <h1 className="font-display text-2xl font-bold">Invitation impossible</h1>
          <p className="mt-1 text-sm text-ink-muted">{erreur} Demandez un nouveau lien au propriétaire de la playlist.</p>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 size={16} className="animate-spin" /> Ajout à la playlist…
        </p>
      )}
    </div>
  );
}
