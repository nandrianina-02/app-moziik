"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronDown,
  User,
  Mail,
  MessageSquare,
  Paperclip,
  X,
  Send,
  Lock,
  CheckCircle2,
  AlertCircle,
  Headphones,
  MessageCircle,
  HelpCircle,
  Share2,
  Loader2,
} from "lucide-react";
import { useToast } from "@/context/ToastProvider";
import { useSiteConfig } from "@/context/SiteConfigProvider";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";

const MESSAGE_MAX = 1000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

const subjectOptions = [
  { value: "", label: "Sélectionnez un sujet" },
  { value: "Question générale", label: "Question générale" },
  { value: "Problème technique", label: "Problème technique" },
  { value: "Signalement de contenu", label: "Signalement de contenu" },
  { value: "Partenariat / Presse", label: "Partenariat / Presse" },
  { value: "Autre", label: "Autre" },
];

const faqItems = [
  { q: "Comment créer un compte ?", a: "Clique sur \"S'inscrire\" depuis la page de connexion, renseigne ton email et un mot de passe, puis confirme ton adresse depuis le lien reçu par email." },
  { q: "Quels sont les moyens de paiement acceptés ?", a: "Les cartes bancaires via Stripe pour les paiements internationaux, ainsi que le Mobile Money pour les paiements locaux à Madagascar." },
  { q: "Comment télécharger une musique ?", a: "Depuis la page d'un son ou d'un album, utilise le menu contextuel (les trois points) puis \"Télécharger\", disponible pour les membres Premium." },
  { q: "Comment devenir artiste vérifié ?", a: "Rends-toi dans ton espace artiste puis \"Demander la vérification\" et suis les étapes indiquées. Notre équipe examine chaque demande sous quelques jours." },
  { q: "Puis-je changer mon adresse email ?", a: "Oui, depuis \"Mon compte\" > \"Modifier le profil\". Un email de confirmation te sera envoyé à la nouvelle adresse." },
];

