import * as THREE from 'three';

/** Drop lost GPU allocations without ending the scene's CPU-owned lifetimes.
 * Three's old geometry/instance/texture disposal callbacks capture pre-loss GL
 * handles. Remove those callbacks while the context is lost; the unchanged
 * geometries, attributes, images and material recipes can upload again later.
 */
export function releaseSceneGPUAllocations(scene: THREE.Object3D, renderer: THREE.WebGLRenderer): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const instances = new Set<THREE.InstancedMesh>();
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const shadows = new Set<THREE.LightShadow>();
  const collectTexture = (value: unknown): void => {
    if (Array.isArray(value)) { for (const item of value) collectTexture(item); }
    else if ((value as THREE.Texture | null)?.isTexture) textures.add(value as THREE.Texture);
  };
  scene.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) instances.add(mesh as THREE.InstancedMesh);
    for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
      if (materials.has(material)) continue;
      materials.add(material);
      for (const value of Object.values(material)) collectTexture(value);
      // onBeforeCompile textures (including the jade field atlas) are not
      // material map slots. Read the current renderer's compiled uniform values.
      const properties = renderer.properties.get(material) as { uniforms?: Record<string, { value: unknown }> };
      const uniforms = properties.uniforms;
      for (const uniform of Object.values(uniforms ?? {})) collectTexture(uniform.value);
    }
    const shadow = (object as THREE.DirectionalLight).shadow;
    if (shadow) shadows.add(shadow);
  });
  for (const instance of instances) instance.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const shadow of shadows) shadow.dispose();
  // material.dispose() also closes application-owned animation/shader recipes;
  // those must stay live throughout a recoverable context loss.
}
