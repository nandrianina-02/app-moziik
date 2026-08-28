"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { useToast } from "@/context/ToastProvider";
import { ouvrirConnexionGoogle } from "@/lib/native/authGoogle";

export function LoginForm() {
  const router = useRouter();
  const pushToast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Vrai quand cette page est affichée dans l'onglet Chrome ouvert par
  // l'app Android (lib/native/authGoogle.ts). Lu après le montage plutôt
  // qu'avec useSearchParams : ce dernier imposerait une frontière Suspense
  // à toute la page, alors qu'on n'a besoin de l'info qu'ici.
  const [relaisAndroid, setRelaisAndroid] = useState(false);
  const [redirectionGoogle, setRedirectionGoogle] = useState(false);

  useEffect(() => {
    setRelaisAndroid(new URLSearchParams(window.location.search).get("relais") === "android");
  }, []);

  useEffect(() => {
    if (!relaisAndroid) return;
    // L'auditeur a déjà appuyé sur « Continuer avec Google » dans l'app :
    // lui réafficher le même bouton dans un onglet de navigateur serait
    // incompréhensible. On enchaîne directement sur Google.
    setRedirectionGoogle(true);
    void signIn("google", { callbackUrl: "/api/mobile-auth/relais" });
  }, [relaisAndroid]);

  /**
   * Dans l'app Android, sort vers un onglet Chrome — Google refuse OAuth
   * dans une WebView. Partout ailleurs, flux NextAuth habituel.
   */
  function connexionGoogle() {
    if (ouvrirConnexionGoogle()) return;
    signIn("google", { callbackUrl: "/" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUnverified(false);
    setResent(false);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      if (result.error === "EMAIL_NOT_VERIFIED") {
        setUnverified(true);
        setError("Ton adresse email n'est pas encore confirmée.");
      } else if (result.error === "Ce compte a été suspendu.") {
        setError(result.error);
      } else {
        // Regroupe "aucun compte" et "mot de passe incorrect" sous un seul
        // message générique, pour ne pas révéler quels emails existent.
        setError("Email ou mot de passe incorrect.");
      }
      return;
    }
    pushToast("success", "Connecté avec succès.");
    router.push("/");
    router.refresh();
  }

  async function handleResend() {
    if (resending) return;
    setResending(true);
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResending(false);
    setResent(true);
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-display mb-1">Bienvenue !</h1>
      <p className="text-sm text-ink-muted mb-6">Connecte-toi à ton compte</p>

      <form onSubmit={handleSubmit} className="space-y-4">
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
        {unverified && (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resent}
            className="text-xs font-medium text-accent hover:underline disabled:opacity-60"
          >
            {resent ? "Email de confirmation renvoyé !" : resending ? "Envoi..." : "Renvoyer l'email de confirmation"}
          </button>
        )}

        <div className="flex justify-end">
          <Link href="/mot-de-passe-oublie" className="text-xs text-accent hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-ink-muted">ou</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        onClick={connexionGoogle}
        disabled={redirectionGoogle}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:border-accent disabled:opacity-60"
      >
        <GoogleIcon size={18} />
        {redirectionGoogle ? "Redirection vers Google..." : "Continuer avec Google"}
      </button>

      <p className="text-sm text-ink-muted mt-6 text-center">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-accent hover:underline">
          Inscris-toi
        </Link>
      </p>
    </div>
  );
}
