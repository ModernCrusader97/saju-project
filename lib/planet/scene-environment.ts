import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** GPU-generated reflections must be rebuilt after WebGL context restoration. */
export function createStudioEnvironment(renderer: THREE.WebGLRenderer) {
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  try { return pmrem.fromScene(room, .035); }
  finally {
    // RoomEnvironment disposes shared geometry/materials, but its instanced
    // boxes also own an instanceMatrix GPU buffer through InstancedMesh.
    room.traverse(object=>{
      const mesh=object as THREE.InstancedMesh;
      if(mesh.isInstancedMesh)mesh.dispose();
    });
    room.dispose();pmrem.dispose();
  }
}
