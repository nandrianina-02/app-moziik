"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";

export function VerifyEmailForm() {
  const token = useSearchParams().get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Lien de vérification invalide.");
      return;
    }
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue.");
        setStatus("success");
        setMessage(data.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Une erreur est survenue.");
      });
  }, [token]);

  return (
    <div className="w-full text-center">
      {status === "loading" && (
        <>
          <div className="mb-4 flex justify-center">
            <EqualizerLoader />
          </div>
          <p className="text-sm text-ink-muted">Vérification de ton adresse email...</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle2 size={40} className="mx-auto mb-4 text-verified" />
          <h1 className="mb-2 text-xl font-display">Adresse confirmée !</h1>
          <p className="mb-6 text-sm text-ink-muted">{message}</p>
          <Link
            href="/connexion"
            className="inline-block rounded-xl bg-accent px-6 py-3 text-sm font-medium text-base hover:bg-accent-hover"
          >
            Se connecter
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle size={40} className="mx-auto mb-4 text-accent" />
          <h1 className="mb-2 text-xl font-display">Lien invalide</h1>
          <p className="mb-6 text-sm text-ink-muted">{message}</p>
          <Link href="/connexion" className="text-sm text-accent hover:underline">
            Retour à la connexion
          </Link>
        </>
      )}
    </div>
  );
}
