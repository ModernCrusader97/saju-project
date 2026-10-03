import * as THREE from 'three';
import {createSurfaceWoodyBranches} from './surface-woody-branches';
import {createStemAccents,type AccentStem,type StemAccents} from './approved-stem-accents';
import {MeshSurface,seeded,type SurfaceAnchor} from './mesh-surface';
export interface SurfaceAccentOptions {meshes:THREE.Mesh[];quality?:'low'|'high';detailScale?:number}
export interface SurfaceAccentDiagnostics {supported:boolean;mode:string;limitations:string[];anchorCount:number}
export interface SurfaceStemAccents extends StemAccents {diagnostics:SurfaceAccentDiagnostics}
/** Actual-triangle accents for static topology / rigid moving meshes, never a bounding sphere shell. */
export function createSurfaceStemAccents(stem:AccentStem | '己' | '庚' | '辛',options:SurfaceAccentOptions):SurfaceStemAccents {
  return stem==='甲'?createSurfaceWoodyBranches(options):createSurfaceStemAccentsUnchanged(stem,options);
}
function createSurfaceStemAccentsUnchanged(stem:AccentStem | '己' | '庚' | '辛',options:SurfaceAccentOptions):SurfaceStemAccents {
  const sampler=new MeshSurface(options.meshes);
  const extent=sampler.bounds.getSize(new THREE.Vector3());
  const unit=options.detailScale??Math.min(extent.x,extent.y,extent.z)*.5;
  if(!Number.isFinite(unit)||unit<=0)throw new RangeError('detailScale must be positive.');
  const diagnostics:SurfaceAccentDiagnostics={supported:true,mode:'triangle-attached',limitations:['Rigid transforms supported; rebuild after topology or morph/skinning changes.','Surface area distribution is fixed at creation; large later scale changes do not redistribute sources.'],anchorCount:0};
  if(stem==='丙'||stem==='丁'){
    const fireCount=stem==='丁'?(options.quality==='low'?12:18):(options.quality==='low'?48:72);
    const anchors=Array.from({length:fireCount},(_,i)=>sampler.sample(i*53+400));diagnostics.anchorCount=anchors.length;
    const effect=createStemAccents(stem,{radius:unit*.52,height:unit*1.04,quality:options.quality,
      surfaceEmitter:(index,_epoch,group,offset)=>{const pose=sampler.resolve(anchors[index],group);return pose.position.addScaledVector(pose.normal,offset);}});
    effect.group.name=`SurfaceStemAccents_${stem}`;
    diagnostics.mode='triangle-emitted-original-fire';diagnostics.limitations.push('Fire rises into world gravity/up, so detached flame flight is intentional; mesh collisions are not simulated.');
    return {...effect,diagnostics};
  }
  const group=new THREE.Group();group.name=`SurfaceStemAccents_${stem}`;
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  let disposed=false;
  const animations:Array<(t:number)=>void>=[];
  const instanced:THREE.InstancedMesh[]=[];
  const ownG=<T extends THREE.BufferGeometry>(g:T):T=>{geometries.add(g);return g;};
  const ownM=<T extends THREE.Material>(m:T):T=>{materials.add(m);return m;};
  if(stem==='壬'||stem==='戊'||stem==='己'||stem==='庚'||stem==='辛'){
    diagnostics.supported=false;diagnostics.mode='base-material-only';
    diagnostics.limitations.push(stem==='己'||stem==='庚'||stem==='辛'?'This stem uses its base material only; no geometry accent is defined.':stem==='壬'?'Curved/character spray and foam disabled: sphere angular advection cannot remain coherent on this topology.':'Curved/character sand disabled: exact shared crack-source alignment is not validated.');
  }else if(stem==='癸'){
    diagnostics.mode='triangle-attached-condensation';diagnostics.limitations.push('Droplets condense and evaporate in place; cross-triangle sliding is intentionally omitted.');
    const count=options.quality==='low'?64:112;
    const mesh=new THREE.InstancedMesh(ownG(new THREE.SphereGeometry(1,12,8)),ownM(new THREE.MeshPhysicalMaterial({color:0xe8ffff,roughness:.045,transmission:.97,ior:1.333,thickness:unit*.05,clearcoat:.65,envMapIntensity:1.1})),count);
    mesh.name='ActualSurfaceDew';mesh.frustumCulled=false;instanced.push(mesh);group.add(mesh);
    const anchors=Array.from({length:count},(_,i)=>sampler.sample(i*43+120));diagnostics.anchorCount=count;
    const dummy=new THREE.Object3D();
    animations.push(t=>{for(let i=0;i<count;i++){
      const seed=seeded(i+72),age=((t/(6.5+seed*8.5)+seeded(i+340))%1+1)%1;
      const life=THREE.MathUtils.smoothstep(age,0,.38)*(1-THREE.MathUtils.smoothstep(age,.8,1));
      const size=unit*(.009+.020*seed)*Math.max(.001,life),pose=sampler.resolve(anchors[i],group);
      dummy.position.copy(pose.position).addScaledVector(pose.normal,size*.25);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),pose.normal);dummy.scale.set(size,size*1.08,size*.55);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    }mesh.instanceMatrix.needsUpdate=true;});
  }else if(stem==='甲'||stem==='乙'){
    const woody=stem==='甲',count=options.quality==='low'?14:22;
    const leafG=ownG(new THREE.BufferGeometry());
    leafG.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.25,.43,.06,0,1,.12,.25,.43,.06,0,.46,.13],3));leafG.setIndex([0,1,4,1,2,4,2,3,4,3,0,4]);leafG.computeVertexNormals();
    const leafM=ownM(new THREE.MeshPhysicalMaterial({color:woody?0x90a947:0xa6cb45,roughness:.5,side:THREE.DoubleSide,clearcoat:.12}));
    const leaves=new THREE.InstancedMesh(leafG,leafM,count);leaves.name='ActualSurfaceLeaves';leaves.frustumCulled=false;instanced.push(leaves);group.add(leaves);
    const anchors=Array.from({length:count},(_,i)=>sampler.sample(i*67+121));diagnostics.anchorCount=count;
    const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),q=new THREE.Quaternion();
    animations.push(t=>{for(let i=0;i<count;i++){
      const pose=sampler.resolve(anchors[i],group);dummy.position.copy(pose.position).addScaledVector(pose.normal,unit*.003);
      q.setFromUnitVectors(up,pose.normal);dummy.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(up,seeded(i+64)*Math.PI*2));
      dummy.rotateX(.25*Math.sin(t*.7+i));dummy.scale.setScalar(unit*(woody?.095:.14)*( .8+seeded(i+90)*.4));dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
    }leaves.instanceMatrix.needsUpdate=true;});
    if(!woody){
      const paths:SurfaceAnchor[][]=[];
      for(let i=0;i<Math.min(8,count);i++){
        const mesh=anchors[i].mesh;mesh.updateWorldMatrix(true,false);const scale=mesh.getWorldScale(new THREE.Vector3());
        paths.push(sampler.path(anchors[i],unit*.65/Math.max(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z)),24));
      }
      const segments=paths.reduce((n,p)=>n+Math.max(0,p.length-1),0);
      if(segments){
        const vines=new THREE.InstancedMesh(ownG(new THREE.CylinderGeometry(unit*.009,unit*.012,1,5)),ownM(new THREE.MeshStandardMaterial({color:0x678626,roughness:.5})),segments);
        vines.name='ActualSurfaceCrawlingVines';vines.frustumCulled=false;instanced.push(vines);group.add(vines);
        diagnostics.anchorCount+=paths.reduce((n,p)=>n+p.length,0);
        animations.push(()=>{let slot=0;for(const path of paths)for(let i=1;i<path.length;i++){
          const a=sampler.resolve(path[i-1],group),b=sampler.resolve(path[i],group);a.position.addScaledVector(a.normal,unit*.009);b.position.addScaledVector(b.normal,unit*.009);
          const delta=b.position.clone().sub(a.position);dummy.position.copy(a.position).lerp(b.position,.5);dummy.quaternion.setFromUnitVectors(up,delta.clone().normalize());dummy.scale.set(1,delta.length(),1);dummy.updateMatrix();vines.setMatrixAt(slot++,dummy.matrix);
        }vines.instanceMatrix.needsUpdate=true;});
      }
      diagnostics.limitations.push('Short same-mesh surface crawls stop at boundaries; vines do not bridge separate character parts.');
    }
  }else throw new RangeError('Unsupported accent stem.');
  function update(time:number):void{if(disposed)return;if(!Number.isFinite(time))throw new RangeError('Accent time must be finite.');group.updateWorldMatrix(true,false);for(const animate of animations)animate(time);}
  function dispose():void{if(disposed)return;disposed=true;group.removeFromParent();for(const m of instanced)m.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.clear();}
  update(0);return {group,update,dispose,diagnostics};
}
