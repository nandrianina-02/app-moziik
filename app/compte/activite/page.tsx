"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  History,
  LifeBuoy,
  ListMusic,
  Loader2,
  LogIn,
  MessageSquare,
  Play,
  UploadCloud,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFuseauHoraire } from "@/context/SiteConfigProvider";
import {
  FILTRES_ACTIVITE,
  heureActivite,
  parJour,
  type EntreeActivite,
  type PageActivite,
  type TypeActivite,
} from "@/lib/activite";

/**
 * L'historique d'activité du compte.
 *
 * Un fil chronologique, groupé par jour, filtrable par nature. Il relit ce
 * que la plateforme enregistre déjà — il n'y a pas de journal séparé, et
 * c'est pour cela qu'il remonte jusqu'à l'ouverture du compte plutôt que
 * de commencer aujourd'hui (voir lib/activite.ts).
 *
 * La pagination suit un curseur de date, pas un numéro de page : le fil
 * mêle huit sources, et une écoute qui s'ajoute pendant la lecture
 * décalerait toute numérotation.
 */

const ICONES: Record<TypeActivite, typeof Play> = {
  ecoute: Play,
  commentaire: MessageSquare,
  playlist: ListMusic,
  publication: UploadCloud,
  evenement: CalendarDays,
  abonnement: CreditCard,
  connexion: LogIn,
  support: LifeBuoy,
};

export default function ActivitePage() {
  const { status } = useSession();
  const fuseau = useFuseauHoraire();

  const [filtre, setFiltre] = useState<TypeActivite | "tout">("tout");
  const [entrees, setEntrees] = useState<EntreeActivite[]>([]);
  const [encore, setEncore] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [suite, setSuite] = useState(false);
  const [echec, setEchec] = useState(false);

  // Numérote les requêtes : changer deux fois de filtre rapidement ne doit
  // pas laisser la réponse la plus lente écraser la plus récente.
  const requete = useRef(0);

  const charger = useCallback(
    async (type: TypeActivite | "tout", avant?: string) => {
      const numero = ++requete.current;
      if (avant) setSuite(true);
      else setChargement(true);
      setEchec(false);
      try {
        const params = new URLSearchParams();
        if (type !== "tout") params.set("type", type);
        if (avant) params.set("avant", avant);
        const res = await fetch(`/api/me/activite?${params}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as PageActivite;
        if (numero !== requete.current) return;
        setEntrees((prev) => (avant ? [...prev, ...data.entrees] : data.entrees));
        setEncore(data.encore);
      } catch {
        if (numero === requete.current) setEchec(true);
      } finally {
        if (numero === requete.current) {
          setChargement(false);
          setSuite(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (status !== "authenticated") {
      setChargement(false);
      return;
    }
    void charger(filtre);
  }, [status, filtre, charger]);

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
        <Skeleton className="h-9 w-48 rounded-xl" />
        <Skeleton className="mt-6 h-10 w-full rounded-full" />
        <Skeleton className="mt-4 h-64 w-full rounded-xl2" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="animate-fade-in-up mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
        <h1 className="text-2xl font-display">Historique d&apos;activité</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Connectez-vous pour consulter votre historique.{" "}
          <Link href="/connexion" className="text-accent hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    );
  }

  const groupes = parJour(entrees, fuseau);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
      <div className="animate-fade-in-up">
        <Link
          href="/compte"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} /> Mon compte
        </Link>

        <h1 className="flex items-center gap-2 text-2xl font-display sm:text-3xl">
          <History size={22} className="text-accent" /> Historique d&apos;activité
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Ce que votre compte a fait sur Moziik, du plus récent au plus ancien.
        </p>
      </div>

      {/* Filtres : une seule ligne qui défile sur téléphone, comme les
          autres barres de filtres du site. */}
      <div
        role="tablist"
        aria-label="Filtrer par nature"
        className="animate-fade-in-up mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ animationDelay: "60ms" }}
      >
        {FILTRES_ACTIVITE.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filtre === f.id}
            onClick={() => setFiltre(f.id)}
            className={`pressable shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filtre === f.id
                ? "border-accent bg-accent text-base"
                : "border-border text-ink-muted hover:border-accent hover:text-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {chargement ? (
          <ul className="space-y-3" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3 rounded" />
                  <Skeleton className="h-3 w-1/3 rounded" />
                </div>
              </li>
            ))}
          </ul>
        ) : echec ? (
          <div className="animate-fade-in rounded-xl2 border border-border bg-surface p-8 text-center">
            <p className="text-sm text-ink">Votre historique n&apos;a pas pu être chargé.</p>
            <button
              type="button"
              onClick={() => void charger(filtre)}
              className="pressable mt-4 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
            >
              Réessayer
            </button>
          </div>
        ) : entrees.length === 0 ? (
          <div className="animate-fade-in rounded-xl2 border border-dashed border-border p-10 text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
              <History size={22} />
            </span>
            <p className="text-sm text-ink">
              {filtre === "tout"
                ? "Aucune activité enregistrée pour l'instant."
                : "Rien de ce type dans votre historique."}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
              Écoutez un titre, créez une playlist ou laissez un commentaire : tout apparaîtra
              ici.
            </p>
          </div>
        ) : (
          <>
            {groupes.map((groupe, iGroupe) => (
              <section key={groupe.jour} className={iGroupe > 0 ? "mt-7" : ""}>
                {/* Collant : en remontant un long fil, on garde sous les
                    yeux le jour qu'on est en train de lire. */}
                <h2 className="sticky top-14 z-10 -mx-1 bg-base/95 px-1 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted backdrop-blur md:top-0">
                  {groupe.jour}
                </h2>
                <ul className="stagger space-y-1">
                  {groupe.entrees.map((entree) => (
                    <li key={`${entree.type}-${entree._id}`}>
                      <Entree entree={entree} fuseau={fuseau} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {encore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => void charger(filtre, entrees[entrees.length - 1]?.at)}
                  disabled={suite}
                  className="pressable flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  {suite && <Loader2 size={14} className="animate-spin" />}
                  Voir plus ancien
                </button>
              </div>
            )}

            {!encore && entrees.length > 0 && (
              <p className="mt-6 text-center text-xs text-ink-muted">
                Vous êtes arrivé au début de votre historique.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Entree({ entree, fuseau }: { entree: EntreeActivite; fuseau?: string }) {
  const Icone = ICONES[entree.type];

  const contenu = (
    <>
      {/* La pochette quand il y en a une, l'icône de la nature sinon : une
          ligne sans vignette casserait l'alignement de tout le fil. */}
      {entree.coverUrl ? (
        <span className="relative shrink-0">
          <SafeImage
            src={entree.coverUrl}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 rounded-xl object-cover"
          />
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-surface text-accent ring-2 ring-base">
            <Icone size={11} />
          </span>
        </span>
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <Icone size={18} />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">{entree.titre}</span>
        {entree.detail && (
          <span className="block truncate text-xs text-ink-muted">{entree.detail}</span>
        )}
      </span>

      <span className="shrink-0 text-xs tabular-nums text-ink-muted">
        {heureActivite(entree.at, fuseau)}
      </span>
    </>
  );

  if (!entree.href) {
    return <div className="flex items-center gap-3 rounded-xl px-2 py-2">{contenu}</div>;
  }

  return (
    <Link
      href={entree.href}
      prefetch={false}
      className="pressable-ligne flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface"
    >
      {contenu}
    </Link>
  );
}
