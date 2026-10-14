"use client";

import { useMemo, useSyncExternalStore } from "react";

interface CanvasStatus {
  readonly ready: boolean;
  readonly error: string | null;
}

const initialStatus: CanvasStatus = Object.freeze({ ready: false, error: null });

/** One status source per external canvas resource; old callbacks retain their old source. */
export function createCanvasStatusStore(resourceKey: string) {
  let snapshot = initialStatus;
  const listeners = new Set<() => void>();
  function publish(next: CanvasStatus) {
    if (snapshot.ready === next.ready && snapshot.error === next.error) return;
    snapshot = Object.freeze(next);
    for (const listener of listeners) listener();
  }
  return {
    resourceKey,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialStatus,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setReady(value: boolean | ((current: boolean) => boolean)) {
      publish({ ...snapshot, ready: typeof value === "function" ? value(snapshot.ready) : value });
    },
    setError(error: string | null) {
      publish({ ...snapshot, error });
    },
  };
}

export function useCanvasStatus(resourceKey: string) {
  const store = useMemo(() => createCanvasStatusStore(resourceKey), [resourceKey]);
  const status = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...status, setReady: store.setReady, setError: store.setError };
}
