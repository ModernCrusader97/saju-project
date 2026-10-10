import * as THREE from 'three';
/** All texture slots, including roughness/metalness/emissive and sprite maps. */
export function disposeMaterial(material: THREE.Material): void {
  const seen = new Set<THREE.Texture>();
  for (const value of Object.values(material)) if (value?.isTexture && !seen.has(value)) {
    seen.add(value); value.dispose();
  }
  material.dispose();
}
export function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse(object => {
    const drawable = object as THREE.Mesh;
    const skin = object as THREE.SkinnedMesh;
    if (skin.isSkinnedMesh && !skeletons.has(skin.skeleton)) { skeletons.add(skin.skeleton); skin.skeleton.dispose(); }
    if (drawable.geometry && !geometries.has(drawable.geometry)) { geometries.add(drawable.geometry); drawable.geometry.dispose(); }
    for (const material of Array.isArray(drawable.material) ? drawable.material : drawable.material ? [drawable.material] : []) {
      if (!materials.has(material)) { materials.add(material); disposeMaterial(material); }
    }
  });
}
export function surfaceTexture(canvas: HTMLCanvasElement, color = false): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}
