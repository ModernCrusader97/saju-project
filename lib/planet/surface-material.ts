import * as THREE from 'three';
import { getSurfaceFamily, type GanziThemePreset } from './theme-library';
import { generate7030UVMask, type MaskStyle } from './uv-mask';
import { surfaceTexture } from './render-resources';
import { installLivingSurface, type LivingSurfaceState } from './living-surface-shader';

/** One shared, physically lit living-surface pipeline for every ganzi/pillar/size.
 * Region occupancy is the existing spherical 70/30 mask, not the current color
 * or brightness of a material. The mask never scrolls with surface motion.
 * Caller supplies the scene's environment; the material never owns that map.
 */
export function createPlanetMaterial(day: GanziThemePreset, month?: GanziThemePreset, style: MaskStyle = 'pangaea', size = 512): THREE.MeshStandardMaterial {
  const families = [getSurfaceFamily(day), ...(month ? [getSurfaceFamily(month)] : [])];
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: day.surface.roughness,
    metalness: day.surface.metalness,
    // Only enable the extra physical lobe for a coating-capable material pair.
    clearcoat: families.some(f => f === 'water' || f === 'lava' || f === 'metal')
      || day.stem === '기' || month?.stem === '기' ? 1 : 0,
    clearcoatRoughness: .1,
    ior: families.every(f => f === 'water') ? 1.333 : 1.45,
    envMapIntensity: 1,
    emissive: 0x000000,
    emissiveIntensity: 1,
    dithering: true,
  });
  // The same bounded mask resolution across planet sizes keeps region boundaries
  // aligned with surface geometry/VFX; high-frequency detail is shader-native.
  const width = Math.max(32, Math.min(512, Math.round(Number.isFinite(size) ? size : 512)));
  const mask = month ? surfaceTexture(generate7030UVMask(style, width, Math.max(2, Math.round(width / 2)))) : null;
  if (mask) {
    mask.name = 'fixed-spherical-day70-month30';
    mask.generateMipmaps = false;
    mask.minFilter = THREE.LinearFilter;
    mask.magFilter = THREE.LinearFilter;
  }
  material.name = `living:${day.key}${month ? `:${month.key}` : ''}`;
  installLivingSurface(material, day, month, mask);
  return material;
}

/** seconds is a delta, as in the original API. Caller pause/reduced-motion gates
 * the call; zero/invalid/negative deltas cannot advance it. No wall-clock reads.
 */
export function animateSurface(material: THREE.Material | THREE.Material[], seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  for (const mat of Array.isArray(material) ? material : [material]) {
    const state = mat.userData.livingSurface as LivingSurfaceState | undefined;
    if (state && !state.disposed) state.time.value += Math.min(seconds, .1);
  }
}
export function resetSurface(material: THREE.Material | THREE.Material[]): void {
  for (const mat of Array.isArray(material) ? material : [material]) {
    const state = mat.userData.livingSurface as LivingSurfaceState | undefined;
    if (state && !state.disposed) state.time.value = 0;
  }
}

/** Reuse the physical material on authored non-spherical spirit geometry without
 * applying sphere-only macro deformation. Procedural fine normals stay active. */
export function setSurfaceReliefScale(material: THREE.Material | THREE.Material[], scale: number): void {
  if (!Number.isFinite(scale)) return;
  for (const mat of Array.isArray(material) ? material : [material]) {
    const state = mat.userData.livingSurface as LivingSurfaceState | undefined;
    if (state && !state.disposed) state.reliefScale.value = Math.max(0, Math.min(1, scale));
  }
}

/** Optional forest-only bark for sculpted tree trunks/roots. The default 0 keeps
 * planet canopy and leaf materials unchanged; non-forest month patches retain
 * their own material and exactly the same static spherical mask. */
export function setSurfaceBarkMix(material: THREE.Material | THREE.Material[], amount = 1): void {
  if (!Number.isFinite(amount)) return;
  for (const mat of Array.isArray(material) ? material : [material]) {
    const state = mat.userData.livingSurface as LivingSurfaceState | undefined;
    if (state && !state.disposed) state.barkMix.value = Math.max(0, Math.min(1, amount));
  }
}
