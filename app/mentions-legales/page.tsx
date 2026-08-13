"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Landmark,
  Copyright,
  Users,
  Lock,
  Cookie,
  Link2,
  ShieldAlert,
  Gavel,
  Mail,
  Download,
  MessageCircle,
  CalendarDays,
  ShieldCheck,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { useSiteConfig } from "@/context/SiteConfigProvider";

type Section = {
  id: string;
  label: string;
  icon: LucideIcon;
  title: string;
  render: (ctx: {
    siteName: string;
    supportEmail: string;
    legalEntityName: string;
    legalCapital: string;
    legalRcsCity: string;
    legalRcsNumber: string;
    legalAddress: string;
    legalWebsite: string;
  }) => React.ReactNode;
};

const sections: Section[] = [
  {
    id: "editeur",
    label: "Éditeur",
    icon: Landmark,
    title: "1. Éditeur",
    render: ({ siteName, legalEntityName, legalCapital, legalRcsCity, legalRcsNumber, legalAddress, supportEmail, legalWebsite }) => (
      <>
        <p>
          {siteName} est édité et exploité par {legalEntityName}, société par actions simplifiée
          au capital de {legalCapital}, immatriculée au RCS de {legalRcsCity} sous le numéro{" "}
          {legalRcsNumber}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-border bg-base px-3 py-1.5 text-xs text-ink-muted">
            Adresse : <span className="text-ink">{legalAddress}</span>
          </span>
          <span className="rounded-full border border-border bg-base px-3 py-1.5 text-xs text-ink-muted">
            Email : <span className="text-ink">{supportEmail}</span>
          </span>
          <span className="rounded-full border border-border bg-base px-3 py-1.5 text-xs text-ink-muted">
            Site web : <span className="text-ink">{legalWebsite}</span>
          </span>
        </div>
      </>
    ),
  },
  {
    id: "propriete-intellectuelle",
    label: "Propriété intellectuelle",
    icon: Copyright,
    title: "2. Propriété intellectuelle",
    render: ({ siteName }) => (
      <p>
        L&apos;ensemble des sons, pochettes, textes et éléments visuels disponibles sur {siteName}{" "}
        sont la propriété de leurs auteurs et artistes respectifs, ou sont utilisés avec leur
        autorisation. Toute reproduction ou diffusion non autorisée est interdite.
      </p>
    ),
  },
  {
    id: "contenu-utilisateurs",
    label: "Contenu des utilisateurs",
    icon: Users,
    title: "3. Contenu des utilisateurs",
    render: ({ siteName }) => (
      <p>
        Les artistes qui publient des sons sur {siteName} garantissent détenir les droits
        nécessaires à leur diffusion. La plateforme se réserve le droit de retirer tout contenu
        signalé comme contrevenant aux droits d&apos;un tiers.
      </p>
    ),
  },
  {
    id: "donnees-personnelles",
    label: "Données personnelles",
    icon: Lock,
    title: "4. Données personnelles",
    render: () => (
      <p>
        Les données de compte (nom, email) sont utilisées uniquement pour le fonctionnement du
        service (authentification, notifications, facturation). Aucune donnée n&apos;est revendue
        à des tiers.
      </p>
    ),
  },
  {
    id: "cookies",
    label: "Cookies",
    icon: Cookie,
    title: "5. Cookies",
    render: ({ siteName }) => (
      <p>
        {siteName} utilise des cookies pour améliorer l&apos;expérience utilisateur, mesurer
        l&apos;audience et personnaliser les contenus. Vous pouvez gérer vos préférences dans les
        paramètres de votre navigateur.
      </p>
    ),
  },
  {
    id: "liens-externes",
    label: "Liens externes",
    icon: Link2,
    title: "6. Liens externes",
    render: ({ siteName }) => (
      <p>
        Le service peut contenir des liens vers des sites tiers. {siteName} n&apos;exerce aucun
        contrôle sur ces sites et décline toute responsabilité quant à leur contenu, leur
        disponibilité ou leurs pratiques en matière de confidentialité.
      </p>
    ),
  },
  {
    id: "responsabilite",
    label: "Responsabilité",
    icon: ShieldAlert,
    title: "7. Responsabilité",
    render: ({ siteName }) => (
      <p>
        {siteName} met tout en œuvre pour assurer un accès continu et sécurisé au service, mais ne
        saurait être tenu responsable des interruptions, coupures réseau, ou pertes de données
        indépendantes de sa volonté.
      </p>
    ),
  },
  {
    id: "droit-applicable",
    label: "Droit applicable",
    icon: Gavel,
    title: "8. Droit applicable",
    render: ({ legalRcsCity }) => (
      <p>
        Les présentes mentions légales sont soumises au droit malgache. Tout litige relatif à
        l&apos;utilisation du service relève de la compétence exclusive des tribunaux de{" "}
        {legalRcsCity}, sauf disposition légale contraire.
      </p>
    ),
  },
  {
    id: "contact",
    label: "Contact",
    icon: Mail,
    title: "9. Contact",
    render: ({ supportEmail }) => (
      <>
        <p className="mb-4">
          Pour toute question relative à ces mentions légales, tu peux nous écrire directement à{" "}
          {supportEmail} ou via notre page de contact.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          Ouvrir la page contact <ArrowRight size={14} />
        </Link>
      </>
    ),
  },
];

