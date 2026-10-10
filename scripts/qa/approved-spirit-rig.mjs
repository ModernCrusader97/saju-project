import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {build} from 'esbuild';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const output = path.resolve('outputs/rigged-greeting/cpu'); await fs.mkdir(output,{recursive:true});
const sourcePath = 'assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb';
const rigPath = process.env.SAJU_RIG_GLB_PATH || 'assets/source-reference/saju-b-rigged-greeting-v001/SaJu_B_Rigged_Greeting_v001.glb';
const bytes = await fs.readFile(rigPath), originalBytes = await fs.readFile(sourcePath);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function chunks(b) {const length = b.readUInt32LE(12);return {json:JSON.parse(b.subarray(20,20+length)),bin:b.subarray(28+length,28+length+b.readUInt32LE(20+length))};}
const source = chunks(originalBytes), candidate = chunks(bytes);
const report = {status:'PENDING',sourceSHA256:hash(originalBytes),rigGLBSHA256:hash(bytes),checks:[]};
const check = (name,run) => {run();report.checks.push({name,status:'PASS'});};
try {
  check('real skeleton and skin attributes exist in the derived GLB', () => {
    assert.equal(candidate.json.skins?.length,1,'Original v32 GLB has no skeleton; a procedural morph is insufficient.');
    const body = candidate.json.meshes.find(m => m.primitives[0].attributes.POSITION === 0);
    assert('JOINTS_0' in body.primitives[0].attributes); assert('WEIGHTS_0' in body.primitives[0].attributes);
  });
  check('all original BIN bytes, accessors, image/material data and source morph clip remain exact', () => {
    assert.equal(hash(originalBytes),'0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84');
    assert(candidate.bin.subarray(0,source.bin.length).equals(source.bin));
    assert.deepEqual(candidate.json.accessors.slice(0,source.json.accessors.length),source.json.accessors);
    assert.deepEqual(candidate.json.bufferViews.slice(0,source.json.bufferViews.length),source.json.bufferViews);
    for (const key of ['images','materials','textures','samplers']) assert.deepEqual(candidate.json[key],source.json[key]);
    assert.deepEqual(candidate.json.animations[0],source.json.animations[0]);
    source.json.nodes.forEach((node,i) => {const current = structuredClone(candidate.json.nodes[i]);delete current.skin;delete current.extras;const old=structuredClone(node);delete old.extras;assert.deepEqual(current,old);});
  });
  const loader = new GLTFLoader().register(() => ({name:'CPU_IMAGE_IO',loadTexture:async()=>new THREE.Texture()}));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  let body;gltf.scene.traverse(o=>{if(o.isMesh&&o.geometry.attributes.position.count===33207)body=o;});assert(body?.isSkinnedMesh);
  const p=body.geometry.attributes.position,index=body.geometry.index,originalPositions=p.array.slice();
  check('normalized finite weights use two adjacent bones; head, soles and left arm bind to the rest bone',()=>{
    const s=body.geometry.attributes.skinIndex,w=body.geometry.attributes.skinWeight;let moving=0,maxCount=0;
    for(let i=0;i<p.count;i++){let sum=0,count=0;for(let j=0;j<4;j++){const weight=w.getComponent(i,j),bone=s.getComponent(i,j);assert(Number.isFinite(weight)&&weight>=0);assert(bone<body.skeleton.bones.length);sum+=weight;if(weight>0){count++;if(bone>0)moving++;}}
      assert(Math.abs(sum-1)<6e-8);maxCount=Math.max(maxCount,count);
      if(p.getX(i)<=.07||p.getY(i)<=.45||p.getY(i)>=1.50){assert.equal(s.getX(i),0);assert.equal(w.getX(i),1);}
    }assert.equal(body.skeleton.bones.length,11);assert.equal(maxCount,2);assert(moving>3000);report.skin={bones:11,maxInfluences:maxCount,movingInfluences:moving};
  });
  await build({stdin:{contents:`export * from './lib/planet/approved-spirit-motion';export * from './lib/planet/approved-spirit-rig-controls';export * from './lib/planet/approved-spirit-rig-profile.mjs';export * from './lib/planet/mesh-surface';export * from './lib/planet/character-rest-coordinates';export * from './lib/planet/surface-fissure-sand';export * from './lib/planet/spirit-fashion';`,resolveDir:process.cwd()},outfile:path.join(output,'runtime.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',
    plugins:[{name:'inspect-collider',setup(builder){builder.onLoad({filter:/surface-fissure-sand\.ts$/},async args=>({contents:(await fs.readFile(args.path,'utf8')).replace('class RigidTriangleCollider','export class RigidTriangleCollider'),loader:'ts'}));}}]});
  const runtime=await import(pathToFileURL(path.join(output,'runtime.mjs')).href);
  const model=gltf.scene,root=new THREE.Group();model.scale.z=1.35;model.position.x=-.42;
  for(const child of [...model.children])root.add(child);model.add(root);body.morphTargetInfluences.fill(0);
  const motion=runtime.createApprovedSpiritMotion(root,body,'壬'),greeting=body.userData.approvedSpiritGreeting;
  const sampler=new runtime.MeshSurface([body],{allowMorphTargets:true,allowSkinning:true});
  const binding=runtime.bindCharacterRestCoordinates(model,[body]),collider=new runtime.RigidTriangleCollider(body);
  const handIDs=[];for(let i=0;i<p.count;i++)if(p.getX(i)>.69&&p.getY(i)>.70&&p.getY(i)<.87)handIDs.push(i);
  const point=new THREE.Vector3(),centroid=()=>{const c=new THREE.Vector3();for(const id of handIDs)c.add(body.getVertexPosition(id,point));return c.divideScalar(handIDs.length);};
  const sourceAttrHashes=Object.fromEntries(Object.entries(body.geometry.attributes).map(([name,a])=>[name,hash(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))]));
  let maxNeutralError=0;model.updateWorldMatrix(true,true);body.skeleton.update();for(let i=0;i<p.count;i++)maxNeutralError=Math.max(maxNeutralError,body.getVertexPosition(i,point).distanceTo(new THREE.Vector3().fromBufferAttribute(p,i)));
  report.maxNeutralError=maxNeutralError;assert(maxNeutralError<1e-7,`Neutral CPU error ${maxNeutralError}`);
  motion.triggerReaction();const states=[],poses=[];let minX=Infinity,maxX=-Infinity,maxima=0,minima=0,previousX,direction=0;
  const samples=[];
  for(let frame=0;frame<=300;frame++){
    const progress=frame/300,begin=performance.now();motion.update(progress*greeting.duration);samples.push(performance.now()-begin);collider.refresh();const hand=centroid();
    if(greeting.stage==='wave'){minX=Math.min(minX,hand.x);maxX=Math.max(maxX,hand.x);const d=previousX===undefined?0:hand.x-previousX,newDirection=Math.abs(d)>1e-7?Math.sign(d):direction;if(direction&&direction!==newDirection){if(newDirection<0)maxima++;else minima++;}direction=newDirection;previousX=hand.x;}
    if(frame%15===0){states.push({progress,stage:greeting.stage,lift:greeting.armLift,wrist:greeting.wrist,hand:hand.toArray()});const pose=[];for(let i=0;i<p.count;i++)body.getVertexPosition(i,point).toArray(pose,i*3);poses.push({progress,positions:pose});}
    assert.equal(body.morphTargetInfluences[0],0);assert.equal(body.geometry.attributes.position,p);
  }
  check('raise, a still hold, three independent wrist waves and lowering return to neutral',()=>{assert(states.some(s=>s.stage==='hold'));assert.equal(maxima,3);assert.equal(minima,3);assert(maxX-minX>.10);assert.equal(greeting.stage,'idle');});
  check('surface attachments and sand collider resolve current skinned triangles',()=>{
    motion.reset();motion.triggerReaction();motion.update(greeting.duration*.55);model.updateWorldMatrix(true,true);collider.refresh();assert(collider.refitCount>0);
    const refits=collider.refitCount;collider.refresh();assert.equal(collider.refitCount,refits,'An unchanged skin pose must reuse the collision snapshot.');
    let colliderError=0;for(let i=0;i<p.count;i++){body.getVertexPosition(i,point);colliderError=Math.max(colliderError,point.distanceTo(new THREE.Vector3().fromArray(collider.vertices,i*3)));}
    assert(colliderError<1e-10);report.maxColliderVertexError=colliderError;
    for(let seed=0;seed<80;seed++){const anchor=sampler.sample(seed*17),pose=sampler.resolve(anchor,body),actual=new THREE.Vector3();for(let k=0;k<3;k++)actual.addScaledVector(body.getVertexPosition(index.getX(anchor.triangle*3+k),point),anchor.barycentric.getComponent(k));assert(actual.distanceTo(pose.position)<1e-10);}
  });
  check('paused rotation, repeated taps, backwards seek and reset do not accumulate rig deformation',()=>{
    const capture=()=>body.skeleton.bones.map(b=>({p:b.position.toArray(),q:b.quaternion.toArray(),s:b.scale.toArray()}));const before=capture();for(let i=0;i<100;i++)motion.triggerReaction();motion.update(greeting.duration*.55);assert.deepEqual(capture(),before);
    model.rotation.y=1.2;motion.update(greeting.duration*.55);assert.deepEqual(capture(),before);
    motion.update(0);motion.reset();let resetNeutralError=0;for(let i=0;i<p.count;i++)resetNeutralError=Math.max(resetNeutralError,body.getVertexPosition(i,point).distanceTo(new THREE.Vector3().fromBufferAttribute(p,i)));
    report.resetNeutralError=resetNeutralError;assert(resetNeutralError<1e-7);assert(body.morphTargetInfluences.every(w=>w===0));
    for(const[name,a]of Object.entries(body.geometry.attributes))assert.equal(hash(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength)),sourceAttrHashes[name]);
    assert.deepEqual(p.array,originalPositions);
  });
  const controls=runtime.createApprovedSpiritRigControls(body),explicitPoses=[];
  for(const lift of[0,.1,.25,.5,.75,1])for(const wrist of[-1,0,1]){
    controls.setPose(lift,wrist);model.updateWorldMatrix(true,false);model.updateMatrixWorld(true);body.skeleton.update();const positions=[];
    for(let i=0;i<p.count;i++)body.getVertexPosition(i,point).toArray(positions,i*3);
    explicitPoses.push({name:`lift-${lift}-wrist-${wrist}`,lift,wrist,positions});
  }
  const clipGltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  let clipBody;clipGltf.scene.traverse(o=>{if(o.isSkinnedMesh)clipBody=o;});
  const clip=clipGltf.animations.find(a=>a.name==='Rigged_three_wave_greeting_v001'),mixer=new THREE.AnimationMixer(clipGltf.scene);
  mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();let clipError=0,clipSamples=0;
  check('portable GLB greeting action targets the same authored bones as runtime controls',()=>{
    const count=Math.ceil(runtime.APPROVED_SPIRIT_RIG_PROFILE.duration*60);
    for(let frame=0;frame<count;frame+=9){const progress=frame/count,time=progress*runtime.APPROVED_SPIRIT_RIG_PROFILE.duration;
      const pose=runtime.rigGreetingPose(progress);controls.setPose(pose.lift,pose.wrist);mixer.setTime(time);
      body.skeleton.bones.forEach((bone,i)=>{const actual=clipBody.skeleton.bones[i],a=[...bone.position.toArray(),...bone.quaternion.toArray()],b=[...actual.position.toArray(),...actual.quaternion.toArray()];a.forEach((v,j)=>{clipError=Math.max(clipError,Math.abs(v-b[j]));});});clipSamples++;
    }assert(clipError<1e-6);report.embeddedClip={name:clip.name,samples:clipSamples,maxBoneComponentError:clipError};
  });
  mixer.stopAllAction();mixer.uncacheRoot(clipGltf.scene);clipBody.skeleton.dispose();
  controls.dispose();model.updateMatrixWorld(true);body.skeleton.update();
  motion.dispose();binding.dispose();collider.clear();
  report.motion={duration:greeting.duration,stages:states,waveTravel:maxX-minX,maxima,minima,motionOnlyUpdateMs:{median:[...samples].sort((a,b)=>a-b)[150],p95:[...samples].sort((a,b)=>a-b)[285]},sourceAttrHashes};
  await fs.writeFile(path.join(output,'sampled-poses.json'),JSON.stringify(poses));
  await fs.writeFile(path.join(output,'explicit-poses.json'),JSON.stringify(explicitPoses));
  report.status='PASS';console.log(`PASS actual B rig: ${report.checks.length} checks, ${poses.length} saved poses, ${maxima} waves.`);
} catch(error){report.status='FAIL';report.error=error.stack;process.exitCode=1;console.error(error.message);}
finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
