'use client';
import { useEffect, useState } from 'react';
import { decodeUniverse, EXAMPLE_UNIVERSE, readUniverseSession, resolveUniverseQuery,
  saveUniverseSession, type UniverseSnapshot } from '@/lib/universe-state';

export function useUniverse() {
  const [snapshot, setSnapshot] = useState(EXAMPLE_UNIVERSE);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const restore = () => {
      const prior = decodeUniverse(window.history.state?.universeSnapshot) || readUniverseSession() || EXAMPLE_UNIVERSE;
      try {
        const next = resolveUniverseQuery(new URLSearchParams(window.location.search), prior);
        setSnapshot(next); setError('');
        // Legacy home URLs remain readable; birth details need not remain in the URL.
        window.history.replaceState({ ...window.history.state, universeSnapshot: next }, '', `/planet?view=${next.mode}`);
        saveUniverseSession(next);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '입력을 확인해주세요.'); setSnapshot(prior);
        const fallbackUrl = new URL(window.location.href);
        fallbackUrl.searchParams.set('view', prior.mode);
        window.history.replaceState({ ...window.history.state, universeSnapshot: prior }, '', fallbackUrl.href);
        saveUniverseSession(prior);
      }
      setReady(true);
    };
    restore(); window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  function commit(next: UniverseSnapshot, push = false) {
    setSnapshot(next);
    if (push) window.history.pushState({ ...window.history.state, universeSnapshot: next }, '', `/planet?view=${next.mode}`);
    saveUniverseSession(next);
  }
  return { snapshot, commit, ready, error, setError };
}