export default function LegalPage() {
  const siteConfig = useSiteConfig();
  const [activeId, setActiveId] = useState(sections[0].id);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const ctx = useMemo(
    () => ({
      siteName: siteConfig.siteName,
      supportEmail: siteConfig.supportEmail || "contact@moziik.app",
      legalEntityName: siteConfig.legalEntityName || `${siteConfig.siteName} SAS`,
      legalCapital: siteConfig.legalCapital || "10 000€",
      legalRcsCity: siteConfig.legalRcsCity || "Antananarivo",
      legalRcsNumber: siteConfig.legalRcsNumber || "123 456 789",
      legalAddress: siteConfig.legalAddress || "Antananarivo, Madagascar",
      legalWebsite: siteConfig.legalWebsite || "www.moziik.com",
    }),
    [siteConfig]
  );

  const lastUpdatedLabel = useMemo(() => {
    if (!siteConfig.legalUpdatedAt) return null;
    const date = new Date(siteConfig.legalUpdatedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }, [siteConfig.legalUpdatedAt]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function scrollToSection(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="px-6 py-8 md:px-10 md:py-10 max-w-6xl">
      {/* Fil d'Ariane */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-ink-muted print:hidden">
        <Link href="/" className="hover:text-ink">
          Accueil
        </Link>
        <ChevronRight size={14} />
        <span className="text-ink">Mentions légales</span>
      </nav>

      {/* En-tête */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between"
      >
        <div>
          <h1 className="text-2xl font-display font-bold md:text-3xl">Mentions légales</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            Informations légales concernant l&apos;éditeur du site, l&apos;utilisation du service
            et la protection de vos données.
          </p>
          {lastUpdatedLabel && (
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-muted print:hidden">
              <CalendarDays size={13} /> Dernière mise à jour : {lastUpdatedLabel}
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink-muted"
          >
            <Download size={15} /> Exporter en PDF
          </button>
          <Link
            href="/contact"
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
          >
            <MessageCircle size={15} /> Nous contacter
          </Link>
        </div>
      </motion.div>

      {/* Sommaire mobile / tablette : pastilles horizontales */}
      <div className="mb-6 -mx-6 flex gap-2 overflow-x-auto px-6 pb-1 lg:hidden print:hidden">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeId === section.id;
          return (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-surface text-ink-muted hover:text-ink"
              }`}
            >
              <Icon size={13} /> {section.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr] lg:gap-10">
        {/* Sommaire latéral sticky (desktop) */}
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:block print:hidden"
        >
          <div className="sticky top-6 space-y-1">
            <nav className="space-y-1 rounded-xl2 border border-border bg-surface p-2">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeId === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-accent/10 text-accent"
                        : "text-ink-muted hover:bg-base hover:text-ink"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon size={16} className="shrink-0" />
                      {section.label}
                    </span>
                    <ChevronRight
                      size={14}
                      className={`shrink-0 transition-transform ${isActive ? "translate-x-0.5" : ""}`}
                    />
                  </button>
                );
              })}
            </nav>

            <div className="mt-4 rounded-xl2 border border-border bg-gradient-to-b from-accent/10 to-transparent p-5">
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
                <ShieldCheck size={20} />
              </div>
              <p className="mb-1.5 text-sm font-semibold text-ink">Votre confiance est notre priorité</p>
              <p className="mb-4 text-xs leading-relaxed text-ink-muted">
                {ctx.siteName} s&apos;engage à protéger vos données et à respecter vos droits.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
              >
                En savoir plus <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </motion.aside>

        {/* Contenu */}
        <div className="space-y-5">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.id}
                id={section.id}
                ref={(el) => {
                  sectionRefs.current[section.id] = el;
                }}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
                className="scroll-mt-24 rounded-xl2 border border-border bg-surface p-6 md:p-7"
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="mb-2 text-base font-semibold text-ink md:text-lg">{section.title}</h2>
                    <div className="space-y-3 text-sm leading-relaxed text-ink-muted">
                      {section.render(ctx)}
                    </div>
                  </div>
                  <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-xs text-ink-muted sm:grid">
                    {index + 1}
                  </span>
                </div>
              </motion.div>
            );
          })}

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="pt-2 text-center text-xs text-ink-muted"
          >
            {siteConfig.copyrightText || `© ${new Date().getFullYear()} ${siteConfig.siteName}. Tous droits réservés.`}
          </motion.p>
        </div>
      </div>
    </div>
  );
}
