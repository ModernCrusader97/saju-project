import * as THREE from 'three';
import {MeshSurface,seeded,type SurfaceAnchor} from './mesh-surface';
import {sandstoneFissureDistance} from './sandstone-fissure-field';
import {isSurfaceAttachmentExcluded} from './surface-attachment-exclusions';
import {supportAffineInstanceNormals} from './affine-instance-normals';
import type {SurfaceAccentOptions,SurfaceStemAccents} from './surface-stem-accents';

interface Source {anchor:SurfaceAnchor;rest:number[];score:number;period:number;phase:number}
interface CollisionNode {bounds:THREE.Box3;start:number;end:number;affected:boolean;left?:CollisionNode;right?:CollisionNode}
/** Small static triangle hierarchy; no BVH dependency and no source-geometry mutation.
 * Rigid world transforms are refreshed each update. Crossing flights are hidden. */
class RigidTriangleCollider {
 private readonly faces:number[];
 private vertices:Float64Array;
 private affectedVertices:number[]=[];
 private padding=0;
 private oversizedWeights=false;
 private weights='';
 refitCount=0;
 private tree:CollisionNode|undefined;
 private readonly inverse=new THREE.Matrix4();
 private readonly ray=new THREE.Ray();
 private readonly start=new THREE.Vector3();private readonly end=new THREE.Vector3();
 private readonly a=new THREE.Vector3();private readonly b=new THREE.Vector3();private readonly c=new THREE.Vector3();private readonly hit=new THREE.Vector3();
 private readonly stack:CollisionNode[]=[];
 constructor(readonly mesh:THREE.Mesh) {
  const p=mesh.geometry.getAttribute('position'),idx=mesh.geometry.index,count=Math.floor((idx?.count??p.count)/3);
  this.vertices=new Float64Array(p.count*3);
  const affected=new Uint8Array(p.count),morphs=mesh.geometry.morphAttributes.position??[];
  // The preserved GLB has ~10k nonzero exported deltas but only ~4.1k
  // meaningful moving vertices. Exact posed positions still update for ALL
  // nonzero deltas; static subtrees retain a conservative 2µm/target envelope
  // across weights in [-1,1], including a nonneutral creation pose.
  this.padding=morphs.length*2.02e-6;
  for(let i=0;i<p.count;i++){
   this.a.fromBufferAttribute(p,i).toArray(this.vertices,i*3);
   let changed=false,significant=false;
   for(const m of morphs){
    const dx=m.getX(i)-(mesh.geometry.morphTargetsRelative?0:p.getX(i)),dy=m.getY(i)-(mesh.geometry.morphTargetsRelative?0:p.getY(i)),dz=m.getZ(i)-(mesh.geometry.morphTargetsRelative?0:p.getZ(i));
    changed||=dx!==0||dy!==0||dz!==0;significant||=dx*dx+dy*dy+dz*dz>1e-12;
   }
   if(changed)this.affectedVertices.push(i);if(significant)affected[i]=1;
  }
  this.refresh();
  this.faces=Array.from({length:count},(_,i)=>i);
  const limits=new Float32Array(count*6),centers=new Float32Array(count*3);
  for(let i=0;i<count;i++){
   const box=new THREE.Box3();
   for(let j=0;j<3;j++){this.a.fromArray(this.vertices,(idx?idx.getX(i*3+j):i*3+j)*3);box.expandByPoint(this.a);}
   box.expandByScalar(this.padding);box.min.toArray(limits,i*6);box.max.toArray(limits,i*6+3);box.getCenter(this.a).toArray(centers,i*3);
  }
  const make=(start:number,end:number):CollisionNode=>{
   const bounds=new THREE.Box3();
   for(let i=start;i<end;i++){const f=this.faces[i];bounds.expandByPoint(this.a.fromArray(limits,f*6));bounds.expandByPoint(this.b.fromArray(limits,f*6+3));}
   const node:CollisionNode={bounds,start,end,affected:false};if(end-start<=12){
    for(let i=start;i<end;i++)for(let j=0;j<3;j++)if(affected[idx?idx.getX(this.faces[i]*3+j):this.faces[i]*3+j])node.affected=true;
    return node;
   }
   const size=bounds.getSize(this.c),axis=size.x>=size.y&&size.x>=size.z?0:size.y>=size.z?1:2;
   const sorted=this.faces.slice(start,end).sort((a,b)=>centers[a*3+axis]-centers[b*3+axis]);
   for(let i=0;i<sorted.length;i++)this.faces[start+i]=sorted[i];
   const middle=(start+end)>>>1;node.left=make(start,middle);node.right=make(middle,end);node.affected=node.left.affected||node.right.affected;return node;
  };
  this.tree=make(0,count);this.refresh();
 }
 refresh():void {
  this.mesh.updateWorldMatrix(true,false);
  if(Math.abs(this.mesh.matrixWorld.determinant())<1e-12)throw new RangeError('Sand surface transforms must be invertible.');
  this.inverse.copy(this.mesh.matrixWorld).invert();
  const weights=this.mesh.morphTargetInfluences?.join(',')??'';
  if(this.mesh.morphTargetInfluences?.some(w=>!Number.isFinite(w)))throw new RangeError('Sand collision morph weights must be finite.');
  if(weights!==this.weights){
   this.weights=weights;
   const geometry=this.mesh.geometry,influences=this.mesh.morphTargetInfluences,morphs=geometry.morphAttributes.position??[];
   if(geometry.morphTargetsRelative&&influences&&influences.length===morphs.length&&this.mesh.getVertexPosition===THREE.Mesh.prototype.getVertexPosition){
    // Collect the bounded nonzero controls once. Match Three's target order and
    // Float64 arithmetic: sum relative deltas first, then add the source point.
    // Custom vertex methods and absolute morphs retain the original API path.
    const active=morphs.map((attribute,i)=>({attribute,weight:influences[i]})).filter(p=>p.weight!==0),position=geometry.getAttribute('position');
    for(const id of this.affectedVertices){
     let x=0,y=0,z=0;
     for(const {attribute,weight} of active){x+=attribute.getX(id)*weight;y+=attribute.getY(id)*weight;z+=attribute.getZ(id)*weight;}
     this.vertices[id*3]=position.getX(id)+x;this.vertices[id*3+1]=position.getY(id)+y;this.vertices[id*3+2]=position.getZ(id)+z;
    }
   }else for(const id of this.affectedVertices)this.mesh.getVertexPosition(id,this.a).toArray(this.vertices,id*3);
   const oversizedWeights=this.mesh.morphTargetInfluences?.some(w=>Math.abs(w)>1)??false;
   if(this.tree){this.refit(this.tree,oversizedWeights||this.oversizedWeights);this.refitCount++;}
   this.oversizedWeights=oversizedWeights;
  }
 }
 private refit(node:CollisionNode,all=false):void {
  if(!all&&!node.affected)return;
  if(node.left){this.refit(node.left,all);this.refit(node.right!,all);node.bounds.copy(node.left.bounds).union(node.right!.bounds);return;}
  const idx=this.mesh.geometry.index;node.bounds.makeEmpty();
  for(let i=node.start;i<node.end;i++)for(let j=0;j<3;j++)node.bounds.expandByPoint(this.a.fromArray(this.vertices,(idx?idx.getX(this.faces[i]*3+j):this.faces[i]*3+j)*3));
  node.bounds.expandByScalar(this.padding);
 }
 worldBounds(target:THREE.Box3):THREE.Box3 {return this.tree?target.copy(this.tree.bounds).applyMatrix4(this.mesh.matrixWorld):target.makeEmpty();}
 intersects(startWorld:THREE.Vector3,endWorld:THREE.Vector3):boolean {
  if(!this.tree)return false;
  this.start.copy(startWorld).applyMatrix4(this.inverse);this.end.copy(endWorld).applyMatrix4(this.inverse);
  this.ray.origin.copy(this.start);this.ray.direction.copy(this.end).sub(this.start);
  const length=this.ray.direction.length();if(length<1e-7)return false;this.ray.direction.divideScalar(length);
  const idx=this.mesh.geometry.index;
  this.stack.length=0;this.stack.push(this.tree);
  while(this.stack.length){
   const node=this.stack.pop()!;
   if(!this.ray.intersectBox(node.bounds,this.hit)||(!node.bounds.containsPoint(this.start)&&this.hit.distanceToSquared(this.start)>length*length))continue;
   if(node.left){this.stack.push(node.left,node.right!);continue;}
   for(let i=node.start;i<node.end;i++){
    const triangle=this.faces[i];this.a.fromArray(this.vertices,(idx?idx.getX(triangle*3):triangle*3)*3);this.b.fromArray(this.vertices,(idx?idx.getX(triangle*3+1):triangle*3+1)*3);this.c.fromArray(this.vertices,(idx?idx.getX(triangle*3+2):triangle*3+2)*3);
    if(this.ray.intersectTriangle(this.a,this.b,this.c,false,this.hit)&&this.hit.distanceToSquared(this.start)<=length*length)return true;
   }
  }return false;
 }
 clear():void {this.tree=undefined;this.faces.length=0;this.stack.length=0;this.affectedVertices.length=0;this.vertices=new Float64Array(0);}
}

