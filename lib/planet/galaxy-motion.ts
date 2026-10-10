import * as THREE from 'three';

/** The original independent orbit, always evaluated from its immutable anchor. */
export function setGalaxyOrbitPosition(position: THREE.Vector3, anchor: THREE.Vector3, seconds: number, laneRadius?: number): void {
  // Shared lane metadata gives equal-radius systems exactly the same speed,
  // independent of tiny trig round-off in each anchor's measured magnitude.
  const radius = laneRadius ?? Math.hypot(anchor.x, anchor.z);
  const angle = seconds * .052 / Math.sqrt(Math.max(1, radius / 6));
  const c = Math.cos(angle), s = Math.sin(angle);
  position.set(anchor.x * c + anchor.z * s, anchor.y, anchor.z * c - anchor.x * s);
}
