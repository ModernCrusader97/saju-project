import type { GanziThemePreset } from "./theme-library";
import { hashSeed, spherePoint, sphericalField } from "./surface-math";

/** Evaluate geological detail in 3D, then bake equirectangular UVs.
 * Identical meridians and longitude-independent poles prevent painted UV seams.
 * No random calls, no baked lights/shadows; the real scene lights reveal relief.
 */
export function generateProceduralTexture(preset: GanziThemePreset, size = 1024): {
  colorCanvas: HTMLCanvasElement; bumpCanvas: HTMLCanvasElement; emissiveCanvas: HTMLCanvasElement;
} {
  const width = size, height = Math.max(2, Math.round(size / 2));
  const make = () => { const c = document.createElement("canvas"); c.width = width; c.height = height; return c; };
  const colorCanvas = make(), bumpCanvas = make(), emissiveCanvas = make();
  const color = colorCanvas.getContext("2d")!.createImageData(width, height);
  const bump = bumpCanvas.getContext("2d")!.createImageData(width, height);
  const emission = emissiveCanvas.getContext("2d")!.createImageData(width, height);
  const rgb = (hex: string) => { const n = parseInt(hex.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const primary = rgb(preset.surface.primaryColor), secondary = rgb(preset.surface.secondaryColor);
  const phase = hashSeed(preset.key) / 4294967296 * 6.28;
  const pattern = preset.surface.patternType;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const [sx, sy, sz] = spherePoint(x / (width - 1), y / (height - 1));
    const low = sphericalField(sx, sy, sz, 4.2, phase);
    const mid = sphericalField(sx, sy, sz, 14, phase + 1.1);
    const fine = sphericalField(sx, sy, sz, 53, phase + 2.7);
    const grain = sphericalField(sx, sy, sz, 131, phase + 0.3);
    const ridge = Math.pow(1 - Math.abs(Math.sin(low * 6 + mid * 1.7)), 8);
    let detail = 0.5 + low * .3 + mid * .13 + fine * .06;
    let relief = .5 + mid * .19 + fine * .12 + grain * .04;
    if (pattern === 'veins') { detail = .19 + ridge * .66 + mid * .13 + fine * .05; relief += ridge * .22; }
    if (pattern === 'crater') { const c = Math.abs(mid + low * .3); const rim = Math.exp(-Math.pow((c - .21) * 25, 2)); detail = .2 + rim * .53 + fine * .1; relief = .28 + rim * .43 + fine * .1 + c * .15; }
    if (pattern === 'crystals') { const facet = Math.round((mid + low * .7) * 9) / 9; detail = .45 + facet * .43 + ridge * .25; relief = .48 + facet * .32 + fine * .07; }
    if (pattern === 'strata') { const band = Math.sin(sy * 43 + low * 6 + mid * .5); detail = .45 + band * .26 + fine * .05; relief = .5 + band * .14 + fine * .1; }
    if (pattern === 'waves') { const flow = Math.sin(sy * 20 + low * 8 + mid * 1.8); detail = .4 + flow * .29 + ridge * .16; relief = .5 + flow * .09 + fine * .04; }
    if (pattern === 'granite') { detail += fine * .21 + grain * .1; relief += grain * .13; }
    // Ten distinct motifs; the full ganzi pair supplies the repeatable terrain seed.
    if (preset.stem === '갑') { const continent = Math.max(0, Math.min(1, .5 + low * 1.5)); detail = .2 + continent * .57 + ridge * .15; relief = .42 + continent * .25 + fine * .09; }
    if (preset.stem === '을') { const vine = Math.pow(1 - Math.abs(Math.sin(low * 11 + mid * 3)), 12); detail = .18 + vine * .72 + mid * .16; relief = .45 + vine * .24 + fine * .07; }
    if (preset.stem === '병') { const lava = Math.pow(1 - Math.abs(Math.sin(low * 5 + mid * 2)), 10); detail = .12 + lava * .86 + fine * .08; relief = .6 - lava * .28 + mid * .12; }
    if (preset.stem === '정') { const ember = Math.pow(Math.max(0, Math.sin(mid * 13 + low * 5)), 8); detail = .24 + ember * .6 + low * .18; relief = .48 + mid * .18 + fine * .08; }
    if (preset.stem === '기') { const terrace = Math.round((low + mid * .3) * 12) / 12; detail = .5 + terrace * .43 + grain * .1; relief = .5 + terrace * .3 + fine * .07; }
    if (preset.stem === '신') { const frost = Math.pow(1 - Math.abs(Math.sin(mid * 10 + fine)), 5); detail = .48 + frost * .43 + low * .12; relief = .5 + frost * .19 + fine * .04; }
    if (preset.stem === '임') { const swirl = Math.sin(sy * 12 + low * 11 + mid * 2); detail = .4 + swirl * .35 + fine * .07; relief = .5 + swirl * .08; }
    if (preset.stem === '계') { const ripple = Math.sin(sy * 34 + low * 4 + mid * .8); detail = .52 + ripple * .25 + fine * .04; relief = .5 + ripple * .055; }
    detail = Math.max(0, Math.min(1, detail));
    const idx = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) {
      color.data[idx + c] = primary[c] * (1 - detail) + secondary[c] * detail;
      bump.data[idx + c] = Math.max(0, Math.min(255, relief * 255));
      // Sparse mineral seams: smooth and steady, never whole-surface flashing.
      emission.data[idx + c] = secondary[c] * ridge * .8;
    }
    color.data[idx + 3] = bump.data[idx + 3] = emission.data[idx + 3] = 255;
  }
  colorCanvas.getContext('2d')!.putImageData(color, 0, 0);
  bumpCanvas.getContext('2d')!.putImageData(bump, 0, 0);
  emissiveCanvas.getContext('2d')!.putImageData(emission, 0, 0);
  return { colorCanvas, bumpCanvas, emissiveCanvas };
}
