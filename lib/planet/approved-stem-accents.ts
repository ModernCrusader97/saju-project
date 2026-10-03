import * as THREE from 'three';

export type AccentStem = '甲' | '乙' | '丙' | '癸';
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
 * optional; broad flame ribbons remain actual silhouette geometry without postprocessing.
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
  if (stem !== '甲' && stem !== '乙' && stem !== '丙' && stem !== '癸') {
    throw new RangeError('Stem accents support 甲, 乙, 丙 and 癸.');
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
    const coils = woody ? 0 : high ? 16 : 10;
    const vineBatches: [THREE.BufferGeometry[], THREE.BufferGeometry[]] = [[], []];
    for (let i = 0; i < coils; i++) {
      const points: THREE.Vector3[] = [];
      const bundle = Math.floor(i / 3);
      const strand = i % 3;
      const bundlePhase = bundle * TAU / (high ? 5 : 3) + 0.19 * hash(bundle + 260);
      const strandPhase = strand * TAU / 3;
      const winding = bundle % 2 === 0 ? 1 : -1;
      const pointCount = high ? 78 : 60;
      for (let j = 0; j <= pointCount; j++) {
        const t = j / pointCount;
        const weave = t * TAU * (2.7 + 0.35 * hash(bundle + 170)) + strandPhase;
        const latitude = 2.87 - 2.59 * t
          + 0.07 * Math.sin(t * TAU * 1.8 + bundlePhase)
          + 0.052 * Math.sin(weave);
        const longitude = bundlePhase + t * TAU * winding * (0.68 + 0.14 * hash(bundle + 20))
          + 0.2 * Math.sin(t * TAU * 1.4 + bundlePhase)
          + 0.08 * Math.cos(weave)
          + (strand - 1) * 0.033;
        // Alternating radial lift puts strands over and under each other.
        const lift = unit * (0.026 + 0.024 * Math.sin(weave + 0.8));
        points.push(surface(latitude, longitude, lift));
      }
      const fine = strand === 2;
      const thickness = unit * (fine ? 0.014 + 0.006 * hash(i + 320) : 0.027 + 0.012 * hash(i + 330));
      vineBatches[fine ? 1 : 0].push(tube(points, thickness, high ? 112 : 76, high ? 7 : 6));
    }
    // Merge owned static tubes by material to keep 10–16 entwined vines at two
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
    const sproutCount = high ? 6 : 4;
    for (let i = 0; i < sproutCount; i++) {
      const latitude = woody ? 0.42 + 1.46 * hash(i + 40) : 0.32 + 2.2 * hash(i + 40);
      const longitude = i * GOLDEN_ANGLE;
      const base = surface(latitude, longitude, unit * 0.014);
      const normal = normalAt(base);
      const tangent = new THREE.Vector3(-Math.sin(longitude), 0.26, Math.cos(longitude)).normalize();
      const end = base.clone().addScaledVector(normal, unit * (woody ? 0.17 + 0.065 * hash(i + 14) : 0.075)).addScaledVector(tangent, unit * (woody ? 0.052 : 0.075));
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
      const branchGeometry = tube([base, midpoint, end], unit * (woody ? 0.019 : 0.007), high ? 12 : 8, woody ? 6 : 4, true);
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
      const length = unit * (woody ? 0.115 + 0.045 * hash(i + 90) : 0.105 + 0.05 * hash(i + 90));
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
    // Generated color ramps preserve amber edges and a golden interior without
    // relying on overbright white emission or an external texture asset.
    function ramp(stops: Array<[number, number]>): THREE.DataTexture {
      const data = new Uint8Array(64 * 4);
      for (let row = 0; row < 64; row++) {
        const t = row / 63;
        let index = 0;
        while (index < stops.length - 2 && t > stops[index + 1][0]) index++;
        const a = stops[index];
        const b = stops[index + 1];
        const color = new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), (t - a[0]) / (b[0] - a[0]));
        color.convertLinearToSRGB();
        data[row * 4] = Math.round(color.r * 255);
        data[row * 4 + 1] = Math.round(color.g * 255);
        data[row * 4 + 2] = Math.round(color.b * 255);
        data[row * 4 + 3] = 255;
      }
      const texture = new THREE.DataTexture(data, 1, 64, THREE.RGBAFormat);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      textures.add(texture);
      return texture;
    }
    const goldenRamp = ramp([[0, 0xffac20], [0.28, 0xffd24f], [0.66, 0xff9011], [1, 0xe94803]]);
    const coreRamp = ramp([[0, 0x66beff], [0.27, 0xc3ecff], [0.64, 0xffe9a0], [1, 0xffaf24]]);
    const goldMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: 0xffc168, map: goldenRamp, emissive: 0xffffff,
      emissiveMap: goldenRamp, emissiveIntensity: 1.08,
      roughness: 0.62, metalness: 0, side: THREE.DoubleSide,
    }));
    const coreMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: 0xd6edff, map: coreRamp, emissive: 0xffffff,
      emissiveMap: coreRamp, emissiveIntensity: 1.6,
      roughness: 0.5, metalness: 0, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));

    /** Two crossed, cupped mesh sheets: broad at the root, tapering to a wavy tip.
     * Their orientation is geometric; they never turn to face the camera. */
    function flameGeometry(width: number, length: number, phase: number, core: boolean): {
      geometry: THREE.BufferGeometry; animate(time: number): void;
    } {
      const rows = high ? 24 : 15;
      const columns = high ? 6 : 4;
      const sheets = core ? 1 : 2;
      const positions = new Float32Array((rows + 1) * (columns + 1) * sheets * 3);
      const uvs: number[] = [];
      const indices: number[] = [];
      for (let sheet = 0; sheet < sheets; sheet++) {
        const first = sheet * (rows + 1) * (columns + 1);
        for (let row = 0; row <= rows; row++) {
          for (let column = 0; column <= columns; column++) uvs.push(column / columns, row / rows);
        }
        for (let row = 0; row < rows; row++) {
          for (let column = 0; column < columns; column++) {
            const a = first + row * (columns + 1) + column;
            indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
          }
        }
      }
      const geometry = ownGeometry(new THREE.BufferGeometry());
      const attribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('position', attribute);
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      function animate(time: number): void {
        for (let sheet = 0; sheet < sheets; sheet++) {
          const angle = sheet * Math.PI * 0.5;
          for (let row = 0; row <= rows; row++) {
            const t = row / rows;
            const taper = Math.pow(Math.max(0, 1 - t), 0.66);
            const belly = (0.42 + 0.74 * Math.sin(Math.PI * t)) * taper + 0.004;
            const wave = Math.sin(t * 8.8 - time * 2.3 + phase);
            const centerX = width * (0.4 * wave * t * t + 0.16 * Math.sin(t * 5.5 + phase) * t);
            const centerZ = width * (0.22 * Math.sin(t * 7.3 - time * 1.7 + phase) * t * t);
            for (let column = 0; column <= columns; column++) {
              const across = column / columns * 2 - 1;
              const x = across * width * belly;
              const z = width * 0.16 * (1 - across * across) * Math.sin(Math.PI * t);
              const index = (sheet * (rows + 1) * (columns + 1) + row * (columns + 1) + column) * 3;
              positions[index] = centerX + x * Math.cos(angle) - z * Math.sin(angle);
              positions[index + 1] = length * t * (1 + 0.05 * Math.sin(time * 1.9 + phase)) + width * 0.055 * wave * across * t;
              positions[index + 2] = centerZ + x * Math.sin(angle) + z * Math.cos(angle);
            }
          }
        }
        attribute.needsUpdate = true;
        geometry.computeVertexNormals();
      }
      animate(0);
      // Conservative time-independent bound covers every wave phase.
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, length * 0.5, 0), Math.hypot(width * 1.7, length * 0.6));
      geometry.boundingBox = new THREE.Box3(
        new THREE.Vector3(-width * 1.7, -width * 0.06, -width * 1.7),
        new THREE.Vector3(width * 1.7, length * 1.1 + width * 0.06, width * 1.7),
      );
      return { geometry, animate };
    }

    const tongues = high ? 26 : 18;
    for (let i = 0; i < tongues; i++) {
      const latitude = Math.acos(0.91 - 1.43 * ((i + 0.45) / tongues));
      const longitude = i * GOLDEN_ANGLE;
      const base = surface(latitude, longitude, unit * 0.008);
      const normal = normalAt(base);
      // Buoyancy wins over the surface normal, including on the lower hemisphere.
      const outward = 0.34 + Math.max(0, -normal.y) * 1.05;
      const up = Y_AXIS.clone().multiplyScalar(0.87).addScaledVector(normal, outward).normalize();
      const right = new THREE.Vector3(Math.sin(longitude), 0, -Math.cos(longitude)).normalize();
      const forward = right.clone().cross(up).normalize();
      const root = new THREE.Group();
      root.name = `UpwardSolarFlame_${i}`;
      root.position.copy(base);
      root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward));
      group.add(root);
      const length = unit * (0.39 + 0.32 * hash(i + 19));
      const width = unit * (0.105 + 0.065 * hash(i + 57));
      const phase = i * 1.79;
      const flame = flameGeometry(width, length, phase, false);
      const mantle = new THREE.Mesh(flame.geometry, goldMaterial);
      mantle.name = 'BroadGoldenFlame';
      root.add(mantle);
      animations.push(flame.animate);
      // Only a few basal cores, kept short and broad so they cannot read as wires.
      if (i % 4 === 0) {
        const core = flameGeometry(width * 0.55, length * 0.42, phase, true);
        const coreMesh = new THREE.Mesh(core.geometry, coreMaterial);
        coreMesh.name = 'BlueWhiteBasalCore';
        coreMesh.position.z = unit * 0.035;
        root.add(coreMesh);
        animations.push(core.animate);
      }
    }
    animations.push((time) => {
      goldMaterial.emissiveIntensity = 1.08 + 0.09 * Math.sin(time * 1.7);
      coreMaterial.emissiveIntensity = 1.6 + 0.12 * Math.sin(time * 1.7 + 0.55);
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
    const movingBeads: Array<{ index: number; latitude: number; longitude: number; size: number; phase: number }> = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const latitude = Math.acos(1 - 2 * (i + 0.5) / count);
      const longitude = i * GOLDEN_ANGLE + (hash(i + 120) - 0.5) * 0.18;
      const size = unit * (0.018 + 0.049 * Math.pow(hash(i + 72), 1.65));
      const point = surface(latitude, longitude);
      const normal = normalAt(point);
      // The lower portion is embedded, giving a wet contact rather than floating pearls.
      dummy.position.copy(point).addScaledVector(normal, size * 0.34);
      dummy.quaternion.setFromUnitVectors(Z_AXIS, normal);
      dummy.scale.set(size, size * (1.05 + 0.16 * hash(i + 37)), size * 0.9);
      dummy.updateMatrix();
      beads.setMatrixAt(i, dummy.matrix);
      if (i % 7 === 0 && latitude < 2.65) movingBeads.push({ index: i, latitude, longitude, size, phase: hash(i + 340) });
    }
    beads.instanceMatrix.needsUpdate = true;
    // Conservative static bounds contain every position along each sliding path.
    beads.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.max(radius, halfHeight) + unit * 0.14);
    beads.boundingBox = new THREE.Box3(
      new THREE.Vector3(-radius - unit * 0.14, -halfHeight - unit * 0.14, -radius - unit * 0.14),
      new THREE.Vector3(radius + unit * 0.14, halfHeight + unit * 0.14, radius + unit * 0.14),
    );
    instancedMeshes.add(beads);
    group.add(beads);
    animations.push((time) => {
      // A minority of drops slowly slip down the surface. A brief size fade
      // hides each periodic reset; absolute-time evaluation supports seeking.
      for (const bead of movingBeads) {
        const cycle = fract(time * (0.038 + bead.phase * 0.008) + bead.phase);
        const latitude = bead.latitude + 0.22 * cycle;
        const point = surface(latitude, bead.longitude + Math.sin(cycle * Math.PI) * 0.015);
        const normal = normalAt(point);
        const fade = Math.max(0.02, Math.min(1, cycle / 0.075, (1 - cycle) / 0.075));
        const size = bead.size * fade;
        dummy.position.copy(point).addScaledVector(normal, size * 0.34);
        dummy.quaternion.setFromUnitVectors(Z_AXIS, normal);
        dummy.scale.set(size, size * (1.1 + 0.12 * Math.sin(cycle * Math.PI)), size * 0.9);
        dummy.updateMatrix();
        beads.setMatrixAt(bead.index, dummy.matrix);
      }
      beads.instanceMatrix.needsUpdate = true;
    });
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
