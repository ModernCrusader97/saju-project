import * as THREE from 'three';

export type AccentStem = '甲' | '乙' | '丙' | '丁' | '戊' | '壬' | '癸';
export interface StemAccentOptions {
  /** Equatorial radius in local world units. Defaults to 1. */
  radius?: number;
  /** Total polar height, centered on the origin. Defaults to 2. */
  height?: number;
  quality?: 'low' | 'high';
  /** Optional actual mesh emitter in accent-group local coordinates; fire only. */
  surfaceEmitter?: (index: number, epoch: number, group: THREE.Group, offset: number) => THREE.Vector3;
}
export interface StemAccents {
  group: THREE.Group;
  /** Absolute seconds; repeat calls and backwards seeks produce identical poses. */
  /** Optional camera enables correct back-to-front alpha sorting for fire. */
  update(timeSeconds: number, camera?: THREE.Camera): void;
  /** Disposes only owned resources, removes the group, and is safe to repeat. */
  dispose(): void;
}

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const fract = (value: number): number => value - Math.floor(value);
const hash = (seed: number): number => fract(Math.sin(seed * 127.1 + 311.7) * 43758.5453123);

// Matches the local-space stone/flow shader hash and trilinear value noise.
// Used only to choose a small number of meaningful source anchors at creation.
const f32 = Math.fround;
function fieldHash(x: number, y: number, z: number): number {
  x = f32(fract(f32(f32(x) * f32(0.1031))));
  y = f32(fract(f32(f32(y) * f32(0.1031))));
  z = f32(fract(f32(f32(z) * f32(0.1031))));
  const dot = f32(f32(f32(x * f32(y + f32(33.33))) + f32(y * f32(z + f32(33.33)))) + f32(z * f32(x + f32(33.33))));
  x = f32(x + dot); y = f32(y + dot); z = f32(z + dot);
  return fract(f32(f32(x + y) * z));
}
function fieldNoise(x: number, y: number, z: number): number {
  x = f32(x); y = f32(y); z = f32(z);
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const smooth = (v: number): number => f32(f32(v * v) * f32(3 - f32(2 * v)));
  const sx = smooth(fract(x)), sy = smooth(fract(y)), sz = smooth(fract(z));
  const mix = (a: number, b: number, t: number): number => f32(f32(a * f32(1 - t)) + f32(b * t));
  return mix(mix(mix(fieldHash(ix, iy, iz), fieldHash(ix + 1, iy, iz), sx),
    mix(fieldHash(ix, iy + 1, iz), fieldHash(ix + 1, iy + 1, iz), sx), sy),
    mix(mix(fieldHash(ix, iy, iz + 1), fieldHash(ix + 1, iy, iz + 1), sx),
    mix(fieldHash(ix, iy + 1, iz + 1), fieldHash(ix + 1, iy + 1, iz + 1), sx), sy), sz);
}
function fieldFbm(x: number, y: number, z: number, octaves: number): number {
  x = f32(x); y = f32(y); z = f32(z);
  let sum = 0, amplitude = f32(0.52);
  for (let i = 0; i < octaves; i++) {
    sum = f32(sum + f32(amplitude * fieldNoise(x, y, z)));
    x = f32(f32(x * f32(2.03)) + f32(7.1));
    y = f32(f32(y * f32(2.03)) + f32(3.7));
    z = f32(f32(z * f32(2.03)) + f32(8.9));
    amplitude = f32(amplitude * f32(0.48));
  }
  return sum;
}

/**
 * Optional, mesh-independent accents for a Y-up ellipsoid centered at (0,0,0).
 * Match its radius/height to the underlying body and parent both under the same
 * transform. These are deliberately restrained details, not a full body shader.
 * Use image-based/environment lighting for leaves and transmissive dew. Bloom is
 * optional; procedural fire cards have soft alpha silhouettes without postprocessing.
 * All assets are procedural and locally owned. No external texture, renderer or DOM needed.
 */