type FieldErrors = Partial<Record<"name" | "email" | "message", string>>;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ContactPage() {
  const pushToast = useToast();
  const siteConfig = useSiteConfig();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<"name" | "email" | "message", boolean>>>({});
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showAllFaq, setShowAllFaq] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleFaq = showAllFaq ? faqItems : faqItems.slice(0, 3);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Le nom est requis.";
    if (!email.trim()) next.email = "L'email est requis.";
    else if (!isValidEmail(email)) next.email = "Adresse email invalide.";
    if (!message.trim()) next.message = "Le message est requis.";
    return next;
  }

  function fieldState(field: "name" | "email" | "message") {
    if (!touched[field]) return "idle";
    return errors[field] ? "invalid" : "valid";
  }

  function handleFileSelect(selected: File | null) {
    if (!selected) return;
    if (!ALLOWED_FILE_TYPES.includes(selected.type)) {
      pushToast("error", "Format non supporté. Utilise un PDF, JPG ou PNG.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      pushToast("error", "Le fichier dépasse la taille maximale de 10 Mo.");
      return;
    }
    setFile(selected);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setTouched({ name: true, email: true, message: true });
    if (Object.keys(nextErrors).length > 0) {
      pushToast("error", "Merci de vérifier les champs en rouge.");
      return;
    }

    setSending(true);
    try {
      let attachmentUrl: string | undefined;
      if (file) {
        setUploadProgress(0);
        const uploaded = await uploadToCloudinaryClient(file, "contact-attachments", setUploadProgress);
        attachmentUrl = uploaded.url;
        setUploadProgress(null);
      }

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject: subject || undefined, message, attachmentUrl }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      pushToast("error", "L'envoi a échoué. Réessaie plus tard.");
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  }

  const contactMethods = useMemo(
    () => [
      {
        icon: Mail,
        title: "Email",
        subtitle: siteConfig.supportEmail || "contact@moziik.app",
        href: `mailto:${siteConfig.supportEmail || "contact@moziik.app"}`,
      },
      {
        icon: MessageCircle,
        title: "Chat en direct",
        subtitle: "Disponible 9h – 18h (Lun – Ven)",
        href: undefined,
      },
      {
        icon: HelpCircle,
        title: "Centre d'aide",
        subtitle: "Trouve rapidement des réponses",
        href: undefined,
      },
      {
        icon: Share2,
        title: "Réseaux sociaux",
        subtitle: "Suis-nous sur nos réseaux",
        href: undefined,
      },
    ],
    [siteConfig.supportEmail]
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 md:px-10 md:py-10">
      {/* Fil d'Ariane */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-ink-muted">
        <Link href="/" className="hover:text-ink">
          Accueil
        </Link>
        <ChevronRight size={14} />
        <span className="text-ink">Contact</span>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <h1 className="text-2xl font-display font-bold md:text-3xl">Contact</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Une question, un problème, une suggestion ? Écris-nous, on te répond dans les plus brefs
          délais{siteConfig.supportEmail ? ` — ou directement à ${siteConfig.supportEmail}` : ""}.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
        {/* Formulaire */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-xl2 border border-border bg-surface p-6 md:p-7"
        >
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center py-12 text-center"
              >
                <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-verified/10 text-verified">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="mb-2 font-display text-xl">Message envoyé</h2>
                <p className="max-w-sm text-sm text-ink-muted">
                  Merci de nous avoir écrit, on te répond dès que possible à {email}.
                </p>
                <button
                  onClick={() => {
                    setSent(false);
                    setName("");
                    setEmail("");
                    setSubject("");
                    setMessage("");
                    setFile(null);
                    setTouched({});
                    setErrors({});
                  }}
                  className="mt-6 text-sm font-medium text-accent hover:underline"
                >
                  Envoyer un autre message
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSubmit}
                className="space-y-5"
                noValidate
              >
                {/* Nom complet */}
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink">Nom complet</span>
                  <span className="relative flex items-center">
                    <User size={16} className="pointer-events-none absolute left-4 text-ink-muted" />
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                      placeholder="Votre nom complet"
                      className={`w-full rounded-xl border bg-base py-2.5 pl-11 pr-10 text-sm outline-none transition-colors ${
                        fieldState("name") === "invalid"
                          ? "border-red-500/70 focus:border-red-500"
                          : "border-border focus:border-accent"
                      }`}
                    />
                    {fieldState("name") === "valid" && (
                      <CheckCircle2 size={16} className="absolute right-3.5 text-verified" />
                    )}
                    {fieldState("name") === "invalid" && (
                      <AlertCircle size={16} className="absolute right-3.5 text-red-500" />
                    )}
                  </span>
                  {fieldState("name") === "invalid" && (
                    <span className="mt-1.5 block text-xs text-red-500">{errors.name}</span>
                  )}
                </label>

                {/* Email */}
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink">Email</span>
                  <span className="relative flex items-center">
                    <Mail size={16} className="pointer-events-none absolute left-4 text-ink-muted" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                      placeholder="Votre adresse email"
                      className={`w-full rounded-xl border bg-base py-2.5 pl-11 pr-10 text-sm outline-none transition-colors ${
                        fieldState("email") === "invalid"
                          ? "border-red-500/70 focus:border-red-500"
                          : "border-border focus:border-accent"
                      }`}
                    />
                    {fieldState("email") === "valid" && (
                      <CheckCircle2 size={16} className="absolute right-3.5 text-verified" />
                    )}
                    {fieldState("email") === "invalid" && (
                      <AlertCircle size={16} className="absolute right-3.5 text-red-500" />
                    )}
                  </span>
                  {fieldState("email") === "invalid" && (
                    <span className="mt-1.5 block text-xs text-red-500">{errors.email}</span>
                  )}
                </label>

                {/* Sujet */}
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink">Sujet</span>
                  <span className="relative flex items-center">
                    <MessageSquare size={16} className="pointer-events-none absolute left-4 text-ink-muted" />
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-border bg-base py-2.5 pl-11 pr-10 text-sm text-ink outline-none transition-colors focus:border-accent"
                    >
                      {subjectOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-3.5 text-ink-muted" />
                  </span>
                </label>

                {/* Message */}
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink">Message</span>
                  <div className={`relative rounded-xl border bg-base transition-colors ${
                    fieldState("message") === "invalid"
                      ? "border-red-500/70 focus-within:border-red-500"
                      : "border-border focus-within:border-accent"
                  }`}>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                      onBlur={() => setTouched((t) => ({ ...t, message: true }))}
                      placeholder="Décrivez votre message en détail..."
                      rows={6}
                      maxLength={MESSAGE_MAX}
                      className="w-full resize-none rounded-xl bg-transparent px-4 py-3 text-sm outline-none"
                    />
                    <span className="pointer-events-none absolute bottom-2.5 right-3.5 text-xs text-ink-muted">
                      {message.length} / {MESSAGE_MAX}
                    </span>
                  </div>
                  {fieldState("message") === "invalid" && (
                    <span className="mt-1.5 block text-xs text-red-500">{errors.message}</span>
                  )}
                </label>

                {/* Pièce jointe */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                  />
                  {file ? (
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-base px-4 py-3">
                      <Paperclip size={16} className="shrink-0 text-accent" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{file.name}</p>
                        <p className="text-xs text-ink-muted">{(file.size / (1024 * 1024)).toFixed(1)} Mo</p>
                      </div>
                      {uploadProgress !== null ? (
                        <span className="shrink-0 text-xs text-ink-muted">{uploadProgress}%</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          aria-label="Retirer la pièce jointe"
                          className="shrink-0 text-ink-muted hover:text-ink"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-base px-4 py-3 text-left transition-colors hover:border-accent"
                    >
                      <Paperclip size={16} className="shrink-0 text-ink-muted" />
                      <div>
                        <p className="text-sm text-ink">Joindre un fichier (optionnel)</p>
                        <p className="text-xs text-ink-muted">PDF, JPG, PNG (max. 10 Mo)</p>
                      </div>
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
                >
                  {sending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {uploadProgress !== null ? `Envoi de la pièce jointe... ${uploadProgress}%` : "Envoi..."}
                    </>
                  ) : (
                    <>
                      <Send size={15} /> Envoyer le message
                    </>
                  )}
                </button>

                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-muted">
                  <Lock size={12} /> Vos informations sont sécurisées et utilisées uniquement pour vous répondre.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl2 border border-border bg-surface p-6"
          >
            <h2 className="mb-4 text-base font-semibold text-ink">Autres moyens de nous contacter</h2>
            <div className="space-y-1">
              {contactMethods.map(({ icon: Icon, title, subtitle, href }) => {
                const content = (
                  <>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{title}</span>
                      <span className="block truncate text-xs text-ink-muted">{subtitle}</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-ink-muted" />
                  </>
                );
                return href ? (
                  <a key={title} href={href} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-base">
                    {content}
                  </a>
                ) : (
                  <div key={title} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                    {content}
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl2 border border-border bg-gradient-to-br from-accent/15 via-accent/5 to-transparent p-6"
          >
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent">
              <Headphones size={20} />
            </div>
            <h3 className="mb-1.5 text-base font-semibold text-ink">Nous sommes là pour vous</h3>
            <p className="text-sm leading-relaxed text-ink-muted">
              Notre équipe est à votre écoute pour vous accompagner et vous offrir la meilleure
              expérience sur {siteConfig.siteName}.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl2 border border-border bg-surface p-6"
          >
            <h2 className="mb-3 text-base font-semibold text-ink">Questions fréquentes</h2>
            <div className="divide-y divide-border">
              {visibleFaq.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={item.q}>
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm text-ink"
                    >
                      {item.q}
                      <ChevronDown
                        size={16}
                        className={`shrink-0 text-ink-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden pb-3 text-xs leading-relaxed text-ink-muted"
                        >
                          {item.a}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
            {faqItems.length > 3 && (
              <button
                onClick={() => setShowAllFaq((v) => !v)}
                className="mt-2 flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                {showAllFaq ? "Voir moins" : "Voir toutes les questions"}
                <ChevronRight size={14} />
              </button>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
