import * as THREE from 'three';

export type AccentStem = '乙' | '丙' | '癸';
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
  update(timeSeconds: number): void;
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
 * optional; flame tubes remain actual silhouette geometry without postprocessing.
 * All assets are procedural and locally owned. No texture, renderer or DOM needed.
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
  if (stem !== '乙' && stem !== '丙' && stem !== '癸') {
    throw new RangeError('Stem accents support 乙, 丙 and 癸.');
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
  const instancedMeshes = new Set<THREE.InstancedMesh>();
  const animations: Array<(time: number) => void> = [];
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

  if (stem === '乙') {
    const vineMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({
      color: 0x678626, roughness: 0.46, metalness: 0,
      clearcoat: 0.23, clearcoatRoughness: 0.34,
    }));
    const youngVineMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xa1b94c, roughness: 0.43 }));
    const leafMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({
      color: 0xb1cf50, vertexColors: true, roughness: 0.5,
      side: THREE.DoubleSide, sheen: 0.32, sheenColor: new THREE.Color(0xc9e88a),
      sheenRoughness: 0.72, clearcoat: 0.14, clearcoatRoughness: 0.48,
    }));
    const veinMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xd4d979, roughness: 0.65 }));
    const coils = high ? 7 : 4;
    for (let i = 0; i < coils; i++) {
      const points: THREE.Vector3[] = [];
      const phase = i * TAU / coils;
      for (let j = 0; j <= 50; j++) {
        const t = j / 50;
        const latitude = 2.76 - 2.35 * t + 0.065 * Math.sin(t * TAU * 2 + phase);
        const longitude = phase + t * TAU * (0.82 + (i % 3) * 0.12) + 0.19 * Math.sin(t * TAU * 1.7 + phase);
        points.push(surface(latitude, longitude, unit * (0.018 + 0.01 * Math.sin(t * Math.PI))));
      }
      const vine = mesh(tube(points, unit * (0.019 + (i % 3) * 0.004), high ? 96 : 54, high ? 7 : 5), i % 3 === 0 ? youngVineMaterial : vineMaterial, `LivingVine_${i}`);
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
    const sproutCount = high ? 14 : 8;
    for (let i = 0; i < sproutCount; i++) {
      const latitude = 0.32 + 2.2 * hash(i + 40);
      const longitude = i * GOLDEN_ANGLE;
      const base = surface(latitude, longitude, unit * 0.014);
      const normal = normalAt(base);
      const tangent = new THREE.Vector3(-Math.sin(longitude), 0.26, Math.cos(longitude)).normalize();
      const end = base.clone().addScaledVector(normal, unit * 0.075).addScaledVector(tangent, unit * 0.075);
      const stemMesh = mesh(tube([base, base.clone().lerp(end, 0.5).addScaledVector(normal, unit * 0.017), end], unit * 0.007, 8, 4, true), youngVineMaterial, `SproutStem_${i}`);
      stemMesh.castShadow = true;
      const pivot = new THREE.Group();
      pivot.name = `LeafSprout_${i}`;
      pivot.position.copy(end);
      const leafUp = normal.clone().multiplyScalar(0.65).addScaledVector(tangent, 0.8).normalize();
      pivot.quaternion.setFromUnitVectors(Y_AXIS, leafUp);
      group.add(pivot);
      const length = unit * (0.16 + 0.09 * hash(i + 90));
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
  } else if (stem === '丙') {
    const goldMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: 0xffa31f, emissive: 0xff9508, emissiveIntensity: 3.1,
      roughness: 0.35, metalness: 0.12,
    }));
    const coreMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: 0xe5f7ff, emissive: 0xaedfff, emissiveIntensity: 4.5,
      roughness: 0.22, metalness: 0,
    }));
    const glowMaterial = ownMaterial(new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.4, 0.39, 0.018), transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
    }));
    const jets = high ? 19 : 10;
    for (let i = 0; i < jets; i++) {
      const latitude = Math.acos(1 - 1.72 * ((i + 0.6) / jets));
      const longitude = i * GOLDEN_ANGLE;
      const base = surface(latitude, longitude, -unit * 0.003);
      const normal = normalAt(base);
      const root = new THREE.Group();
      root.name = `SolarEruption_${i}`;
      root.position.copy(base);
      root.quaternion.setFromUnitVectors(Y_AXIS, normal);
      root.rotateY(i * 2.23);
      group.add(root);
      const magnitude = unit * (0.27 + 0.2 * hash(i + 19));
      const handedness = i % 2 === 0 ? 1 : -1;
      const points: THREE.Vector3[] = [];
      for (let j = 0; j <= 18; j++) {
        const t = j / 18;
        // A curling prominence with a low root and rising fine wisp.
        const curl = t * Math.PI * 1.3;
        points.push(new THREE.Vector3(
          handedness * magnitude * (0.45 * Math.sin(curl) + 0.11 * Math.sin(t * TAU * 1.7) * t),
          magnitude * (0.9 * t + 0.24 * Math.sin(t * Math.PI)),
          magnitude * 0.17 * Math.sin(t * TAU * 1.25 + i) * t,
        ));
      }
      const thickness = unit * (0.016 + 0.012 * hash(i + 57));
      const eruption = new THREE.Group();
      eruption.name = 'AnimatedFlame';
      root.add(eruption);
      const mantle = new THREE.Mesh(tube(points, thickness, high ? 32 : 20, high ? 6 : 4, true), goldMaterial);
      mantle.name = 'GoldenFlameMantle';
      const core = new THREE.Mesh(tube(points, thickness * 0.34, high ? 32 : 20, 4, true), coreMaterial);
      core.name = 'BlueWhiteFlameCore';
      // Offset the thin core toward the camera-independent crest of the ribbon,
      // so it remains visible instead of being hidden inside an opaque mantle.
      core.position.z = thickness * 0.92;
      eruption.add(mantle, core);
      if (high) {
        const glow = new THREE.Mesh(tube(points, thickness * 2.1, 24, 5, true), glowMaterial);
        glow.name = 'RestrainedGoldenHalo';
        glow.renderOrder = 1;
        eruption.add(glow);
      }
      const phase = i * 1.79;
      animations.push((time) => {
        eruption.scale.set(1 + 0.035 * Math.sin(time * 1.8 + phase), 1 + 0.13 * Math.sin(time * 2.1 + phase), 1);
        eruption.rotation.y = 0.14 * Math.sin(time * 0.95 + phase);
        eruption.rotation.z = 0.07 * Math.sin(time * 1.47 + phase);
      });
    }
    animations.push((time) => {
      goldMaterial.emissiveIntensity = 3.1 + 0.35 * Math.sin(time * 1.7);
      coreMaterial.emissiveIntensity = 4.5 + 0.4 * Math.sin(time * 1.7 + 0.55);
      glowMaterial.opacity = 0.16 + 0.02 * Math.sin(time * 1.7);
    });
  } else {
    const material = ownMaterial(new THREE.MeshPhysicalMaterial({
      color: 0xe8ffff, roughness: 0.045, metalness: 0,
      transmission: 0.97, ior: 1.333, thickness: unit * 0.105,
      attenuationColor: new THREE.Color(0xaeeef1), attenuationDistance: unit * 1.5,
      clearcoat: 0.65, clearcoatRoughness: 0.035, envMapIntensity: 1.1,
    }));
    const beadGeometry = ownGeometry(new THREE.SphereGeometry(1, high ? 18 : 12, high ? 12 : 8));
    const count = high ? 116 : 48;
    const beads = new THREE.InstancedMesh(beadGeometry, material, count);
    beads.name = 'ClearAquaDewBeads';
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const latitude = Math.acos(1 - 2 * (i + 0.5) / count);
      const longitude = i * GOLDEN_ANGLE + (hash(i + 120) - 0.5) * 0.18;
      const size = unit * (0.015 + 0.047 * Math.pow(hash(i + 72), 2.3));
      const point = surface(latitude, longitude);
      const normal = normalAt(point);
      // The lower portion is embedded, giving a wet contact rather than floating pearls.
      dummy.position.copy(point).addScaledVector(normal, size * 0.34);
      dummy.quaternion.setFromUnitVectors(Z_AXIS, normal);
      dummy.scale.set(size, size * (1.05 + 0.16 * hash(i + 37)), size * 0.9);
      dummy.updateMatrix();
      beads.setMatrixAt(i, dummy.matrix);
    }
    beads.instanceMatrix.needsUpdate = true;
    beads.computeBoundingSphere();
    instancedMeshes.add(beads);
    group.add(beads);
  }

  function update(timeSeconds: number): void {
    if (disposed) return;
    if (!Number.isFinite(timeSeconds)) throw new RangeError('Accent time must be finite.');
    for (const animate of animations) animate(timeSeconds);
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
      for (const instance of instancedMeshes) instance.dispose();
      geometries.clear();
      materials.clear();
      instancedMeshes.clear();
      animations.length = 0;
      group.removeFromParent();
      group.clear();
    },
  };
}
