"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Camera, Loader2, AlertCircle, Mic2 } from "lucide-react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { FormField } from "@/components/ui/FormField";
import { useToast } from "@/context/ToastProvider";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { ModalSheet } from "@/components/ui/ModalSheet";

export type EditableProfile = {
  name: string;
  email: string;
  avatarUrl?: string;
  hasGoogleAccount?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EditProfileModal({
  profile,
  isArtist,
  artistId,
  onClose,
  onUpdated,
}: {
  profile: EditableProfile;
  isArtist?: boolean;
  artistId?: string;
  onClose: () => void;
  onUpdated: (profile: EditableProfile) => void;
}) {
  const { update } = useSession();
  const pushToast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailLocked = !!profile.hasGoogleAccount;

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Le fichier doit être une image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("L'image ne doit pas dépasser 5 Mo.");
      return;
    }

    setError(null);
    setUploadingAvatar(true);
    try {
      const { url } = await uploadToCloudinaryClient(file, "avatars");
      setAvatarUrl(url);
    } catch {
      setError("L'envoi de la photo a échoué. Réessaie.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  function validate(): string | null {
    if (!name.trim()) return "Le nom ne peut pas être vide.";
    if (name.trim().length > 80) return "Le nom est trop long (80 caractères max).";
    if (!emailLocked && !EMAIL_RE.test(email.trim())) return "Adresse email invalide.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const body: Record<string, string> = { name: name.trim(), avatarUrl: avatarUrl ?? "" };
      if (!emailLocked) body.email = email.trim();

      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "La mise à jour a échoué.");
        return;
      }

      // Rafraîchit la session NextAuth (nom/photo/email affichés partout
      // dans l'app) sans recharger la page.
      await update({ name: data.user.name, picture: data.user.avatarUrl, email: data.user.email });

      onUpdated({
        name: data.user.name,
        email: data.user.email,
        avatarUrl: data.user.avatarUrl,
        hasGoogleAccount: data.user.hasGoogleAccount,
      });
      pushToast("success", "Profil mis à jour.");
      onClose();
    } catch {
      setError("Une erreur réseau est survenue. Réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      titre="Modifier le profil"
      largeur="sm:max-w-md"
      onClose={onClose}
      pied={
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="form-profil"
            disabled={saving || uploadingAvatar}
            className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      }
    >
      <form id="form-profil" onSubmit={handleSubmit} className="space-y-5">
          <div className="flex justify-center">
            <div className="relative">
              <SafeImage
                src={avatarUrl}
                alt={name || "Profil"}
                width={88}
                height={88}
                className="h-[88px] w-[88px] rounded-full object-cover"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Changer la photo de profil"
                className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-accent text-base shadow-md transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
          </div>

          <FormField label="Nom" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />

          <div>
            <FormField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={emailLocked}
              required
            />
            {emailLocked && (
              <p className="mt-1.5 text-xs text-ink-muted">
                Ton compte est lié à Google — l&apos;email ne peut pas être modifié ici.
              </p>
            )}
          </div>

          {isArtist && artistId && (
            <p className="rounded-xl border border-border bg-base p-3 text-xs text-ink-muted">
              <Mic2 size={12} className="mr-1 inline text-accent" />
              La bannière, la bio et les liens de ton profil artiste se modifient sur{" "}
              <Link href={`/artiste/${artistId}`} onClick={onClose} className="text-accent hover:underline">
                ta page artiste
              </Link>
              .
            </p>
          )}

          {error && (
            <p className="flex items-start gap-1.5 rounded-xl bg-accent/10 p-3 text-xs text-accent">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}

      </form>
    </ModalSheet>
  );
}
