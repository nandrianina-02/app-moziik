import { createContext, useContext, useEffect, useRef } from "react";

/*
 * Les pages visitées restent montées, masquées, comme les onglets d'un
 * navigateur : au retour, défilement, pagination, recherche, filtres,
 * sélection et panneaux ouverts sont là où on les avait laissés. Une page
 * masquée ne doit pourtant ni prendre le clavier, ni relire le site en
 * boucle : elle demande ici si elle est à l'écran.
 */
const ContextePage = createContext(true);

export const FournisseurPage = ContextePage.Provider;

/** Vrai si la page qui contient ce composant est celle affichée. */
export function usePageActive() {
  return useContext(ContextePage);
}

/** La dernière valeur de « page active », lisible depuis un écouteur sans le réinscrire. */
export function useRefPageActive() {
  const active = usePageActive();
  const ref = useRef(active);
  ref.current = active;
  return ref;
}

/**
 * Appelé quand on revient sur la page (pas à sa première ouverture) :
 * pour relire sans bruit ce qui a pu changer pendant qu'elle était masquée.
 */
export function useAuRetour(rappel: () => void) {
  const active = usePageActive();
  const avant = useRef(active);
  const dernier = useRef(rappel);
  dernier.current = rappel;
  useEffect(() => {
    if (active && !avant.current) dernier.current();
    avant.current = active;
  }, [active]);
}
