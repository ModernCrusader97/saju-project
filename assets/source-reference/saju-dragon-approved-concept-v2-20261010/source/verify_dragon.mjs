// Actual production-style GLTFLoader/AnimationMixer checks. No synthetic pet geometry.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const argv=process.argv.slice(2);
const opt=(name)=>{const i=argv.indexOf(name);return i<0?undefined:argv[i+1];};
const file=path.resolve(opt("--glb"));
const out=path.resolve(opt("--out"));
const root=path.resolve(opt("--three-root")??"node_modules/three");
const THREE=await import(pathToFileURL(path.join(root,"build/three.module.js")).href);
const {GLTFLoader}=await import(pathToFileURL(path.join(root,"examples/jsm/loaders/GLTFLoader.js")).href);
const bytes=fs.readFileSync(file);
assert.equal(bytes.readUInt32LE(0),0x46546c67);
assert.equal(bytes.readUInt32LE(4),2);
assert.equal(bytes.readUInt32LE(8),bytes.length);
assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
const jsonLen=bytes.readUInt32LE(12);
const spec=JSON.parse(bytes.subarray(20,20+jsonLen).toString("utf8"));
assert(!spec.buffers.some(x=>x.uri),"External buffer");
assert(!(spec.images??[]).some(x=>x.uri),"External image");
assert.equal(spec.animations.length,1);
assert.equal(spec.animations[0].name,"Idle_Loop");
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"");
const clip=gltf.animations[0];
assert(Math.abs(clip.duration-6)<.0001,clip.duration);
const meshes=[];
gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
assert(meshes.length>0 && meshes.every(m=>m.isSkinnedMesh));
const body=meshes.find(m=>m.name.includes("Continuous_Teal_Ivory"));
assert(body && body.geometry.getAttribute("color") && body.material.vertexColors);
const stats={meshCount:meshes.length,skinCount:spec.skins.length,boneCount:body.skeleton.bones.length,
 animationName:clip.name,animationSeconds:clip.duration,externalBuffers:0,externalImages:0,
 triangles:0,vertices:0,invalidNormals:0,invalidWeights:0,nonFinitePositions:0,zeroAreaTriangles:0};
for(const m of meshes){
 const g=m.geometry,p=g.getAttribute("position"),n=g.getAttribute("normal"),w=g.getAttribute("skinWeight");
 stats.vertices+=p.count;stats.triangles+=(g.index?.count??p.count)/3;
 for(let i=0;i<p.count;i++){
  if(![p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite))stats.nonFinitePositions++;
  const nl=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));
  if(!Number.isFinite(nl)||Math.abs(nl-1)>.025)stats.invalidNormals++;
  const sum=w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i);
  if(Math.abs(sum-1)>.00015)stats.invalidWeights++;
 }
 const va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3();
 const idx=g.index;
 for(let i=0;i<(idx?.count??p.count);i+=3){
  va.fromBufferAttribute(p,idx?idx.getX(i):i);vb.fromBufferAttribute(p,idx?idx.getX(i+1):i+1);
  vc.fromBufferAttribute(p,idx?idx.getX(i+2):i+2);
  const area=vb.sub(va).cross(vc.sub(va)).length();
  if(area<1e-11)stats.zeroAreaTriangles++;
 }
}
assert.equal(stats.invalidNormals,0,JSON.stringify(stats));
assert.equal(stats.invalidWeights,0,JSON.stringify(stats));
assert.equal(stats.nonFinitePositions,0,JSON.stringify(stats));
assert.equal(stats.zeroAreaTriangles,0,JSON.stringify(stats));
const mixer=new THREE.AnimationMixer(gltf.scene);
const action=mixer.clipAction(clip);
action.setLoop(THREE.LoopOnce,0);action.clampWhenFinished=true;
const at=(t)=>{
 action.reset();action.play();mixer.setTime(t);
 gltf.scene.updateMatrixWorld(true);
 for(const m of meshes)m.skeleton.update();
};
const samples=[];
for(const m of meshes){
 const p=m.geometry.getAttribute("position");
 for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/700)))samples.push([m,i]);
}
const point=new THREE.Vector3();
const snapshot=(t)=>{at(t);return samples.map(([m,i])=>{
 m.getVertexPosition(i,point);point.applyMatrix4(m.matrixWorld);return point.toArray();});};
const dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const first=snapshot(0),end=snapshot(6);
stats.exactEndPoseError=Math.max(...first.map((p,i)=>dist(p,end[i])));
assert(stats.exactEndPoseError<.00002,stats.exactEndPoseError);
const h=1/240,after=snapshot(h),before=snapshot(6-h);
stats.loopBoundaryVelocityDifference=Math.max(...first.map((p,i)=>Math.hypot(...p.map(
 (x,k)=>(after[i][k]-x)/h-(end[i][k]-before[i][k])/h))));
assert(stats.loopBoundaryVelocityDifference<.05,stats.loopBoundaryVelocityDifference);
stats.maxMotion=0;const bounds=new THREE.Box3();
for(let f=0;f<=144;f++){
 const snap=snapshot(f/24);
 for(let i=0;i<snap.length;i++){
  stats.maxMotion=Math.max(stats.maxMotion,dist(first[i],snap[i]));
  point.fromArray(snap[i]);bounds.expandByPoint(point);
 }
}
assert(stats.maxMotion>.04,stats.maxMotion);
stats.sampledVertices=samples.length;stats.sampledFrames=145;
stats.animatedBoundsYUp={min:bounds.min.toArray(),max:bounds.max.toArray()};
const mats=new Set(),geos=new Set();
gltf.scene.traverse(o=>{if(o.isMesh){geos.add(o.geometry);for(const m of [o.material].flat())mats.add(m);}});
mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
for(const g of geos)g.dispose();for(const m of mats)m.dispose();
const report={status:"PASS_GLTFLOADER_ANIMATIONMIXER",generator:spec.asset.generator,
 sha256:crypto.createHash("sha256").update(bytes).digest("hex"),bytes:bytes.length,
 tests:stats,limits:["CPU geometry/runtime verification; no deployed product or mobile GPU performance claim."]};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));

