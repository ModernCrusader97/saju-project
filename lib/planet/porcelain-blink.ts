import type { Object3D, Mesh } from 'three';

/** Calibrated for porcelain_blink.glb with CalmAlert held at 1.
 * No animation clip, iris hiding, scaling, shader clipping, or frame loop.
 * Call once after loading; call setBlink01 from the host's own update loop.
 */
export function bindPorcelainBlink(root: Object3D) {
  const stages = [25, 50, 75, 100] as const;
  const lids: Array<{ weights: number[]; indices: number[] }> = [];
  root.traverse((node) => {
    const mesh = node as Mesh;
    const dictionary = mesh.morphTargetDictionary;
    const weights = mesh.morphTargetInfluences;
    if (!dictionary || !weights) return;
    const calm = dictionary.CalmAlert;
    if (calm !== undefined) weights[calm] = 1;
    const indices = stages.map((stage) => dictionary[`Blink${stage}`]);
    if (indices.every((index) => index === undefined)) return;
    if (indices.some((index) => index === undefined)) {
      throw new Error(`Incomplete porcelain blink target set on ${mesh.name}`);
    }
    lids.push({ weights, indices: indices as number[] });
  });
  if (lids.length !== 4) {
    throw new Error(`Expected 4 porcelain blink meshes, found ${lids.length}`);
  }
  const setBlink01 = (blink01: number) => {
    if (!Number.isFinite(blink01)) throw new Error('blink01 must be finite');
    const b = Math.max(0, Math.min(1, blink01));
    for (const lid of lids) {
      stages.forEach((stage, i) => {
        lid.weights[lid.indices[i]] = Math.max(0, 1 - Math.abs(b - stage / 100) / 0.25);
      });
    }
  };
  // A single explicit 275 ms blink; never schedules or loops itself.
  const sampleOnce = (elapsedMs: number) => {
    if (!Number.isFinite(elapsedMs)) throw new Error('elapsedMs must be finite');
    const b = elapsedMs < 0 ? 0
      : elapsedMs < 100 ? elapsedMs / 100
      : elapsedMs < 135 ? 1
      : elapsedMs < 275 ? 1 - (elapsedMs - 135) / 140 : 0;
    setBlink01(b);
  };
  setBlink01(0);
  return { setBlink01, sampleOnce, reset: () => setBlink01(0) };
}
