// Real Three GLTFLoader/AnimationMixer CPU evaluation; no browser GPU claim.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {pngDecode} from './png_decode.mjs';

const args=process.argv.slice(2),opt=n=>args[args.indexOf(n)+1];
const baseline=path.resolve(opt('--baseline-glb')),candidate=path.resolve(opt('--glb')),out=path.resolve(opt('--out'));
assert(!fs.existsSync(out),'Use a new report path');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function glb(file){
 const raw=fs.readFileSync(file),len=raw.readUInt32LE(12);
 assert.equal(raw.readUInt32LE(0),0x46546c67);assert.equal(raw.readUInt32LE(8),raw.length);
 assert.equal(raw.readUInt32LE(16),0x4e4f534a);assert.equal(raw.readUInt32LE(24+len),0x004e4942);
 const bin=raw.subarray(28+len);assert.equal(bin.length,raw.readUInt32LE(20+len));
 return {raw,spec:JSON.parse(raw.subarray(20,20+len)),bin};
}
const before=glb(baseline),after=glb(candidate);
assert(before.bin.equals(after.bin),'BIN data changed');
const restored=structuredClone(after.spec);restored.scenes=structuredClone(before.spec.scenes);restored.nodes[23]=structuredClone(before.spec.nodes[23]);
assert.deepEqual(restored,before.spec,'Unrelated JSON changed');
assert.deepEqual(after.spec.nodes[23].children,[12]);
assert.deepEqual(after.spec.scenes[0].nodes,[23,13,14,15,16,17,18,19,20,21,22]);
assert.equal(before.spec.animations.length,1);assert.equal(before.spec.animations[0].name,'Idle_Loop');
const threeRoot=path.resolve(opt('--three-root'));
const THREE=await import(pathToFileURL(path.join(threeRoot,'build/three.module.js')).href);
const {GLTFLoader}=await import(pathToFileURL(path.join(threeRoot,'examples/jsm/loaders/GLTFLoader.js')).href);
let decodedImages=0;
globalThis.self=globalThis;globalThis.createImageBitmap=async blob=>{decodedImages++;return pngDecode(await blob.arrayBuffer());};
async function load(input){
 const loaded=await new GLTFLoader().parseAsync(input.raw.buffer.slice(input.raw.byteOffset,input.raw.byteOffset+input.raw.length),'');
 const meshes=[];loaded.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 meshes.sort((a,b)=>a.name.localeCompare(b.name));assert.equal(meshes.length,11);assert.equal(new Set(meshes.map(m=>m.name)).size,11);
 const clip=loaded.animations[0];assert.equal(clip.duration,6);
 const mixer=new THREE.AnimationMixer(loaded.scene),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,0);action.clampWhenFinished=true;
 const wrapper=new THREE.Group();wrapper.add(loaded.scene);
 return {loaded,meshes,mixer,action,wrapper};
}
const old=await load(before),now=await load(after);assert.equal(decodedImages,2);
let vertices=0,triangles=0;
for(let k=0;k<old.meshes.length;k++){
 const a=old.meshes[k],b=now.meshes[k];assert.equal(a.name,b.name);
 assert.deepEqual(Object.keys(a.geometry.attributes),Object.keys(b.geometry.attributes));
 for(const name of Object.keys(a.geometry.attributes)){
  const x=a.geometry.attributes[name],y=b.geometry.attributes[name];
  assert.equal(x.itemSize,y.itemSize);assert.equal(x.normalized,y.normalized);assert.deepEqual(x.array,y.array);
 }
 assert.deepEqual(a.geometry.index.array,b.geometry.index.array);
 assert.deepEqual(a.bindMatrix.elements,b.bindMatrix.elements);
 assert.deepEqual(a.skeleton.boneInverses.map(m=>m.elements),b.skeleton.boneInverses.map(m=>m.elements));
 assert.deepEqual(a.skeleton.bones.map(bone=>bone.name),b.skeleton.bones.map(bone=>bone.name));
 assert.equal(a.material.name,b.material.name);
 if(a.material.map){assert(b.material.map);assert.deepEqual(a.material.map.image.data,b.material.map.image.data);assert.equal(a.material.map.colorSpace,b.material.map.colorSpace);assert.equal(a.material.map.flipY,b.material.map.flipY);}
 vertices+=a.geometry.attributes.position.count;triangles+=a.geometry.index.count/3;
}
assert.equal(vertices,116175);assert.equal(triangles,222646);
const setPose=(model,time)=>{model.action.reset().play();model.mixer.setTime(time);model.wrapper.updateMatrixWorld(true);model.meshes.forEach(m=>m.skeleton.update());};
const maxAbs=(a,b)=>a.reduce((m,v,k)=>Math.max(m,Math.abs(v-b[k])),0);
const p=new THREE.Vector3(),q=new THREE.Vector3();
let maxWorldPositionError=0,maxJointMatrixError=0,maxMeshMatrixError=0,maxBindMatrixError=0,maxMotion=0,loopError=0,evaluatedVertices=0;
const firstPositions=old.meshes.map(m=>new Float64Array(m.geometry.attributes.position.count*3));
for(let frame=0;frame<=144;frame++){
 setPose(old,frame/24);setPose(now,frame/24);
 for(let k=0;k<old.meshes.length;k++){
  const a=old.meshes[k],b=now.meshes[k];
  maxMeshMatrixError=Math.max(maxMeshMatrixError,maxAbs(a.matrixWorld.elements,b.matrixWorld.elements));
  maxBindMatrixError=Math.max(maxBindMatrixError,maxAbs(a.bindMatrixInverse.elements,b.bindMatrixInverse.elements));
  maxJointMatrixError=Math.max(maxJointMatrixError,maxAbs(a.skeleton.boneMatrices,b.skeleton.boneMatrices));
  for(let i=0;i<a.geometry.attributes.position.count;i++){
   a.getVertexPosition(i,p).applyMatrix4(a.matrixWorld);b.getVertexPosition(i,q).applyMatrix4(b.matrixWorld);
   assert(Number.isFinite(p.x+p.y+p.z+q.x+q.y+q.z));
   maxWorldPositionError=Math.max(maxWorldPositionError,p.distanceTo(q));evaluatedVertices++;
   const f=firstPositions[k],offset=i*3;
   if(frame===0){f[offset]=p.x;f[offset+1]=p.y;f[offset+2]=p.z;}
   else{const displacement=Math.hypot(p.x-f[offset],p.y-f[offset+1],p.z-f[offset+2]);maxMotion=Math.max(maxMotion,displacement);if(frame===144)loopError=Math.max(loopError,displacement);}
  }
 }
}
assert.equal(maxWorldPositionError,0);assert.equal(maxJointMatrixError,0);assert.equal(maxMeshMatrixError,0);assert.equal(maxBindMatrixError,0);
assert(loopError<.00002);assert(maxMotion>.04);
// Also exercise placement of the whole loaded model in a transformed scene group.
old.wrapper.position.set(.4,-.2,1.1);now.wrapper.position.copy(old.wrapper.position);
old.wrapper.rotation.set(.13,-.42,.19);now.wrapper.rotation.copy(old.wrapper.rotation);
old.wrapper.scale.setScalar(1.25);now.wrapper.scale.copy(old.wrapper.scale);
let placedError=0;
for(const time of [0,1.5,3,6]){setPose(old,time);setPose(now,time);for(let k=0;k<old.meshes.length;k++){const a=old.meshes[k],b=now.meshes[k];for(let i=0;i<a.geometry.attributes.position.count;i++){a.getVertexPosition(i,p).applyMatrix4(a.matrixWorld);b.getVertexPosition(i,q).applyMatrix4(b.matrixWorld);placedError=Math.max(placedError,p.distanceTo(q));}}}
assert.equal(placedError,0);
const report={
 status:'PASS_V3_V4_ACTUAL_GLTFLOADER_FULL_VERTEX_LOOP_EQUIVALENCE',
 baseline_glb_sha256:hash(before.raw),candidate_glb_sha256:hash(after.raw),binary_chunk_sha256:hash(after.bin),binary_chunk_byte_identical:true,
 json_change_only:['nodes[23].children','scenes[0].nodes'],
 mesh_nodes:10,loader_skinned_primitives:11,vertices,triangles,bones:13,clip:'Idle_Loop',clip_seconds:6,
 geometry_indices_normals_uv_colors_joints_weights_byte_equal:true,skin_and_inverse_bind_matrices_equal:true,material_texture_and_animation_json_equal:true,
 decoded_images:decodedImages,frames:145,full_vertex_comparisons:evaluatedVertices,
 max_world_vertex_error:maxWorldPositionError,max_joint_matrix_error:maxJointMatrixError,max_mesh_matrix_error:maxMeshMatrixError,max_bind_inverse_error:maxBindMatrixError,
 normal_output_equivalence:'Identical normals, skin weights, bone matrices, bind matrices and mesh matrices at all 145 frames imply identical skin-normal transforms.',
 loop_end_pose_error:loopError,max_skin_motion:maxMotion,transformed_model_group_vertex_error:placedError,
 limits:['Actual CPU GLTFLoader and AnimationMixer evaluation; no browser GPU or mobile performance claim.']
};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
