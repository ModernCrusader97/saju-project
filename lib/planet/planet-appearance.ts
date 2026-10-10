import type { GanziThemePreset } from './theme-library';
import type { MaskStyle } from './uv-mask';
import { createPlanetMaterial } from './surface-material';
import { createSurfaceEffects } from './surface-effects';

/** Personal and galaxy bodies use the same fixed mask, material and supported
 * effects. Radius is the unscaled sphere geometry radius; the mesh owns scale.
 * Attach effects to the body and dispose them before generic parent disposal. */
export function createPlanetAppearance(day: GanziThemePreset, month: GanziThemePreset,
  geometryRadius: number, maskStyle: MaskStyle = 'pangaea') {
  return {
    material: createPlanetMaterial(day, month, maskStyle, 512),
    effects: createSurfaceEffects(day, month, maskStyle, geometryRadius),
  };
}
