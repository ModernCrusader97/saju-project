/** Schedule automatic scene frames only while the canvas and document are visible.
 * Motion preferences and rendering remain the caller's responsibility.
 */
export function createVisibilityLoop(
  element: Element,
  onFrame: (now: number, previousTime: number) => void,
): () => void {
  let disposed = false;
  let inViewport = typeof IntersectionObserver === "undefined";
  let active = false;
  let frame: number | null = null;
  let generation = 0;
  let previousTime = performance.now();
  let observer: IntersectionObserver | undefined;

  const eligible = () => !disposed && inViewport && !document.hidden;
  const schedule = () => {
    if (!active || !eligible() || frame !== null) return;
    const currentGeneration = generation;
    frame = requestAnimationFrame((now) => {
      // An already-delivered canceled callback must not affect a newer loop.
      if (disposed || currentGeneration !== generation) return;
      frame = null;
      if (!eligible()) { synchronize(); return; }
      const previous = previousTime;
      previousTime = now;
      try { onFrame(now, previous); } finally { schedule(); }
    });
  };
  const synchronize = () => {
    const nextActive = eligible();
    if (active !== nextActive) {
      active = nextActive;
      generation++;
      previousTime = performance.now();
      if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
    }
    schedule();
  };

  document.addEventListener("visibilitychange", synchronize);
  if (typeof IntersectionObserver !== "undefined") {
    try {
      observer = new IntersectionObserver((entries) => {
        if (disposed) return;
        for (const entry of entries) if (entry.target === element) inViewport = entry.isIntersecting;
        synchronize();
      });
      observer.observe(element);
    } catch {
      // Older/embedded browsers keep document visibility gating.
      observer?.disconnect();
      observer = undefined;
      inViewport = true;
    }
  }
  synchronize();
  return () => {
    if (disposed) return;
    disposed = true;
    active = false;
    generation++;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    observer?.disconnect();
    document.removeEventListener("visibilitychange", synchronize);
  };
}
