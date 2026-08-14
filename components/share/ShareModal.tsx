"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, QrCode, ListMusic, BadgeCheck, Globe2, Lock, Loader2 } from "lucide-react";
import {
  FaFacebook,
  FaFacebookMessenger,
  FaWhatsapp,
  FaTelegram,
  FaXTwitter,
  FaInstagram,
  FaLinkedin,
  FaDiscord,
} from "react-icons/fa6";
import { MdEmail } from "react-icons/md";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";
import { Portal } from "@/components/ui/Portal";
import type { ShareSubject } from "@/components/share/shareSubject";
import { useEscapeClose } from "@/hooks/useEscapeClose";

// Réseaux pour lesquels il n'existe pas d'URL de partage web fiable sans
// identifiant d'application (Messenger, Discord) ou pas du tout
// (Instagram) : on copie le lien à la place, plutôt que de proposer un
// bouton qui ne fonctionnerait pas réellement.
const COPY_ONLY_NETWORKS = new Set(["messenger", "instagram", "discord"]);

const subjectDescription: Record<ShareSubject["type"], string> = {
  song: "Partagez ce morceau avec vos amis ou sur vos réseaux sociaux.",
  album: "Partagez cet album avec vos amis ou sur vos réseaux sociaux.",
  playlist: "Partagez cette playlist avec vos amis ou sur vos réseaux sociaux.",
  artist: "Partagez ce profil d'artiste avec vos amis ou sur vos réseaux sociaux.",
  profile: "Partagez votre profil d'artiste avec vos amis ou sur vos réseaux sociaux.",
};

