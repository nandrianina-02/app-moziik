"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { SafeImage } from "@/components/ui/SafeImage";
import {
  ICONES_PARTAGE,
  LIBELLES_PARTAGE,
  TYPES_PARTAGE,
  type ContenuPartage,
  type TypePartage,
} from "@/lib/messagerie";

/**
 * Choisir un contenu à joindre à un message.
 *
 * LA RECHERCHE PORTE SUR TOUT, LES FILTRES NE FONT QUE RESTREINDRE
 *
 * Quelqu'un qui tape « Mandigny » ne sait pas s'il cherche l'album ou le
 * titre. Obliger à choisir la famille avant de chercher est le détour qui
 * fait renoncer au partage ; les onglets sont donc là pour affiner après
 * coup, pas pour ouvrir la porte.
 *
 * Sans recherche, la liste montre les nouveautés de chaque famille : un
 * sélecteur vide au premier affichage donne l'impression que rien n'est
 * partageable.
 */

const ATTENTE_MS = 300;

export function SelecteurContenu({
  onChoisir,
  onClose,
}: {
  onChoisir: (contenu: ContenuPartage) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [famille, setFamille] = useState<TypePartage | null>(null);
  const [resultats, setResultats] = useState<ContenuPartage[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Le compteur départage les réponses : une requête lente lancée avant
  // une rapide arriverait après elle et écraserait le bon résultat.
  const tour = useRef(0);

  useEffect(() => {
    const mien = ++tour.current;
    const minuteur = setTimeout(async () => {
      setChargement(true);
      setErreur(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (famille) params.set("type", famille);
        const res = await fetch(`/api/messagerie/partageables?${params}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { resultats: ContenuPartage[] };
        if (tour.current === mien) setResultats(data.resultats);
      } catch {
        if (tour.current === mien) setErreur("Impossible de charger les contenus.");
      } finally {
        if (tour.current === mien) setChargement(false);
      }
    }, q ? ATTENTE_MS : 0);

    return () => clearTimeout(minuteur);
  }, [q, famille]);

  const groupes = useMemo(() => {
    const parType = new Map<TypePartage, ContenuPartage[]>();
    for (const r of resultats) {
      const liste = parType.get(r.type);
      if (liste) liste.push(r);
      else parType.set(r.type, [r]);
    }
    return TYPES_PARTAGE.map((t) => [t, parType.get(t) ?? []] as const).filter(([, l]) => l.length > 0);
  }, [resultats]);

  return (
    <ModalSheet
      titre="Partager un contenu"
      sousTitre="Titres, albums, podcasts, playlists, artistes, évènements et radios."
      largeur="sm:max-w-2xl"
      onClose={onClose}
      entete={
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher dans tout le catalogue…"
              autoFocus
              className="w-full rounded-full border border-border bg-base py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-accent"
            />
          </div>

          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <Puce actif={famille === null} onClick={() => setFamille(null)}>
              Tout
            </Puce>
            {TYPES_PARTAGE.map((t) => {
              const Icone = ICONES_PARTAGE[t];
              return (
                <Puce key={t} actif={famille === t} onClick={() => setFamille(t)}>
                  <Icone size={12} />
                  {LIBELLES_PARTAGE[t]}
                </Puce>
              );
            })}
          </div>
        </div>
      }
    >
      {chargement && resultats.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-ink-muted">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : erreur ? (
        <p className="py-12 text-center text-sm text-danger">{erreur}</p>
      ) : groupes.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink-muted">
          Rien ne correspond à « {q} ».
        </p>
      ) : (
        <div className="space-y-5">
          {groupes.map(([type, liste]) => (
            <section key={type}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                {LIBELLES_PARTAGE[type]}
              </h3>
              <ul className="space-y-1">
                {liste.map((item) => (
                  <li key={`${item.type}-${item.refId}`}>
                    <button
                      type="button"
                      onClick={() => onChoisir(item)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-base"
                    >
                      <Vignette contenu={item} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.titre}</span>
                        {item.sousTitre && (
                          <span className="block truncate text-xs text-ink-muted">{item.sousTitre}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </ModalSheet>
  );
}

function Puce({
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
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        actif ? "border-accent bg-accent text-base" : "border-border text-ink-muted hover:border-accent/40"
      }`}
    >
      {children}
    </button>
  );
}

function Vignette({ contenu }: { contenu: ContenuPartage }) {
  const Icone = ICONES_PARTAGE[contenu.type];
  const forme = contenu.type === "artist" ? "rounded-full" : "rounded-lg";

  if (contenu.imageUrl) {
    return (
      <SafeImage
        src={contenu.imageUrl}
        alt=""
        width={44}
        height={44}
        className={`h-11 w-11 shrink-0 object-cover ${forme}`}
      />
    );
  }
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center bg-accent/10 text-accent ${forme}`}>
      <Icone size={18} />
    </span>
  );
}
