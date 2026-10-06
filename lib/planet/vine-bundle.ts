import * as THREE from 'three';

export interface VineBundleOptions {
  /** Overall bundle radius, excluding occasional leaves. Default 1. */
  radius?: number;
  quality?: 'low' | 'high';
  /** Stable numerical shape seed. Default 9255. */
  seed?: number;
}
export interface VineBundle {
  group: THREE.Group;
  /** Absolute seconds. Only leaves sway; the wound vine mass stays fixed. */
  update(timeSeconds: number): void;
  dispose(): void;
}

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const Y = new THREE.Vector3(0, 1, 0);
const fract = (x: number) => x - Math.floor(x);

/**
 * A literal wound ball made from living vines. No sphere, smooth substrate,
 * displacement impostor or opaque fill mesh is present. Three radial layers of
 * continuous tube strands create real crossings, occlusion and lower strands.
 * Designed as a replacement for the sphere, not another thin decoration layer.
 */
export function createVineBundle(options: VineBundleOptions = {}): VineBundle {
  const radius = options.radius ?? 1;
  const quality = options.quality ?? 'low';
  const seed = options.seed ?? 9255;
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Vine radius must be finite and positive.');
  if (!Number.isFinite(seed)) throw new RangeError('Vine seed must be finite.');
  if (quality !== 'low' && quality !== 'high') throw new RangeError('Vine quality must be low or high.');
  const high = quality === 'high';
  const random = (i: number) => fract(Math.sin(i * 127.1 + (seed % 100000) * .713 + 311.7) * 43758.5453123);
  const group = new THREE.Group();
  group.name = 'LivingVineYarnBundle';
  group.userData = { asset: 'vine-yarn-bundle-v1', seed, quality, hasSmoothSubstrate: false };
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const instances = new Set<THREE.InstancedMesh>();
  let disposed = false;
  const ownGeometry = <T extends THREE.BufferGeometry>(value: T): T => { geometries.add(value); return value; };
  const ownMaterial = <T extends THREE.Material>(value: T): T => { materials.add(value); return value; };
  const materialsByLayer = [
    ownMaterial(new THREE.MeshPhysicalMaterial({ color: 0x526d2e, roughness: .63, clearcoat: .025, clearcoatRoughness: .55, vertexColors: false })),
    ownMaterial(new THREE.MeshPhysicalMaterial({ color: 0x6c8935, roughness: .57, clearcoat: .04, clearcoatRoughness: .48, vertexColors: false })),
    ownMaterial(new THREE.MeshPhysicalMaterial({ color: 0x779738, roughness: .53, clearcoat: .055, clearcoatRoughness: .45, vertexColors: false })),
    ownMaterial(new THREE.MeshStandardMaterial({ color: 0x90a746, roughness: .57, vertexColors: false })),
  ];

  class WoundCurve extends THREE.Curve<THREE.Vector3> {
    readonly rotation: THREE.Quaternion;
    constructor(readonly r: number, readonly turns: number, readonly phase: number, readonly variation: number, axis: THREE.Vector3) {
      super();
      this.rotation = new THREE.Quaternion().setFromUnitVectors(Y, axis);
      this.arcLengthDivisions = high ? 960 : 640;
    }
    getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
      const a = TAU * t;
      const lat = Math.PI * .5 + .82 * Math.sin(a + this.phase * .71) + .12 * Math.sin(a * 3 + this.phase);
      const lon = a * this.turns + this.phase + .12 * Math.sin(a * 2 + this.phase);
      const r = this.r + this.variation * (.70 * Math.sin(a * 3 + this.phase) + .30 * Math.sin(a * 7 - this.phase));
      target.set(Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon));
      return target.multiplyScalar(r).applyQuaternion(this.rotation);
    }
  }

  const batches: THREE.BufferGeometry[][] = [[], [], [], []];
  const outerCurves: Array<{ curve: WoundCurve; thickness: number }> = [];
  let strandCount = 0;
  const layerSpecs = high
    ? [{ count: 7, r: .61, thickness: .064, segments: 192, sides: 6 }, { count: 12, r: .81, thickness: .048, segments: 240, sides: 7 }, { count: 20, r: .953, thickness: .033, segments: 288, sides: 7 }]
    : [{ count: 6, r: .61, thickness: .064, segments: 128, sides: 5 }, { count: 9, r: .81, thickness: .048, segments: 160, sides: 6 }, { count: 16, r: .953, thickness: .033, segments: 192, sides: 6 }];

  for (let layer = 0; layer < layerSpecs.length; layer++) {
    const spec = layerSpecs[layer];
    for (let i = 0; i < spec.count; i++) {
      const id = layer * 100 + i;
      const z = 1 - 2 * (i + .5) / spec.count;
      const azimuth = i * GOLDEN_ANGLE + layer * .79 + (random(id + 10) - .5) * .45;
      const side = Math.sqrt(1 - z * z);
      const axis = new THREE.Vector3(side * Math.cos(azimuth), z, side * Math.sin(azimuth));
      const fine = layer === 2 && i % 4 === 3;
      const thickness = radius * spec.thickness * (fine ? .58 : .88 + .30 * random(id + 20));
      const curve = new WoundCurve(
        radius * (spec.r + (random(id + 30) - .5) * .026),
        layer === 0 ? 4 : 3 + (i % 2),
        TAU * random(id + 40),
        radius * (layer === 2 ? .032 : .022), axis,
      );
      const geometry = new THREE.TubeGeometry(curve, spec.segments, thickness, spec.sides, true);
      // Small periodic thickness variation is real geometry, not painted shading.
      const positions = geometry.getAttribute('position');
      for (let row = 0; row <= spec.segments; row++) {
        const t = row / spec.segments;
        const center = curve.getPointAt(t);
        const width = .92 + .09 * Math.sin(TAU * t * 3 + id) + .04 * Math.sin(TAU * t * 7 + id * .7);
        for (let col = 0; col <= spec.sides; col++) {
          const index = row * (spec.sides + 1) + col;
          positions.setXYZ(index,
            center.x + (positions.getX(index) - center.x) * width,
            center.y + (positions.getY(index) - center.y) * width,
            center.z + (positions.getZ(index) - center.z) * width);
        }
      }
      geometry.computeVertexNormals();
      geometry.userData.sourceStrand = true;
      batches[fine ? 3 : layer].push(geometry);
      if (layer === 2) outerCurves.push({ curve, thickness });
      strandCount++;
    }
  }

  function mergeIntoMesh(sources: THREE.BufferGeometry[], material: THREE.Material, name: string): THREE.Mesh {
    const vertexCount = sources.reduce((sum, g) => sum + g.getAttribute('position').count, 0);
    const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3);
    const indices: number[] = [];
    let offset = 0;
    for (const geometry of sources) {
      const position = geometry.getAttribute('position');
      positions.set(position.array, offset * 3);
      normals.set(geometry.getAttribute('normal').array, offset * 3);
      const index = geometry.getIndex();
      if (index) for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + offset);
      offset += position.count;
      geometry.dispose();
    }
    const geometry = ownGeometry(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  for (let i = 0; i < batches.length; i++) {
    const mesh = mergeIntoMesh(batches[i], materialsByLayer[i], ['InnerLivingStrands', 'MiddleWoundStrands', 'OuterWoundVines', 'FineOverwrapVines'][i]);
    mesh.userData.strandCount = batches[i].length;
  }

  // Sprigs grow from actual outer vine centerlines, never arbitrary sphere points.
  const sprouts = high ? 18 : 12;
  const twigGeometries: THREE.BufferGeometry[] = [];
  const leafFrames: Array<{ position: THREE.Vector3; quaternion: THREE.Quaternion; size: number; phase: number }> = [];
  for (let i = 0; i < sprouts; i++) {
    const strand = outerCurves[i % outerCurves.length];
    const t = .08 + .84 * random(i + 510);
    const base = strand.curve.getPointAt(t), tangent = strand.curve.getTangentAt(t).normalize(), normal = base.clone().normalize();
    base.addScaledVector(normal, strand.thickness * .55);
    const end = base.clone().addScaledVector(normal, radius * (.07 + .06 * random(i + 530))).addScaledVector(tangent, radius * .06);
    const mid = base.clone().lerp(end, .55).addScaledVector(normal, radius * .016);
    twigGeometries.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([base, mid, end]), 8, radius * .0065, 5, false));
    const direction = normal.clone().multiplyScalar(.76).addScaledVector(tangent, .66).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(Y, direction);
    for (let side = 0; side < 2; side++) {
      const spread = new THREE.Quaternion().setFromEuler(new THREE.Euler(.20, side === 0 ? .30 : -.48, side === 0 ? -.48 : .70));
      leafFrames.push({ position: end.clone(), quaternion: q.clone().multiply(spread), size: radius * (.135 + .060 * random(i + 570)) * (side ? .76 : 1), phase: i * 1.73 + side });
    }
  }
  mergeIntoMesh(twigGeometries, materialsByLayer[3], 'VineSproutStems');

  const leafPosition: number[] = [], leafIndex: number[] = [];
  const rows = high ? 10 : 7;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, width = .32 * Math.pow(Math.sin(Math.PI * t), .9);
    for (let col = -1; col <= 1; col++) leafPosition.push(col * width, t, .12 * Math.sin(t * Math.PI) * (1 - .75 * col * col) + .08 * t * t);
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < 2; col++) {
    const a = row * 3 + col; leafIndex.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
  }
  const leafGeometry = ownGeometry(new THREE.BufferGeometry());
  leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute(leafPosition, 3));
  leafGeometry.setIndex(leafIndex); leafGeometry.computeVertexNormals();
  // The three coincident pointed-tip vertices can have zero accumulated area.
  // A finite facing normal avoids undefined lighting at that subpixel endpoint.
  const leafNormals = leafGeometry.getAttribute('normal');
  for (let i = 0; i < leafNormals.count; i++) {
    const x = leafNormals.getX(i), y = leafNormals.getY(i), z = leafNormals.getZ(i);
    if (x * x + y * y + z * z < 1e-10) leafNormals.setXYZ(i, 0, 0, 1);
  }
  const leafMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({ color: 0x91ae3b, roughness: .59, side: THREE.DoubleSide, clearcoat: .04, sheen: .12, sheenColor: new THREE.Color(0xb3c968), vertexColors: false }));
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafFrames.length);
  leaves.name = 'LivingVineLeafSprigs'; leaves.castShadow = true; leaves.receiveShadow = true;
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  leaves.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 1.38);
  leaves.boundingBox = new THREE.Box3(new THREE.Vector3(-1.38, -1.38, -1.38).multiplyScalar(radius), new THREE.Vector3(1.38, 1.38, 1.38).multiplyScalar(radius));
  group.add(leaves); instances.add(leaves);
  const dummy = new THREE.Object3D(), sway = new THREE.Quaternion();
  group.userData.strandCount = strandCount;
  group.userData.radialLayers = 3;
  group.userData.leafCount = leafFrames.length;
  group.userData.drawCalls = 6;
  const update = (seconds: number) => {
    if (disposed) return;
    if (!Number.isFinite(seconds)) throw new RangeError('Vine time must be finite.');
    for (let i = 0; i < leafFrames.length; i++) {
      const f = leafFrames[i];
      sway.setFromEuler(new THREE.Euler(.035 * Math.sin(seconds * .83 + f.phase), 0, .045 * Math.sin(seconds * .62 + f.phase * .8)));
      dummy.position.copy(f.position); dummy.quaternion.copy(f.quaternion).multiply(sway); dummy.scale.setScalar(f.size); dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    }
    leaves.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { group, update, dispose() {
    if (disposed) return; disposed = true;
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const instance of instances) instance.dispose();
    geometries.clear(); materials.clear(); instances.clear();
    group.removeFromParent(); group.clear();
  } };
}
