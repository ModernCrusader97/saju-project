/** Pure, deterministic sphere sampling shared by mask/texture builders and tests. */
export type SurfaceMaskStyle = "pangaea" | "archipelago" | "tectonic" | "bands" | "vortices";
export function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}
export function seededRandom(seed: number): () => number {
  return () => {
    seed += 0x6D2B79F5;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function spherePoint(u: number, v: number): [number, number, number] {
  const latitude = v * Math.PI;
  const radius = Math.sin(latitude);
  if (v === 0 || v === 1) return [0, Math.cos(latitude), 0];
  const angle = (u % 1) * Math.PI * 2;
  return [radius * Math.cos(angle), Math.cos(latitude), radius * Math.sin(angle)];
}
export function sphericalField(x: number, y: number, z: number, frequency: number, phase = 0): number {
  return (Math.sin(x * frequency + y * frequency * 0.71 + phase)
    + Math.sin(y * frequency * 1.13 - z * frequency * 0.83 + phase * 1.7)
    + Math.cos(z * frequency * 0.93 - x * frequency * 0.61 + phase * 0.4)) / 3;
}
export function sphereRowWeight(y: number, height: number): number {
  const top = Math.max(0, (y - 0.5) / (height - 1)) * Math.PI;
  const bottom = Math.min(1, (y + 0.5) / (height - 1)) * Math.PI;
  return Math.cos(top) - Math.cos(bottom);
}
export function smoothMask(score: number, threshold: number, softness = 0.065): number {
  const t = Math.max(0, Math.min(1, (score - threshold) / softness + 0.5));
  return t * t * (3 - 2 * t);
}
export function createSphereMask(style: SurfaceMaskStyle, width: number, height: number): Uint8ClampedArray {
  if (width < 2 || height < 2) throw new Error("Sphere maps require at least 2 × 2 samples");
  const scores = new Float32Array(width * height);
  const histogram = new Float64Array(2048);
  const weights = Float64Array.from({length: height}, (_, y) => sphereRowWeight(y, height));
  const frequency = style === "pangaea" ? 2.7 : style === "archipelago" ? 6.2 : 4.2;
  let total = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const [sx, sy, sz] = spherePoint(x / (width - 1), y / (height - 1));
    let score = sphericalField(sx, sy, sz, frequency, 0.82) * 0.76 + sphericalField(sx, sy, sz, frequency * 2.4, 1.3) * 0.24;
    if (style === "bands") score = Math.sin(sy * 14 + sphericalField(sx, sy, sz, 4, .4) * 1.7) * .75;
    if (style === "vortices") score = Math.sin(sy * 8 + sphericalField(sx, sy, sz, 3, 2) * 5 + sphericalField(sx, sy, sz, 9, .7)) * .78;
    if (style === "tectonic") score = Math.abs(score) * 2 - 0.6;
    scores[y * width + x] = score;
    // Duplicate meridian endpoints each represent half a longitude cell.
    const weight = weights[y] * (x === 0 || x === width - 1 ? 0.5 : 1);
    histogram[Math.max(0, Math.min(2047, Math.round((score + 1) * 1023.5)))] += weight;
    total += weight;
  }
  let low = -1.1, high = 1.1;
  // Calibrate the *soft, quantized* blend, not a different binary mask.
  for (let i = 0; i < 24; i++) {
    const threshold = (low + high) / 2;
    let sum = 0;
    for (let b = 0; b < histogram.length; b++) sum += histogram[b] * Math.round(smoothMask(b / 1023.5 - 1, threshold) * 255) / 255;
    if (sum / total > 0.7) low = threshold; else high = threshold;
  }
  const alpha = new Uint8ClampedArray(scores.length);
  for (let i = 0; i < alpha.length; i++) alpha[i] = Math.round(smoothMask(scores[i], (low + high) / 2) * 255);
  return alpha;
}
/** Ignore hidden-tab gaps; motion is integrated in seconds rather than frames. */
export function safeDelta(now: number, previous: number): number {
  return Math.max(0, Math.min(0.05, (now - previous) / 1000));
}
export function damping(rate: number, seconds: number): number { return 1 - Math.exp(-rate * seconds); }
