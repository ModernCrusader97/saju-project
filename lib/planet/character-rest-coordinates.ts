import * as THREE from 'three';

export const CHARACTER_REST_ATTRIBUTES = ['stemRestPosition', 'stemRestNormal', 'stemLocalBrushAxis', 'stemLocalBrushSide'] as const;
/** Bind once in the character's desired reference pose, before its display transform.
 * Display transforms may already be present: root.matrixWorld is explicitly removed.
 * Attributes remain attached to each rigid part; this is not skinning or joint welding.
 * Geometry must be owned by the caller and not shared between differently placed meshes.
 */
export function bindCharacterRestCoordinates(root: THREE.Object3D, meshes: readonly THREE.Mesh[]) {
  root.updateWorldMatrix(true, true);
  if (Math.abs(root.matrixWorld.determinant()) < 1e-12) throw new RangeError('Character root transform must be invertible');
  const rootInverse = root.matrixWorld.clone().invert();
  const seen = new Set<THREE.BufferGeometry>();
  // Validate the entire input before mutating any geometry.
  for (const mesh of meshes) {
    let ancestor: THREE.Object3D | null = mesh;
    while (ancestor && ancestor !== root) ancestor = ancestor.parent;
    if (!ancestor) throw new Error('Every surface mesh must descend from the character root');
    if (seen.has(mesh.geometry)) throw new Error('Surface meshes must own distinct geometry before binding');
    seen.add(mesh.geometry);
    if (!mesh.geometry.getAttribute('position') || !mesh.geometry.getAttribute('normal')) throw new Error('Position and normal attributes are required');
    if (Math.abs(mesh.matrixWorld.determinant()) < 1e-12) throw new RangeError('Surface transform must be invertible');
  }
  const entries = meshes.map(mesh => {
    const geometry = mesh.geometry;
    const previous = CHARACTER_REST_ATTRIBUTES.map(name => geometry.getAttribute(name));
    const meshToRest = rootInverse.clone().multiply(mesh.matrixWorld);
    const normalToRest = new THREE.Matrix3().getNormalMatrix(meshToRest);
    const restToLocal = meshToRest.clone().invert();
    const axis = new THREE.Vector3(0, 1, 0).transformDirection(restToLocal);
    const side = new THREE.Vector3(1, 0, 0).transformDirection(restToLocal);
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    const arrays = CHARACTER_REST_ATTRIBUTES.map(() => new Float32Array(position.count * 3));
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(meshToRest).toArray(arrays[0], i * 3);
      n.fromBufferAttribute(normal, i).applyMatrix3(normalToRest).normalize().toArray(arrays[1], i * 3);
      axis.toArray(arrays[2], i * 3); side.toArray(arrays[3], i * 3);
    }
    const attributes = arrays.map(array => new THREE.BufferAttribute(array, 3));
    CHARACTER_REST_ATTRIBUTES.forEach((name, i) => geometry.setAttribute(name, attributes[i]));
    return { mesh, meshToRest, attributes, previous };
  });
  let disposed = false;
  return {
    entries,
    /** Restore prior attributes; caller still owns all geometry/material resources. */
    dispose() {
      if (disposed) return; disposed = true;
      for (const {mesh, attributes, previous} of entries) CHARACTER_REST_ATTRIBUTES.forEach((name, i) => {
        if (mesh.geometry.getAttribute(name) !== attributes[i]) return;
        if (previous[i]) mesh.geometry.setAttribute(name, previous[i]); else mesh.geometry.deleteAttribute(name);
      });
    },
  };
}
