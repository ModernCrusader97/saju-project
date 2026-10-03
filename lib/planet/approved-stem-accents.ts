import * as THREE from 'three';

export type AccentStem = '甲' | '乙' | '丙' | '丁' | '壬' | '癸';
export interface StemAccentOptions {
  /** Equatorial radius in local world units. Defaults to 1. */
  radius?: number;
  /** Total polar height, centered on the origin. Defaults to 2. */
  height?: number;
  quality?: 'low' | 'high';
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
  if (stem !== '甲' && stem !== '乙' && stem !== '丙' && stem !== '丁' && stem !== '壬' && stem !== '癸') {
    throw new RangeError('Stem accents support 甲, 乙, 丙, 丁, 壬 and 癸.');
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
    // This WebGL implementation uses two packed-noise reads, no external art,
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
          vec3 worldPosition = center.xyz + right * position.x * size.x + up * position.y * size.y;
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
          vec2 flowUV = vec2(vUv.x * 0.66 + seed * 3.7, y * 0.86 - uTime * (0.78 + seed * 0.39));
          vec2 flow = texture2D(uNoise, flowUV).rg;
          float bend = (flow.r - 0.5) * (0.2 + y * 0.52);
          vec2 detail = texture2D(uNoise, flowUV * vec2(1.8, 1.65) + vec2(bend, seed * 2.1)).rg;
          float x = vUv.x * 2.0 - 1.0 + bend + sin(y * 6.0 - uTime * 3.4 + seed * 20.0) * y * 0.13;
          float width = (0.72 * pow(max(0.0, 1.0 - y), 0.57) + 0.07) * (0.8 + flow.r * 0.4);
          float interior = 1.0 - abs(x) / max(width, 0.04);
          float edge = smoothstep(0.0, 0.30, interior);
          float density = flow.g * 0.57 + detail.r * 0.43;
          float threshold = 0.23 + y * 0.25 + age * age * 0.20;
          float erosion = smoothstep(threshold, threshold + 0.17, density + interior * 0.1);
          float vertical = smoothstep(0.0, 0.10, y) * (1.0 - smoothstep(0.72, 1.0, y));
          float life = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.60, 1.0, age));
          float outside = (length(vBodyPosition / uBodyRadii) - 1.0) * uUnit;
          float contactFade = smoothstep(-uUnit * 0.01, uUnit * 0.055, outside);
          float alpha = edge * erosion * vertical * life * contactFade * mix(0.79, 0.9, candle);
          if (alpha < 0.008) discard;
          float hot = smoothstep(0.18, 0.9, interior) * (1.0 - y * 0.76);
          vec3 orange = vec3(1.35, 0.13, 0.008);
          vec3 gold = vec3(1.85, 0.83, 0.075);
          vec3 color = mix(orange, gold, clamp(hot * 0.71 + density * 0.25, 0.0, 1.0));
          float blueSource = core * hot * (1.0 - smoothstep(0.07, 0.24, y)) * (1.0 - age * 0.72);
          color = mix(color, vec3(0.55, 1.1, 1.8), blueSource * 0.78);
          gl_FragColor = vec4(color, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }));
    const count = candle ? (high ? 18 : 12) : (high ? 72 : 48);
    const geometry = ownGeometry(new THREE.PlaneGeometry(1, 1));
    const particleData = new Float32Array(count * 4);
    const particleAttribute = new THREE.InstancedBufferAttribute(particleData, 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aParticle', particleAttribute);
    const fire = new THREE.InstancedMesh(geometry, fireMaterial, count);
    fire.name = candle ? 'ScatteredCandleFlames' : 'SoftSolarFireWisps';
    fire.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Camera-facing shader offsets do not match ordinary geometry bounds.
    fire.frustumCulled = false;
    fire.renderOrder = 2;
    fire.userData.particleCount = count;
    fire.userData.activeFraction = candle ? 0.66 : 1;
    fire.userData.effect = 'updraft-soft-alpha-fire';
    instancedMeshes.add(fire);
    group.add(fire);
    const particles = Array.from({ length: count }, (_, index) => ({
      index,
      seed: hash(index + 530),
      phase: hash(index + 600),
      period: candle ? 1.12 + 0.68 * hash(index + 820) : 0.47 + 0.66 * hash(index + 820),
      latitude: Math.acos((candle ? 0.85 : 0.96) - (candle ? 1.40 : 1.63) * (index + 0.5) / count),
      longitude: index * GOLDEN_ANGLE,
      width: unit * (candle ? 0.058 + 0.048 * hash(index + 730) : 0.22 + 0.22 * hash(index + 730)),
      height: unit * (candle ? 0.105 + 0.11 * hash(index + 760) : 0.35 + 0.27 * hash(index + 760)),
      rise: unit * (candle ? 0.032 + 0.052 * hash(index + 870) : 0.20 + 0.31 * hash(index + 870)),
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
        const age = candle ? Math.min(1, phase / 0.66) : phase;
        particle.age = age;
        particle.growth = 0.68 + Math.sin(age * Math.PI) * 0.51;
        const longitude = particle.longitude + (candle ? (hash(cycle * 17 + particle.index + 890) - 0.5) * 0.9 : 0);
        const base = surface(particle.latitude, longitude, unit * (candle ? 0.032 : 0.063));
        particle.world.copy(base).applyMatrix4(group.matrixWorld);
        particle.world.y += worldScale * (particle.height * 0.35 + particle.rise * age);
        const sway = unit * (candle ? 0.016 : 0.065) * age;
        particle.world.x += worldScale * sway * Math.sin(time * 2.7 + particle.seed * 19);
        particle.world.z += worldScale * sway * Math.cos(time * 2.1 + particle.seed * 23);
        particle.position.copy(particle.world).applyMatrix4(uniforms.uWorldToLocal.value);
        particle.depth = camera ? cameraPoint.copy(particle.world).applyMatrix4(camera.matrixWorldInverse).z : -particle.index;
      }
      // Back-to-front ordering avoids alpha-layer artifacts in the single draw.
      order.sort((a, b) => a.depth - b.depth || a.index - b.index);
      for (let slot = 0; slot < count; slot++) {
        const particle = order[slot];
        dummy.position.copy(particle.position);
        dummy.scale.set(particle.width * particle.growth, particle.height * (1 - particle.age * 0.24), 1);
        dummy.updateMatrix();
        fire.setMatrixAt(slot, dummy.matrix);
        particleData[slot * 4] = particle.age;
        particleData[slot * 4 + 1] = particle.seed;
        particleData[slot * 4 + 2] = candle ? 1 : 0;
        particleData[slot * 4 + 3] = particle.index % (candle ? 3 : 7) === 0 ? 1 : 0;
      }
      fire.instanceMatrix.needsUpdate = true;
      particleAttribute.needsUpdate = true;
      // Bounds are for consumers/inspectors; renderer culling is disabled above.
      const margin = unit * (candle ? 0.3 : 0.82);
      fire.boundingBox = new THREE.Box3(
        new THREE.Vector3(-radius - margin, -halfHeight - margin, -radius - margin),
        new THREE.Vector3(radius + margin, halfHeight + margin, radius + margin),
      );
      fire.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.max(radius, halfHeight) + margin);
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
    const sprayCount = high ? 58 : 34;
    const foamCount = high ? 32 : 20;
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
      item.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.max(radius, halfHeight) + unit * 0.45);
      item.boundingBox = new THREE.Box3(
        new THREE.Vector3(-radius - unit * 0.3, -halfHeight - unit * 0.3, -radius - unit * 0.3),
        new THREE.Vector3(radius + unit * 0.3, halfHeight + unit * 0.45, radius + unit * 0.3),
      );
      instancedMeshes.add(item);
      group.add(item);
    }
    const dummy = new THREE.Object3D();
    const inverse = new THREE.Matrix4();
    const globalUp = new THREE.Vector3();
    animations.push((time) => {
      group.updateWorldMatrix(true, false);
      inverse.copy(group.matrixWorld).invert();
      globalUp.copy(Y_AXIS).transformDirection(inverse);
      for (let i = 0; i < sprayCount; i++) {
        const seed = hash(i + 940);
        const period = 0.92 + seed * 0.73;
        const cycle = time / period + hash(i + 955);
        const age = fract(cycle);
        const epoch = Math.floor(cycle);
        const latitude = 0.42 + 2.02 * hash(i * 7 + epoch * 11 + 1200);
        const longitude = i * GOLDEN_ANGLE + time * 0.15 + 0.2 * Math.sin(latitude * 5);
        const base = surface(latitude, longitude, unit * 0.018);
        const normal = normalAt(base);
        const lift = Math.sin(age * Math.PI) * unit * (0.075 + seed * 0.13);
        dummy.position.copy(base).addScaledVector(normal, unit * 0.12 * age).addScaledVector(globalUp, lift);
        const velocity = normal.clone().multiplyScalar(0.3).addScaledVector(globalUp, 0.75 - age).normalize();
        dummy.quaternion.setFromUnitVectors(Y_AXIS, velocity);
        const life = THREE.MathUtils.smoothstep(age, 0, 0.12) * (1 - THREE.MathUtils.smoothstep(age, 0.67, 1));
        const size = unit * (0.012 + 0.016 * seed) * Math.max(life, 0.001);
        dummy.scale.set(size * 0.82, size * (1.8 - 0.55 * age), size * 0.82);
        dummy.updateMatrix();
        sprays.setMatrixAt(i, dummy.matrix);
      }
      for (let i = 0; i < foamCount; i++) {
        const seed = hash(i + 1120);
        const cycle = time / (1.5 + 1.1 * seed) + hash(i + 1170);
        const age = fract(cycle);
        const latitude = 0.47 + 2.08 * hash(i * 5 + Math.floor(cycle) * 7 + 1190);
        const longitude = i * GOLDEN_ANGLE + time * 0.16 + 0.18 * Math.sin(latitude * 5);
        const point = surface(latitude, longitude, unit * 0.015);
        const normal = normalAt(point);
        dummy.position.copy(point);
        dummy.quaternion.setFromUnitVectors(Y_AXIS, normal);
        dummy.rotateY(seed * TAU + age * 0.28);
        const life = THREE.MathUtils.smoothstep(age, 0, 0.18) * (1 - THREE.MathUtils.smoothstep(age, 0.64, 1));
        const grow = Math.max(life, 0.001);
        dummy.scale.set(unit * (0.19 + seed * 0.19) * grow, unit * 0.2 * grow, unit * 0.27 * grow);
        dummy.updateMatrix();
        foam.setMatrixAt(i, dummy.matrix);
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
