"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { FormField } from "@/components/ui/FormField";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="w-full">
        <h1 className="text-2xl font-display mb-2">Vérifie ta boîte mail</h1>
        <p className="text-sm text-ink-muted">
          Si un compte existe avec l&apos;adresse {email}, un lien de
          réinitialisation vient d&apos;être envoyé.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-display mb-1">Mot de passe oublié</h1>
      <p className="text-sm text-ink-muted mb-6">
        Indique ton email, on t&apos;envoie un lien de réinitialisation.
      </p>

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
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? "Envoi..." : "Envoyer le lien"}
        </button>
      </form>
    </div>
  );
}
