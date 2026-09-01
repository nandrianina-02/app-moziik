"use client";

import { useState } from "react";
import { Crown, Info } from "lucide-react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { useToast } from "@/context/ToastProvider";
import { useFormatDate } from "@/context/SiteConfigProvider";
import { readApiError } from "@/lib/readApiError";

/**
 * Offrir ou retirer l'accès Premium à un ensemble de comptes.
 *
 * Deux décisions à prendre, et rien d'autre : à qui, et pour combien de
 * temps. La phrase de résumé les redit en clair avant validation — une
 * action de masse qui touche « tous les résultats » mérite d'être relue
 * plutôt que devinée à partir de deux menus.
 */

type Cible = "selection" | "filtre";
type Duree = "illimite" | "30" | "90" | "180" | "365" | "date";

const DUREES: { value: Duree; label: string }[] = [
  { value: "illimite", label: "Illimité" },
  { value: "30", label: "1 mois" },
  { value: "90", label: "3 mois" },
  { value: "180", label: "6 mois" },
  { value: "365", label: "1 an" },
  { value: "date", label: "Jusqu'à une date" },
];

export type FiltresComptesUI = {
  role?: string;
  status?: string;
  verified?: string;
  search?: string;
};

function Segment({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
        actif ? "bg-accent text-base" : "border border-border text-ink-muted hover:border-accent hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function PremiumGrantModal({
  ids,
  totalFiltre,
  filtres,
  onClose,
  onDone,
}: {
  /** Les comptes cochés dans la table. */
  ids: string[];
  /** Combien de comptes le filtre courant retient en tout. */
  totalFiltre: number;
  filtres: FiltresComptesUI;
  onClose: () => void;
  onDone: () => void;
}) {
  const pushToast = useToast();
  const formatDate = useFormatDate();

  const [action, setAction] = useState<"offrir" | "retirer">("offrir");
  // Sans sélection, la seule cible possible est l'ensemble filtré.
  const [cible, setCible] = useState<Cible>(ids.length > 0 ? "selection" : "filtre");
  const [duree, setDuree] = useState<Duree>("illimite");
  const [dateFin, setDateFin] = useState("");
  const [enCours, setEnCours] = useState(false);

  const nombre = cible === "selection" ? ids.length : totalFiltre;

  function corpsDuree() {
    if (duree === "illimite") return { type: "illimite" as const };
    if (duree === "date") return { type: "jusqu_au" as const, date: dateFin };
    return { type: "jours" as const, jours: Number(duree) };
  }

  const resume =
    action === "retirer"
      ? `L'accès offert sera retiré à ${nombre} compte(s). Les abonnements payants ne sont pas touchés.`
      : duree === "illimite"
      ? `${nombre} compte(s) recevront l'accès Premium, sans date de fin.`
      : duree === "date"
      ? dateFin
        ? `${nombre} compte(s) recevront l'accès Premium jusqu'au ${formatDate(dateFin)}.`
        : `Choisis la date de fin.`
      : `${nombre} compte(s) recevront l'accès Premium pour ${DUREES.find((d) => d.value === duree)?.label.toLowerCase()}.`;

  const pretAEnvoyer = nombre > 0 && (action === "retirer" || duree !== "date" || Boolean(dateFin));

  async function envoyer() {
    setEnCours(true);
    try {
      const res = await fetch("/api/admin/users/premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "offrir" ? { duree: corpsDuree() } : {}),
          cible: cible === "selection" ? { type: "selection", ids } : { type: "filtre", filtres },
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "L'opération a échoué."));
      const data = await res.json();

      pushToast("success", data.message);
      if (data.ignores > 0) {
        pushToast(
          "info",
          `${data.ignores} compte(s) ignoré(s) : un abonnement payant est en cours.`
        );
      }
      onDone();
      onClose();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "L'opération a échoué.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <ModalSheet
      titre="Accès Premium"
      largeur="sm:max-w-lg"
      onClose={onClose}
      pied={
        <button
          type="button"
          onClick={envoyer}
          disabled={enCours || !pretAEnvoyer}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {enCours ? "En cours..." : action === "offrir" ? "Offrir l'accès" : "Retirer l'accès"}
        </button>
      }
    >
      <div className="space-y-5">
        <div>
          <span className="mb-2 block text-sm text-ink-muted">Action</span>
          <div className="flex flex-wrap gap-2">
            <Segment actif={action === "offrir"} onClick={() => setAction("offrir")}>
              Offrir Premium
            </Segment>
            <Segment actif={action === "retirer"} onClick={() => setAction("retirer")}>
              Retirer l&apos;accès offert
            </Segment>
          </div>
        </div>

        <div>
          <span className="mb-2 block text-sm text-ink-muted">Comptes concernés</span>
          <div className="flex flex-wrap gap-2">
            <Segment
              actif={cible === "selection"}
              onClick={() => ids.length > 0 && setCible("selection")}
            >
              La sélection ({ids.length})
            </Segment>
            <Segment actif={cible === "filtre"} onClick={() => setCible("filtre")}>
              Tous les résultats ({totalFiltre})
            </Segment>
          </div>
          {ids.length === 0 && (
            <p className="mt-2 text-xs text-ink-muted">
              Aucun compte coché : seule l&apos;option « tous les résultats » est disponible.
            </p>
          )}
        </div>

        {action === "offrir" && (
          <div>
            <span className="mb-2 block text-sm text-ink-muted">Durée</span>
            <div className="flex flex-wrap gap-2">
              {DUREES.map((option) => (
                <Segment key={option.value} actif={duree === option.value} onClick={() => setDuree(option.value)}>
                  {option.label}
                </Segment>
              ))}
            </div>

            {duree === "date" && (
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                aria-label="Date de fin de l'accès"
                className="mt-2.5 w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
              />
            )}
          </div>
        )}

        <p className="flex items-start gap-2.5 rounded-xl border border-border bg-base p-3.5 text-xs text-ink-muted">
          {action === "offrir" ? (
            <Crown size={14} className="mt-0.5 shrink-0 text-accent" />
          ) : (
            <Info size={14} className="mt-0.5 shrink-0" />
          )}
          {resume}
        </p>

        {action === "offrir" && (
          <p className="text-xs text-ink-muted">
            Un compte déjà abonné et payant n&apos;est pas modifié : son abonnement resterait
            introuvable pour la facturation si on l&apos;écrasait. Chaque bénéficiaire reçoit une
            notification.
          </p>
        )}
      </div>
    </ModalSheet>
  );
}
