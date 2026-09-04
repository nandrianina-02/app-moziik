"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Download,
  Smartphone,
  ShieldCheck,
  CircleAlert,
  Share,
  Plus,
  Check,
  Apple,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useSiteConfig } from "@/context/SiteConfigProvider";
import { usePWA } from "@/hooks/usePWA";

/**
 * Installer Moziik sur son téléphone.
 *
 * DEUX CHEMINS, ET LE PREMIER N'EST PAS TOUJOURS DISPONIBLE
 *
 * L'application Android se télécharge directement depuis le site, faute
 * d'accès au Play Store. Quand aucune version n'est publiée, cette page
 * ne montre pas un bouton grisé : elle le dit, et met en avant
 * l'installation depuis le navigateur — qui, elle, fonctionne tout de
 * suite, sur Android comme sur iPhone.
 *
 * LES AVERTISSEMENTS NE SONT PAS DE LA PRÉCAUTION JURIDIQUE
 *
 * Android refuse d'installer une application venue d'ailleurs que du
 * Play Store tant que la personne n'a pas autorisé la source. Ne pas
 * l'expliquer, c'est envoyer chacun buter sur un refus du système sans
 * comprendre — et conclure que le fichier est cassé.
 */
export function PageTelechargement() {
  const config = useSiteConfig();
  const { canInstall, promptInstall } = usePWA();
  const [systeme, setSysteme] = useState<"android" | "ios" | "autre">("autre");
  const [installee, setInstallee] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) setSysteme("android");
    else if (/iPad|iPhone|iPod/.test(ua)) setSysteme("ios");
    // `display-mode: standalone` : la page tourne déjà dans l'application
    // installée. Proposer de l'installer une seconde fois n'aurait pas de
    // sens.
    setInstallee(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  const apk = config.androidApkUrl?.trim();
  const version = config.androidVersion?.trim();
  const poids = config.androidSizeMB ?? 0;
  const publieLe = config.androidPublishedAt
    ? new Date(config.androidPublishedAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="flex flex-col items-center gap-4 text-center">
        <SafeImage
          src={config.logoUrl}
          alt=""
          width={88}
          height={88}
          className="h-22 w-22 rounded-2xl object-cover"
        />
        <div>
          <h1 className="font-display text-2xl md:text-3xl">Installer {config.siteName}</h1>
          <p className="mt-2 max-w-md text-sm text-ink-muted">
            La musique malgache sur votre téléphone : lecture en arrière-plan, écoute hors
            connexion, notification média.
          </p>
        </div>
      </header>

      {installee && (
        <p className="mt-8 flex items-center justify-center gap-2 rounded-xl2 border border-verified/40 bg-verified/10 px-4 py-3 text-sm">
          <Check size={16} className="text-verified" />
          {config.siteName} est déjà installé sur cet appareil.
        </p>
      )}

      {/* --- Android : le fichier direct */}
      <section className="mt-8 rounded-xl2 border border-border bg-surface p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Smartphone size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold">Application Android</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {apk
                ? "Téléchargement direct depuis ce site."
                : "Pas encore disponible au téléchargement."}
            </p>
          </div>
        </div>

        {apk ? (
          <>
            <a
              href="/api/telechargement/android"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-base transition-colors hover:bg-accent-hover"
            >
              <Download size={17} />
              Télécharger l&apos;application
            </a>

            <p className="mt-2 text-center text-xs text-ink-muted">
              {[version && `Version ${version}`, poids > 0 && `${poids} Mo`, publieLe]
                .filter(Boolean)
                .join(" · ")}
            </p>

            {config.androidNotes?.trim() && (
              <p className="mt-3 whitespace-pre-line rounded-xl bg-base px-3 py-2.5 text-xs text-ink-muted">
                {config.androidNotes}
              </p>
            )}

            <div className="mt-5 rounded-xl border border-warning/40 bg-warning/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <CircleAlert size={15} className="shrink-0 text-warning" />
                Android va demander une autorisation
              </p>
              <p className="mt-1.5 text-xs text-ink-muted">
                Une application qui ne vient pas du Play Store est bloquée par défaut. Ce
                n&apos;est pas un problème avec le fichier : c&apos;est le comportement normal
                du système.
              </p>
              <ol className="mt-3 space-y-1.5 text-xs text-ink-muted">
                {[
                  "Ouvrez le fichier téléchargé.",
                  "Android affiche « Installation bloquée ». Touchez « Paramètres ».",
                  "Autorisez votre navigateur à installer des applications.",
                  "Revenez en arrière, puis touchez « Installer ».",
                ].map((etape, i) => (
                  <li key={etape} className="flex gap-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-warning/20 text-[10px] font-semibold text-warning">
                      {i + 1}
                    </span>
                    {etape}
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-4 flex items-start gap-2 text-xs text-ink-muted">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-verified" />
              Ne téléchargez {config.siteName} que depuis cette page. Un fichier reçu par
              message ou trouvé ailleurs peut avoir été modifié.
            </p>
          </>
        ) : (
          <p className="mt-4 rounded-xl bg-base px-4 py-3 text-sm text-ink-muted">
            L&apos;application n&apos;est pas encore publiée. En attendant, l&apos;installation
            depuis le navigateur ci-dessous donne le même résultat pour l&apos;essentiel :
            l&apos;icône sur l&apos;écran d&apos;accueil, le plein écran et l&apos;écoute hors
            connexion.
          </p>
        )}
      </section>

      {/* --- Le navigateur, qui marche partout et tout de suite */}
      <section className="mt-5 rounded-xl2 border border-border bg-surface p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint-blue/10 text-tint-blue">
            {systeme === "ios" ? <Apple size={20} /> : <Plus size={20} />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold">
              Depuis le navigateur {systeme === "ios" ? "(iPhone, iPad)" : ""}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              Sans téléchargement ni autorisation. C&apos;est la seule voie sur iPhone.
            </p>
          </div>
        </div>

        {canInstall && !installee ? (
          <button
            type="button"
            onClick={promptInstall}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-accent px-5 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/10"
          >
            <Plus size={17} /> Ajouter à l&apos;écran d&apos;accueil
          </button>
        ) : (
          <ol className="mt-4 space-y-2 text-sm text-ink-muted">
            {(systeme === "ios"
              ? [
                  <>
                    Touchez <Share size={13} className="inline" /> Partager, en bas de Safari.
                  </>,
                  <>Choisissez « Sur l&apos;écran d&apos;accueil ».</>,
                  <>Confirmez avec « Ajouter ».</>,
                ]
              : [
                  <>Ouvrez le menu de votre navigateur (⋮).</>,
                  <>Choisissez « Installer l&apos;application » ou « Ajouter à l&apos;écran d&apos;accueil ».</>,
                  <>Confirmez.</>,
                ]
            ).map((etape, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-base text-[11px] font-semibold">
                  {i + 1}
                </span>
                <span>{etape}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">Ce que l&apos;installation apporte</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            "La musique continue quand l'écran s'éteint.",
            "Les commandes sur l'écran de verrouillage.",
            "L'écoute hors connexion des titres téléchargés.",
            "Le plein écran, sans barre de navigateur.",
          ].map((ligne) => (
            <li
              key={ligne}
              className="flex items-start gap-2 rounded-xl border border-border px-3 py-2.5 text-sm"
            >
              <Check size={14} className="mt-0.5 shrink-0 text-verified" />
              {ligne}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-center text-xs text-ink-muted">
        Un problème à l&apos;installation ?{" "}
        <Link href="/contact" className="text-accent hover:underline">
          Écrivez-nous
        </Link>
        .
      </p>
    </div>
  );
}
