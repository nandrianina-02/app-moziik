import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { adresseSite, configurer, connecter, deconnecter, ErreurApi, verifierAdmin, type Utilisateur } from "./api";
import { SITE_PAR_DEFAUT } from "../../partage/types";

/** Le coffre garde le jeton de renouvellement et l'identité affichée, en JSON. */
function lireCoffre(brut: string | null): { jeton: string; utilisateur: Utilisateur } | null {
  if (!brut) return null;
  try {
    const v = JSON.parse(brut) as { jeton?: string; utilisateur?: Utilisateur };
    return v.jeton && v.utilisateur ? { jeton: v.jeton, utilisateur: v.utilisateur } : null;
  } catch {
    return null;
  }
}

/*
 * La session : qui est connecté, à quel site. Le jeton de renouvellement
 * vit dans le coffre de Windows ; au lancement, il suffit à rouvrir la
 * session sans redemander le mot de passe.
 */

type Etat = { phase: "demarrage" } | { phase: "deconnecte"; message?: string } | { phase: "connecte"; utilisateur: Utilisateur };

interface Session {
  etat: Etat;
  site: string;
  changerSite: (site: string) => Promise<void>;
  ouvrir: (email: string, motDePasse: string) => Promise<void>;
  fermer: () => Promise<void>;
}

const Contexte = createContext<Session | null>(null);

export function FournisseurSession({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>({ phase: "demarrage" });
  const [site, setSite] = useState(SITE_PAR_DEFAUT);

  const surDeconnexion = useCallback(() => {
    void window.bureau.coffre.ecrire(null);
    setEtat({ phase: "deconnecte", message: "Session expirée : reconnectez-vous." });
  }, []);

  useEffect(() => {
    (async () => {
      const reglages = await window.bureau.reglages.lire();
      const garde = lireCoffre(await window.bureau.coffre.lire());
      setSite(reglages.site);
      configurer({ site: reglages.site, jetonRenouvellement: garde?.jeton ?? null, surDeconnexion });
      if (!garde) return setEtat({ phase: "deconnecte" });
      try {
        // Un appel réservé à l'administration : il vaut vérification du jeton et du rôle à la fois.
        await verifierAdmin();
        setEtat({ phase: "connecte", utilisateur: garde.utilisateur });
      } catch (e) {
        await window.bureau.coffre.ecrire(null);
        setEtat({ phase: "deconnecte", message: e instanceof ErreurApi && e.statut === 403 ? "Ce compte n'est pas administrateur." : undefined });
      }
    })();
  }, [surDeconnexion]);

  const valeur = useMemo<Session>(
    () => ({
      etat,
      site,
      changerSite: async (nouveau) => {
        const propre = nouveau.trim().replace(/\/+$/, "") || SITE_PAR_DEFAUT;
        await window.bureau.reglages.ecrire({ site: propre });
        await window.bureau.coffre.ecrire(null);
        setSite(propre);
        configurer({ site: propre, jetonRenouvellement: null, surDeconnexion });
        setEtat({ phase: "deconnecte" });
      },
      ouvrir: async (email, motDePasse) => {
        const { utilisateur, jetonRenouvellement } = await connecter(email, motDePasse);
        if (utilisateur.role !== "admin") {
          await deconnecter();
          throw new Error("Ce compte n'est pas administrateur.");
        }
        await window.bureau.coffre.ecrire(JSON.stringify({ jeton: jetonRenouvellement, utilisateur }));
        setEtat({ phase: "connecte", utilisateur });
      },
      fermer: async () => {
        await deconnecter();
        await window.bureau.coffre.ecrire(null);
        setEtat({ phase: "deconnecte" });
      },
    }),
    [etat, site, surDeconnexion],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useSession(): Session {
  const s = useContext(Contexte);
  if (!s) throw new Error("useSession hors du FournisseurSession");
  return s;
}

/** Une adresse d'image du site (/media/…), absolue. */
export const adresseImage = (chemin: string | null | undefined) => (chemin ? (chemin.startsWith("http") ? chemin : `${adresseSite()}${chemin}`) : null);
