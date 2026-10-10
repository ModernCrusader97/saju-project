// Vite QA aliases bind the immutable v31 source or the candidate, plus the
// unchanged private fashion reference. This file is never a product entry.
import * as THREE from 'three';
import { loadApprovedSpirit } from '@dew-loader';
import { createStudioEnvironment } from '@dew-environment';
import { createSpiritFashion } from '@dew-fashion';

const width = 640, height = 760, errors = [], buffers = new Map();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
const gl = renderer.getContext(), create = gl.createBuffer.bind(gl), remove = gl.deleteBuffer.bind(gl);
gl.createBuffer = () => { const b = create(); buffers.set(b, { deleted: false, explicit: false }); return b; };
gl.deleteBuffer = b => {
  const live = gl.isBuffer(b), result = remove(b), row = buffers.get(b);
  if (row) { row.deleted = true; row.explicit = live && !gl.isBuffer(b) && !gl.isContextLost(); }
  return result;
};
renderer.setSize(width, height); renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.debug.onShaderError = (g, p, v, f) => errors.push({ program: g.getProgramInfoLog(p), vertex: g.getShaderInfoLog(v), fragment: g.getShaderInfoLog(f) });
document.body.style.cssText = 'margin:0;background:#edf2ea'; document.body.append(renderer.domElement);
const scene = new THREE.Scene(), environment = createStudioEnvironment(renderer);
scene.environment = environment.texture; scene.environmentIntensity = 1.05;
scene.add(new THREE.HemisphereLight(0xf4f8fc, 0x26343b, .85));
for (const [color, intensity, pos] of [[0xfff1d9, 2.1, [-3, 4, 4]], [0xc1e4f0, .8, [4, 1, 2]], [0xf5fbff, 1.8, [0, 3, -3]]]) {
  const light = new THREE.DirectionalLight(color, intensity); light.position.set(...pos);
  if (pos[0] === -3) { light.castShadow = true; light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -2, near: .1, far: 16 }); light.shadow.bias = -.0002; }
  scene.add(light);
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ color: 0x1c4836, opacity: .09 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.016; floor.receiveShadow = true; scene.add(floor);
const camera = new THREE.PerspectiveCamera(38, width / height, .1, 40);
camera.position.set(0, 1.7, 5.7); camera.lookAt(0, 1.24, 0);
const hash = async a => [...new Uint8Array(await crypto.subtle.digest('SHA-256',
  new Uint8Array(a.buffer, a.byteOffset, a.byteLength)))].map(v => v.toString(16).padStart(2, '0')).join('');
