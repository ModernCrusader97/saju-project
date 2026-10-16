import * as THREE from 'three';
/** All texture slots, including roughness/metalness/emissive and sprite maps. */
export function disposeMaterial(material: THREE.Material, seen = new Set<THREE.Texture>()): void {
  for (const value of Object.values(material)) if (value?.isTexture && !seen.has(value)) {
    seen.add(value); value.dispose();
  }
  material.dispose();
}
export function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    const drawable = object as THREE.Mesh;
    if (drawable.geometry && !geometries.has(drawable.geometry)) { geometries.add(drawable.geometry); drawable.geometry.dispose(); }
    for (const material of Array.isArray(drawable.material) ? drawable.material : drawable.material ? [drawable.material] : []) {
      if (!materials.has(material)) { materials.add(material); disposeMaterial(material, textures); }
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

/** Keep the drawing buffer at the current display density within the view's cap. */
export function resizeRenderer(renderer: THREE.WebGLRenderer, width: number, height: number, maxPixelRatio: number, updateStyle = true): void {
  const ratio = Math.min(window.devicePixelRatio, maxPixelRatio);
  if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
  renderer.setSize(width, height, updateStyle);
}

/** Content-box observers alone do not report a display-density-only change. */
export function observeCanvasResize(element: Element, onResize: () => void): () => void {
  let disposed = false;
  const resized = () => { if (!disposed) onResize(); };
  const observer = new ResizeObserver(resized);
  observer.observe(element);
  let resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  const changed = () => {
    if (disposed) return;
    resolution.removeEventListener('change', changed);
    resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    resolution.addEventListener('change', changed);
    resized();
  };
  resolution.addEventListener('change', changed);
  window.addEventListener('resize', resized);
  return () => {
    disposed = true;
    observer.disconnect();
    resolution.removeEventListener('change', changed);
    window.removeEventListener('resize', resized);
  };
}
