"use client";

import { useState } from "react";
import { Sparkles, Loader2, Check, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/context/ToastProvider";
import { useIADisponible } from "@/context/SiteConfigProvider";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { readApiError } from "@/lib/readApiError";
import { SocialLinksEditor, type SocialLink } from "@/components/artist/SocialLinksEditor";

export function EditArtistProfileModal({
  bio,
  genres,
  socialLinks,
  onClose,
  onSaved,
}: {
  bio?: string;
  genres: string[];
  socialLinks: SocialLink[];
  onClose: () => void;
  onSaved: (data: { bio: string; genres: string[]; socialLinks: SocialLink[] }) => void;
}) {
  const pushToast = useToast();
  const iaBio = useIADisponible("biographie");
  const [bioValue, setBioValue] = useState(bio ?? "");
  const [genresValue, setGenresValue] = useState(genres.join(", "));
  const [links, setLinks] = useState<SocialLink[]>(socialLinks.length > 0 ? socialLinks : [{ platform: "instagram", url: "" }]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const cleanGenres = genresValue
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
    const cleanLinks = links.filter((l) => l.url.trim());

    try {
      const res = await fetch("/api/artist/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bioValue, genres: cleanGenres, socialLinks: cleanLinks }),
      });
      if (!res.ok) throw new Error();
      onSaved({ bio: bioValue, genres: cleanGenres, socialLinks: cleanLinks });
      pushToast("success", "Profil mis à jour.");
      onClose();
    } catch {
      pushToast("error", "Échec de la mise à jour du profil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      titre="Modifier le profil"
      onClose={onClose}
      pied={
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-full bg-accent py-2.5 text-sm font-medium text-base hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      }
    >
      <div className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Biographie</span>
            <textarea
              value={bioValue}
              onChange={(e) => setBioValue(e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full resize-none rounded-xl border border-border bg-base px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              placeholder="Parle de toi, de ta musique, de ton parcours..."
            />
          </label>

          {iaBio && <RedactionAssistee bioActuelle={bioValue} onUtiliser={setBioValue} />}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Genres (séparés par une virgule)</span>
            <input
              value={genresValue}
              onChange={(e) => setGenresValue(e.target.value)}
              placeholder="Pop, Afro, Soul"
              className="w-full rounded-xl border border-border bg-base px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>

          <SocialLinksEditor links={links} onChange={setLinks} />
      </div>
    </ModalSheet>
  );
}

/**
 * Rédaction assistée de la biographie.
 *
 * Le panneau demande des notes avant d'écrire, et ce n'est pas une
 * formalité : c'est la seule matière biographique dont le modèle
 * disposera. Sans elles il ne reste que le nom de scène, les genres et
 * les titres publiés — de quoi écrire deux phrases justes sur la musique,
 * pas une vie. Le refus d'inventer est côté serveur (lib/ai/artistBio.ts) ;
 * ce panneau se contente de le rendre lisible.
 *
 * Le texte proposé ne remplace rien tant que l'artiste ne clique pas : ce
 * qui paraît sur sa page est signé de son nom.
 */
function RedactionAssistee({
  bioActuelle,
  onUtiliser,
}: {
  bioActuelle: string;
  onUtiliser: (texte: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [notes, setNotes] = useState("");
  const [proposition, setProposition] = useState<{ bio: string; remarque: string } | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pose, setPose] = useState(false);

  async function rediger() {
    setChargement(true);
    setErreur(null);
    setPose(false);
    try {
      const res = await fetch("/api/ai/artist-bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, bio: bioActuelle }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "La rédaction a échoué."));
      const data = await res.json();
      setProposition(data.proposition);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "La rédaction a échoué.");
      setProposition(null);
    } finally {
      setChargement(false);
    }
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="-mt-3 flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
      >
        <Sparkles size={12} /> Rédiger avec l&apos;IA
      </button>
    );
  }

  return (
    <div className="-mt-2 rounded-xl2 border border-border bg-base p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <Sparkles size={14} className="text-accent" /> Rédiger avec l&apos;IA
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Dites en quelques mots qui vous êtes et ce que vous faites. L&apos;IA met en forme ce que vous écrivez :
        elle n&apos;ajoutera ni date, ni lieu, ni récompense que vous n&apos;auriez pas mentionnés.
      </p>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        maxLength={3000}
        aria-label="Vos notes"
        placeholder="Ex : je chante en malgache et en français, salegy mélangé de guitare, je compose seul chez moi…"
        className="mt-3 w-full resize-y rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={rediger}
          disabled={chargement}
          className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {chargement ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {chargement ? "Rédaction…" : proposition ? "Rédiger à nouveau" : "Rédiger"}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
        >
          Fermer
        </button>
      </div>

      {erreur && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-accent">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {erreur}
        </p>
      )}

      <AnimatePresence initial={false}>
        {proposition && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-border bg-surface p-3.5">
              <p className="whitespace-pre-line break-words text-sm text-ink">{proposition.bio}</p>
              {proposition.remarque && (
                <p className="mt-2 border-t border-border pt-2 text-[11px] text-ink-muted">{proposition.remarque}</p>
              )}
              <button
                type="button"
                onClick={() => {
                  onUtiliser(proposition.bio);
                  setPose(true);
                }}
                className="mt-3 flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
              >
                {pose && <Check size={12} className="text-verified" />}
                {pose
                  ? "Placé dans la biographie"
                  : bioActuelle.trim()
                    ? "Remplacer ma biographie"
                    : "Utiliser ce texte"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
