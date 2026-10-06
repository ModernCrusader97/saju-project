import * as THREE from 'three';
import { createSpiritGeometry } from './spirit-geometry';
import { getStemThemePreset } from './theme-library';

export type CharacterFixtureQuality = 'low' | 'medium' | 'high';
export interface CharacterMaterialFixture {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  /** Actual material-bearing meshes, in their existing nested local spaces. */
  surfaceTargets: THREE.Mesh[];
  /** Existing animation only. Call before surface-effect updates. */
  update(time: number, reaction?: number): void;
  /** Releases owned geometry and face materials, never the borrowed stem handle. */
  dispose(): void;
}

/** A material comparison fixture, not a new final character design.
 * Uses the same existing 신 body for every tested stem; no stem-dependent
 * silhouette, crown or darkened tunic can confound the comparison.
 * Geometry retains its original local coordinates and hierarchy.
 */
export function createCharacterMaterialFixture(
  source: THREE.Material | { material: THREE.Material },
  quality: CharacterFixtureQuality = 'high',
): CharacterMaterialFixture {
  const material = source instanceof THREE.Material ? source : source.material;
  // The legacy factory changes its input's vertexColors flag. Isolate that
  // side effect on a disposable placeholder rather than on the live shader.
  const placeholder = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const spirit = createSpiritGeometry(
    getStemThemePreset('신'), placeholder, placeholder,
    quality === 'low' ? 'low' : 'high',
  );
  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const ownedMaterials = new Set<THREE.Material>();
  spirit.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    ownedGeometries.add(object.geometry);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const entry of materials) if (entry !== placeholder) ownedMaterials.add(entry);
  });
  // Collect ownership first: removed crest resources must also be released.
  spirit.crown.removeFromParent();
  const surfaceTargets: THREE.Mesh[] = [];
  spirit.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object.material === placeholder) {
      object.material = material;
      object.geometry.deleteAttribute('color');
      object.geometry.computeBoundingBox();
      object.geometry.computeBoundingSphere();
      object.userData.characterMaterialSurface = true;
      surfaceTargets.push(object);
    }
  });
  // The approved stem materials use procedural color, not legacy garment tint.
  const colorMaterial = material as THREE.Material & { vertexColors?: boolean };
  if (colorMaterial.vertexColors) {
    colorMaterial.vertexColors = false;
    material.needsUpdate = true;
  }
  // Keep the original expression geometry, with neutral achromatic face ink.
  for (const faceMaterial of ownedMaterials) {
    if (!(faceMaterial instanceof THREE.MeshBasicMaterial)) continue;
    faceMaterial.color.setHex(faceMaterial.color.getHex() === 0x12252b ? 0x17191c : 0xf2f2f2);
  }
  placeholder.dispose();
  const group = spirit.group;
  group.name = 'existing-character-material-fixture';
  group.userData.materialFixture = { fixedBodyPreset: '신', purpose: 'material-comparison' };
  let disposed = false;
  const update = (time: number, reaction = 0) => {
    if (!Number.isFinite(time) || !Number.isFinite(reaction)) throw new RangeError('Animation inputs must be finite');
    if (disposed) return;
    spirit.update(time, reaction);
    // Ancestor changes (turntable, scaling) are included in target matrices.
    group.updateWorldMatrix(true, true);
  };
  update(0);
  return {
    group, bodyMesh: spirit.bodyMesh, surfaceTargets, update,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      for (const geometry of ownedGeometries) geometry.dispose();
      for (const faceMaterial of ownedMaterials) faceMaterial.dispose();
      group.clear();
    },
  };
}
