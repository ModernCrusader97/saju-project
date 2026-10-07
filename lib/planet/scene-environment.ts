import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** GPU-generated reflections must be rebuilt after WebGL context restoration. */
export function createStudioEnvironment(renderer: THREE.WebGLRenderer) {
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  try { return pmrem.fromScene(room, .035); }
  finally { room.dispose(); pmrem.dispose(); }
}