function restPosition(anchor:SurfaceAnchor):number[] {
 const p=anchor.mesh.geometry.getAttribute('stemRestPosition'),idx=anchor.mesh.geometry.index,result=new THREE.Vector3();
 for(let j=0;j<3;j++)result.addScaledVector(new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(anchor.triangle*3+j):anchor.triangle*3+j),anchor.barycentric.getComponent(j));
 return result.toArray().map(Math.fround);
}

/** Actual-triangle sandstone emitters. No sphere shell, UV changes or texture drift. */
export function createSurfaceFissureSand(options:SurfaceAccentOptions):SurfaceStemAccents {
 const sampler=new MeshSurface(options.meshes,{allowMorphTargets:options.allowMorphTargets});
 for(const mesh of options.meshes){const rest=mesh.geometry.getAttribute('stemRestPosition');if(!rest||rest.itemSize!==3||rest.count!==mesh.geometry.getAttribute('position').count)throw new Error('Sand requires character-rest position binding matching the stone shader.');}
 const quality=options.quality==='low'?'low':'high',high=quality==='high',desired=high?6:4,perSource=high?8:6;
 const extent=sampler.bounds.getSize(new THREE.Vector3()),unit=options.detailScale??Math.min(extent.x,extent.y,extent.z)*.5;
 if(!Number.isFinite(unit)||unit<=0)throw new RangeError('detailScale must be positive and finite.');
 const colliders=options.meshes.map(mesh=>new RigidTriangleCollider(mesh));
 const identity=new THREE.Group(),sources:Source[]=[],points:THREE.Vector3[]=[];
 const start=new THREE.Vector3(),end=new THREE.Vector3();
 // Restrict to mid/lower outward faces. Candidate coordinates are interpolated
 // attributes, exactly the domain the fragment shader interpolates on this face.
 for(let attempt=0;attempt<8192&&sources.length<desired;attempt++){
  const anchor=sampler.sample(attempt*71+1951),pose=sampler.resolve(anchor,identity);
  const fraction=(pose.position.y-sampler.bounds.min.y)/extent.y;
  if(fraction<.10||fraction>.69||Math.abs(pose.normal.y)>.44)continue;
  if(points.some(p=>p.distanceToSquared(pose.position)<unit*unit*.075))continue;
  const rest=restPosition(anchor),score=sandstoneFissureDistance(rest,quality);if(score>.006)continue;
  start.copy(pose.position).addScaledVector(pose.normal,unit*.014);
  end.copy(start).addScaledVector(pose.normal,unit*.11);end.y-=unit*.42;
  if(colliders.some(c=>c.intersects(start,end)))continue;
  const i=sources.length;sources.push({anchor,rest,score,period:2.8+seeded(i+2070)*2.6,phase:seeded(i+2080)});points.push(pose.position.clone());
 }
 if(sources.length<desired){for(const collider of colliders)collider.clear();throw new Error(`Only ${sources.length}/${desired} validated actual sandstone fissure sources found.`);}
 const group=new THREE.Group();group.name='SurfaceStemAccents_戊';
 const diagnostics={supported:true,mode:'triangle-fissure-gravity-sand',anchorCount:sources.length,limitations:[
  'Actual triangle/barycentric sources use character-rest F2-F1 cracks; optional pose morphs refit persistent collision storage. Skinning and changed topology require rebuilding.',
  'Float32 CPU field is tested against the actual WebGL material on the QA device; GPU arithmetic can differ on other hardware.',
  'Deterministic flights are re-evaluated from current emitter pose on seeks; birth-transform history and free independent world trajectories are not cached.',
  'Actual-triangle segment collision hides body-crossing grains; no bouncing, floor accumulation or full swept-sphere collision simulation.',
 ]};
 const geometry=new THREE.IcosahedronGeometry(1,0),material=new THREE.MeshStandardMaterial({color:0xe1b77e,roughness:.94,metalness:0});
 supportAffineInstanceNormals(material);
 const grains=new THREE.InstancedMesh(geometry,material,desired*perSource);grains.name='ActualSurfaceFissureSand';grains.frustumCulled=false;
 grains.instanceMatrix.setUsage(THREE.DynamicDrawUsage);grains.castShadow=false;grains.receiveShadow=true;
 grains.userData.surfaceNonShadowCaster=true;
 grains.userData.maxParticles=grains.count;grains.userData.effect='actual-triangle-gravity-fissure-trickles';group.add(grains);
 for(let i=0;i<grains.count;i++)grains.setColorAt(i,new THREE.Color().setRGB(.66+seeded(i+2180)*.25,.54+seeded(i+2190)*.20,.33+seeded(i+2200)*.15));
 group.userData.sandSources=sources.map(source=>({mesh:source.anchor.mesh.name,triangle:source.anchor.triangle,barycentric:source.anchor.barycentric.toArray(),restPosition:source.rest,fieldDistance:source.score,period:source.period,phase:source.phase}));
 const dummy=new THREE.Object3D(),inverse=new THREE.Matrix4(),normalToWorld=new THREE.Matrix3(),position=new THREE.Vector3(),normal=new THREE.Vector3(),world=new THREE.Vector3();
 const pose={position:new THREE.Vector3(),normal:new THREE.Vector3()},worldMatrix=new THREE.Matrix4();
 const worldBounds=new THREE.Box3(),partBounds=new THREE.Box3();
 let disposed=false;
 function update(time:number):void {
  if(disposed)return;if(!Number.isFinite(time))throw new RangeError('Accent time must be finite.');
  group.updateWorldMatrix(true,false);
  if(Math.abs(group.matrixWorld.determinant())<1e-12)throw new RangeError('Sand effect transforms must be invertible.');
  inverse.copy(group.matrixWorld).invert();normalToWorld.getNormalMatrix(group.matrixWorld);
  for(const collider of colliders)collider.refresh();
  const elements=group.matrixWorld.elements,worldUnit=unit*Math.cbrt(Math.abs(group.matrixWorld.determinant()));
  let visibleCount=0,hiddenByBody=0,excludedSourceCount=0;const sourceWorld:Array<{position:number[];normal:number[]}>=[];
  worldBounds.makeEmpty();for(const collider of colliders)worldBounds.union(collider.worldBounds(partBounds));
  for(let sourceIndex=0;sourceIndex<sources.length;sourceIndex++){
   const source=sources[sourceIndex];sampler.resolve(source.anchor,group,pose);
   const excluded=isSurfaceAttachmentExcluded(group,pose.position);if(excluded)excludedSourceCount++;
   position.copy(pose.position).applyMatrix4(group.matrixWorld);normal.copy(pose.normal).applyNormalMatrix(normalToWorld);
   sourceWorld.push({position:position.toArray(),normal:normal.toArray()});
   const clock=time/source.period+source.phase,epoch=Math.floor(clock);
   for(let slot=0;slot<perSource;slot++){
    const i=sourceIndex*perSource+slot,release=slot*.064+seeded(i+epoch*13+2260)*.065;
    const lifetime=.45+seeded(i+epoch*17+2270)*.23,flight=(clock-epoch)*source.period-release;
    const age=THREE.MathUtils.clamp(flight/lifetime,0,1),seconds=Math.max(0,Math.min(flight,lifetime));
    const size=worldUnit*(.008+seeded(i+2310)*.006);
    start.copy(position).addScaledVector(normal,size*1.1+worldUnit*.004);
    world.copy(start).addScaledVector(normal,worldUnit*.15*seconds);world.y-=worldUnit*(.075*seconds+.95*seconds*seconds);
    // Tangential launch variance, not cumulative animation or moving crack UVs.
    world.x+=worldUnit*(seeded(i+2290)-.5)*.020*seconds;
    world.z+=worldUnit*(seeded(i+2300)-.5)*.018*seconds;
    const crossing=flight>=0&&flight<=lifetime&&colliders.some(c=>c.intersects(start,world));if(crossing)hiddenByBody++;
    const floorFade=THREE.MathUtils.smoothstep(world.y-worldBounds.min.y,worldUnit*.018,worldUnit*.10);
    const life=flight>=0&&flight<=lifetime&&!crossing&&!excluded?THREE.MathUtils.smoothstep(age,0,.045)*(1-THREE.MathUtils.smoothstep(age,.78,1))*floorFade:0;
    if(life>.02)visibleCount++;
    dummy.position.copy(world);dummy.rotation.set(age*2.1+i,age*1.7+i*.7,age*2.4);dummy.scale.set(size*life,size*life*(1.05+.7*age),size*life*.81);dummy.updateMatrix();
    // Form a world grain transform first, then remove the effect parent. This
    // preserves grain size and world gravity even under nonuniform parent scale.
    worldMatrix.copy(inverse).multiply(dummy.matrix);grains.setMatrixAt(i,worldMatrix);
   }
  }
  grains.instanceMatrix.needsUpdate=true;
  group.userData.sandFrame={time,visibleCount,hiddenByBody,excludedSourceCount,sourceWorld,colliderRefits:colliders.reduce((sum,c)=>sum+c.refitCount,0),worldGravity:[0,-1,0],worldUnit,parentPosition:[elements[12],elements[13],elements[14]]};
 }
 function dispose():void {
  if(disposed)return;disposed=true;group.removeFromParent();grains.dispose();geometry.dispose();material.dispose();
  for(const collider of colliders)collider.clear();sources.length=0;group.clear();
 }
 update(0);return {group,update,dispose,diagnostics};
}
