"use client";

import { Check, Flame, Gauge, Moon, SignalHigh } from "lucide-react";
import { ContextMenuShell } from "@/components/ui/ContextMenuShell";
import type { MenuAnchor } from "@/components/ui/useClampedMenuPosition";
import { NIVEAUX_BASS } from "@/components/player/constants/bassBoost";
import { usePlayer, VITESSES } from "@/context/PlayerProvider";
import type { AudioQuality } from "@/lib/offlineSettings";
import Link from "next/link";
import { useAcces } from "@/context/AccesProvider";
import { qualiteMaximale } from "@/lib/acces";

/**
 * Réglages audio du lecteur, en menus ancrés : Bass Boost, vitesse,
 * qualité, minuteur de veille.
 *
 * Chacun s'appuie sur ContextMenuShell, qui gère déjà le recadrage à
 * l'écran, la fermeture au clic extérieur et à Échap — un lecteur collé
 * en bas de fenêtre ouvre sinon ses menus hors du cadre visible.
 */

function EnTete({ icon: Icon, titre }: { icon: typeof Flame; titre: string }) {
  return (
    <p className="flex items-center gap-1.5 px-4 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
      <Icon size={11} className="text-accent" /> {titre}
    </p>
  );
}

function Option({
  actif,
  onClick,
  titre,
  detail,
  verrouille,
}: {
  actif: boolean;
  onClick: () => void;
  titre: string;
  detail?: string;
  /** Réservé à l'abonnement : montré, mais inatteignable. */
  verrouille?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      role="menuitemradio"
      aria-checked={actif}
      disabled={verrouille}
      className={`flex w-full items-start gap-2.5 px-4 py-2 text-left transition-colors hover:bg-base disabled:cursor-not-allowed disabled:opacity-50 ${
        actif ? "text-accent" : "text-ink"
      }`}
    >
      <span className="mt-0.5 w-3.5 shrink-0">{actif && <Check size={14} />}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{titre}</span>
        {detail && <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">{detail}</span>}
      </span>
    </button>
  );
}

export function BassBoostMenu({ anchor, onClose }: { anchor: MenuAnchor; onClose: () => void }) {
  const { bassBoost, setBassBoost } = usePlayer();
  return (
    <ContextMenuShell anchor={anchor} onClose={onClose} width={276}>
      <EnTete icon={Flame} titre="Bass Boost" />
      {NIVEAUX_BASS.map((niveau) => (
        <Option
          key={niveau.id}
          actif={bassBoost === niveau.id}
          titre={niveau.label}
          detail={niveau.description}
          onClick={() => {
            setBassBoost(niveau.id);
            onClose();
          }}
        />
      ))}
      <p className="border-t border-border px-4 pb-1.5 pt-2 text-[10px] leading-snug text-ink-muted">
        Traitement Web Audio réel&nbsp;: le grave est renforcé et le bas médium
        dégagé, sans monter le volume général.
      </p>
    </ContextMenuShell>
  );
}

export function SpeedMenu({ anchor, onClose }: { anchor: MenuAnchor; onClose: () => void }) {
  const { playbackRate, setPlaybackRate } = usePlayer();
  return (
    <ContextMenuShell anchor={anchor} onClose={onClose} width={200}>
      <EnTete icon={Gauge} titre="Vitesse de lecture" />
      {VITESSES.map((v) => (
        <Option
          key={v}
          actif={playbackRate === v}
          titre={v === 1 ? "Normale (1×)" : `${v}×`}
          onClick={() => {
            setPlaybackRate(v);
            onClose();
          }}
        />
      ))}
    </ContextMenuShell>
  );
}

const QUALITES: { id: AudioQuality; titre: string; detail: string }[] = [
  { id: "low", titre: "Économe", detail: "64 kb/s — pour les forfaits limités." },
  { id: "medium", titre: "Standard", detail: "128 kb/s — bon compromis en mobilité." },
  { id: "high", titre: "Haute", detail: "320 kb/s — qualité maximale." },
];

export function QualityMenu({ anchor, onClose }: { anchor: MenuAnchor; onClose: () => void }) {
  const { audioQuality, setAudioQuality } = usePlayer();
  const acces = useAcces();

  // Le plafond est le même que celui appliqué à l'URL réellement lue : le
  // menu ne promet rien que le lecteur ne servirait pas.
  const plafond = qualiteMaximale(acces);
  const rang = { low: 0, medium: 1, high: 2 };

  return (
    <ContextMenuShell anchor={anchor} onClose={onClose} width={264}>
      <EnTete icon={SignalHigh} titre="Qualité audio" />
      {QUALITES.map((q) => {
        const verrouille = rang[q.id] > rang[plafond];
        return (
          <Option
            key={q.id}
            actif={audioQuality === q.id && !verrouille}
            titre={verrouille ? `${q.titre} — Premium` : q.titre}
            detail={q.detail}
            verrouille={verrouille}
            onClick={() => {
              setAudioQuality(q.id);
              onClose();
            }}
          />
        );
      })}

      {plafond !== "high" && (
        <Link
          href="/abonnement"
          onClick={onClose}
          className="block border-t border-border px-4 py-2 text-xs font-medium text-accent hover:bg-base"
        >
          Passer en Premium pour le 320 kb/s
        </Link>
      )}

      <p className="border-t border-border px-4 pb-1.5 pt-2 text-[10px] leading-snug text-ink-muted">
        S&apos;applique à l&apos;écoute en ligne et aux prochains téléchargements.
        Hors-ligne, les morceaux déjà enregistrés gardent leur qualité d&apos;origine.
      </p>
    </ContextMenuShell>
  );
}

const DUREES = [5, 10, 15, 30, 45, 60] as const;

export function SleepMenu({ anchor, onClose }: { anchor: MenuAnchor; onClose: () => void }) {
  const { sleepRemainingMs, sleepAfterTrack, setSleepTimer } = usePlayer();
  const actif = sleepRemainingMs !== null || sleepAfterTrack;

  return (
    <ContextMenuShell anchor={anchor} onClose={onClose} width={232}>
      <EnTete icon={Moon} titre="Minuteur de veille" />
      {actif && (
        <Option
          actif={false}
          titre="Désactiver"
          detail={
            sleepAfterTrack
              ? "Arrêt prévu à la fin du morceau."
              : `Arrêt dans ${Math.ceil((sleepRemainingMs ?? 0) / 60000)} min.`
          }
          onClick={() => {
            setSleepTimer(null);
            onClose();
          }}
        />
      )}
      {DUREES.map((d) => (
        <Option
          key={d}
          actif={!sleepAfterTrack && sleepRemainingMs !== null && Math.ceil(sleepRemainingMs / 60000) === d}
          titre={`${d} minutes`}
          onClick={() => {
            setSleepTimer(d);
            onClose();
          }}
        />
      ))}
      <Option
        actif={sleepAfterTrack}
        titre="À la fin du morceau"
        onClick={() => {
          setSleepTimer("track");
          onClose();
        }}
      />
    </ContextMenuShell>
  );
}
