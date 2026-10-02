import * as THREE from 'three';
import type { GanziThemePreset } from './theme-library';
import { generateProceduralTexture } from './texture-generator';
import { generate7030UVMask, blendPlanetSurfaces, createSurfacePropertyMap, type MaskStyle } from './uv-mask';
import { surfaceTexture } from './render-resources';

/** One common preset pipeline for every pillar/size. Spatial property maps keep
 * polished minerals and rough terrain distinct instead of averaging the planet. */
export function createPlanetMaterial(day: GanziThemePreset, month?: GanziThemePreset, style: MaskStyle = 'pangaea', size = 512): THREE.MeshStandardMaterial {
  const scaleRelief = (canvas: HTMLCanvasElement, amount: number) => {
    const ctx = canvas.getContext('2d')!;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < image.data.length; i += 4) {
      const height = 128 + (image.data[i] - 128) * amount;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = height;
    }
    ctx.putImageData(image, 0, 0); return canvas;
  };
  const d = generateProceduralTexture(day, size);
  scaleRelief(d.bumpCanvas, day.surface.bumpScale);
  const material = new THREE.MeshStandardMaterial({
    roughness: day.surface.roughness, metalness: day.surface.metalness,
    bumpScale: .065,
    emissive: 0xffffff, emissiveIntensity: .16,
  });
  if (month) {
    const m = generateProceduralTexture(month, size);
    scaleRelief(m.bumpCanvas, month.surface.bumpScale);
    const mask = generate7030UVMask(style, size, size / 2);
    const mix = (a: HTMLCanvasElement, b: HTMLCanvasElement) => blendPlanetSurfaces(a, b, mask, size, size / 2);
    material.map = surfaceTexture(mix(d.colorCanvas, m.colorCanvas), true);
    material.bumpMap = surfaceTexture(mix(d.bumpCanvas, m.bumpCanvas));
    material.emissiveMap = surfaceTexture(mix(d.emissiveCanvas, m.emissiveCanvas), true);
    material.roughness = material.metalness = 1;
    material.roughnessMap = surfaceTexture(createSurfacePropertyMap(mask, day.surface.roughness, month.surface.roughness));
    material.metalnessMap = surfaceTexture(createSurfacePropertyMap(mask, day.surface.metalness, month.surface.metalness));
  } else {
    material.map = surfaceTexture(d.colorCanvas, true);
    material.bumpMap = surfaceTexture(d.bumpCanvas);
    material.emissiveMap = surfaceTexture(d.emissiveCanvas, true);
  }
  material.userData.uvSpeed = day.surface.patternType === 'waves' ? .007 : .0015;
  return material;
}
export function animateSurface(material: THREE.Material | THREE.Material[], seconds: number): void {
  for (const mat of Array.isArray(material) ? material : [material]) {
    const m = mat as THREE.MeshStandardMaterial;
    const offset = ((m.map?.offset.x ?? 0) + seconds * (m.userData.uvSpeed ?? 0)) % 1;
    for (const texture of [m.map, m.bumpMap, m.emissiveMap, m.roughnessMap, m.metalnessMap]) if (texture) texture.offset.x = offset;
  }
}
export function resetSurface(material: THREE.Material | THREE.Material[]): void {
  for (const m of Array.isArray(material) ? material : [material]) for (const value of Object.values(m)) if (value?.isTexture) value.offset.set(0, 0);
}
