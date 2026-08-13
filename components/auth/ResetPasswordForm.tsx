"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff } from "lucide-react";
import { FormField } from "@/components/ui/FormField";

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Une erreur est survenue.");
      return;
    }
    router.push("/connexion");
  }

  if (!token) {
    return (
      <p className="text-sm text-accent">
        Lien invalide. Redemande une réinitialisation.
      </p>
    );
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-display mb-1">Nouveau mot de passe</h1>
      <p className="text-sm text-ink-muted mb-6">Choisis un mot de passe d&apos;au moins 8 caractères.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Nouveau mot de passe"
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
          {loading ? "Mise à jour..." : "Réinitialiser"}
        </button>
      </form>
    </div>
  );
}