let spirit, fashion, seconds = 0;
function optics() {
  spirit.group.traverse(o => {
    if (!o.isMesh) return;
    for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!material.isMeshPhysicalMaterial || material.transmission <= 0) continue;
      const prior = material.onBeforeRender;
      material.onBeforeRender = function(...args) { prior.apply(this, args);
        const final = args[0].getRenderTarget() === null;
        if (this.premultipliedAlpha !== final) { this.premultipliedAlpha = final; this.needsUpdate = true; }
      };
    }
  });
}
function update(t) { spirit.update(t, 0, camera); fashion?.update(); spirit.update(t, 0, camera); seconds = t; }
function advance(target) {
  if (target < seconds) { spirit.reset(); seconds = 0; }
  while (seconds + .05 < target - 1e-10) update(seconds + .05);
  update(target); renderer.render(scene, camera);
}
async function state() {
  const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const g = spirit.bodyMesh.geometry, attrs = {};
  for (const name of ['position', 'normal', 'uv', 'index']) attrs[name] = await hash(name === 'index' ? g.index.array : g.getAttribute(name).array);
  const dew = spirit.propGroup.children.find(o => o.isInstancedMesh), flags = [], casters = [];
  spirit.propGroup.traverse(o => { if (o.isMesh) flags.push({ name: o.name, cast: o.castShadow, receive: o.receiveShadow }); });
  const effectObjects = new Set(); spirit.propGroup.traverse(o => effectObjects.add(o));
  spirit.bodyMesh.parent.traverse(o => { if (o.isMesh && !effectObjects.has(o) && !o.name.startsWith('fashion:')) casters.push({ name: o.name, cast: o.castShadow }); });
  const program = renderer.properties.get(spirit.bodyMesh.material).currentProgram?.program;
  const location = program && gl.getUniformLocation(program, 'uStemTime');
  const time = location ? gl.getUniform(program, location) : null;
  const world = program && gl.getUniformLocation(program, 'modelMatrix');
  const nativeModel = world ? [...gl.getUniform(program, world)] : null;
  const instances = [], maskOverlaps = [], masks = spirit.bodyMesh.parent.userData.surfaceAttachmentExclusions || [];
  const ownerInverse = spirit.bodyMesh.parent.matrixWorld.clone().invert();
  if (dew) for (let i = 0; i < dew.count; i++) {
    const local = new THREE.Matrix4(); dew.getMatrixAt(i, local); const matrix = dew.matrixWorld.clone().multiply(local);
    instances.push({ index: i, center: new THREE.Vector3().setFromMatrixPosition(matrix).toArray(), volume: Math.abs(matrix.determinant()) });
    if (Math.abs(matrix.determinant()) > 1e-14) {
      const local = ownerInverse.clone().multiply(matrix), e = local.elements;
      const center = new THREE.Vector3().setFromMatrixPosition(local);
      const radius = [Math.hypot(e[0], e[4], e[8]), Math.hypot(e[1], e[5], e[9]), Math.hypot(e[2], e[6], e[10])];
      // Independent ellipsoid axis bounds in the actual fashion owner's space,
      // not a call back into the product exclusion predicate.
      for (const mask of masks) if (mask.shape === 'box' &&
        [0, 1, 2].every(axis => center.getComponent(axis) + radius[axis] >= mask.min[axis] &&
          center.getComponent(axis) - radius[axis] <= mask.max[axis])) maskOverlaps.push({ instance: i, mask: mask.id });
    }
  }
  return { seconds, pixels: await hash(pixels), attributes: attrs, bodyMatrix: spirit.bodyMesh.matrixWorld.toArray(), nativeModel,
    materialTime: time, morph: [...spirit.bodyMesh.morphTargetInfluences], camera: { position: camera.position.toArray(), projection: camera.projectionMatrix.toArray(), world: camera.matrixWorld.toArray() },
    depth: spirit.avatarPivot.scale.z, flags, bodyCasters: casters, instances,
    pool: spirit.propGroup.userData.surfaceDew || null, lifecycle: spirit.propGroup.userData.surfaceDewFrame || null,
    masks, maskOverlaps, matrixSHA256: dew ? await hash(dew.instanceMatrix.array) : null,
    png: renderer.domElement.toDataURL('image/png'), errors: [...errors], glError: gl.getError(),
    shadow: { enabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type, groundY: floor.position.y, opacity: floor.material.opacity },
    nativeBuffers: { created: buffers.size, live: [...buffers.keys()].filter(b => gl.isBuffer(b)).length } };
}
window.dewQA = {
  async load(quality, day = '계유') {
    fashion?.dispose(); fashion = null; spirit?.dispose();
    spirit = await loadApprovedSpirit(day, '병인', quality); optics(); scene.add(spirit.group); seconds = 0;
    const key = scene.children.find(o => o.isDirectionalLight && o.castShadow); key.shadow.mapSize.set(quality === 'low' ? 512 : 1024, quality === 'low' ? 512 : 1024);
    spirit.reset(); update(0); renderer.render(scene, camera); return state();
  },
  async frame(time, angle = 0, tilt = 0) { spirit.avatarPivot.rotation.set(tilt, angle, 0); advance(time); return state(); },
  async wave(time) { advance(time); spirit.triggerReaction(); advance(time + .72); return state(); },
  async zoom(target) { camera.position.set(target[0], target[1] + .05, target[2] + 1.35); camera.lookAt(...target); renderer.render(scene, camera); return state(); },
  async unzoom() { camera.position.set(0, 1.7, 5.7); camera.lookAt(0, 1.24, 0); renderer.render(scene, camera); return state(); },
  async fashion(face) {
    fashion?.dispose();
    const eyes = []; spirit.bodyMesh.parent.traverse(o => { if (o.isMesh && o.name.includes('almond_gaze')) eyes.push(o); });
    fashion = createSpiritFashion({ body: spirit.bodyMesh, model: spirit.bodyMesh.parent, eyes, stem: '계',
      quality: new URLSearchParams(location.search).get('quality') || 'high', presentationDepth: spirit.avatarPivot.scale.z });
    fashion.set({ head: 'crescent-pin', face, neck: 'ribbon-bow', back: 'leaf-brooch' });
    update(seconds); renderer.render(scene, camera); return state();
  },
  async clearFashion() { fashion?.dispose(); fashion = null; update(seconds); renderer.render(scene, camera); return state(); },
  async reset() { spirit.reset(); seconds = 0; update(0); renderer.render(scene, camera); return state(); },
  async dispose() {
    fashion?.dispose(); fashion = null; spirit?.dispose(); spirit = null;
    scene.environment = null; environment.dispose(); floor.geometry.dispose(); floor.material.dispose();
    scene.children.filter(o => o.isDirectionalLight).forEach(o => o.shadow.dispose());
    renderer.dispose();
    const result = { created: buffers.size, explicitDeleted: [...buffers.values()].filter(row => row.explicit).length,
      nativeLiveBeforeForcedLoss: [...buffers.keys()].filter(b => gl.isBuffer(b)).length, glError: gl.getError(), errors: [...errors] };
    renderer.forceContextLoss(); return result;
  },
};
