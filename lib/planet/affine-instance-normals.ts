import * as THREE from 'three';

/** Inverse-parent instance transforms may contain shear. Three r186's stock
 * instance normal shortcut handles rotation/scale; cofactors handle the full
 * affine linear transform, including mirrored nonsingular instances. */
export function supportAffineInstanceNormals(
  material: THREE.MeshStandardMaterial, cacheKey = 'surface-affine-instance-normals-v1',
): void {
  material.onBeforeCompile = shader => {
    const chunk = THREE.ShaderChunk.defaultnormal_vertex.replace(
      /transformedNormal \/= vec3\( dot\( im\[ 0 \], im\[ 0 \] \), dot\( im\[ 1 \], im\[ 1 \] \), dot\( im\[ 2 \], im\[ 2 \] \) \);\s*transformedNormal = im \* transformedNormal;/,
      'mat3 cofactors = mat3(cross(im[1], im[2]), cross(im[2], im[0]), cross(im[0], im[1]));\n' +
      'transformedNormal = cofactors * transformedNormal * (dot(im[0], cross(im[1], im[2])) < 0.0 ? -1.0 : 1.0);',
    );
    shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>', chunk);
  };
  material.customProgramCacheKey = () => cacheKey;
}
