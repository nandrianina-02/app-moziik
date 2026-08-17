"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Charge une ressource indépendamment des autres.
 *
 * Une page qui regroupe plusieurs appels dans un même `Promise.all` ne
 * s'affiche qu'au rythme du plus lent : cinq requêtes de 100 ms et une de
 * 2 s donnent une page vide pendant 2 s. Un `useAsyncData` par ressource
 * laisse chaque bloc apparaître dès qu'il est prêt.
 *
 * `load` peut valoir `null` : la ressource est alors désactivée (visiteur
 * non connecté, identifiant pas encore connu) et `loading` reste faux —
 * pas de squelette perpétuel pour une donnée qui ne viendra jamais.
 *
 * `resetKey` rejoue le chargement quand sa valeur change (filtre, période,
 * statut de session). Les réponses arrivées après un changement de clé sont
 * ignorées, pour ne pas afficher le résultat d'un filtre déjà remplacé.
 */
export function useAsyncData<T>(
  load: (() => Promise<T>) | null,
  initial: T,
  resetKey: string | number = ""
): { data: T; setData: Dispatch<SetStateAction<T>>; loading: boolean; error: boolean; reload: () => Promise<void> } {
  const enabled = load !== null;
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);

  const loadRef = useRef(load);
  loadRef.current = load;
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    const run = loadRef.current;
    if (!run) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    try {
      const result = await run();
      if (requestId === requestIdRef.current) setData(result);
    } catch {
      if (requestId === requestIdRef.current) setError(true);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current++;
      setLoading(false);
      return;
    }
    reload();
  }, [enabled, resetKey, reload]);

  return { data, setData, loading, error, reload };
}

/** Raccourci : GET JSON puis extraction du champ utile, avec repli si la réponse n'est pas exploitable. */
export async function getJson<T>(
  url: string,
  pick: (json: Record<string, unknown>) => T | undefined | null,
  fallback: T
): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) return fallback;
  const json = (await res.json()) as Record<string, unknown>;
  return pick(json) ?? fallback;
}
