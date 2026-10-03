import * as THREE from 'three';
import type { GanziThemePreset } from './theme-library';
import { createSphereMask, hashSeed, seededRandom, type SurfaceMaskStyle } from './surface-math';

/** Small, real surface geometry, in planet-local coordinates. No atmosphere shell,
 * texture updates, timers, canvas, external assets, or per-frame instance uploads. */
export interface SurfaceEffectsBudget {
  drawCalls: number;
  instances: number;
  triangles: number;
  bufferBytes: number;
  maxRadius: number;
}

type Region = 'day' | 'month' | 'whole';
type Motion = 'wind' | 'water' | 'mercury' | 'still';
interface Placement { normal: THREE.Vector3; twist: number; size: number; phase: number }
interface EffectsState { time: { value: number }; disposed: boolean }
const states = new WeakMap<THREE.Group, EffectsState>();
const UP = new THREE.Vector3(0, 1, 0);
const MASK_WIDTH = 512;
const MASK_HEIGHT = 256;
const TAU = Math.PI * 2;

/** All materials in this group share one clock. Absolute elapsed seconds means
 * pause/reset and 30/60/144 Hz playback produce the same deformation. delta is
 * accepted for callers using the common (time, delta) animation signature. */
export function animateSurfaceEffects(group: THREE.Group, elapsedSeconds: number, _deltaSeconds?: number): void {
  const state = states.get(group);
  if (state && !state.disposed && Number.isFinite(elapsedSeconds)) state.time.value = Math.max(0, elapsedSeconds);
}

/** Call before generic parent disposal, or use this alone when replacing effects.
 * This also disposes InstancedMesh buffers (generic geometry traversal often
 * misses them). Idempotent, removes itself from its parent, and owns no textures. */
export function disposeSurfaceEffects(group: THREE.Group): void {
  const state = states.get(group);
  if (state?.disposed) return;
  if (state) state.disposed = true;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (Array.isArray(mesh.material)) mesh.material.forEach(material => materials.add(material));
    else if (mesh.material) materials.add(mesh.material);
    if ((object as THREE.InstancedMesh).isInstancedMesh) (object as THREE.InstancedMesh).dispose();
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  group.removeFromParent();
  group.clear();
  states.delete(group);
}

