// Renderer callbacks publish outside React. Each scene instance owns its store.
export function createGraphicsErrorStore() {
  let snapshot: string | null = null;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => snapshot,
    // No renderer exists during SSR or the initial hydration render.
    getServerSnapshot: () => null,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setError(error: string | null) {
      if (snapshot === error) return;
      snapshot = error;
      listeners.forEach(listener => listener());
    },
  };
}
