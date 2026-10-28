"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserCog } from "lucide-react";
import { AdminHeaderSlot } from "@/components/admin/AdminChrome";
import { ATraiterProvider, useATraiter } from "@/components/admin/ATraiter";
import { SECTIONS_ADMIN, correspond, pageOuverte } from "@/components/admin/navigationAdmin";

/** Un nombre d'éléments en attente, à côté d'une entrée de navigation. */
function Compteur({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="min-w-[18px] rounded bg-accent/10 px-1 text-center text-[11px] font-semibold tabular-nums leading-[18px] text-accent">
      {n > 999 ? "999+" : n}
    </span>
  );
}

function Navigation() {
  const chemin = usePathname();
  const compteurs = useATraiter();
  const { section: ouverte, page } = pageOuverte(chemin);

  return (
    <>
      <header className="mb-8">
        {/* Les sections : cinq entrées, chacune mène à sa première page. */}
        <div className="flex items-center justify-between gap-4 border-b border-border">
          <nav aria-label="Sections de l'administration" className="-mb-px -ml-3 flex min-w-0 overflow-x-auto">
            {SECTIONS_ADMIN.map((section) => {
              const active = section === ouverte;
              const enAttente = section.pages.reduce((n, p) => n + (compteurs[p.href] ?? 0), 0);
              const Icone = section.icon;
              return (
                <Link
                  key={section.label}
                  href={section.pages[0].href}
                  aria-current={active ? "true" : undefined}
                  className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors ${
                    active ? "text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Icone size={15} className={active ? "text-accent" : ""} />
                  {section.label}
                  <Compteur n={enAttente} />
                  <span
                    aria-hidden
                    className={`absolute bottom-0 left-3 right-3 h-0.5 transition-colors ${
                      active ? "bg-accent" : "bg-transparent"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>
          {/* Sortie de l'administration : on y arrive par le menu du compte, rien n'y ramenait. */}
          <Link
            href="/compte"
            className="flex shrink-0 items-center gap-1.5 py-3 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <UserCog size={14} />
            <span className="hidden sm:inline">Mon compte</span>
          </Link>
        </div>

        {/* Les pages de la section ouverte, et elles seules. */}
        {ouverte.pages.length > 1 && (
          <nav aria-label={`Pages de la section ${ouverte.label}`} className="-mx-1 flex overflow-x-auto py-2">
            {ouverte.pages.map((p) => {
              const active = correspond(p.href, chemin);
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                    active ? "bg-surface font-medium text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {p.label}
                  <Compteur n={compteurs[p.href] ?? 0} />
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {/* En-tête commun : la section en surtitre, le titre, et le réceptacle
          où chaque page dépose son action principale. */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div key={page.href} className="min-w-0 animate-fade-in-up">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">{ouverte.label}</p>
          <h1 className="mt-1 text-2xl font-display sm:text-3xl">{page.titre}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{page.description}</p>
        </div>
        <AdminHeaderSlot />
      </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ATraiterProvider>
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10">
        <Navigation />
        {children}
      </div>
    </ATraiterProvider>
  );
}
