"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Music, Sparkles } from "lucide-react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";

type TitreProposé = {
  _id: string;
  title: string;
  artiste: string;
  genre?: string;
  duration?: number;
  coverUrl?: string;
};

type Proposition = {
  titre: string;
  description: string;
  songs: TitreProposé[];
  remarque: string;
};

export type PlaylistCreee = { _id: string; title: string; coverUrl?: string; songs: string[] };

/** Quelques demandes types, pour montrer ce que la chose accepte. */
const EXEMPLES = [
  "pour courir le matin",
  "salegy pour une soirée entre amis",
  "des morceaux calmes en malgache",
  "de quoi travailler sans être distrait",
];

function duree(secondes?: number) {
  if (!secondes || secondes <= 0) return "";
  const m = Math.floor(secondes / 60);
  const s = Math.floor(secondes % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Une playlist composée à partir d'une phrase.
 *
 * L'aperçu est montré avant toute création. Deux raisons : une playlist
 * créée d'office encombrerait la bibliothèque au premier essai, et
 * surtout, c'est en voyant les morceaux qu'on juge la proposition — un
 * titre et une description ne disent rien de ce qu'on va écouter.
 *
 * Les morceaux proposés existent tous : le serveur ne rend que des
 * identifiants issus du catalogue qu'il a lui-même soumis au modèle
 * (voir lib/ai/playlistBuilder.ts).
 */
export function AiPlaylistModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (playlist: PlaylistCreee) => void;
}) {
  const pushToast = useToast();
  const [demande, setDemande] = useState("");
  const [proposition, setProposition] = useState<Proposition | null>(null);
  const [chargement, setChargement] = useState(false);
  const [creation, setCreation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function composer(texte?: string) {
    const phrase = (texte ?? demande).trim();
    if (phrase.length < 3) {
      setErreur("Décrivez en quelques mots la playlist voulue.");
      return;
    }
    if (texte) setDemande(texte);
    setChargement(true);
    setErreur(null);
    try {
      const res = await fetch("/api/ai/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demande: phrase }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "La composition a échoué."));
      const data = await res.json();
      if (!data.proposition) {
        setProposition(null);
        setErreur(
          "Rien à composer avec cette demande : le catalogue ne contient pas encore de quoi la remplir."
        );
        return;
      }
      setProposition(data.proposition);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "La composition a échoué.");
      setProposition(null);
    } finally {
      setChargement(false);
    }
  }

  async function creer() {
    if (!proposition || creation) return;
    setCreation(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Titre et morceaux en une seule requête : deux appels
        // laisseraient une playlist vide si le second échouait.
        body: JSON.stringify({
          title: proposition.titre,
          description: proposition.description,
          songIds: proposition.songs.map((s) => s._id),
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "La création a échoué."));
      const data = await res.json();
      onCreated(data.playlist);
      window.dispatchEvent(new Event("moziik-playlists-change"));
      pushToast("success", `« ${proposition.titre} » créée avec ${proposition.songs.length} titres.`);
      onClose();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "La création a échoué.");
    } finally {
      setCreation(false);
    }
  }

  return (
    <ModalSheet
      titre="Composer une playlist"
      sousTitre="Décrivez ce que vous voulez écouter"
      largeur="sm:max-w-xl"
      onClose={onClose}
      pied={
        proposition ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={creer}
              disabled={creation}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {creation ? <Loader2 size={15} className="animate-spin" /> : null}
              {creation ? "Création…" : `Créer cette playlist (${proposition.songs.length} titres)`}
            </button>
            <button
              type="button"
              onClick={() => composer()}
              disabled={chargement || creation}
              className="rounded-full border border-border px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
            >
              Recomposer
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-muted">Votre demande</span>
            <textarea
              value={demande}
              onChange={(e) => setDemande(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  composer();
                }
              }}
              rows={2}
              maxLength={400}
              placeholder="Ex : de la musique douce pour la fin de journée"
              className="w-full resize-y rounded-xl border border-border bg-base px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXEMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => composer(ex)}
                disabled={chargement}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
              >
                {ex}
              </button>
            ))}
          </div>

          {!proposition && (
            <button
              type="button"
              onClick={() => composer()}
              disabled={chargement}
              className="mt-3 flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {chargement ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {chargement ? "Composition…" : "Composer"}
            </button>
          )}
        </div>

        {erreur && (
          <p className="flex items-start gap-1.5 text-xs text-accent">
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {erreur}
          </p>
        )}

        {proposition && (
          <div className="rounded-xl2 border border-border bg-base p-4">
            <p className="font-display text-lg text-ink">{proposition.titre}</p>
            {proposition.description && (
              <p className="mt-1 text-sm text-ink-muted">{proposition.description}</p>
            )}

            <ul className="mt-3 divide-y divide-border">
              {proposition.songs.map((s, i) => (
                <li key={s._id} className="flex items-center gap-3 py-2">
                  <span className="w-5 shrink-0 text-right text-xs text-ink-muted">{i + 1}</span>
                  {s.coverUrl ? (
                    <SafeImage
                      src={s.coverUrl}
                      alt={s.title}
                      width={36}
                      height={36}
                      className="shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-ink-muted">
                      <Music size={14} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{s.title}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {s.artiste}
                      {s.genre ? ` · ${s.genre}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted">{duree(s.duration)}</span>
                </li>
              ))}
            </ul>

            {proposition.remarque && (
              <p className="mt-3 border-t border-border pt-2.5 text-[11px] text-ink-muted">
                {proposition.remarque}
              </p>
            )}
          </div>
        )}
      </div>
    </ModalSheet>
  );
}