export function createStemAccents(
  stem: AccentStem,
  options: StemAccentOptions = {},
): StemAccents {
  const radius = options.radius ?? 1;
  const height = options.height ?? 2;
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new RangeError('Stem accents require finite positive radius and height.');
  }
  if (stem !== '甲' && stem !== '乙' && stem !== '丙' && stem !== '丁' && stem !== '戊' && stem !== '壬' && stem !== '癸') {
    throw new RangeError('Stem accents support 甲, 乙, 丙, 丁, 戊, 壬 and 癸.');
  }
  const high = options.quality !== 'low';
  const halfHeight = height / 2;
  // Keeps details proportional for both a sphere and a tall ellipsoid.
  const unit = Math.min(radius, halfHeight);
  const group = new THREE.Group();
  group.name = `StemAccents_${stem}`;
  group.userData.stem = stem;
  group.userData.accentBounds = { radius, height };
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const instancedMeshes = new Set<THREE.InstancedMesh>();
  const animations: Array<(time: number, camera?: THREE.Camera) => void> = [];
  let disposed = false;

  function ownGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
    geometries.add(geometry);
    return geometry;
  }
  function ownMaterial<T extends THREE.Material>(material: T): T {
    materials.add(material);
    return material;
  }
  function surface(latitude: number, longitude: number, offset = 0): THREE.Vector3 {
    const s = Math.sin(latitude);
    const point = new THREE.Vector3(radius * s * Math.cos(longitude), halfHeight * Math.cos(latitude), radius * s * Math.sin(longitude));
    if (offset !== 0) point.addScaledVector(normalAt(point), offset);
    return point;
  }
  function normalAt(point: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(point.x / (radius * radius), point.y / (halfHeight * halfHeight), point.z / (radius * radius)).normalize();
  }
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, name: string): THREE.Mesh {
    const result = new THREE.Mesh(geometry, material);
    result.name = name;
    group.add(result);
    return result;
  }
  function tube(points: THREE.Vector3[], thickness: number, segments: number, sides: number, taper = false): THREE.BufferGeometry {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const geometry = new THREE.TubeGeometry(curve, segments, thickness, sides, false);
    if (taper) {
      const position = geometry.getAttribute('position');
      // The tip remains finite; an open zero-radius cap can create degenerate normals.
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const center = curve.getPointAt(t);
        const width = 0.11 + 0.89 * Math.pow(1 - t, 0.6);
        for (let j = 0; j <= sides; j++) {
          const index = i * (sides + 1) + j;
          position.setXYZ(index,
            center.x + (position.getX(index) - center.x) * width,
            center.y + (position.getY(index) - center.y) * width,
            center.z + (position.getZ(index) - center.z) * width);
        }
      }
      geometry.computeVertexNormals();
    }
    geometry.computeBoundingSphere();
    return ownGeometry(geometry);
  }

  if (stem === '甲' || stem === '乙') {
    const woody = stem === '甲';
    const vineMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({
      color: woody ? 0x745037 : 0x678626, roughness: woody ? 0.88 : 0.46, metalness: 0,
      clearcoat: woody ? 0.02 : 0.23, clearcoatRoughness: 0.34,
    }));
    const youngVineMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: woody ? 0x96704b : 0xa1b94c, roughness: woody ? 0.79 : 0.43 }));
    const leafMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({
      color: 0xb1cf50, vertexColors: true, roughness: 0.5,
      side: THREE.DoubleSide, sheen: 0.32, sheenColor: new THREE.Color(0xc9e88a),
      sheenRoughness: 0.72, clearcoat: 0.14, clearcoatRoughness: 0.48,
    }));
    const veinMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xd4d979, roughness: 0.65 }));
    const coils = woody ? 0 : high ? 20 : 14;
    const vineBatches: [THREE.BufferGeometry[], THREE.BufferGeometry[]] = [[], []];
    for (let i = 0; i < coils; i++) {
      const points: THREE.Vector3[] = [];
      const bundle = Math.floor(i / 3);
      const strand = i % 3;
      const bundlePhase = bundle * GOLDEN_ANGLE + 0.29 * hash(bundle + 260);
      const strandPhase = strand * TAU / 3;
      const winding = hash(bundle + 210) > 0.46 ? 1 : -1;
      const startLatitude = 2.47 + 0.38 * hash(i + 415);
      const endLatitude = 0.24 + 0.82 * hash(i + 425);
      const pointCount = high ? 78 : 60;
      for (let j = 0; j <= pointCount; j++) {
        const t = j / pointCount;
        const weave = t * TAU * (2.7 + 0.35 * hash(bundle + 170)) + strandPhase;
        const curl = THREE.MathUtils.smoothstep(t, 0.77, 1);
        const latitude = startLatitude + (endLatitude - startLatitude) * t
          + 0.07 * Math.sin(t * TAU * 1.8 + bundlePhase)
          + 0.052 * Math.sin(weave) + 0.13 * Math.sin(curl * Math.PI * 1.2);
        const longitude = bundlePhase + t * TAU * winding * (0.68 + 0.14 * hash(bundle + 20))
          + 0.2 * Math.sin(t * TAU * 1.4 + bundlePhase)
          + 0.08 * Math.cos(weave)
          + (strand - 1) * 0.033 + winding * 0.31 * Math.sin(curl * Math.PI * 1.15);
        // Alternating radial lift puts strands over and under each other.
        const lift = unit * (0.03 + 0.025 * Math.sin(weave + 0.8) + curl * (0.055 + 0.07 * hash(i + 480)));
        points.push(surface(latitude, longitude, lift));
      }
      const fine = strand === 2;
      const thickness = unit * (fine ? 0.014 + 0.006 * hash(i + 320) : 0.027 + 0.012 * hash(i + 330));
      vineBatches[fine ? 1 : 0].push(tube(points, thickness, high ? 112 : 76, high ? 7 : 6));
    }
    // Merge owned static tubes by material to keep 14–20 entwined vines at two
    // draw calls. Leaves remain separate only where local movement needs them.
    for (let batch = 0; batch < vineBatches.length; batch++) {
      const sources = vineBatches[batch];
      if (!sources.length) continue;
      const count = sources.reduce((sum, geometry) => sum + geometry.getAttribute('position').count, 0);
      const positions = new Float32Array(count * 3);
      const normals = new Float32Array(count * 3);
      const uvs = new Float32Array(count * 2);
      const indices: number[] = [];
      let vertexOffset = 0;
      for (const source of sources) {
        const position = source.getAttribute('position');
        positions.set(position.array, vertexOffset * 3);
        normals.set(source.getAttribute('normal').array, vertexOffset * 3);
        uvs.set(source.getAttribute('uv').array, vertexOffset * 2);
        const index = source.getIndex();
        if (index) for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + vertexOffset);
        vertexOffset += position.count;
        source.dispose();
        geometries.delete(source);
      }
      const merged = ownGeometry(new THREE.BufferGeometry());
      merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      merged.setIndex(indices);
      merged.computeBoundingSphere();
      const vine = mesh(merged, batch === 0 ? vineMaterial : youngVineMaterial, batch === 0 ? 'IntertwinedVineBundles' : 'FineWeavingStems');
      vine.userData.vineCount = sources.length;
      vine.castShadow = true;
      vine.receiveShadow = true;
    }

    // A cupped lanceolate leaf with a center ridge, not a flat sprite.
    const leafVertices: number[] = [];
    const leafColors: number[] = [];
    const leafIndices: number[] = [];
    const rows = high ? 12 : 7;
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      const width = 0.31 * Math.pow(Math.sin(Math.PI * t), 0.82) * (1 - 0.14 * t);
      for (let j = 0; j < 3; j++) {
        const across = j - 1;
        leafVertices.push(across * width, t, 0.1 * Math.sin(Math.PI * t) * (1 - 0.75 * across * across) + 0.13 * t * t);
        const lightness = j === 1 ? 1 : 0.76;
        leafColors.push(0.68 * lightness + 0.18 * t, 0.85 * lightness + 0.1 * t, 0.34 * lightness);
      }
    }
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < 2; j++) {
        const a = i * 3 + j;
        leafIndices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
      }
    }
    const leafGeometry = ownGeometry(new THREE.BufferGeometry());
    leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute(leafVertices, 3));
    leafGeometry.setAttribute('color', new THREE.Float32BufferAttribute(leafColors, 3));
    leafGeometry.setIndex(leafIndices);
    leafGeometry.computeVertexNormals();
    const veinPoints = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      return new THREE.Vector3(0, t, 0.1 * Math.sin(Math.PI * t) + 0.13 * t * t + 0.005);
    });
    const veinGeometry = tube(veinPoints, 0.009, 12, 4, true);
    const sproutCount = woody ? (high ? 8 : 6) : (high ? 12 : 8);
    for (let i = 0; i < sproutCount; i++) {
      const latitude = woody ? 0.42 + 1.46 * hash(i + 40) : Math.acos(0.87 - 1.58 * ((i + 0.5) / sproutCount)) + 0.07 * (hash(i + 40) - 0.5);
      const longitude = i * GOLDEN_ANGLE;
      const base = surface(latitude, longitude, unit * 0.014);
      const normal = normalAt(base);
      const tangent = new THREE.Vector3(-Math.sin(longitude), 0.26, Math.cos(longitude)).normalize();
      const end = base.clone().addScaledVector(normal, unit * (woody ? 0.17 + 0.065 * hash(i + 14) : 0.105 + 0.065 * hash(i + 14))).addScaledVector(tangent, unit * (woody ? 0.052 : 0.095));
      if (woody) end.y += unit * 0.075;
      const branchRoot = woody ? new THREE.Group() : null;
      if (branchRoot) {
        branchRoot.name = `SwayingTwigCluster_${i}`;
        branchRoot.position.copy(base);
        group.add(branchRoot);
        animations.push((time) => {
          branchRoot.rotation.x = 0.018 * Math.sin(time * 0.7 + i * 1.2);
          branchRoot.rotation.z = 0.023 * Math.sin(time * 0.63 + i * 1.9);
        });
      }
      const midpoint = base.clone().lerp(end, 0.51).addScaledVector(normal, unit * 0.017);
      const branchPoints = woody ? [base, midpoint, end] : [
        base,
        base.clone().lerp(end, 0.32).addScaledVector(tangent, unit * 0.035),
        midpoint.clone().addScaledVector(normal, unit * 0.023),
        end.clone().lerp(midpoint, 0.25).addScaledVector(tangent, unit * -0.04),
        end,
      ];
      const branchGeometry = tube(branchPoints, unit * (woody ? 0.019 : 0.007), high ? 12 : 8, woody ? 6 : 4, true);
      if (woody) {
        // Fine geometry irregularity catches light like bark rather than polished wire.
        const positions = branchGeometry.getAttribute('position');
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const displacement = unit * (hash(vertex + i * 13) - 0.5) * 0.003;
          positions.setXYZ(vertex, positions.getX(vertex) + normal.x * displacement,
            positions.getY(vertex) + normal.y * displacement, positions.getZ(vertex) + normal.z * displacement);
        }
        branchGeometry.computeVertexNormals();
        branchGeometry.computeBoundingSphere();
        const forkEnd = midpoint.clone().addScaledVector(normal, unit * 0.07).addScaledVector(tangent, unit * -0.1);
        forkEnd.y += unit * 0.05;
        const fork = mesh(tube([midpoint, midpoint.clone().lerp(forkEnd, 0.5), forkEnd], unit * 0.011, 6, 5, true), youngVineMaterial, `TwigFork_${i}`);
        fork.castShadow = true;
        if (branchRoot) branchRoot.attach(fork);
      }
      const stemMesh = mesh(branchGeometry, woody ? vineMaterial : youngVineMaterial, woody ? `RoughTwig_${i}` : `SproutStem_${i}`);
      stemMesh.castShadow = true;
      if (branchRoot) branchRoot.attach(stemMesh);
      const pivot = new THREE.Group();
      pivot.name = `LeafSprout_${i}`;
      pivot.position.copy(end);
      const leafUp = normal.clone().multiplyScalar(0.65).addScaledVector(tangent, 0.8).normalize();
      pivot.quaternion.setFromUnitVectors(Y_AXIS, leafUp);
      group.add(pivot);
      if (branchRoot) branchRoot.attach(pivot);
      const length = unit * (woody ? 0.135 + 0.045 * hash(i + 90) : 0.165 + 0.055 * hash(i + 90));
      for (let side = 0; side < 2; side++) {
        const leaf = new THREE.Group();
        leaf.scale.setScalar(length * (side === 0 ? 1 : 0.76));
        leaf.rotation.set(0.23, side === 0 ? 0.36 : -0.65, side === 0 ? -0.37 : 1.12);
        const restX = leaf.rotation.x;
        const restZ = leaf.rotation.z;
        const blade = new THREE.Mesh(leafGeometry, leafMaterial);
        blade.name = 'CuppedLeaf';
        blade.castShadow = true;
        const vein = new THREE.Mesh(veinGeometry, veinMaterial);
        vein.name = 'LeafMidrib';
        leaf.add(blade, vein);
        pivot.add(leaf);
        animations.push((time) => {
          leaf.rotation.x = restX + 0.045 * Math.sin(time * 0.82 + i * 1.7 + side);
          leaf.rotation.z = restZ + 0.025 * Math.sin(time * 0.61 + i * 0.8 + side);
        });
      }
    }
  } else if (stem === '丙' || stem === '丁') {
    const candle = stem === '丁';
    // Dynamic particle silhouettes and scrolling UV distortion, following the
    // game-VFX approach described by Keith Guerrette (Naughty Dog), GDC 2012:
    // https://www.gdcvault.com/play/1016066/The-Tricks-Up-Our-Sleeves
    // This WebGL implementation uses three packed-noise reads, no external art,
    // no scene-depth pass, and one instanced transparent draw per emitter.
    const noiseSize = 256;
    const noiseData = new Uint8Array(noiseSize * noiseSize * 4);
    function tiledNoise(x: number, y: number, period: number, seed: number): number {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const sx = fract(x) ** 2 * (3 - 2 * fract(x));
      const sy = fract(y) ** 2 * (3 - 2 * fract(y));
      const corner = (dx: number, dy: number): number => hash(((ix + dx) % period) * 43 + ((iy + dy) % period) * 97 + seed);
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(corner(0, 0), corner(1, 0), sx), THREE.MathUtils.lerp(corner(0, 1), corner(1, 1), sx), sy);
    }
    for (let y = 0; y < noiseSize; y++) {
      for (let x = 0; x < noiseSize; x++) {
        const i = (y * noiseSize + x) * 4;
        noiseData[i] = Math.round(tiledNoise(x / noiseSize * 4, y / noiseSize * 4, 4, 14) * 255);
        noiseData[i + 1] = Math.round(tiledNoise(x / noiseSize * 9, y / noiseSize * 9, 9, 63) * 255);
        noiseData[i + 2] = 0;
        noiseData[i + 3] = 255;
      }
    }
    const noiseTexture = new THREE.DataTexture(noiseData, noiseSize, noiseSize, THREE.RGBAFormat);
    noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;
    noiseTexture.minFilter = noiseTexture.magFilter = THREE.LinearFilter;
    noiseTexture.generateMipmaps = false;
    noiseTexture.needsUpdate = true;
    textures.add(noiseTexture);

    const uniforms = {
      uTime: { value: 0 },
      uNoise: { value: noiseTexture },
      uBodyRadii: { value: new THREE.Vector3(radius, halfHeight, radius) },
      uWorldToLocal: { value: new THREE.Matrix4() },
      uWorldScale: { value: 1 },
      uUnit: { value: unit },
    };
    const fireMaterial = ownMaterial(new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      toneMapped: true,
      vertexShader: /* glsl */ `
        attribute vec4 aParticle;
        attribute vec4 aFlow;
        uniform float uTime;
        uniform mat4 uWorldToLocal;
        uniform float uWorldScale;
        varying vec2 vUv;
        varying vec4 vParticle;
        varying vec3 vBodyPosition;
        void main() {
          vUv = uv;
          vParticle = aParticle;
          vec4 center = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vec3 forward = normalize(vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]));
          vec3 up = vec3(0.0, 1.0, 0.0) - forward * forward.y;
          if (dot(up, up) < 0.0001) up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          up = normalize(up);
          vec3 right = normalize(cross(up, forward));
          vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz)) * uWorldScale;
          // Subdivided cards bend continuously through a shared low-frequency
          // wind field. The lower and upper ends no longer form rigid columns.
          float y = uv.y;
          float strength = 1.0 - aParticle.z * 0.82;
          float roll = sin(y * 5.5 + aFlow.w) - sin(aFlow.w);
          float curl = sin(y * 9.0 - uTime * 2.1 + aParticle.y * 9.0);
          vec3 drift = vec3(aFlow.x, 0.0, aFlow.y) * (y * y - 0.28) * size.y;
          vec3 worldPosition = center.xyz + right * position.x * size.x + up * position.y * size.y;
          worldPosition += strength * (drift + right * (roll * 0.14 + curl * y * 0.065) * size.x);
          worldPosition += up * (cos(y * 5.5 + aFlow.w) - cos(aFlow.w)) * size.y * 0.07 * strength;
          vBodyPosition = (uWorldToLocal * vec4(worldPosition, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D uNoise;
        uniform vec3 uBodyRadii;
        uniform float uUnit;
        varying vec2 vUv;
        varying vec4 vParticle;
        varying vec3 vBodyPosition;
        void main() {
          float age = vParticle.x;
          float seed = vParticle.y;
          float candle = vParticle.z;
          float core = vParticle.w;
          float y = vUv.y;
          // Domain-warped, advected density creates rolling, tearing wisps.
          // Every card boundary fades to zero; erosion never exposes a rectangle.
          vec2 flowUV = vec2(vUv.x * 0.72 + seed * 3.7, y * 0.76 - uTime * (0.51 + seed * 0.37));
          vec2 flow = texture2D(uNoise, flowUV).rg;
          vec2 detailUV = flowUV * vec2(1.67, 1.42) + (flow - 0.5) * vec2(0.24, 0.31);
          vec2 detail = texture2D(uNoise, detailUV + vec2(uTime * 0.13, seed * 2.1)).rg;
          vec2 fine = texture2D(uNoise, flowUV * vec2(2.8, 2.1) + (detail - 0.5) * 0.27 - vec2(uTime * 0.11, uTime * 0.19)).rg;
          float bend = (flow.r - 0.5) * (0.28 + y * 0.62) + (detail.r - 0.5) * y * 0.22;
          float x = vUv.x * 2.0 - 1.0 + bend;
          float bulge = 0.70 + 0.22 * sin(y * 7.0 + flow.r * 5.0 - uTime * 1.6 + seed * 8.0);
          float width = mix(0.72, 0.28, smoothstep(0.26, 1.0, y)) * bulge;
          width *= mix(1.0, 0.85, candle);
          float interior = 1.0 - abs(x) / max(width, 0.06);
          float edge = smoothstep(-0.02, 0.34, interior);
          float density = flow.g * 0.42 + detail.g * 0.38 + fine.r * 0.20;
          float threshold = 0.21 + y * 0.23 + age * age * 0.17;
          float erosion = smoothstep(threshold - 0.035, threshold + 0.19, density + interior * 0.09);
          float rim = smoothstep(0.0, 0.095, vUv.x) * (1.0 - smoothstep(0.905, 1.0, vUv.x));
          float vertical = smoothstep(0.0, 0.14, y) * (1.0 - smoothstep(0.75, 1.0, y));
          float life = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.59, 1.0, age));
          float outside = (length(vBodyPosition / uBodyRadii) - 1.0) * uUnit;
          float contactFade = smoothstep(-uUnit * 0.018, uUnit * 0.06, outside);
          float alpha = edge * erosion * vertical * rim * life * contactFade * mix(0.77, 0.9, candle);
          if (alpha < 0.003) discard;
          float hot = smoothstep(0.12, 0.91, interior) * (1.0 - y * 0.78);
          vec3 orange = vec3(1.60, 0.18, 0.008);
          vec3 gold = vec3(1.95, 0.85, 0.075);
          vec3 color = mix(orange, gold, clamp(hot * 0.63 + density * 0.23, 0.0, 1.0));
          float blueSource = core * hot * (1.0 - smoothstep(0.045, 0.20, y)) * (1.0 - age * 0.8);
          color = mix(color, vec3(0.57, 1.1, 1.8), blueSource * 0.62);
          gl_FragColor = vec4(color, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }));
    if (!candle) {
      // 丙 only: four evolving flame families share one transparent draw. 丁's
      // original shaders, dimensions, lifetimes and trajectories stay untouched.
      fireMaterial.vertexShader = fireMaterial.vertexShader
        .replace('varying vec2 vUv;', 'varying vec2 vUv;\n        varying float vFamily;')
        .replace('vUv = uv;', 'vUv = uv;\n          vFamily = aFlow.z;')
        .replace('vBodyPosition = (uWorldToLocal', /* glsl */ `
          float family = aFlow.z;
          float age = aParticle.x;
          float phase = aParticle.y * 6.2831853;
          float tip = smoothstep(0.12, 1.0, y);
          float wave = sin(y * 6.8 - uTime * 4.4 + phase);
          // Broad sheets roll over in 3D; tongues stretch and whip; the two
          // fork/burst families open laterally as they climb and burn away.
          float sheet = 1.0 - step(0.5, family);
          float tongue = step(0.5, family) * (1.0 - step(1.5, family));
          float split = step(1.5, family);
          float opening = smoothstep(0.12, 0.65, age);
          worldPosition += right * size.x * (sheet * tip * (0.28 * wave + 0.17 * sin(age * 5.0 + phase))
            + tongue * tip * tip * 0.33 * sin(uTime * 5.1 - y * 4.0 + phase)
            + split * position.x * tip * opening * 0.46);
          worldPosition += forward * size.x * sheet * tip * 0.30 * sin(y * 5.6 - uTime * 3.1 + phase);
          worldPosition += up * size.y * (tongue * tip * 0.16 * sin(age * 4.2)
            - sheet * tip * tip * 0.17 * (0.5 + 0.5 * wave));
          vBodyPosition = (uWorldToLocal`);
      fireMaterial.fragmentShader = fireMaterial.fragmentShader
        .replace('varying vec2 vUv;', 'varying vec2 vUv;\n        varying float vFamily;')
        .replace('float interior = 1.0 - abs(x) / max(width, 0.06);', /* glsl */ `
          // Family-specific animated signed silhouettes, not four rigid cards.
          // The split center is a true transparent cleft that grows with age.
          float family = vFamily;
          float tip = smoothstep(0.16, 1.0, y);
          float travel = uTime * (3.2 + seed) + seed * 12.0;
          float interior;
          if (family < 0.5) {
            float sheetX = x + tip * 0.28 * sin(y * 5.5 - travel);
            float sheetWidth = (0.80 - y * 0.38) * (0.85 + 0.15 * sin(y * 9.0 - travel));
            interior = 1.0 - abs(sheetX) / max(sheetWidth, 0.06);
            // Asymmetric mouth opening makes a curling, torn sheet.
            float mouth = smoothstep(0.40, 0.87, y) * smoothstep(0.18, 0.77, age);
            interior -= mouth * (0.5 + 0.5 * sin(y * 10.0 + travel * 0.7)) * 0.40;
          } else if (family < 1.5) {
            float tongueX = x + tip * 0.24 * sin(y * 8.5 - travel * 1.5);
            float tongueWidth = mix(0.60, 0.055, pow(y, 0.75));
            tongueWidth *= 0.84 + 0.16 * sin(y * 13.0 - travel * 1.8);
            interior = 1.0 - abs(tongueX) / max(tongueWidth, 0.035);
          } else {
            float burst = step(2.5, family);
            float forkStart = mix(0.30, 0.19, burst);
            float open = smoothstep(forkStart, 0.86, y)
              * (0.20 + 0.28 * smoothstep(0.10, 0.68, age));
            float branchWidth = mix(0.49, 0.065, smoothstep(0.14, 1.0, y));
            float leftX = -open + tip * 0.09 * sin(travel + y * 6.0);
            float rightX = open + tip * 0.10 * sin(travel * 0.83 - y * 7.0);
            float left = 1.0 - abs(x - leftX) / max(branchWidth * (1.0 - y * 0.20), 0.035);
            float right = 1.0 - abs(x - rightX) / max(branchWidth * (0.86 + 0.14 * sin(travel)), 0.035);
            // A short third tongue breaks up the brief, wider burst family.
            float middle = 1.0 - abs(x + tip * 0.08 * sin(travel * 1.3)) / max(branchWidth * 0.52, 0.035);
            middle -= smoothstep(0.66, 0.93, y) * 2.0;
            interior = max(left, right);
            if (burst > 0.5) interior = max(interior, middle);
          }`);
    }
    // Arbitrary mesh attachment must NOT use the ellipsoid's analytic clipping.
    // Ordinary depth testing still clips flames behind the actual body meshes.
    if (options.surfaceEmitter) {
      fireMaterial.fragmentShader = fireMaterial.fragmentShader.replace(
        'float contactFade = smoothstep(-uUnit * 0.018, uUnit * 0.06, outside);',
        'float contactFade = 1.0;',
      );
    }
    const count = candle ? (high ? 18 : 12) : (high ? 72 : 48);
    const geometry = ownGeometry(new THREE.PlaneGeometry(1, 1, candle ? 1 : 3, candle ? 4 : (high ? 12 : 8)));
    const particleData = new Float32Array(count * 4);
    const particleAttribute = new THREE.InstancedBufferAttribute(particleData, 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aParticle', particleAttribute);
    const flowData = new Float32Array(count * 4);
    const flowAttribute = new THREE.InstancedBufferAttribute(flowData, 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aFlow', flowAttribute);
    const fire = new THREE.InstancedMesh(geometry, fireMaterial, count);
    fire.name = candle ? 'ScatteredCandleFlames' : 'SoftSolarFireWisps';
    fire.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Camera-facing shader offsets do not match ordinary geometry bounds.
    fire.frustumCulled = false;
    fire.renderOrder = 2;
    fire.userData.particleCount = count;
    fire.userData.activeFraction = candle ? 0.66 : 1;
    fire.userData.effect = candle ? 'curled-advected-soft-alpha-fire' : 'evolving-sheet-tongue-fork-burst-fire';
    if (!candle) fire.userData.flameFamilies = ['curling-sheet', 'slender-tongue', 'forked-flame', 'brief-burst'];
    instancedMeshes.add(fire);
    group.add(fire);
    const particles = Array.from({ length: count }, (_, index) => ({
      index,
      seed: hash(index + 530),
      phase: hash(index + 600),
      period: candle ? 1.12 + 0.68 * hash(index + 820) : 0.64 + 0.73 * hash(index + 820),
      latitude: Math.acos((candle ? 0.85 : 0.96) - (candle ? 1.40 : 1.63) * (index + 0.5) / count),
      longitude: index * GOLDEN_ANGLE,
      width: unit * (candle ? 0.058 + 0.048 * hash(index + 730) : 0.25 + 0.21 * hash(index + 730)),
      height: unit * (candle ? 0.105 + 0.11 * hash(index + 760) : 0.29 + 0.28 * hash(index + 760)),
      rise: unit * (candle ? 0.032 + 0.052 * hash(index + 870) : 0.27 + 0.26 * hash(index + 870)),
      flowX: 0, flowZ: 0, roll: 0, family: 0, stretch: 1, spread: 1,
      position: new THREE.Vector3(),
      world: new THREE.Vector3(),
      age: 0,
      growth: 1,
      depth: 0,
    }));
    const order = particles.slice();
    const dummy = new THREE.Object3D();
    const scale = new THREE.Vector3();
    const cameraPoint = new THREE.Vector3();
    animations.push((time, camera) => {
      group.updateWorldMatrix(true, false);
      group.getWorldScale(scale);
      const worldScale = Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
      uniforms.uWorldScale.value = worldScale;
      uniforms.uWorldToLocal.value.copy(group.matrixWorld).invert();
      uniforms.uTime.value = time;
      if (camera) camera.updateWorldMatrix(true, false);
      for (const particle of particles) {
        const clock = time / particle.period + particle.phase;
        const cycle = Math.floor(clock);
        const phase = fract(clock);
        // Per-birth lifetime and launch point vary while invisible at the boundary.
        // Rotate families only at invisible rebirth, with positive modulo for
        // backwards seeks. Staggered seeds avoid synchronized shape changes.
        particle.family = candle ? 0 : ((particle.index + cycle) % 4 + 4) % 4;
        const duration = candle ? 0.66 : (particle.family === 3 ? 0.47 : 0.76)
          + (particle.family === 3 ? 0.14 : 0.24) * hash(cycle * 19 + particle.index + 927);
        const age = Math.min(1, phase / duration);
        particle.age = age;
        particle.growth = 0.68 + Math.sin(age * Math.PI) * 0.51;
        if (!candle) {
          const opening = THREE.MathUtils.smoothstep(age, 0.04, 0.50);
          const melting = THREE.MathUtils.smoothstep(age, 0.60, 1);
          const variation = 0.88 + 0.24 * hash(cycle * 31 + particle.index + 1030);
          particle.spread = [1.22, 0.60, 1.01, 1.26][particle.family]
            * (0.64 + opening * 0.43 - melting * 0.19) * variation;
          particle.stretch = [0.92, 1.34, 1.10, 0.82][particle.family]
            * (0.68 + opening * 0.56 - melting * 0.12) / variation;
        }
        const birth = (cycle - particle.phase) * particle.period;
        const flight = Math.min(time - birth, particle.period * duration);
        const longitude = particle.longitude + (hash(cycle * 17 + particle.index + 890) - 0.5) * (candle ? 0.9 : 1.45);
        const latitude = particle.latitude + (candle ? 0 : (hash(cycle * 23 + particle.index + 920) - 0.5) * 0.29);
        const base = options.surfaceEmitter?.(particle.index, cycle, group, unit * (candle ? 0.012 : 0.025))
          ?? surface(latitude, longitude, unit * (candle ? 0.032 : 0.068));
        particle.world.copy(base).applyMatrix4(group.matrixWorld);
        particle.world.y += worldScale * (particle.height * 0.32 + particle.rise * (age * 0.66 + age * age * 0.34));
        // Difference of smooth flow potentials anchors each trajectory at birth.
        // Nearby emitters share broad gusts; seed detail gives smaller rolling eddies.
        const xPhase = birth * 1.65 + base.z * 1.7 + base.y * 0.9;
        const zPhase = birth * 1.31 + base.x * 1.6 - base.y * 0.6;
        const finePhase = birth * 3.2 + particle.seed * 9.0;
        const amplitude = unit * (candle ? 0.014 : 0.20);
        const dx = (Math.sin(xPhase + flight * 2.15) - Math.sin(xPhase)) * 0.9
          + (Math.cos(finePhase + flight * 3.4) - Math.cos(finePhase)) * 0.26;
        const dz = (Math.cos(zPhase + flight * 1.8) - Math.cos(zPhase)) * 0.8
          + (Math.sin(finePhase + flight * 2.7) - Math.sin(finePhase)) * 0.23;
        particle.world.x += worldScale * amplitude * dx;
        particle.world.z += worldScale * amplitude * dz;
        particle.flowX = Math.cos(xPhase + flight * 2.15) * (candle ? 0.08 : 0.48);
        particle.flowZ = -Math.sin(zPhase + flight * 1.8) * (candle ? 0.08 : 0.48);
        particle.roll = birth * 1.4 + particle.seed * TAU + flight * 2.1;
        particle.position.copy(particle.world).applyMatrix4(uniforms.uWorldToLocal.value);
        particle.depth = camera ? cameraPoint.copy(particle.world).applyMatrix4(camera.matrixWorldInverse).z : -particle.index;
      }
      // Back-to-front ordering avoids alpha-layer artifacts in the single draw.
      order.sort((a, b) => a.depth - b.depth || a.index - b.index);
      for (let slot = 0; slot < count; slot++) {
        const particle = order[slot];
        dummy.position.copy(particle.position);
        dummy.scale.set(particle.width * particle.growth * particle.spread,
          particle.height * (1 - particle.age * 0.24) * particle.stretch, 1);
        dummy.updateMatrix();
        fire.setMatrixAt(slot, dummy.matrix);
        particleData[slot * 4] = particle.age;
        particleData[slot * 4 + 1] = particle.seed;
        particleData[slot * 4 + 2] = candle ? 1 : 0;
        particleData[slot * 4 + 3] = particle.index % (candle ? 3 : 7) === 0 ? 1 : 0;
        flowData[slot * 4] = particle.flowX;
        flowData[slot * 4 + 1] = particle.flowZ;
        flowData[slot * 4 + 2] = particle.family;
        flowData[slot * 4 + 3] = particle.roll;
      }
      fire.instanceMatrix.needsUpdate = true;
      particleAttribute.needsUpdate = true;
      flowAttribute.needsUpdate = true;
      // Bounds are for consumers/inspectors; renderer culling is disabled above.
      const margin = unit * (candle ? 0.3 : 1.35);
      fire.boundingBox = new THREE.Box3(
        new THREE.Vector3(-radius - margin, -halfHeight - margin, -radius - margin),
        new THREE.Vector3(radius + margin, halfHeight + margin, radius + margin),
      );
      fire.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.max(radius, halfHeight) + margin);
    });
  } else if (stem === '戊') {
    const sourceCount = high ? 6 : 4;
    const grainsPerSource = high ? 8 : 6;
    const count = sourceCount * grainsPerSource;
    // Find actual F2-F1 rock fissures, using the same field as STEM_KIND 4.
    // Anchors stay on mid/lower sides, so falling grains leave the intact mass.
    function fissureDistance(point: THREE.Vector3): number {
      const octaves = high ? 4 : 3;
      point = new THREE.Vector3(f32(point.x), f32(point.y), f32(point.z));
      const scaled = (v: number, factor: number, offset = 0): number => f32(f32(v * f32(factor)) + f32(offset));
      const x = point.x * 4.4 + fieldFbm(scaled(point.x, 2.6), scaled(point.y, 2.6), scaled(point.z, 2.6), octaves) * 0.85;
      const y = point.y * 3.4 + fieldFbm(scaled(point.x, 3.0, 13), scaled(point.y, 3.0, 13), scaled(point.z, 3.0, 13), octaves) * 0.85;
      const z = point.z * 4.4 + fieldFbm(scaled(point.x, 2.8, -9), scaled(point.y, 2.8, -9), scaled(point.z, 2.8, -9), octaves) * 0.85;
      const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
      let first = Infinity, second = Infinity;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const dx = a + 0.2 + 0.6 * fieldHash(ix + a, iy + b, iz + c) - fract(x);
        const dy = b + 0.2 + 0.6 * fieldHash(ix + a + 19.1, iy + b + 19.1, iz + c + 19.1) - fract(y);
        const dz = c + 0.2 + 0.6 * fieldHash(ix + a + 47.2, iy + b + 47.2, iz + c + 47.2) - fract(z);
        const distance = Math.hypot(dx, dy, dz);
        if (distance < first) { second = first; first = distance; }
        else second = Math.min(second, distance);
      }
      return second - first;
    }
    const sources = Array.from({ length: sourceCount }, (_, i) => {
      let best = surface(1.55, i * GOLDEN_ANGLE), score = Infinity;
      for (let j = 0; j < 96; j++) {
        const point = surface(1.43 + hash(i * 113 + j + 1900) * 0.61,
          i * GOLDEN_ANGLE + (hash(i * 107 + j + (high ? 2000 : 2001)) - 0.5) * 0.44);
        const candidate = fissureDistance(point);
        if (candidate < score) { best = point; score = candidate; }
      }
      const normal = normalAt(best);
      return { point: best.addScaledVector(normal, unit * 0.023), normal, score,
        period: 2.8 + hash(i + 2070) * 2.6, phase: hash(i + 2080) };
    });
    const material = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xe1b77e, roughness: 0.94, metalness: 0 }));
    const geometry = ownGeometry(new THREE.IcosahedronGeometry(1, 0));
    const grains = new THREE.InstancedMesh(geometry, material, count);
    grains.name = 'IntermittentFissureSand';
    grains.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    grains.frustumCulled = false;
    grains.userData.sourceCount = sourceCount;
    grains.userData.fissureDistances = sources.map(source => source.score);
    grains.userData.sourceAnchors = sources.map(source => source.point.clone().addScaledVector(source.normal, -unit * 0.023).toArray());
    grains.userData.maxParticles = count;
    grains.userData.effect = 'gravity-fissure-trickles';
    grains.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.max(radius, halfHeight) + unit * 0.62);
    grains.boundingBox = new THREE.Box3(new THREE.Vector3(-radius - unit * 0.4, -halfHeight - unit * 0.1, -radius - unit * 0.4),
      new THREE.Vector3(radius + unit * 0.4, halfHeight + unit * 0.1, radius + unit * 0.4));
    for (let i = 0; i < count; i++) grains.setColorAt(i, new THREE.Color().setRGB(0.66 + hash(i + 2180) * 0.25, 0.54 + hash(i + 2190) * 0.20, 0.33 + hash(i + 2200) * 0.15));
    instancedMeshes.add(grains);
    group.add(grains);
    const dummy = new THREE.Object3D();
    const inverse = new THREE.Matrix4();
    const down = new THREE.Vector3();
    const world = new THREE.Vector3();
    animations.push((time) => {
      group.updateWorldMatrix(true, false);
      inverse.copy(group.matrixWorld).invert();
      down.set(0, -1, 0).transformDirection(inverse);
      const m = group.matrixWorld.elements;
      const worldHalfHeight = Math.hypot(m[1] * radius, m[5] * halfHeight, m[9] * radius);
      const floorY = m[13] - worldHalfHeight;
      for (let i = 0; i < count; i++) {
        const source = sources[Math.floor(i / grainsPerSource)];
        const clock = time / source.period + source.phase;
        const epoch = Math.floor(clock);
        const release = (i % grainsPerSource) * 0.064 + hash(i + epoch * 13 + 2260) * 0.065;
        const lifeSeconds = 0.39 + hash(i + epoch * 17 + 2270) * 0.22;
        const flight = fract(clock) * source.period - release;
        const age = THREE.MathUtils.clamp(flight / lifeSeconds, 0, 1);
        const visible = flight >= 0 && flight <= lifeSeconds;
        dummy.position.copy(source.point).addScaledVector(source.normal, unit * (0.006 + age * 0.10));
        dummy.position.addScaledVector(down, unit * (0.085 * age + 0.43 * age * age));
        const jitter = unit * (hash(i + 2290) - 0.5) * 0.024;
        dummy.position.x += jitter;
        dummy.position.z += unit * (hash(i + 2300) - 0.5) * 0.022;
        world.copy(dummy.position).applyMatrix4(group.matrixWorld);
        const floorFade = THREE.MathUtils.smoothstep(world.y - floorY, unit * 0.035, unit * 0.14);
        const fade = visible ? THREE.MathUtils.smoothstep(age, 0, 0.07) * (1 - THREE.MathUtils.smoothstep(age, 0.70, 1)) * floorFade : 0;
        const size = unit * (0.006 + hash(i + 2310) * 0.005) * Math.max(fade, 0.0001);
        dummy.scale.set(size, size * (1.05 + 0.8 * age), size * 0.81);
        dummy.rotation.set(age * 2.1 + i, age * 1.7 + i * 0.7, age * 2.4);
        dummy.updateMatrix(); grains.setMatrixAt(i, dummy.matrix);
      }
      grains.instanceMatrix.needsUpdate = true;
    });
  } else if (stem === '壬') {
    const sprayMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({
      color: 0xc6f5ff, roughness: 0.14, metalness: 0, transmission: 0.3,
      ior: 1.333, thickness: unit * 0.035, clearcoat: 0.85,
      clearcoatRoughness: 0.08, envMapIntensity: 1.25,
    }));
    const foamMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: 0xd9f5fa, roughness: 0.58, metalness: 0,
      emissive: 0x295a64, emissiveIntensity: 0.1,
    }));
    const sprayCount = high ? 36 : 24;
    const foamCount = high ? 18 : 12;
    const sprayGeometry = ownGeometry(new THREE.SphereGeometry(1, high ? 10 : 8, 6));
    const foamPoints = Array.from({ length: 10 }, (_, i) => {
      const t = i / 9;
      return new THREE.Vector3(t - 0.5, Math.sin(t * Math.PI) * 0.07, Math.sin(t * Math.PI * 1.8) * 0.12);
    });
    const foamGeometry = tube(foamPoints, 0.047, 12, 5, true);
    const sprays = new THREE.InstancedMesh(sprayGeometry, sprayMaterial, sprayCount);
    const foam = new THREE.InstancedMesh(foamGeometry, foamMaterial, foamCount);
    sprays.name = 'RapidCrestSplashes';
    foam.name = 'BrokenWhitewaterWisps';
    for (const item of [sprays, foam]) {
      item.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      item.frustumCulled = false;
      item.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.max(radius, halfHeight) + unit * 0.62);
      item.boundingBox = new THREE.Box3(
        new THREE.Vector3(-radius - unit * 0.62, -halfHeight - unit * 0.62, -radius - unit * 0.62),
        new THREE.Vector3(radius + unit * 0.62, halfHeight + unit * 0.62, radius + unit * 0.62),
      );
      instancedMeshes.add(item);
      group.add(item);
    }
    // Shared with STEM_KIND 8: one analytic, invertible angular mapping.
    // Axial latitude is rotation-invariant, so forward CPU and inverse GLSL
    // coordinates agree without accumulated integration or hash-based tracking.
    const axis = new THREE.Vector3(0.18, 1, 0.24).normalize();
    const phaseDirection = new THREE.Vector3(9.5, 2.2, 4.2);
    const pulseDirection = new THREE.Vector3(2.1, 1.3, -1.4);
    const flowAngle = (latitude: number, time: number): number =>
      1.08 * time + 0.14 * Math.sin(latitude * 2.5) * Math.sin(time * 0.8)
      + 0.055 * (Math.sin(latitude * 4 + time * 1.6) - Math.sin(latitude * 4));
    const flowSpeed = (latitude: number, time: number): number =>
      1.08 + 0.112 * Math.sin(latitude * 2.5) * Math.cos(time * 0.8) + 0.088 * Math.cos(latitude * 4 + time * 1.6);
    function breaking(point: THREE.Vector3, time: number): number {
      const warp = 0.55 * Math.sin(point.x * 3.1 + point.y * 2.6 + point.z * 1.4)
        + 0.45 * Math.sin(point.x * -1.8 + point.y * 3.4 + point.z * 2.6);
      const wave = Math.sin(point.dot(phaseDirection) + 0.85 * warp);
      const region = 0.55 * Math.sin(point.x * 2.5 - point.y * 2.1 + point.z * 1.2 + 0.7)
        + 0.45 * Math.sin(point.x * -1.7 + point.y * 1.8 + point.z * 3.1 - 0.4);
      const pulse = THREE.MathUtils.smoothstep(Math.sin(time * 2.4 + point.dot(pulseDirection)), -0.45, 0.65);
      return THREE.MathUtils.smoothstep(wave, 0.52, 0.94) * THREE.MathUtils.smoothstep(region, 0.06, 0.50) * pulse;
    }
    // Retain spatially distributed high crests only inside the localized breaker
    // regions. No arbitrary surface sources or second direction remain.
    const anchors: THREE.Vector3[] = [];
    for (let i = 0; i < 1536; i++) {
      const latitude = Math.acos(1 - 2 * (i + 0.5) / 1536);
      const longitude = i * GOLDEN_ANGLE;
      const point = new THREE.Vector3(Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude));
      const crestPhase = Math.PI / 2 - point.dot(pulseDirection);
      if (breaking(point, crestPhase / 2.4) > 0.68) anchors.push(point);
    }
    if (!anchors.length) throw new Error('Water breaker field has no source anchors.');
    const dummy = new THREE.Object3D();
    const inverse = new THREE.Matrix4();
    const globalUp = new THREE.Vector3();
    const point = new THREE.Vector3(), normal = new THREE.Vector3(), tangent = new THREE.Vector3();
    const side = new THREE.Vector3(), velocity = new THREE.Vector3();
    const basis = new THREE.Matrix4();
    const axisSize = new THREE.Vector3(radius, halfHeight, radius);
    const sourceAt = (index: number, epoch: number): THREE.Vector3 => anchors[((index * 17 + epoch * 13) % anchors.length + anchors.length) % anchors.length];
    const prepare = (source: THREE.Vector3, time: number): void => {
      point.copy(source).applyAxisAngle(axis, flowAngle(source.dot(axis), time)).multiply(axisSize);
      normal.copy(normalAt(point));
      tangent.crossVectors(axis, point);
      tangent.addScaledVector(normal, -tangent.dot(normal));
      if (tangent.lengthSq() < 0.0001) tangent.set(1, 0, 0).addScaledVector(normal, -normal.x);
      tangent.normalize();
    };
    for (const item of [sprays, foam]) {
      item.userData.flow = 'single-latitude-sheared-advection';
      item.userData.flowAxis = axis.toArray();
      item.userData.breakerAnchorCount = anchors.length;
    }
    sprays.userData.effect = 'crest-gated-tangent-spray';
    foam.userData.effect = 'sparse-shared-flow-whitewater';
    animations.push((time) => {
      group.updateWorldMatrix(true, false);
      inverse.copy(group.matrixWorld).invert();
      globalUp.copy(Y_AXIS).transformDirection(inverse);
      for (let i = 0; i < sprayCount; i++) {
        const seed = hash(i + 940);
        const period = 0.90 + seed * 0.70;
        const phase = hash(i + 955);
        const clock = time / period + phase;
        const epoch = Math.floor(clock), birth = (epoch - phase) * period;
        const duration = 0.34 + seed * 0.20;
        const flight = Math.min(time - birth, duration);
        const age = THREE.MathUtils.clamp(flight / duration, 0, 1);
        const source = sourceAt(i, epoch);
        const emission = THREE.MathUtils.smoothstep(breaking(source, birth), 0.30, 0.72);
        prepare(source, birth);
        // Launch with the very same dominant tangent speed as the source water.
        velocity.crossVectors(axis, point).multiplyScalar(flowSpeed(source.dot(axis), birth));
        dummy.position.copy(point).addScaledVector(velocity, flight * 0.83);
        dummy.position.addScaledVector(normal, unit * (0.018 + 0.30 * flight));
        dummy.position.addScaledVector(globalUp, unit * (0.20 * flight - 0.75 * flight * flight));
        side.copy(velocity).addScaledVector(normal, unit * 0.30).addScaledVector(globalUp, unit * (0.20 - 1.50 * flight)).normalize();
        dummy.quaternion.setFromUnitVectors(Y_AXIS, side);
        const life = THREE.MathUtils.smoothstep(age, 0, 0.10) * (1 - THREE.MathUtils.smoothstep(age, 0.55, 1));
        const size = unit * (0.010 + 0.014 * seed) * Math.max(life * emission, 0.0001);
        dummy.scale.set(size * 0.72, size * (1.75 - 0.40 * age), size * 0.72);
        dummy.updateMatrix(); sprays.setMatrixAt(i, dummy.matrix);
      }
      for (let i = 0; i < foamCount; i++) {
        const seed = hash(i + 1120);
        const period = 0.67 + seed * 0.45;
        const clock = time / period + hash(i + 1170);
        const age = fract(clock), epoch = Math.floor(clock);
        const source = sourceAt(i + 53, epoch);
        prepare(source, time);
        // The core shader and this wisp use the same parcel and breaker pulse.
        const strength = breaking(source, time);
        dummy.position.copy(point).addScaledVector(normal, unit * 0.018);
        side.crossVectors(tangent, normal).normalize();
        basis.makeBasis(tangent, normal, side);
        dummy.quaternion.setFromRotationMatrix(basis);
        const life = THREE.MathUtils.smoothstep(age, 0, 0.13) * (1 - THREE.MathUtils.smoothstep(age, 0.55, 1));
        const grow = Math.max(life * strength, 0.0001);
        dummy.scale.set(unit * (0.13 + seed * 0.13) * grow,
          unit * 0.14 * grow, unit * (0.14 + age * 0.08) * grow);
        dummy.updateMatrix(); foam.setMatrixAt(i, dummy.matrix);
      }
      sprays.instanceMatrix.needsUpdate = true;
      foam.instanceMatrix.needsUpdate = true;
    });
  } else {
    const material = ownMaterial(new THREE.MeshPhysicalMaterial({
      color: 0xe8ffff, roughness: 0.045, metalness: 0,
      transmission: 0.97, ior: 1.333, thickness: unit * 0.105,
      attenuationColor: new THREE.Color(0xaeeef1), attenuationDistance: unit * 1.5,
      clearcoat: 0.65, clearcoatRoughness: 0.035, envMapIntensity: 1.1,
    }));
    const beadGeometry = ownGeometry(new THREE.SphereGeometry(1, high ? 18 : 12, high ? 12 : 8));
    const count = high ? 152 : 82;
    const beads = new THREE.InstancedMesh(beadGeometry, material, count);
    beads.name = 'ClearAquaDewBeads';
    beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    beads.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.max(radius, halfHeight) + unit * 0.14);
    beads.boundingBox = new THREE.Box3(
      new THREE.Vector3(-radius - unit * 0.14, -halfHeight - unit * 0.14, -radius - unit * 0.14),
      new THREE.Vector3(radius + unit * 0.14, halfHeight + unit * 0.14, radius + unit * 0.14),
    );
    instancedMeshes.add(beads);
    group.add(beads);
    const dummy = new THREE.Object3D();
    const inverse = new THREE.Matrix4();
    const gravity = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const point = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const right = new THREE.Vector3();
    const basis = new THREE.Matrix4();
    animations.push((time) => {
      group.updateWorldMatrix(true, false);
      inverse.copy(group.matrixWorld).invert();
      gravity.set(0, -1, 0).transformDirection(inverse);
      for (let i = 0; i < count; i++) {
        const seed = hash(i + 72);
        const cycle = time / (6.5 + seed * 8.5) + hash(i + 340);
        const epoch = Math.floor(cycle);
        const age = fract(cycle);
        const latitude = 0.22 + 2.6 * hash(i * 3 + epoch * 29 + 1360);
        const longitude = i * GOLDEN_ANGLE + epoch * 0.72 + hash(i + epoch * 13 + 1410) * 0.6;
        const grow = THREE.MathUtils.smoothstep(age, 0, 0.38);
        const slide = THREE.MathUtils.smoothstep(age, 0.34, 0.89);
        const dissolve = 1 - THREE.MathUtils.smoothstep(age, 0.8, 1);
        // Every drop condenses, grows, slips along the surface, and disappears.
        // The next cycle chooses a new anchor while the old drop is invisible.
        const size = unit * (0.019 + 0.054 * Math.pow(seed, 1.65)) * Math.max(0.001, grow * dissolve);
        direction.set(Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude));
        direction.addScaledVector(gravity, slide * (0.29 + seed * 0.24)).normalize();
        point.set(direction.x * radius, direction.y * halfHeight, direction.z * radius);
        const normal = normalAt(point);
        dummy.position.copy(point).addScaledVector(normal, size * 0.34);
        tangent.copy(gravity).addScaledVector(normal, -gravity.dot(normal));
        if (tangent.lengthSq() < 0.0001) tangent.set(1, 0, 0).addScaledVector(normal, -normal.x);
        tangent.normalize();
        right.crossVectors(tangent, normal).normalize();
        tangent.crossVectors(normal, right).normalize();
        basis.makeBasis(right, tangent, normal);
        dummy.quaternion.setFromRotationMatrix(basis);
        dummy.scale.set(size, size * (1.06 + slide * 0.24), size * 0.9);
        dummy.updateMatrix();
        beads.setMatrixAt(i, dummy.matrix);
      }
      beads.instanceMatrix.needsUpdate = true;
    });

  }

  function update(timeSeconds: number, camera?: THREE.Camera): void {
    if (disposed) return;
    if (!Number.isFinite(timeSeconds)) throw new RangeError('Accent time must be finite.');
    for (const animate of animations) animate(timeSeconds, camera);
  }
  update(0);
  return {
    group,
    update,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      for (const instance of instancedMeshes) instance.dispose();
      geometries.clear();
      materials.clear();
      textures.clear();
      instancedMeshes.clear();
      animations.length = 0;
      group.removeFromParent();
      group.clear();
    },
  };
}
