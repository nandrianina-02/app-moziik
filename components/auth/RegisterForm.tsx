"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { User, Mail, Lock, Eye, EyeOff, MailCheck } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { GoogleIcon } from "@/components/ui/GoogleIcon";

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Une erreur est survenue.");
      return;
    }

    // Le compte n'est pas encore utilisable : un email de confirmation a
    // été envoyé, on ne connecte donc pas automatiquement (voir
    // lib/auth.ts, qui bloque toute connexion tant que l'email n'est pas
    // confirmé).
    setRegisteredEmail(email);
  }

  async function handleResend() {
    if (!registeredEmail || resending) return;
    setResending(true);
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: registeredEmail }),
    });
    setResending(false);
    setResent(true);
  }

  if (registeredEmail) {
    return (
      <div className="w-full text-center">
        <MailCheck size={40} className="mx-auto mb-4 text-accent" />
        <h1 className="mb-2 text-xl font-display">Vérifie ta boîte mail</h1>
        <p className="mb-6 text-sm text-ink-muted">
          Un email de confirmation a été envoyé à <strong>{registeredEmail}</strong>. Clique sur le lien qu&apos;il
          contient pour activer ton compte et pouvoir te connecter.
        </p>
        <button
          onClick={handleResend}
          disabled={resending || resent}
          className="text-sm font-medium text-accent hover:underline disabled:opacity-60"
        >
          {resent ? "Email renvoyé !" : resending ? "Envoi..." : "Je n'ai rien reçu — renvoyer l'email"}
        </button>
        <p className="mt-6 text-sm text-ink-muted">
          <Link href="/connexion" className="text-accent hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-display mb-1">Créer un compte</h1>
      <p className="text-sm text-ink-muted mb-6">Rejoins la communauté et soutiens tes artistes.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Nom"
          type="text"
          required
          icon={User}
          placeholder="Ton nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <FormField
          label="Email"
          type="email"
          required
          icon={Mail}
          placeholder="Exemple@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          label="Mot de passe"
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          icon={Lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="text-ink-muted hover:text-ink"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        {error && <p className="text-sm text-accent">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? "Création..." : "Créer mon compte"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-ink-muted">ou</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        onClick={() => signIn("google", { callbackUrl: "/" })}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:border-accent"
      >
        <GoogleIcon size={18} />
        Continuer avec Google
      </button>

      <p className="text-sm text-ink-muted mt-6 text-center">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="text-accent hover:underline">
          Connecte-toi
        </Link>
      </p>
    </div>
  );
}
