/** Horizontal touch drags explore the scene; vertical gestures scroll the page. */
export function bindSceneGestures(canvas: HTMLCanvasElement, options: {
  rotate(dx: number, dy: number): void;
  dragging(active: boolean): void;
  tap?: (event: PointerEvent) => void;
  zoom?: (delta: number) => void;
}) {
  const points = new Map<number, { x: number; y: number; originX: number; originY: number; moved: number; intent: boolean }>();
  let pinchDistance = 0;
  canvas.style.touchAction = 'pan-y';
  const distance = () => { const [a, b] = [...points.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
  const down = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY, moved: 0, intent: event.pointerType !== 'touch' });
    canvas.setPointerCapture(event.pointerId); options.dragging(true);
    pinchDistance = distance();
  };
  const move = (event: PointerEvent) => {
    const point = points.get(event.pointerId); if (!point) return;
    if (points.size > 1) {
      point.x = event.clientX; point.y = event.clientY; point.moved = 100;
      const next = distance(); if (pinchDistance && next) options.zoom?.((pinchDistance - next) * .04);
      pinchDistance = next; return;
    }
    if (!point.intent) {
      const x = event.clientX - point.originX, y = event.clientY - point.originY;
      if (Math.abs(x) + Math.abs(y) < 7) return;
      if (Math.abs(y) > Math.abs(x) * 1.1) { end(event); return; }
      point.intent = true;
    }
    const dx = event.clientX - point.x, dy = event.clientY - point.y;
    point.moved += Math.abs(dx) + Math.abs(dy); point.x = event.clientX; point.y = event.clientY;
    options.rotate(dx, dy);
  };
  const end = (event: PointerEvent) => {
    const point = points.get(event.pointerId);
    if (point && event.type === 'pointerup' && point.moved < 8) options.tap?.(event);
    points.delete(event.pointerId); pinchDistance = distance(); options.dragging(points.size > 0);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  const wheel = (event: WheelEvent) => { if (options.zoom) { event.preventDefault(); options.zoom(event.deltaY * .018); } };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.addEventListener('lostpointercapture', end);
  canvas.addEventListener('wheel', wheel, { passive: false });
  return () => {
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', end); canvas.removeEventListener('lostpointercapture', end);
    canvas.removeEventListener('wheel', wheel); points.clear(); options.dragging(false);
  };
}
