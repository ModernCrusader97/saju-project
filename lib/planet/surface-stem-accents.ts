import * as THREE from 'three';
import { createSurfaceWoodyBranches } from './surface-woody-branches';
import { createSurfaceCreepingVines } from './surface-creeping-vines';
import { createSurfaceSlidingDew } from './surface-sliding-dew';
import { createSurfaceFissureSand } from './surface-fissure-sand';
import { createStemAccents, type AccentStem, type StemAccents } from './approved-stem-accents';
import { MeshSurface } from './mesh-surface';
import { isSurfaceAttachmentExcluded } from './surface-attachment-exclusions';
export interface SurfaceAccentOptions { meshes: THREE.Mesh[]; quality?: 'low' | 'high'; detailScale?: number; allowMorphTargets?: boolean }
export interface SurfaceAccentBudget { drawCalls: number; instances: number; triangles: number; bufferBytes: number }
export interface SurfaceAccentDiagnostics { supported: boolean; mode: string; limitations: string[]; anchorCount: number; budget?: SurfaceAccentBudget }
export interface SurfaceStemAccents extends StemAccents { diagnostics: SurfaceAccentDiagnostics }

/** Real triangles; rest paths and identities stay stable during rotation/morphs. */
export function createSurfaceStemAccents(stem: AccentStem | '己' | '庚' | '辛', options: SurfaceAccentOptions): SurfaceStemAccents {
  let effect: SurfaceStemAccents;
  if (stem === '甲') effect = createSurfaceWoodyBranches(options);
  else if (stem === '乙') effect = createSurfaceCreepingVines(options);
  else if (stem === '癸') effect = createSurfaceSlidingDew(options);
  else if (stem === '戊') effect = createSurfaceFissureSand(options);
  else {
    const sampler = new MeshSurface(options.meshes, { allowMorphTargets: options.allowMorphTargets });
    const extent = sampler.bounds.getSize(new THREE.Vector3());
    const unit = options.detailScale ?? Math.min(extent.x, extent.y, extent.z) * .5;
    if (!Number.isFinite(unit) || unit <= 0) throw new RangeError('detailScale must be positive.');
    const diagnostics: SurfaceAccentDiagnostics = { supported: true, mode: 'triangle-attached', anchorCount: 0,
      limitations: ['Reference-pose area; rotations and explicitly enabled morphs resolve current triangles. Skinning/topology changes require another adapter.'] };
    if (stem === '丙' || stem === '丁') {
      const fireCount = stem === '丁' ? (options.quality === 'low' ? 12 : 18) : (options.quality === 'low' ? 48 : 72);
      const anchors = Array.from({ length: fireCount }, (_, i) => sampler.sample(i * 53 + 400));
      diagnostics.anchorCount = anchors.length;
      const fire = createStemAccents(stem, { radius: unit * .52, height: unit * 1.04, quality: options.quality,
        surfaceEmitter: (index, _epoch, group, offset) => {
          const pose = sampler.resolve(anchors[index], group);
          return pose.position.addScaledVector(pose.normal, offset);
        }, surfaceVisibility: (index, _epoch, group) =>
          !isSurfaceAttachmentExcluded(group, sampler.resolve(anchors[index], group).position) });
      fire.group.name = 'SurfaceStemAccents_' + stem;
      diagnostics.mode = 'triangle-emitted-original-fire';
      diagnostics.limitations.push('Detached flame flight is intentional; full body/flame collisions are not simulated.');
      effect = { ...fire, diagnostics };
    } else {
      const group = new THREE.Group(); group.name = 'SurfaceStemAccents_' + stem;
      diagnostics.supported = false; diagnostics.mode = 'base-material-only';
      diagnostics.limitations.push(stem === '壬' ? 'Actual-character spray/foam remains unimplemented.' : 'This stem uses its base material without geometry accents.');
      let disposed = false;
      effect = { group, diagnostics, update(time) { if (!disposed && !Number.isFinite(time)) throw new RangeError('Accent time must be finite.'); },
        dispose() { if (disposed) return; disposed = true; group.removeFromParent(); group.clear(); } };
    }
  }
  const geometries = new Set<THREE.BufferGeometry>();
  const budget: SurfaceAccentBudget = { drawCalls: 0, instances: 0, triangles: 0, bufferBytes: 0 };
  effect.group.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const instances = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1;
    budget.drawCalls++; budget.instances += instances;
    budget.triangles += ((mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3) * instances;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) budget.bufferBytes += (mesh as THREE.InstancedMesh).instanceMatrix.array.byteLength;
    if (geometries.has(mesh.geometry)) return;
    geometries.add(mesh.geometry);
    for (const attribute of Object.values(mesh.geometry.attributes)) budget.bufferBytes += attribute.array.byteLength;
    budget.bufferBytes += mesh.geometry.index?.array.byteLength ?? 0;
  });
  effect.diagnostics.budget = budget;
  effect.group.userData.surfaceAccentBudget = budget;
  return effect;
}
