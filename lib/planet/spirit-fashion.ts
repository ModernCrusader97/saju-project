import * as THREE from 'three';
import { EMPTY_FASHION, FASHION_PALETTES, FASHION_SLOTS, normalizeFashion, type FashionItemId, type FashionSelection, type FashionSlot, type FashionStem } from './spirit-fashion-catalog';
import type { SurfaceAttachmentExclusion } from './surface-attachment-exclusions';
import { FashionSurfaceProjector } from './fashion-surface-projector';

export interface FashionAnchor { triangle: number; barycentric: THREE.Vector3; mesh: THREE.Mesh; role: string }
interface Pose { position: THREE.Vector3; normal: THREE.Vector3 }
interface Item { id: FashionItemId; slot: FashionSlot; group: THREE.Group; anchor: FashionAnchor; localBounds: THREE.Box3; update: () => void; dispose: () => void }
export interface SpiritFashion {
  group: THREE.Group;
  readonly selection: FashionSelection;
  set: (selection: FashionSelection) => void;
  update: () => void;
  dispose: () => void;
}

/** Code-authored accessories for the approved B. Triangle supports are sampled
 * from its real GLB, never from a radius shell. A rigid accessory follows its
 * support triangle each frame, including transformed presentation depth. */
export function createSpiritFashion({ body, model, eyes, stem, quality = 'high', presentationDepth = model.scale.z }: {
  body: THREE.Mesh; model: THREE.Group; eyes: THREE.Mesh[]; stem: FashionStem; quality?: 'low' | 'high'; presentationDepth?: number;
}): SpiritFashion {
  const group = new THREE.Group(); group.name = 'SpiritFashion_v1';
  // Keep the accessory proportions isotropic while baking the body's fixed
  // presentation depth into support locations. The original GLB is untouched.
  if (presentationDepth <= 0 || !Number.isFinite(presentationDepth)) throw new Error('Fashion requires positive presentation depth.');
  group.scale.z = 1 / presentationDepth; model.add(group); group.updateWorldMatrix(true, true);
  const items = new Map<FashionSlot, Item>();
  let selection: FashionSelection = { ...EMPTY_FASHION }, disposed = false;
  const ray = new THREE.Raycaster(), relative = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3();
  const projector = new FashionSurfaceProjector(body);
  const inverse = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
  const high = quality !== 'low', palette = FASHION_PALETTES[stem];
  const priorExclusions = model.userData.surfaceAttachmentExclusions;

  function resolve(anchor: FashionAnchor): Pose {
    const index = body.geometry.index;
    const vertices = [0, 1, 2].map(i => body.getVertexPosition(index ? index.getX(anchor.triangle * 3 + i) : anchor.triangle * 3 + i, new THREE.Vector3()));
    const position = new THREE.Vector3().copy(vertices[0]).multiplyScalar(anchor.barycentric.x)
      .addScaledVector(vertices[1], anchor.barycentric.y).addScaledVector(vertices[2], anchor.barycentric.z);
    const normal = new THREE.Triangle(...vertices as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getNormal(new THREE.Vector3());
    body.updateWorldMatrix(true, false); group.updateWorldMatrix(true, false);
    relative.copy(group.matrixWorld).invert().multiply(body.matrixWorld);
    return { position: position.applyMatrix4(relative), normal: normal.applyNormalMatrix(normalMatrix.getNormalMatrix(relative)) };
  }
  function support(origin: THREE.Vector3, direction: THREE.Vector3, role: string): FashionAnchor {
    group.updateWorldMatrix(true, false); body.updateWorldMatrix(true, false);
    const worldOrigin = origin.clone().applyMatrix4(group.matrixWorld), worldDirection = direction.clone().transformDirection(group.matrixWorld);
    const bodyInverse = body.matrixWorld.clone().invert();
    const projected = projector.intersect(worldOrigin.clone().applyMatrix4(bodyInverse), worldDirection.clone().transformDirection(bodyInverse));
    if (projected) return { mesh: body, ...projected, role };
    if (projected === null) throw new Error(`Approved B fashion support missing: ${role}`);
    ray.set(worldOrigin, worldDirection); ray.near = 0; ray.far = 12;
    const hit = ray.intersectObject(body, false)[0];
    if (!hit || hit.faceIndex === undefined || hit.faceIndex === null) throw new Error(`Approved B fashion support missing: ${role}`);
    const triangle = hit.faceIndex, index = body.geometry.index;
    const [a, b, c] = [0, 1, 2].map(i => body.getVertexPosition(index ? index.getX(triangle * 3 + i) : triangle * 3 + i, new THREE.Vector3()));
    const localPoint = body.worldToLocal(hit.point.clone());
    const barycentric = new THREE.Triangle(a, b, c).getBarycoord(localPoint, new THREE.Vector3());
    if (!barycentric || !barycentric.toArray().every(Number.isFinite)) throw new Error('Fashion support is degenerate.');
    return { mesh: body, triangle, barycentric, role };
  }
  const front = (x: number, y: number, role: string) => support(new THREE.Vector3(x, y, 3), new THREE.Vector3(0, 0, -1), role);
  function outside(x: number, y: number, clearance = .04): THREE.Vector3 {
    const pose = resolve(front(x, y, 'contour'));
    return pose.position.addScaledVector(pose.normal, clearance);
  }
  function mount(itemGroup: THREE.Group, anchor: FashionAnchor, clearance = .04): void {
    const pose = resolve(anchor);
    // Normals are covectors under scale. Turn the actual world normal back into
    // a direction before orienting the rigid attachment in its parent's space.
    const worldNormal = pose.normal.clone().applyNormalMatrix(normalMatrix.getNormalMatrix(group.matrixWorld));
    const direction = worldNormal.transformDirection(inverse.copy(group.matrixWorld).invert());
    const y = up.clone().addScaledVector(direction, -up.dot(direction));
    if (y.lengthSq() < 1e-5) y.set(0, 0, 1).addScaledVector(direction, -direction.z);
    y.normalize(); const x = y.clone().cross(direction).normalize(); y.crossVectors(direction, x).normalize();
    itemGroup.position.copy(pose.position).addScaledVector(direction, clearance);
    itemGroup.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, direction)); itemGroup.updateMatrix();
    itemGroup.userData.support = { triangle: anchor.triangle, barycentric: anchor.barycentric.toArray(), role: anchor.role,
      position: pose.position.toArray(), normal: pose.normal.toArray(), clearance };
  }

  function build(slot: FashionSlot, id: FashionItemId): Item {
    const itemGroup = new THREE.Group(); itemGroup.name = `fashion:${slot}:${id}`;
    itemGroup.userData.fashionItemId = id; itemGroup.userData.fashionSlot = slot; itemGroup.userData.stem = stem;
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    const ownG = <T extends THREE.BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
    const ownM = <T extends THREE.Material>(material: T): T => { materials.add(material); return material; };
    const main = ownM(new THREE.MeshStandardMaterial({ name: `fashion:${stem}:${id}`, color: palette.main, roughness: palette.roughness, metalness: palette.metalness }));
    const accent = ownM(new THREE.MeshStandardMaterial({ name: `fashion-accent:${stem}:${id}`, color: palette.accent, roughness: .43, metalness: Math.min(.7, palette.metalness + .12) }));
    const fabric = ownM(new THREE.MeshStandardMaterial({ name: `fashion-fabric:${stem}:${id}`, color: palette.fabric, roughness: .9, metalness: 0, side: THREE.DoubleSide }));
    let anchor: FashionAnchor;
    try {
      anchor = slot === 'head' ? front(-.32, 2.12, 'upper-left-head') : slot === 'face' ? front(0, id === 'fitted-mask' ? 1.635 : 1.76, 'face-center') :
        slot === 'neck' ? front(0, 1.34, 'below-mouth') : support(new THREE.Vector3(0, 1.25, -3), new THREE.Vector3(0, 0, 1), 'mid-back');
      group.add(itemGroup); mount(itemGroup, anchor, slot === 'neck' ? .055 : .045);
      const localFromRoot = itemGroup.matrix.clone().invert();
      function mesh(geometry: THREE.BufferGeometry, material: THREE.Material = main, name: string = id, inRoot = false): THREE.Mesh {
        ownG(geometry); if (inRoot) geometry.applyMatrix4(localFromRoot);
        const object = new THREE.Mesh(geometry, material); object.name = `fashion:${name}`; object.castShadow = true; itemGroup.add(object); return object;
      }
      const sphere = (position: [number, number, number], scale: [number, number, number], material = main, name: string = id) => {
        const object = mesh(new THREE.SphereGeometry(1, high ? 20 : 12, high ? 12 : 8), material, name); object.position.set(...position); object.scale.set(...scale); return object;
      };
      const tube = (points: THREE.Vector3[], radius: number, material = main, closed = false, name: string = id, inRoot = false) =>
        mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed, 'centripetal'), high ? 48 : 24, radius, high ? 8 : 5, closed), material, name, inRoot);
      function leaf(x: number, y: number, rotation: number, size: number) {
        const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.bezierCurveTo(-.075, .04, -.08, .14, 0, .21); shape.bezierCurveTo(.08, .14, .075, .04, 0, 0);
        const object = mesh(new THREE.ExtrudeGeometry(shape, { depth: .013, bevelEnabled: true, bevelSize: .004, bevelThickness: .004, bevelSegments: 1, curveSegments: high ? 8 : 4 }), accent, 'leaf');
        object.position.set(x, y, .014); object.rotation.z = rotation; object.scale.setScalar(size);
      }
      if (id === 'sprout-pin') {
        sphere([0, 0, 0], [.054, .044, .018], main, 'pin-base');
        tube([new THREE.Vector3(0, 0, .008), new THREE.Vector3(.008, .07, .025), new THREE.Vector3(.018, .13, .03)], .011, main, false, 'sprout-stem');
        leaf(.006, .066, -.72, .58); leaf(.014, .084, .62, .58);
      } else if (id === 'crescent-pin') {
        const shape = new THREE.Shape(); shape.moveTo(.048, .096); shape.bezierCurveTo(-.07, .11, -.112, -.032, -.014, -.069);
        shape.bezierCurveTo(.026, -.083, .06, -.062, .079, -.038); shape.bezierCurveTo(-.01, -.038, -.026, .05, .048, .096);
        mesh(new THREE.ExtrudeGeometry(shape, { depth: .018, bevelEnabled: true, bevelSize: .004, bevelThickness: .004, bevelSegments: 2, curveSegments: high ? 16 : 8 }), accent, 'crescent');
        sphere([.088, .077, .019], [.024, .024, .012], main, 'crescent-dot');
      } else if (id === 'round-sunglasses') {
        const centers = eyes.map(eye => {
          eye.geometry.computeBoundingBox(); const center = eye.geometry.boundingBox!.getCenter(new THREE.Vector3());
          eye.updateWorldMatrix(true, false); return center.applyMatrix4(eye.matrixWorld).applyMatrix4(group.matrixWorld.clone().invert());
        }).sort((a, b) => a.x - b.x);
        if (centers.length !== 2) throw new Error('Fashion requires the two original gaze meshes.');
        const lens = ownM(new THREE.MeshStandardMaterial({ name: `fashion-lens:${stem}`, color: palette.lens, roughness: .2, metalness: .12, side: THREE.DoubleSide }));
        for (const [index, center] of centers.entries()) {
          const points = Array.from({ length: 48 }, (_, i) => {
            const angle = i / 48 * Math.PI * 2; const p = outside(center.x + Math.cos(angle) * .175, center.y + Math.sin(angle) * .12, .046);
            p.z = Math.max(p.z, center.z + .095); return p;
          });
          tube(points, .012, main, true, `glasses-ring-${index}`, true);
          const geometry = new THREE.CircleGeometry(1, high ? 40 : 24); geometry.scale(.158, .104, 1); geometry.translate(center.x, center.y, center.z + .095);
          const object = mesh(geometry, lens, `tinted-lens-${index}`, true); object.castShadow = false;
        }
        tube([new THREE.Vector3(-.071, 1.792, .716), new THREE.Vector3(0, 1.815, .725), new THREE.Vector3(.071, 1.792, .716)], .012, main, false, 'glasses-bridge', true);
        for (const sign of [-1, 1]) {
          const a = outside(sign * .410, 1.774, .047), b = outside(sign * .49, 1.797, .028);
          tube([a, a.clone().lerp(b, .5).add(new THREE.Vector3(0, .015, .012)), b], .011, main, false, 'glasses-support', true);
        }
        itemGroup.userData.intentionalFaceCoverage = 'tinted-sunglasses';
      } else if (id === 'fitted-mask') {
        const width = high ? 20 : 12, height = high ? 8 : 5, positions: number[] = [], indices: number[] = [];
        for (let row = 0; row <= height; row++) for (let col = 0; col <= width; col++) {
          const x = (col / width - .5) * .65, t = row / height;
          const edge = Math.abs(x) / .325, y = 1.475 + t * .275 + edge * .042;
          positions.push(...outside(x, y, .049).toArray());
        }
        for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
          const a = row * (width + 1) + col, b = a + 1, c = a + width + 1, d = c + 1; indices.push(a, c, b, b, c, d);
        }
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
        mesh(geometry, fabric, 'fitted-mask', true);
        for (const t of [0, .5, 1]) {
          const points = Array.from({ length: 17 }, (_, i) => { const x = (i / 16 - .5) * .65; return outside(x, 1.475 + t * .275 + Math.abs(x) / .325 * .042, .055); });
          tube(points, .006, accent, false, 'mask-seam', true);
        }
        for (const sign of [-1, 1]) tube([outside(sign * .325, 1.67, .054), outside(sign * .44, 1.702, .041), outside(sign * .52, 1.755, .027)], .009, fabric, false, 'mask-support', true);
        itemGroup.userData.intentionalFaceCoverage = 'mask';
      } else if (id === 'ribbon-bow') {
        for (const sign of [-1, 1]) {
          const loop = sphere([sign * .087, .012, .009], [.088, .063, .022], fabric, 'ribbon-loop'); loop.rotation.z = sign * -.32;
          const tail = sphere([sign * .052, -.082, .006], [.033, .070, .014], fabric, 'ribbon-tail'); tail.rotation.z = sign * -.24;
        }
        sphere([0, 0, .026], [.032, .039, .019], accent, 'ribbon-knot');
      } else if (id === 'leaf-brooch') {
        sphere([0, 0, 0], [.037, .055, .018], main, 'back-brooch-base');
        for (const [index, rotation] of [-.7, 0, .7].entries()) leaf(0, -.022 + index * .002, rotation, .9);
        tube([new THREE.Vector3(0, -.04, .02), new THREE.Vector3(.015, .07, .028), new THREE.Vector3(0, .13, .03)], .009, main, false, 'back-brooch-stem');
      }
      itemGroup.updateWorldMatrix(true, true);
      const localBounds = new THREE.Box3(), itemInverse = itemGroup.matrixWorld.clone().invert();
      itemGroup.traverse(object => { const drawable = object as THREE.Mesh; if (!drawable.isMesh) return;
        drawable.geometry.computeBoundingBox(); localBounds.union(drawable.geometry.boundingBox!.clone().applyMatrix4(itemInverse.clone().multiply(drawable.matrixWorld))); });
      let released = false;
      const update = () => { if (!released) mount(itemGroup, anchor, slot === 'neck' ? .055 : .045); };
      const dispose = () => { if (released) return; released = true; itemGroup.removeFromParent(); for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose(); itemGroup.clear(); };
      return { id, slot, group: itemGroup, anchor, localBounds, update, dispose };
    } catch (error) {
      itemGroup.removeFromParent(); for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose(); itemGroup.clear(); throw error;
    }
  }

  function publish(): void {
    group.updateWorldMatrix(true, true); model.updateWorldMatrix(true, false);
    const exclusions: SurfaceAttachmentExclusion[] = [];
    const toModel = model.matrixWorld.clone().invert();
    for (const [slot, item] of items) {
      // The region includes the small hardware footprint and its surface
      // support, not the whole head/body. Coordinates belong to the model.
      const box = item.localBounds.clone().applyMatrix4(toModel.clone().multiply(item.group.matrixWorld));
      const supportPoint = resolve(item.anchor).position.applyMatrix4(group.matrixWorld).applyMatrix4(toModel);
      box.expandByPoint(supportPoint); box.expandByScalar(.035);
      exclusions.push({ id: `fashion:${slot}:${item.id}`, shape: 'box', min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] });
    }
    model.userData.surfaceAttachmentExclusions = exclusions;
    group.userData.diagnostics = { version: 1, stem, quality, itemCount: items.size, selection: { ...selection },
      triangleSupports: [...items.values()].map(item => ({ id: item.id, ...item.group.userData.support })), exclusions,
      limitations: ['Rigid accessories track one actual support triangle; fabric is not simulated.', 'Tinted glasses and masks intentionally cover the expression.', 'Six code-authored items; no external fashion assets or server wardrobe.'] };
  }
  function set(next: FashionSelection): void {
    if (disposed) return;
    const normalized = normalizeFashion(next);
    // Build replacements before removing the old outfit. A failed support lookup
    // cannot leave a half-equipped wardrobe or leaked replacement resources.
    const replacements = new Map<FashionSlot, Item>();
    try { for (const slot of FASHION_SLOTS) if (normalized[slot] && normalized[slot] !== selection[slot]) replacements.set(slot, build(slot, normalized[slot]!)); }
    catch (error) { for (const item of replacements.values()) item.dispose(); throw error; }
    for (const slot of FASHION_SLOTS) if (normalized[slot] !== selection[slot]) { items.get(slot)?.dispose(); items.delete(slot); if (replacements.has(slot)) items.set(slot, replacements.get(slot)!); }
    selection = normalized; publish();
  }
  function update(): void { if (disposed) return; for (const item of items.values()) item.update(); publish(); }
  function dispose(): void {
    if (disposed) return; disposed = true; for (const item of items.values()) item.dispose(); items.clear();
    projector.dispose();
    group.removeFromParent(); group.clear();
    if (priorExclusions === undefined) delete model.userData.surfaceAttachmentExclusions; else model.userData.surfaceAttachmentExclusions = priorExclusions;
  }
  publish();
  return { group, get selection() { return { ...selection }; }, set, update, dispose };
}
