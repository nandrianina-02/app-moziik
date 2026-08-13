"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Observe une sentinelle en bas de liste et appelle onLoadMore quand elle
 * entre dans le viewport. rootMargin positif = précharge avant que
 * l'utilisateur n'atteigne réellement le bas.
 *
 * loading/hasMore passent par des refs à jour à chaque rendu : l'effet
 * qui crée l'observer ne se relance donc pas à chaque changement de ces
 * valeurs (un seul IntersectionObserver pour la durée de vie du composant),
 * tout en lisant toujours leur état courant au moment du déclenchement.
 */
export function useInfiniteScroll(onLoadMore: () => void, hasMore: boolean, loading: boolean, rootMargin = "400px") {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ hasMore, loading, onLoadMore });
  stateRef.current = { hasMore, loading, onLoadMore };

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const { hasMore: more, loading: busy, onLoadMore: load } = stateRef.current;
        if (entry.isIntersecting && more && !busy) load();
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return sentinelRef;
}

type PageResult<T> = { items: T[]; hasMore: boolean };

/**
 * Cas d'usage standard : liste paginée par numéro de page. On ajoute
 * toujours à la liste existante (jamais de remplacement pendant le
 * scroll) — la position de scroll est donc naturellement conservée,
 * le contenu déjà affiché ne bouge jamais.
 *
 * resetKey : quand sa valeur change (ex: un filtre), la liste et la
 * pagination redémarrent proprement à la page 1.
 */
export function useInfiniteList<T>(fetchPage: (page: number) => Promise<PageResult<T>>, resetKey: string | number = "") {
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const pageRef = useRef(1);
  // Ignore une réponse qui arriverait après qu'un reset a déjà eu lieu
  // (évite d'insérer les résultats d'un ancien filtre dans la nouvelle liste).
  const requestIdRef = useRef(0);
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const loadMore = useCallback(async () => {
    const requestId = requestIdRef.current;
    const nextPage = pageRef.current + 1;
    setLoading(true);
    try {
      const { items: newItems, hasMore: more } = await fetchPageRef.current(nextPage);
      if (requestId !== requestIdRef.current) return;
      pageRef.current = nextPage;
      setItems((prev) => [...prev, ...newItems]);
      setHasMore(more);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    pageRef.current = 1;
    setInitialLoading(true);
    setHasMore(true);
    fetchPageRef
      .current(1)
      .then(({ items: firstPage, hasMore: more }) => {
        if (requestId !== requestIdRef.current) return;
        setItems(firstPage);
        setHasMore(more);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setInitialLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const sentinelRef = useInfiniteScroll(loadMore, hasMore, loading);

  return { items, loading, initialLoading, hasMore, sentinelRef };
}
