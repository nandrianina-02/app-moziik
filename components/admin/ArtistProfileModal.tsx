"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, CalendarClock, ImagePlus, Wallet } from "lucide-react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { SafeImage } from "@/components/ui/SafeImage";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/context/ToastProvider";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { readApiError } from "@/lib/readApiError";
import { SocialLinksEditor, type SocialLink } from "@/components/artist/SocialLinksEditor";

/**
 * Le profil public d'un artiste, modifiable par l'administration.
 *
 * Mêmes champs que ceux dont l'artiste dispose, plus ceux que lui seul ne
 * décide pas : nom de scène, vérification, monétisation, droit de publier
 * des évènements. Une faute dans un nom de scène ou une photo manquante
 * n'ont plus à attendre que l'intéressé s'en occupe.
 */

type Profil = {
  _id: string;
  stageName: string;
  bio?: string;
  coverUrl?: string;
  bannerUrl?: string;
  genres: string[];
  socialLinks: SocialLink[];
  verified: boolean;
  monetizationEnabled: boolean;
  eventPublishingAuthorized: boolean;
  user?: { name?: string; email?: string; avatarUrl?: string };
};

const CHAMP =
  "w-full rounded-xl border border-border bg-base px-3.5 py-2.5 text-sm outline-none focus:border-accent";

function Reglage({
  icone: Icone,
  titre,
  detail,
  actif,
  onChange,
}: {
  icone: typeof BadgeCheck;
  titre: string;
  detail: string;
  actif: boolean;
  onChange: (actif: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border p-3.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icone size={16} className="mt-0.5 shrink-0 text-ink-muted" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{titre}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{detail}</p>
        </div>
      </div>
      <Switch checked={actif} onChange={onChange} label={titre} />
    </div>
  );
}

export function ArtistProfileModal({
  artistId,
  onClose,
  onSaved,
}: {
  artistId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const pushToast = useToast();

  const [profil, setProfil] = useState<Profil | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [envoi, setEnvoi] = useState<"photo" | "banniere" | null>(null);

  const [stageName, setStageName] = useState("");
  const [bio, setBio] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [genres, setGenres] = useState("");
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [verified, setVerified] = useState(false);
  const [monetization, setMonetization] = useState(true);
  const [evenements, setEvenements] = useState(false);

  useEffect(() => {
    async function charger() {
      try {
        const res = await fetch(`/api/admin/artists/${artistId}`);
        if (!res.ok) throw new Error(await readApiError(res, "Profil introuvable."));
        const data = await res.json();
        const a: Profil = data.artist;

        setProfil(a);
        setStageName(a.stageName ?? "");
        setBio(a.bio ?? "");
        setCoverUrl(a.coverUrl ?? "");
        setBannerUrl(a.bannerUrl ?? "");
        setGenres((a.genres ?? []).join(", "));
        setLinks(a.socialLinks ?? []);
        setVerified(Boolean(a.verified));
        setMonetization(a.monetizationEnabled !== false);
        setEvenements(Boolean(a.eventPublishingAuthorized));
      } catch (err) {
        pushToast("error", err instanceof Error ? err.message : "Profil introuvable.");
        onClose();
      } finally {
        setChargement(false);
      }
    }
    charger();
    // `onClose` et `pushToast` sont stables : les lister relancerait la
    // requête à chaque rendu du parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistId]);

  async function envoyer(fichier: File | null, cible: "photo" | "banniere") {
    if (!fichier) return;
    setEnvoi(cible);
    try {
      const { url } = await uploadToCloudinaryClient(fichier, cible === "photo" ? "avatars" : "covers");
      if (cible === "photo") setCoverUrl(url);
      else setBannerUrl(url);
    } catch {
      pushToast("error", "L'envoi de l'image a échoué.");
    } finally {
      setEnvoi(null);
    }
  }

  async function enregistrer() {
    setEnregistrement(true);
    try {
      const res = await fetch(`/api/admin/artists/${artistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageName,
          bio,
          coverUrl,
          bannerUrl,
          genres: genres
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean),
          socialLinks: links.filter((l) => l.url.trim()),
          verified,
          monetizationEnabled: monetization,
          eventPublishingAuthorized: evenements,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "L'enregistrement a échoué."));
      pushToast("success", "Profil artiste mis à jour.");
      onSaved();
      onClose();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "L'enregistrement a échoué.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <ModalSheet
      titre="Profil artiste"
      largeur="sm:max-w-xl"
      onClose={onClose}
      pied={
        <button
          type="button"
          onClick={enregistrer}
          disabled={enregistrement || chargement || !stageName.trim()}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {enregistrement ? "Enregistrement..." : "Enregistrer"}
        </button>
      }
    >
      {chargement ? (
        <p className="py-8 text-center text-sm text-ink-muted">Chargement du profil...</p>
      ) : (
        <div className="space-y-5">
          {/* Bannière et photo, montrées comme elles paraîtront sur la page
              publique : c'est le seul moyen de voir qu'un cadrage ne va pas. */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Bannière et photo</span>
            <div className="relative overflow-hidden rounded-xl border border-border">
              <div className="h-24 w-full bg-base">
                {bannerUrl && (
                  <SafeImage src={bannerUrl} alt="" width={640} height={96} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex items-end gap-3 px-3.5 pb-3.5">
                <span className="-mt-8 h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-surface bg-base">
                  <SafeImage
                    src={coverUrl}
                    alt={stageName}
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                </span>
                <div className="flex flex-wrap gap-2 pb-0.5">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent hover:text-accent">
                    <ImagePlus size={13} />
                    {envoi === "photo" ? "Envoi..." : "Photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={envoi !== null}
                      onChange={(e) => {
                        envoyer(e.target.files?.[0] ?? null, "photo");
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent hover:text-accent">
                    <ImagePlus size={13} />
                    {envoi === "banniere" ? "Envoi..." : "Bannière"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={envoi !== null}
                      onChange={(e) => {
                        envoyer(e.target.files?.[0] ?? null, "banniere");
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {!coverUrl && profil?.user?.avatarUrl && (
              <button
                type="button"
                onClick={() => setCoverUrl(profil.user?.avatarUrl ?? "")}
                className="mt-2 text-xs text-accent hover:underline"
              >
                Reprendre la photo du compte
              </button>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Nom de scène</span>
            <input
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              maxLength={80}
              className={CHAMP}
            />
            {profil?.user?.email && (
              <span className="mt-1 block text-xs text-ink-muted">Compte : {profil.user.email}</span>
            )}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Biographie</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={2000}
              className={`${CHAMP} resize-none`}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">
              Genres (séparés par une virgule)
            </span>
            <input
              value={genres}
              onChange={(e) => setGenres(e.target.value)}
              placeholder="Pop, Afro, Soul"
              className={CHAMP}
            />
          </label>

          <SocialLinksEditor links={links} onChange={setLinks} />

          <div className="space-y-2">
            <Reglage
              icone={BadgeCheck}
              titre="Artiste vérifié"
              detail="Affiche le badge, et range le compte parmi les vérifiés."
              actif={verified}
              onChange={setVerified}
            />
            <Reglage
              icone={Wallet}
              titre="Monétisation"
              detail="Les écoutes complètes génèrent des droits."
              actif={monetization}
              onChange={setMonetization}
            />
            <Reglage
              icone={CalendarClock}
              titre="Publication d'évènements"
              detail="Peut créer des évènements, soumis à validation."
              actif={evenements}
              onChange={setEvenements}
            />
          </div>
        </div>
      )}
    </ModalSheet>
  );
}
