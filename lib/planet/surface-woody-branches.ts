import * as THREE from 'three';
import {MeshSurface,seeded,type SurfaceAnchor} from './mesh-surface';
import type {SurfaceAccentOptions,SurfaceStemAccents} from './surface-stem-accents';
const Y=new THREE.Vector3(0,1,0),TAU=Math.PI*2;
interface BranchAnchor {anchor:SurfaceAnchor;length:number;variant:number;roll:number}
function merge(geometries:THREE.BufferGeometry[]):THREE.BufferGeometry{
 const count=geometries.reduce((n,g)=>n+g.getAttribute('position').count,0),p=new Float32Array(count*3),n=new Float32Array(count*3),indices:number[]=[];let offset=0;
 for(const g of geometries){const pos=g.getAttribute('position');p.set(pos.array,offset*3);n.set(g.getAttribute('normal').array,offset*3);const idx=g.index!;for(let i=0;i<idx.count;i++)indices.push(idx.getX(i)+offset);offset+=pos.count;g.dispose();}
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.BufferAttribute(p,3));result.setAttribute('normal',new THREE.BufferAttribute(n,3));result.setIndex(indices);result.computeBoundingSphere();return result;
}
function tapered(curve:THREE.Curve<THREE.Vector3>,radius:number,segments:number):THREE.BufferGeometry{
 const g=new THREE.TubeGeometry(curve,segments,radius,6,false),p=g.getAttribute('position');
 for(let row=0;row<=segments;row++){const t=row/segments,center=curve.getPointAt(t),width=.12+1.38*Math.pow(1-t,.72);for(let j=0;j<=6;j++){const i=row*7+j;p.setXYZ(i,center.x+(p.getX(i)-center.x)*width,center.y+(p.getY(i)-center.y)*width,center.z+(p.getZ(i)-center.z)*width);}}
 g.computeVertexNormals();return g;
}
export function createSurfaceWoodyBranches(options:SurfaceAccentOptions):SurfaceStemAccents{
 const sampler=new MeshSurface(options.meshes),size=sampler.bounds.getSize(new THREE.Vector3()),unit=options.detailScale??Math.min(size.x,size.y,size.z)*.5;
 if(!Number.isFinite(unit)||unit<=0)throw new RangeError('detailScale must be positive.');
 const high=options.quality!=='low',desired=high?44:30,group=new THREE.Group();group.name='SurfaceStemAccents_甲';
 const anchors:BranchAnchor[]=[],worldPoints:THREE.Vector3[]=[];
 const identity=new THREE.Group(),ray=new THREE.Raycaster(),tmpNormal=new THREE.Vector3();
 // Deterministic area-weighted surface candidates; exclude readable face center,
 // buried joints and outward paths that immediately strike another surface.
 for(let attempt=0;attempt<desired*40&&anchors.length<desired;attempt++){
  const anchor=sampler.sample(attempt*73+193),pose=sampler.resolve(anchor,identity),local=sampler.resolve(anchor,anchor.mesh),mesh=anchor.mesh;
  if(mesh.name==='expressive-element-head'&&local.position.z>.10&&Math.abs(local.position.x)<.265&&local.position.y<.23&&local.position.y>-.23)continue;
  if(pose.normal.y<-.55&&pose.position.y<sampler.bounds.min.y+unit*.14)continue;
  if(mesh.geometry instanceof THREE.TubeGeometry){const uv=mesh.geometry.getAttribute('uv'),idx=mesh.geometry.index;let u=0;for(let j=0;j<3;j++){const id=idx?idx.getX(anchor.triangle*3+j):anchor.triangle*3+j;u+=uv.getX(id)*anchor.barycentric.getComponent(j);}if(u<.08||u>.92)continue;}
  const length=unit*(.22+.15*seeded(attempt+770));
  if(worldPoints.some(p=>p.distanceToSquared(pose.position)<Math.pow(unit*.13,2)))continue;
  ray.set(pose.position.clone().addScaledVector(pose.normal,unit*.007),pose.normal);ray.near=0;ray.far=length*.82;
  if(ray.intersectObjects(options.meshes,false).some(hit=>hit.distance>unit*.003))continue;
  anchors.push({anchor,length,variant:anchors.length%4,roll:seeded(attempt+870)*TAU});worldPoints.push(pose.position.clone());
 }
 const diagnostics={supported:true,mode:'normal-rooted-forked-woody-branches',anchorCount:anchors.length,limitations:['Rigid topology only; root directions are actual surface normals, with natural curved tips.','Creation-time facial/sole/joint and short outward collision filters reduce penetrations; full animated collision avoidance is not simulated.']};
 const bark=new THREE.MeshStandardMaterial({color:0x795235,roughness:.9});
 const leafMat=new THREE.MeshPhysicalMaterial({color:0x98b54e,roughness:.56,side:THREE.DoubleSide,clearcoat:.08});
 const geometries:THREE.BufferGeometry[]=[],instanced:THREE.InstancedMesh[]=[],branches:THREE.InstancedMesh[]=[],leafPositions:THREE.Vector3[][]=[];
 for(let variant=0;variant<4;variant++){
  const bend=.23+.055*variant,sign=variant%2?1:-1;
  class Trunk extends THREE.Curve<THREE.Vector3>{constructor(){super();}getPoint(t:number,out=new THREE.Vector3()){const u=Math.max(0,(t-.28)/.72);return out.set(sign*bend*u*u,t,.12*Math.sin(u*Math.PI*.75)*u*u);}}
  const trunk=new Trunk(),parts=[tapered(trunk,.062,high?22:16)],tips=[trunk.getPoint(1)];
  for(let fork=0;fork<2;fork++){
   const t=.52+fork*.19,root=trunk.getPoint(t),tip=root.clone().add(new THREE.Vector3((fork?-.28:.31)*sign,.35-fork*.05, fork?.19:-.16));
   const curve=new THREE.QuadraticBezierCurve3(root,root.clone().lerp(tip,.55).add(new THREE.Vector3(0,.08,0)),tip);parts.push(tapered(curve,.035-fork*.006,high?12:9));tips.push(tip);
  }
  const geometry=merge(parts);geometries.push(geometry);leafPositions.push(tips);
  const count=anchors.filter(a=>a.variant===variant).length,mesh=new THREE.InstancedMesh(geometry,bark,count);mesh.name=`NormalRootedWoodyBranches_${variant}`;mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;branches.push(mesh);instanced.push(mesh);group.add(mesh);
 }
 const leafG=new THREE.BufferGeometry();leafG.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.28,.45,.055,0,1,.12,.28,.45,.055,0,.46,.13],3));leafG.setIndex([0,1,4,1,2,4,2,3,4,3,0,4]);leafG.computeVertexNormals();geometries.push(leafG);
 const leaves=new THREE.InstancedMesh(leafG,leafMat,anchors.length*3);leaves.name='WoodyBranchTipLeaves';leaves.frustumCulled=false;instanced.push(leaves);group.add(leaves);
 const dummy=new THREE.Object3D(),leafDummy=new THREE.Object3D(),inverse=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),rootWorld=new THREE.Vector3(),normalWorld=new THREE.Vector3();
 let disposed=false;
 function update(time:number):void{
  if(disposed)return;if(!Number.isFinite(time))throw new RangeError('Accent time must be finite.');group.updateWorldMatrix(true,false);inverse.copy(group.matrixWorld).invert();normalMatrix.getNormalMatrix(group.matrixWorld);const slots=[0,0,0,0];let minDot=1;
  for(let i=0;i<anchors.length;i++){
   const entry=anchors[i],pose=sampler.resolve(entry.anchor,group);
   normalWorld.copy(pose.normal).applyNormalMatrix(normalMatrix);rootWorld.copy(pose.position).applyMatrix4(group.matrixWorld);
   // A normal is a covector; convert world outward normal back as a DIRECTION
   // before orienting a branch under a nonuniformly scaled effect parent.
   tmpNormal.copy(normalWorld).transformDirection(inverse);
   dummy.position.copy(pose.position).addScaledVector(tmpNormal,-unit*.006);dummy.quaternion.setFromUnitVectors(Y,tmpNormal).multiply(new THREE.Quaternion().setFromAxisAngle(Y,entry.roll));dummy.scale.setScalar(entry.length);dummy.updateMatrix();branches[entry.variant].setMatrixAt(slots[entry.variant]++,dummy.matrix);
   const actualWorld=Y.clone().applyQuaternion(dummy.quaternion).transformDirection(group.matrixWorld);minDot=Math.min(minDot,actualWorld.dot(normalWorld));
   for(let j=0;j<3;j++){
    const tip=leafPositions[entry.variant][j];leafDummy.position.copy(tip).applyMatrix4(dummy.matrix);
    leafDummy.quaternion.copy(dummy.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),(j-1)*.7+.10*Math.sin(time*.9+i+j))).multiply(new THREE.Quaternion().setFromAxisAngle(Y,.6*j));
    leafDummy.scale.setScalar(entry.length*(j===0?.31:.26));leafDummy.updateMatrix();leaves.setMatrixAt(i*3+j,leafDummy.matrix);
   }
  }
  for(const mesh of instanced)mesh.instanceMatrix.needsUpdate=true;
  group.userData.branchAttachment={branchCount:anchors.length,minWorldRootNormalDot:minDot,rootInitialStraightFraction:.28,hasWoodyForkGeometry:true};
 }
 function dispose():void{if(disposed)return;disposed=true;group.removeFromParent();for(const mesh of instanced)mesh.dispose();for(const g of geometries)g.dispose();bark.dispose();leafMat.dispose();group.clear();}
 update(0);return {group,update,dispose,diagnostics};
}