function joinGeometry(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const data: Record<'position' | 'normal' | 'uv', number[]> = { position: [], normal: [], uv: [] };
  for (const part of parts) {
    const flat = part.index ? part.toNonIndexed() : part;
    for (const key of ['position', 'normal', 'uv'] as const) {
      const attribute = flat.getAttribute(key);
      for (let i = 0; i < attribute.array.length; i++) data[key].push(Number(attribute.array[i]));
    }
    if (flat !== part) flat.dispose();
    part.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  for (const key of ['position', 'normal', 'uv'] as const) geometry.setAttribute(key, new THREE.Float32BufferAttribute(data[key], key === 'uv' ? 2 : 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function treeGeometry(broadleaf: boolean): THREE.BufferGeometry {
  const crowns: THREE.BufferGeometry[] = [];
  if (broadleaf) {
    // Overlapping, asymmetric crowns share a visible bole: not green surface dots.
    for (const [x, y, z, size] of [[-.18, .63, .03, .34], [.17, .72, -.06, .31], [-.015, .9, .035, .3]]) {
      const crown = new THREE.IcosahedronGeometry(1, 0);
      crown.scale(size, size * .72, size * .86).translate(x, y, z);
      crowns.push(crown);
    }
  } else {
    // Three staggered cedar/pine tiers leave a serrated canopy silhouette.
    for (const [base, height, width] of [[.25, .47, .32], [.46, .41, .25], [.68, .39, .17]]) {
      const crown = new THREE.ConeGeometry(width, height, 7, 1);
      crown.translate(0, base + height / 2, 0);
      crowns.push(crown);
    }
  }
  const geometry = joinGeometry(crowns);
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const colors = new Float32Array(position.count * 3);
  const shadow = new THREE.Color(broadleaf ? '#123d27' : '#123b27');
  const middle = new THREE.Color(broadleaf ? '#43814b' : '#2b6b3a');
  const light = new THREE.Color(broadleaf ? '#a0b867' : '#86a85d');
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const top = Math.max(0, Math.min(1, (position.getY(i) - .2) / 1.05));
    color.copy(shadow).lerp(middle, .25 + top * .72).lerp(light, Math.max(0, normal.getY(i)) * .3);
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function litMaterial(parameters: THREE.MeshStandardMaterialParameters, motion: Motion, time: { value: number }): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial(parameters);
  // Thin double-sided crests do not need Three's extra back/front render passes.
  if (parameters.transparent && parameters.side === THREE.DoubleSide) material.forceSinglePass = true;
  if (motion !== 'still') {
    material.onBeforeCompile = shader => {
      shader.uniforms.surfaceEffectsTime = time;
      shader.vertexShader = `uniform float surfaceEffectsTime;\nattribute float effectPhase;\n${shader.vertexShader}`;
      const deformation = motion === 'wind'
        ? `float w = sin(surfaceEffectsTime * 1.15 + effectPhase + position.y * 2.1);
           transformed.x += w * 0.043 * max(0.0, position.y) * max(0.0, position.y);
           transformed.z += cos(surfaceEffectsTime * 0.83 + effectPhase) * 0.022 * max(0.0, position.y);`
        : motion === 'water'
          ? `float surge = sin(surfaceEffectsTime * 1.7 + effectPhase + position.x * 2.8);
             transformed.y += surge * 0.09 * (0.45 + max(0.0, position.y));
             transformed.z += cos(surfaceEffectsTime * 1.1 + effectPhase) * 0.045;`
          : `float pulse = sin(surfaceEffectsTime * 1.3 + effectPhase);
             transformed.x *= 1.0 + pulse * 0.085;
             transformed.z *= 1.0 - pulse * 0.07;
             transformed.y *= 1.0 + pulse * 0.10;`;
      // Transform normals by J^-T BEFORE Three applies the instance/model normal
      // matrices. Applying this after defaultnormal_vertex would mix spaces when
      // instances have the intentionally non-uniform trunk/crest/bead scales.
      // These Jacobians are triangular/diagonal, so no matrix inverse or extra
      // position samples are needed. All scale/divisor terms stay positive (>= .9).
      const normalDeformation = motion === 'wind'
        ? `float effectHeight = max(0.0, position.y);
           float effectWindAngle = surfaceEffectsTime * 1.15 + effectPhase + position.y * 2.1;
           float effectSlopeX = 0.043 * (2.0 * effectHeight * sin(effectWindAngle) + 2.1 * effectHeight * effectHeight * cos(effectWindAngle));
           float effectSlopeZ = position.y > 0.0 ? cos(surfaceEffectsTime * 0.83 + effectPhase) * 0.022 : 0.0;
           objectNormal.y -= effectSlopeX * objectNormal.x + effectSlopeZ * objectNormal.z;
           objectNormal = normalize(objectNormal);
           #ifdef USE_TANGENT
             objectTangent.x += effectSlopeX * objectTangent.y;
             objectTangent.z += effectSlopeZ * objectTangent.y;
           #endif`
        : motion === 'water'
          ? `float effectSurgeAngle = surfaceEffectsTime * 1.7 + effectPhase + position.x * 2.8;
             float effectSlopeX = cos(effectSurgeAngle) * 0.09 * 2.8 * (0.45 + max(0.0, position.y));
             float effectSlopeY = position.y > 0.0 ? sin(effectSurgeAngle) * 0.09 : 0.0;
             float effectNormalY = objectNormal.y / (1.0 + effectSlopeY);
             objectNormal = normalize(vec3(objectNormal.x - effectSlopeX * effectNormalY, effectNormalY, objectNormal.z));
             #ifdef USE_TANGENT
               objectTangent.y += effectSlopeX * objectTangent.x + effectSlopeY * objectTangent.y;
             #endif`
          : `float effectPulse = sin(surfaceEffectsTime * 1.3 + effectPhase);
             vec3 effectScale = vec3(1.0 + effectPulse * 0.085, 1.0 + effectPulse * 0.10, 1.0 - effectPulse * 0.07);
             objectNormal = normalize(objectNormal / effectScale);
             #ifdef USE_TANGENT
               objectTangent *= effectScale;
             #endif`;
      shader.vertexShader = shader.vertexShader
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${normalDeformation}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${deformation}`);
    };
    material.customProgramCacheKey = () => `saju-surface-effects-${motion}-v2`;
  }
  return material;
}

function flameGeometry(): THREE.BufferGeometry {
  const ribbons: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const plane = new THREE.PlaneGeometry(1, 1, 1, 9);
    plane.translate(0, .5, 0).rotateY(i * Math.PI / 3);
    ribbons.push(plane);
  }
  return joinGeometry(ribbons);
}

function flameMaterial(time: { value: number }, quiet: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      surfaceEffectsTime: time,
      edgeColor: { value: new THREE.Color(quiet ? '#e94737' : '#ff4b06') },
      coreColor: { value: new THREE.Color(quiet ? '#ffd3a0' : '#fff2a6') },
      activity: { value: quiet ? .72 : 1 },
    },
    vertexShader: `
      uniform float surfaceEffectsTime;
      uniform float activity;
      attribute float effectPhase;
      varying vec2 vFlameUV;
      varying float vPhase;
      void main() {
        vFlameUV = uv; vPhase = effectPhase;
        float t = surfaceEffectsTime * activity;
        vec3 p = position;
        float height = position.y;
        float envelope = mix(1.0, 0.08, pow(height, 0.72));
        p.xz *= envelope;
        p.x += (sin(t * 3.4 + effectPhase + height * 7.2) * .18 + sin(t * 6.1 + effectPhase * 1.7 + height * 13.0) * .05) * height;
        p.z += cos(t * 2.8 + effectPhase + height * 6.0) * .12 * height;
        p.y *= .82 + .18 * sin(t * 3.2 + effectPhase);
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float surfaceEffectsTime;
      uniform vec3 edgeColor;
      uniform vec3 coreColor;
      uniform float activity;
      varying vec2 vFlameUV;
      varying float vPhase;
      void main() {
        float t = surfaceEffectsTime * activity;
        float h = vFlameUV.y;
        float center = abs(vFlameUV.x - .5) * 2.0;
        float tongues = sin(h * 20.0 - t * 5.0 + vPhase + vFlameUV.x * 8.0) * .12;
        float edge = 1.0 - smoothstep(.15 + tongues, 1.0, center);
        float alpha = edge * (1.0 - smoothstep(.30, 1.0, h)) * smoothstep(0.0, .12, h) * .72;
        if (alpha < .015) discard;
        vec3 color = mix(edgeColor, coreColor, pow(max(0.0, 1.0 - center), 3.0) * (1.0 - h * .8));
        gl_FragColor = vec4(color * 1.65, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true,
  });
}

function emberMaterial(time: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { surfaceEffectsTime: time },
    vertexShader: `
      uniform float surfaceEffectsTime;
      attribute float effectPhase;
      varying float vLife;
      void main() {
        float life = fract(surfaceEffectsTime * (.15 + .025 * sin(effectPhase)) + effectPhase / 6.2831853);
        vLife = life;
        vec3 p = position * (.024 * (1.0 - life * .65));
        p.y += life;
        p.x += sin(life * 6.0 + effectPhase) * .12 * life;
        p.z += cos(life * 7.0 + effectPhase) * .12 * life;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying float vLife;
      void main() {
        float alpha = smoothstep(0.0, .08, vLife) * (1.0 - smoothstep(.5, 1.0, vLife));
        gl_FragColor = vec4(mix(vec3(2.3, 1.15, .24), vec3(1.3, .16, .015), vLife), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

function crestGeometry(foam: boolean): THREE.BufferGeometry {
  // A short curling crest, not a torus/halo. Both ends taper into the water.
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const x = i / 12;
    const arch = Math.sin(x * Math.PI);
    points.push(new THREE.Vector3((x - .5) * 2, .12 + arch * .22, .20 * Math.cos(x * Math.PI)));
  }
  if (foam) return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, .038, 3, false);
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    positions.push(p.x, -.07, p.z + .15, p.x, p.y, p.z);
    uvs.push(i / 12, 0, i / 12, 1);
    if (i < 12) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Build once after a preset change and attach as a child of the matching sphere.
 * radius is the sphere's unscaled geometry radius (parent scaling is inherited).
 * SphereGeometry UVs have x = -cos(phi)*sin(theta); CPU mask lookup deliberately
 * uses that convention and canvas top = north. Material mask never drifts.
 *
 * Placement budgets are area-scaled (70% day, 30% month), not a second blend.
 * Every anchor AND its footprint are rejected near the other material. The
 * original sphere always remains visible between coherent groves/vents/crests.
 */
export function createSurfaceEffects(
  dayPreset: GanziThemePreset,
  monthPreset?: GanziThemePreset,
  maskStyle: SurfaceMaskStyle = 'pangaea',
  radius = 1,
): THREE.Group {
  if (!Number.isFinite(radius) || radius <= 0) throw new Error('Surface effects need a positive finite radius');
  const group = new THREE.Group();
  group.name = 'living-planet-surface-effects';
  const time = { value: 0 };
  states.set(group, { time, disposed: false });
  const mixed = !!monthPreset && monthPreset.key !== dayPreset.key;
  // One CPU-only allocation, freed after construction. No canvas readback/frame.
  const mask = mixed ? createSphereMask(maskStyle, MASK_WIDTH, MASK_HEIGHT) : null;
  const budget: SurfaceEffectsBudget = { drawCalls: 0, instances: 0, triangles: 0, bufferBytes: 0, maxRadius: radius * 1.19 };
  group.userData.surfaceEffects = { version: 1, dayKey: dayPreset.key, monthKey: monthPreset?.key, maskStyle, radius, budget };

  function alphaAt(normal: THREE.Vector3): number {
    if (!mask) return 1;
    const u = ((Math.atan2(normal.z, -normal.x) / TAU) % 1 + 1) % 1;
    const v = Math.acos(THREE.MathUtils.clamp(normal.y, -1, 1)) / Math.PI;
    const fx = u * (MASK_WIDTH - 1), fy = v * (MASK_HEIGHT - 1);
    const x = Math.floor(fx), y = Math.floor(fy);
    const x1 = Math.min(x + 1, MASK_WIDTH - 1), y1 = Math.min(y + 1, MASK_HEIGHT - 1);
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(mask[y * MASK_WIDTH + x], mask[y * MASK_WIDTH + x1], fx - x),
      THREE.MathUtils.lerp(mask[y1 * MASK_WIDTH + x], mask[y1 * MASK_WIDTH + x1], fx - x), fy - y,
    ) / 255;
  }
  function fits(normal: THREE.Vector3, region: Region, footprint: number): boolean {
    if (region === 'whole') return true;
    const accepts = (point: THREE.Vector3) => region === 'day' ? alphaAt(point) > .90 : alphaAt(point) < .10;
    if (!accepts(normal)) return false;
    const tangent = new THREE.Vector3().crossVectors(Math.abs(normal.y) > .95 ? new THREE.Vector3(1, 0, 0) : UP, normal).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent);
    const point = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      point.copy(normal).addScaledVector(tangent, Math.cos(angle) * footprint).addScaledVector(bitangent, Math.sin(angle) * footprint).normalize();
      if (!accepts(point)) return false;
    }
    return true;
  }
  function placements(preset: GanziThemePreset, region: Region, fullCount: number, footprint: number, clustered = false): Placement[] {
    const target = Math.round(fullCount * (region === 'day' ? .7 : region === 'month' ? .3 : 1));
    const random = seededRandom(hashSeed(`${preset.key}:${maskStyle}:${region}:relief-v1`));
    const result: Placement[] = [];
    const center = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const bitangent = new THREE.Vector3();
    let groove = 0;
    for (let attempt = 0; attempt < target * 100 && result.length < target; attempt++) {
      if (!clustered || groove % 9 === 0) {
        const y = random() * 1.92 - .96;
        const angle = random() * TAU;
        const r = Math.sqrt(1 - y * y);
        center.set(-r * Math.cos(angle), y, r * Math.sin(angle));
        tangent.crossVectors(UP, center).normalize(); bitangent.crossVectors(center, tangent);
        groove = 0;
      }
      const normal = center.clone();
      if (clustered) {
        const spread = Math.sqrt(groove) * .034;
        const angle = groove * 2.399963 + random() * .45;
        normal.addScaledVector(tangent, Math.cos(angle) * spread).addScaledVector(bitangent, Math.sin(angle) * spread).normalize();
      }
      groove++;
      if (!fits(normal, region, footprint)) continue;
      result.push({ normal, twist: random() * TAU, size: .72 + random() * .5, phase: random() * TAU });
    }
    return result;
  }
  function batch(
    preset: GanziThemePreset, region: Region, kind: string, list: Placement[], geometry: THREE.BufferGeometry,
    material: THREE.Material, scale: THREE.Vector3, offset: number, tint?: (index: number) => THREE.Color,
  ): THREE.InstancedMesh | undefined {
    if (!list.length) { geometry.dispose(); material.dispose(); return undefined; }
    const phases = Float32Array.from(list, placement => placement.phase);
    geometry.setAttribute('effectPhase', new THREE.InstancedBufferAttribute(phases, 1));
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    mesh.name = `${region}-${preset.key}-${kind}`;
    mesh.userData.surfaceEffect = { kind, region, presetKey: preset.key };
    const matrix = new THREE.Matrix4(), orientation = new THREE.Quaternion(), twist = new THREE.Quaternion();
    const position = new THREE.Vector3(), instanceScale = new THREE.Vector3();
    list.forEach((placement, i) => {
      orientation.setFromUnitVectors(UP, placement.normal);
      twist.setFromAxisAngle(UP, placement.twist); orientation.multiply(twist);
      position.copy(placement.normal).multiplyScalar(radius * offset);
      instanceScale.copy(scale).multiplyScalar(radius * placement.size);
      matrix.compose(position, orientation, instanceScale);
      mesh.setMatrixAt(i, matrix);
      if (tint) mesh.setColorAt(i, tint(i));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // Vertex animation must not be culled against undeformed per-instance bounds.
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), budget.maxRadius);
    mesh.frustumCulled = true;
    mesh.castShadow = false; mesh.receiveShadow = false;
    group.add(mesh);
    budget.drawCalls++;
    budget.instances += list.length;
    budget.triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3 * list.length;
    budget.bufferBytes += mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0) + (geometry.index?.array.byteLength ?? 0);
    for (const attribute of Object.values(geometry.attributes)) budget.bufferBytes += attribute.array.byteLength;
    return mesh;
  }

  function addRegion(preset: GanziThemePreset, region: Region): void {
    const stem = preset.stem;
    const secondary = new THREE.Color(preset.surface.secondaryColor);
    const branchTint = (hashSeed(preset.branch) % 17) / 17;
    if (stem === '갑' || stem === '을') {
      const broad = stem === '을';
      const list = placements(preset, region, broad ? 920 : 860, .051, true);
      const scale = new THREE.Vector3(broad ? .058 : .062, broad ? .070 : .082, broad ? .058 : .062);
      const trunk = new THREE.CylinderGeometry(.055, .075, .77, 5, 1).translate(0, .385, 0);
      batch(preset, region, 'trunks', list, trunk, litMaterial({ color: broad ? '#66513b' : '#544735', roughness: 1 }, 'wind', time), scale, 1.008);
      batch(preset, region, broad ? 'broadleaf-canopy' : 'tiered-forest-canopy', list, treeGeometry(broad),
        litMaterial({ color: '#ffffff', roughness: .91, vertexColors: true }, 'wind', time), scale, 1.008,
        i => new THREE.Color().setHSL(.24 + branchTint * .055 + Math.sin(list[i].phase) * .018, .22, .72 + Math.sin(list[i].phase * 2) * .11));
      if (broad) {
        // Short intertwined climbing stems at the same grove anchors, under crowns.
        const curve = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => {
          const t = i / 8;
          return new THREE.Vector3(Math.sin(t * TAU * 1.3) * .13, .1 + t * .57, Math.cos(t * TAU * 1.3) * .13);
        }));
        batch(preset, region, 'climbing-vines', list.filter((_, i) => i % 3 === 0), new THREE.TubeGeometry(curve, 8, .025, 3, false),
          litMaterial({ color: '#819353', roughness: .92 }, 'wind', time), scale, 1.008);
      }
    } else if (stem === '병' || stem === '정') {
      const quiet = stem === '정';
      const list = placements(preset, region, quiet ? 70 : 94, .051, true);
      const mound = new THREE.IcosahedronGeometry(1, 1).translate(0, .28, 0);
      batch(preset, region, 'lava-domes', list, mound,
        litMaterial({ color: quiet ? '#762217' : '#933115', emissive: quiet ? '#a7250a' : '#e43b05', emissiveIntensity: .65, roughness: .39, metalness: .22 }, 'mercury', time),
        new THREE.Vector3(.026, .018, .024), 1.025);
      batch(preset, region, 'flame-plumes', list, flameGeometry(), flameMaterial(time, quiet),
        new THREE.Vector3(quiet ? .039 : .054, quiet ? .080 : .115, quiet ? .039 : .054), 1.032);
      // Each bounded vent emits one ember at a staggered phase, never a global halo.
      batch(preset, region, 'rising-embers', list, new THREE.OctahedronGeometry(1, 0), emberMaterial(time),
        new THREE.Vector3(.095, quiet ? .105 : .125, .095), 1.035);
    } else if (stem === '무' || stem === '기') {
      const ceramic = stem === '기';
      const list = placements(preset, region, ceramic ? 135 : 172, .056, true);
      const rock = ceramic ? new THREE.CylinderGeometry(.84, 1, .55, 7, 1).translate(0, .2, 0) : new THREE.IcosahedronGeometry(1, 0).translate(0, .23, 0);
      batch(preset, region, ceramic ? 'earthen-terraces' : 'sandstone-outcrops', list, rock,
        litMaterial({ color: '#ffffff', roughness: ceramic ? .68 : .97, metalness: .03, flatShading: true }, 'still', time),
        new THREE.Vector3(ceramic ? .034 : .032, ceramic ? .028 : .033, ceramic ? .038 : .029), 1.023,
        i => new THREE.Color(preset.surface.primaryColor).lerp(secondary, .18 + list[i].phase / TAU * .34));
      if (!ceramic) {
        const strata = new THREE.CylinderGeometry(.82, 1, .18, 6).translate(0, .9, 0);
        batch(preset, region, 'strata-caps', list.filter((_, i) => i % 3 === 0), strata,
          litMaterial({ color: secondary, roughness: .95 }, 'still', time), new THREE.Vector3(.030, .028, .026), 1.023);
      }
    } else if (stem === '경' || stem === '신') {
      const mercury = stem === '신';
      const list = placements(preset, region, mercury ? 155 : 180, .045, true);
      const geometry = mercury ? new THREE.IcosahedronGeometry(1, 1).translate(0, .38, 0)
        : new THREE.CylinderGeometry(.18, .62, 1, 4, 1).rotateY(Math.PI / 4).translate(0, .48, 0);
      batch(preset, region, mercury ? 'mercury-beads' : 'titanium-fins', list, geometry,
        litMaterial({ color: '#ffffff', roughness: mercury ? .12 : .28, metalness: .93, emissive: '#486579', emissiveIntensity: .045, flatShading: !mercury }, mercury ? 'mercury' : 'still', time),
        new THREE.Vector3(mercury ? .021 : .024, mercury ? .015 : .052, mercury ? .028 : .044), 1.021,
        i => secondary.clone().lerp(new THREE.Color(preset.surface.primaryColor), .16 + list[i].phase / TAU * .32));
    } else if (stem === '임' || stem === '계') {
      const quiet = stem === '계';
      const list = placements(preset, region, quiet ? 48 : 68, .078);
      // Flow direction is coherent instead of randomly oriented decorative rings.
      list.forEach(placement => { placement.twist = .24 + Math.sin(placement.normal.y * 4 + branchTint) * .32; });
      const scale = new THREE.Vector3(quiet ? .043 : .052, quiet ? .031 : .041, quiet ? .031 : .04);
      batch(preset, region, 'raised-water-crests', list, crestGeometry(false),
        litMaterial({ color: quiet ? '#459eaa' : '#447fba', roughness: .19, metalness: .31, transparent: true, opacity: .69, depthWrite: false, side: THREE.DoubleSide }, 'water', time), scale, 1.023);
      batch(preset, region, 'foam-crest-lines', list, crestGeometry(true),
        litMaterial({ color: quiet ? '#b8e6dc' : '#a7d4ed', emissive: '#294558', emissiveIntensity: .08, roughness: .43, transparent: true, opacity: quiet ? .48 : .69, depthWrite: false }, 'water', time), scale, 1.023);
    }
  }
  addRegion(dayPreset, mixed ? 'day' : 'whole');
  if (mixed && monthPreset) addRegion(monthPreset, 'month');
  animateSurfaceEffects(group, 0);
  return group;
}


/** Fire spirit accent using the exact same bounded flame/ember assets as planets.
 * The caller supplies its own core/canopy silhouette. Keep the front eye area
 * (local y≈0, z>0) empty. Other stems intentionally return an empty owned group.
 * Attach to a spherical/seed-like core of this radius, then animate/dispose using
 * the same functions above. No full-sphere surface is created by this helper. */
export function createSpiritCrownEffects(preset: GanziThemePreset, radius = .72): THREE.Group {
  if (!Number.isFinite(radius) || radius <= 0) throw new Error('Spirit crown effects need a positive finite radius');
  if (preset.stem !== '병' && preset.stem !== '정') {
    const group = new THREE.Group();
    group.name = 'empty-spirit-crown-effects';
    states.set(group, { time: { value: 0 }, disposed: false });
    return group;
  }
  const group = createSurfaceEffects(preset, undefined, 'pangaea', radius);
  group.name = 'living-spirit-fire-crown';
  const budget = group.userData.surfaceEffects.budget as SurfaceEffectsBudget;
  budget.instances = 0; budget.triangles = 0;
  const matrix = new THREE.Matrix4(), direction = new THREE.Vector3(), color = new THREE.Color();
  for (const child of group.children) {
    const mesh = child as THREE.InstancedMesh;
    const phases = mesh.geometry.getAttribute('effectPhase') as THREE.InstancedBufferAttribute;
    let kept = 0;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix); direction.setFromMatrixPosition(matrix).normalize();
      if (direction.y < .18 || (direction.z > .30 && direction.y < .58)) continue;
      mesh.setMatrixAt(kept, matrix);
      phases.setX(kept, phases.getX(i));
      if (mesh.instanceColor) { mesh.getColorAt(i, color); mesh.setColorAt(kept, color); }
      kept++;
    }
    mesh.count = kept;
    mesh.instanceMatrix.needsUpdate = true; phases.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    budget.instances += kept;
    budget.triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3 * kept;
    mesh.userData.surfaceEffect.spiritCrown = true;
  }
  return group;
}