export function ShareModal({
  subject,
  onClose,
  onShared,
  onOpenAddToPlaylist,
  privacy,
}: {
  subject: ShareSubject;
  onClose: () => void;
  /** Le compteur de partages n'existe que sur le modèle Song — non appelé pour les autres types. */
  onShared?: (sharesCount: number) => void;
  /** Uniquement pertinent pour un titre (subject.type === "song"). */
  onOpenAddToPlaylist?: () => void;
  /** Uniquement pertinent pour une playlist (subject.type === "playlist"). */
  privacy?: { isPublic: boolean; isOwner: boolean; busy?: boolean; onTogglePublic: () => void };
}) {
  useEscapeClose(onClose);
  const pushToast = useToast();
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${subject.path}`;
  const shareText = subject.subtitle ? `${subject.title} — ${subject.subtitle}` : subject.title;

  async function registerShare() {
    if (subject.type !== "song") return;
    try {
      const res = await fetch(`/api/songs/${subject.id}/share`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      onShared?.(data.sharesCount);
    } catch {
      // Le compteur de partages est indicatif : un échec silencieux ne doit pas bloquer le partage lui-même.
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    pushToast("success", "Lien copié dans le presse-papiers.");
    registerShare();
    setTimeout(() => setCopied(false), 2000);
  }

  function openIntent(url: string) {
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=650");
    registerShare();
  }

  function handleNetwork(network: string) {
    if (COPY_ONLY_NETWORKS.has(network)) {
      copyLink();
      return;
    }
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);
    switch (network) {
      case "facebook":
        openIntent(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`);
        break;
      case "whatsapp":
        openIntent(`https://wa.me/?text=${encodedText}%20${encodedUrl}`);
        break;
      case "telegram":
        openIntent(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`);
        break;
      case "x":
        openIntent(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`);
        break;
      case "linkedin":
        openIntent(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`);
        break;
      case "email":
        window.location.href = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodedText}%20${encodedUrl}`;
        registerShare();
        break;
    }
  }

  async function handleShowQr() {
    if (qrDataUrl) {
      setQrDataUrl(null);
      return;
    }
    setLoadingQr(true);
    try {
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(shareUrl, { margin: 1, width: 220, color: { dark: "#161927" } });
      setQrDataUrl(dataUrl);
      registerShare();
    } catch {
      pushToast("error", "Impossible de générer le QR code.");
    } finally {
      setLoadingQr(false);
    }
  }

  const networks: { id: string; label: string; icon: typeof FaFacebook; className: string; note?: string }[] = [
    { id: "facebook", label: "Facebook", icon: FaFacebook, className: "bg-[#1877F2] text-white" },
    { id: "messenger", label: "Messenger", icon: FaFacebookMessenger, className: "bg-gradient-to-br from-[#00B2FF] to-[#B900E4] text-white", note: "Copier le lien" },
    { id: "whatsapp", label: "WhatsApp", icon: FaWhatsapp, className: "bg-[#25D366] text-white" },
    { id: "telegram", label: "Telegram", icon: FaTelegram, className: "bg-[#26A5E4] text-white" },
    { id: "x", label: "X (Twitter)", icon: FaXTwitter, className: "bg-black text-white" },
    { id: "instagram", label: "Instagram", icon: FaInstagram, className: "bg-gradient-to-br from-[#FEDA75] via-[#D62976] to-[#4F5BD5] text-white", note: "Copier le lien" },
    { id: "linkedin", label: "LinkedIn", icon: FaLinkedin, className: "bg-[#0A66C2] text-white" },
    { id: "discord", label: "Discord", icon: FaDiscord, className: "bg-[#5865F2] text-white", note: "Copier le lien" },
    { id: "email", label: "Email", icon: MdEmail, className: "bg-ink-muted/20 text-ink" },
  ];

  const isCircular = subject.type === "artist" || subject.type === "profile";

  return (
    // Portail : ouverte depuis le mini-lecteur (parent fixed + z-30),
    // cette modale restait sinon confinée sous la navigation mobile.
    <Portal>
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 px-4 py-8 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl2 border border-border bg-surface p-6 shadow-2xl"
      >
        <div className="mb-1 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-display">Partager</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{subjectDescription[subject.type]}</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-base hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 flex gap-4 rounded-xl2 bg-base p-3">
          <SafeImage
            src={subject.coverUrl}
            alt={subject.title}
            width={84}
            height={84}
            className={`shrink-0 object-cover ${isCircular ? "rounded-full" : "rounded-xl"}`}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{subject.title}</p>
            {subject.subtitle && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink-muted">
                {subject.subtitle}
                {subject.verified && <BadgeCheck size={13} className="text-verified" />}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
              {subject.stats.map((stat) => (
                <span key={stat.label} className="flex items-center gap-1">
                  <stat.icon size={11} /> {stat.value}
                </span>
              ))}
            </div>
          </div>
        </div>

        {privacy && (
          <div className="mt-3 flex items-center justify-between rounded-xl2 border border-border p-3">
            <span className="flex items-center gap-2 text-sm">
              {privacy.isPublic ? <Globe2 size={15} className="text-verified" /> : <Lock size={15} className="text-ink-muted" />}
              {privacy.isPublic ? "Playlist publique" : "Playlist privée"}
            </span>
            {privacy.isOwner ? (
              <button
                onClick={privacy.onTogglePublic}
                disabled={privacy.busy}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
              >
                {privacy.busy && <Loader2 size={12} className="animate-spin" />}
                {privacy.isPublic ? "Rendre privée" : "Rendre publique"}
              </button>
            ) : (
              !privacy.isPublic && <span className="text-xs text-ink-muted">Lien valable pour toi uniquement</span>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 truncate rounded-xl border border-border bg-base px-3.5 py-2.5 text-sm text-ink-muted outline-none"
          />
          <button
            onClick={copyLink}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Copié" : "Copier"}
          </button>
        </div>

        <div className="my-5 h-px bg-border" />

        <h3 className="mb-3 text-sm font-medium">Partager sur</h3>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {networks.map((n) => (
            <button key={n.id} onClick={() => handleNetwork(n.id)} className="group flex flex-col items-center gap-1.5">
              <span className={`grid h-11 w-11 place-items-center rounded-full transition-transform group-hover:scale-110 ${n.className}`}>
                <n.icon size={18} />
              </span>
              <span className="text-center text-[11px] leading-tight text-ink-muted">{n.label}</span>
              {n.note && <span className="text-center text-[10px] leading-tight text-ink-muted/70">{n.note}</span>}
            </button>
          ))}
          <button onClick={handleShowQr} className="group flex flex-col items-center gap-1.5">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-border text-ink-muted transition-transform group-hover:scale-110 group-hover:border-accent group-hover:text-accent">
              <QrCode size={18} />
            </span>
            <span className="text-center text-[11px] leading-tight text-ink-muted">{loadingQr ? "..." : "QR Code"}</span>
          </button>
        </div>

        <AnimatePresence>
          {qrDataUrl && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="flex flex-col items-center gap-2 rounded-xl2 border border-border bg-base p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- image générée localement (data URL), next/image ne s'applique pas */}
                <img src={qrDataUrl} alt="QR code du lien de partage" width={160} height={160} className="rounded-lg" />
                <p className="text-xs text-ink-muted">Scannez pour ouvrir {subject.type === "song" ? "le morceau" : subject.type === "album" ? "l'album" : subject.type === "playlist" ? "la playlist" : "le profil"}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {onOpenAddToPlaylist && (
          <>
            <div className="my-5 h-px bg-border" />
            <h3 className="mb-3 text-sm font-medium">Partager vers</h3>
            <button
              onClick={() => {
                onClose();
                onOpenAddToPlaylist();
              }}
              className="flex w-full items-center gap-3 rounded-xl2 border border-border p-3.5 text-left transition-colors hover:border-accent"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                <ListMusic size={17} />
              </span>
              <span>
                <span className="block text-sm font-medium">Playlist</span>
                <span className="block text-xs text-ink-muted">Ajouter à une de tes playlists</span>
              </span>
            </button>
          </>
        )}

        <p className="mt-4 text-xs text-ink-muted">
          Le partage direct vers un utilisateur, un groupe ou une radio Moziik arrive bientôt.
        </p>

        <div className="mt-4 flex justify-end">
          <Link href={subject.path} onClick={onClose} className="text-xs text-ink-muted hover:text-accent">
            Voir la page →
          </Link>
        </div>
      </motion.div>
    </div>
    </Portal>
  );
}
