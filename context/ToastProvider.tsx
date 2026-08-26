"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { Portal } from "@/components/ui/Portal";

type ToastKind = "success" | "error" | "info";

type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
};

const ToastContext = createContext<{
  pushToast: (kind: ToastKind, message: string) => void;
}>({ pushToast: () => {} });

const icons: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const accentByKind: Record<ToastKind, string> = {
  success: "text-verified",
  error: "text-accent",
  info: "text-ink-muted",
};

const DUREE_MS = 5000;
/** Au-delà, les plus anciennes sortent : une pile qui remplit l'écran ne se lit plus. */
const PILE_MAX = 4;

/**
 * Notifications éphémères.
 *
 * Aucune ne s'affichait, nulle part dans l'application, et la cause n'était
 * pas dans ce fichier : `tailwind.config.ts` ne scannait que `./app` et
 * `./components`. Ce fournisseur vit dans `context/`, le seul dossier hors
 * de cette liste à contenir des classes. Aucune classe employée ici et
 * nulle part ailleurs n'était donc générée — `bottom-20`, `md:bottom-6` et
 * `animate-toast-in` étaient absentes de la feuille de style produite.
 *
 * Le conteneur se retrouvait en `position: fixed` SANS décalage vertical.
 * Une boîte fixée sans `top` ni `bottom` reste à sa position statique,
 * c'est-à-dire ici en fin de document : la pile s'affichait sous le pied de
 * page, hors de l'écran. Elle fonctionnait, elle était juste ailleurs.
 *
 * Deux défauts de superposition attendaient derrière celui-là, et sont
 * corrigés ici :
 *
 *  1. La pile était rendue en `z-50` au milieu de l'arbre, alors que les
 *     modales sont portées dans <body> en `z-[70]`. Une notification
 *     déclenchée depuis une modale — enregistrer un profil, créer un
 *     album, copier un lien de partage, soit une grande part des actions
 *     du site — serait passée derrière la modale qui l'a provoquée. La
 *     pile est donc portée dans <body> comme elles, et au-dessus.
 *  2. Le décalage était fixe, donc posé dans la bande du mini-lecteur dès
 *     qu'une musique jouait. Il suit maintenant la hauteur réelle du
 *     lecteur, publiée par MiniPlayerBar dans `--hauteur-lecteur` et nulle
 *     quand rien ne joue.
 *
 * Le portail n'est monté qu'à la première notification : rendu dès
 * l'hydratation, il créerait un écart entre le rendu serveur (vide) et le
 * rendu client (cf. le contrat de <Portal>).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const minuteurs = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /**
   * Le portail reste monté une fois la première notification passée. Le
   * démonter dès que la pile se vide couperait l'animation de sortie de la
   * dernière notification : AnimatePresence disparaîtrait avec elle. Ce
   * qui subsiste est un conteneur vide, sans hauteur ni clics.
   */
  const [pileMontee, setPileMontee] = useState(false);

  const dismiss = useCallback((id: string) => {
    const minuteur = minuteurs.current.get(id);
    if (minuteur) {
      clearTimeout(minuteur);
      minuteurs.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (kind: ToastKind, message: string) => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setPileMontee(true);
      setToasts((prev) => [...prev, { id, kind, message }].slice(-PILE_MAX));
      minuteurs.current.set(
        id,
        setTimeout(() => dismiss(id), DUREE_MS)
      );
    },
    [dismiss]
  );

  // Les minuteurs survivraient au démontage du fournisseur (changement de
  // session, rechargement à chaud) et écriraient dans un état disparu.
  const tousLesMinuteurs = minuteurs.current;
  useEffect(() => () => tousLesMinuteurs.forEach(clearTimeout), [tousLesMinuteurs]);

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      {pileMontee && (
        <Portal>
          <div
            className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--hauteur-lecteur,0px)+5rem)] z-[100] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-[calc(var(--hauteur-lecteur,0px)+1.5rem)] md:right-6 md:items-end"
          >
            <AnimatePresence initial={false}>
              {toasts.map((toast) => {
                const Icon = icons[toast.kind];
                return (
                  <motion.div
                    key={toast.id}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
                    // Une erreur doit interrompre la lecture d'écran en
                    // cours ; une confirmation attend son tour.
                    role={toast.kind === "error" ? "alert" : "status"}
                    className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl2 border border-border bg-surface px-4 py-3 shadow-lg"
                  >
                    <Icon size={18} className={`${accentByKind[toast.kind]} shrink-0 mt-0.5`} />
                    <p className="text-sm flex-1">{toast.message}</p>
                    <button
                      onClick={() => dismiss(toast.id)}
                      aria-label="Fermer la notification"
                      className="text-ink-muted transition-colors hover:text-ink"
                    >
                      <X size={16} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </Portal>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext).pushToast;
