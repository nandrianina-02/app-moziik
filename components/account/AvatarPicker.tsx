"use client";

import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";

/** Poids au-delà duquel on refuse avant d'envoyer : inutile de faire monter
 *  huit mégaoctets pour une vignette de 96 pixels. */
const POIDS_MAX = 5 * 1024 * 1024;

/**
 * Photo de profil, changeable sur place.
 *
 * L'envoi part dès le choix du fichier — un bouton « enregistrer » de plus
 * pour une action qu'on vient déjà de confirmer en choisissant une image
 * n'ajoute qu'une occasion de l'oublier.
 */
export function AvatarPicker({
  url,
  nom,
  onChange,
}: {
  url?: string;
  nom: string;
  onChange: (url: string) => Promise<void> | void;
}) {
  const pushToast = useToast();
  const [envoi, setEnvoi] = useState(false);

  async function choisir(file: File) {
    if (file.size > POIDS_MAX) {
      pushToast("error", "Image trop lourde : 5 Mo maximum.");
      return;
    }
    setEnvoi(true);
    try {
      const { url: nouvelle } = await uploadToCloudinaryClient(file, "avatars");
      await onChange(nouvelle);
    } catch {
      pushToast("error", "L'envoi de la photo a échoué.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <SafeImage src={url} alt={nom} width={88} height={88} className="h-[88px] w-[88px] rounded-full object-cover" />
      <label
        className="absolute -bottom-1 -right-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-accent text-base ring-2 ring-surface transition-colors hover:bg-accent-hover"
        title="Changer la photo"
      >
        {envoi ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
        <span className="sr-only">Changer la photo de profil</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={envoi}
          onChange={(e) => e.target.files?.[0] && choisir(e.target.files[0])}
        />
      </label>
    </div>
  );
}
