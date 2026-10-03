import * as THREE from 'three';
export interface SurfaceVineBodyOptions {meshes:THREE.Mesh[];quality?:'low'|'high';seed?:number}
export interface SurfaceVineBody {group:THREE.Group;update(time:number):void;dispose():void;diagnostics:{hasSmoothSubstrate:false;strandCount:number;triangles:number;parts:number;layers:number;supportedGeometry:string[];limitations:string[]}}
const TAU=Math.PI*2;
const fract=(x:number)=>x-Math.floor(x);
const random=(x:number)=>fract(Math.sin(x*127.1+311.7)*43758.5453123);
interface Grid {get:(u:number,v:number)=>THREE.Vector3;center:(u:number,v:number)=>THREE.Vector3;tubular:boolean;closed:boolean;radius:number;length:number}
/** Explicit parameter-grid support for existing fixture geometry; never substitutes bounding ellipsoids. */
function makeGrid(g:THREE.BufferGeometry):Grid{
  const p=g.getAttribute('position');
  let nu:number,nv:number,transpose=false,tubular=false,closed=false;
  if(g instanceof THREE.TorusKnotGeometry){nu=g.parameters.tubularSegments;nv=g.parameters.radialSegments;tubular=true;closed=true;}
  else if(g instanceof THREE.TubeGeometry){nu=g.parameters.tubularSegments;nv=g.parameters.radialSegments;tubular=true;closed=g.parameters.closed;}
  else if(g instanceof THREE.LatheGeometry){nu=g.parameters.segments;nv=g.parameters.points.length-1;}
  else if(g instanceof THREE.SphereGeometry){nu=g.parameters.widthSegments;nv=g.parameters.heightSegments;transpose=true;}
  else throw new Error(`Surface vines require retained TorusKnot/Tube/Lathe/Sphere parameter topology; got ${g.type}.`);
  if(p.count!==(nu+1)*(nv+1))throw new Error('Surface topology has changed; parameter grid is no longer valid.');
  const vertex=(u:number,v:number)=>new THREE.Vector3().fromBufferAttribute(p,transpose?v*(nu+1)+u:u*(nv+1)+v);
  const get=(u:number,v:number)=>{
    u=tubular&&!closed?THREE.MathUtils.clamp(u,0,1):fract(u);v=tubular?fract(v):THREE.MathUtils.clamp(v,0,1);
    const x=u*nu,y=v*nv,ix=Math.min(nu-1,Math.floor(x)),iy=Math.min(nv-1,Math.floor(y)),a=x-ix,b=y-iy;
    return vertex(ix,iy).lerp(vertex(ix+1,iy),a).lerp(vertex(ix,iy+1).lerp(vertex(ix+1,iy+1),a),b);
  };
  const centers:THREE.Vector3[]=[];
  const rows=tubular?nu:nv,around=tubular?nv:nu;
  for(let row=0;row<=rows;row++){
    const c=new THREE.Vector3();for(let a=0;a<around;a++)c.add(tubular?vertex(row,a):vertex(a,row));centers.push(c.divideScalar(around));
  }
  const center=(u:number,v:number)=>{const t=(tubular?THREE.MathUtils.clamp(u,0,1):THREE.MathUtils.clamp(v,0,1))*rows,i=Math.min(rows-1,Math.floor(t));return centers[i].clone().lerp(centers[i+1],t-i);};
  let radius=0;for(let i=0;i<9;i++)radius=Math.max(radius,get(tubular?(i+.5)/9:0,tubular?0:(i+.5)/9).distanceTo(center(tubular?(i+.5)/9:0,tubular?0:(i+.5)/9)));
  let length=0;for(let i=1;i<centers.length;i++)length+=centers[i].distanceTo(centers[i-1]);
  return {get,center,tubular,closed,radius,length};
}
function merge(sources:THREE.BufferGeometry[]):THREE.BufferGeometry{
  const count=sources.reduce((n,g)=>n+g.getAttribute('position').count,0),p=new Float32Array(count*3),n=new Float32Array(count*3),indices:number[]=[];
  let offset=0;for(const g of sources){const a=g.getAttribute('position'),normal=g.getAttribute('normal'),index=g.index;p.set(a.array,offset*3);n.set(normal.array,offset*3);if(index)for(let i=0;i<index.count;i++)indices.push(index.getX(i)+offset);offset+=a.count;g.dispose();}
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.BufferAttribute(p,3));result.setAttribute('normal',new THREE.BufferAttribute(n,3));result.setIndex(indices);result.computeBoundingSphere();return result;
}
export function createSurfaceVineBody(options:SurfaceVineBodyOptions):SurfaceVineBody{
  if(!options.meshes.length)throw new Error('Surface vines require target meshes.');
  const high=options.quality==='high',seed=options.seed??9255;
  if(!Number.isFinite(seed))throw new RangeError('Seed must be finite.');
  const group=new THREE.Group();group.name='ActualSurfaceLivingVineBody';group.userData.hasSmoothSubstrate=false;
  const materials=[0x5b752b,0x718c35,0x839d3c].map((color,i)=>new THREE.MeshPhysicalMaterial({color,roughness:.64-i*.035,clearcoat:.025+i*.015,clearcoatRoughness:.55}));
  const geometries:THREE.BufferGeometry[]=[];
  const parts:Array<{source:THREE.Mesh;holder:THREE.Group}>=[];
  const diagnostics:SurfaceVineBody['diagnostics']={hasSmoothSubstrate:false,strandCount:0,triangles:0,parts:options.meshes.length,layers:3,supportedGeometry:[],limitations:['Only original parameter topology of TorusKnot, Tube, Lathe and Sphere geometry is supported.','Rigid nested transforms supported; no skinning or morph deformation.','Separate body-part strand loops overlap at joints but are not a continuous anatomical rig.']};
  // Validate every source before allocating resources or mutating any targets.
  const grids=options.meshes.map(mesh=>{if((mesh as THREE.SkinnedMesh).isSkinnedMesh||mesh.morphTargetInfluences?.length)throw new Error('Rigid meshes only.');return makeGrid(mesh.geometry);});
  for(let part=0;part<options.meshes.length;part++){
    const source=options.meshes[part],grid=grids[part],holder=new THREE.Group();holder.name=`WovenBody:${source.name||source.geometry.type}`;holder.matrixAutoUpdate=false;group.add(holder);parts.push({source,holder});diagnostics.supportedGeometry.push(source.geometry.type);
    const knot=source.geometry instanceof THREE.TorusKnotGeometry;
    const major=grid.radius>.22||grid.length>.7;
    const torso=source.geometry instanceof THREE.LatheGeometry;
    for(let layer=0;layer<3;layer++){
      const count=knot?(high?[7,10,13]:[5,8,11])[layer]:torso?(high?[15,13,15]:[11,10,11])[layer]:(high?[5,8,12]:[4,6,9])[layer];
      const thickness=grid.radius*(knot?[.100,.077,.057]:torso?[.165,.100,.058]:[.115,.085,.056])[layer];
      const radial=[.60,.79,.97][layer];
      const batch:THREE.BufferGeometry[]=[];
      for(let strand=0;strand<count;strand++){
        const id=seed+part*311+layer*79+strand*13,phase=TAU*random(id+3),shift=(strand+.29*random(id+4))/count;
        const turns=knot?(layer===1?-1:1)*(18+layer*3+(strand%3)):((strand+layer)%2?1:-1)*(grid.tubular?4:(torso?4+strand%3:3+strand%2));
        class Winding extends THREE.Curve<THREE.Vector3>{
          constructor(){super();this.arcLengthDivisions=knot?1536:512;}
          getPoint(t:number,target=new THREE.Vector3()):THREE.Vector3{
            const a=TAU*t;
            let u:number,v:number;
            if(knot){u=t+shift*.11+.004*Math.sin(a*9+phase);v=t*turns+shift+.065*Math.sin(a*3+phase)+.020*Math.sin(a*7-phase);}
            else if(grid.tubular){u=.5+.498*Math.sin(a+phase);v=t*turns+shift+.05*Math.sin(a*3+phase);}
            else {u=t*turns+shift+.075*Math.sin(a*2+phase)+.024*Math.sin(a*5-phase);v=.5+.478*Math.sin(a+phase)+.015*Math.sin(a*3-phase);}
            const surface=grid.get(u,v),center=grid.center(grid.closed?fract(u):u,v);
            const lift=radial+(layer===2?.023:.013)*Math.sin(a*(knot?18:6)+phase);
            return target.copy(center).lerp(surface,lift);
          }
        }
        const curve=new Winding();
        const segments=knot?(high?896:480):(high?(major?256:192):(major?128:96));
        const geometry=new THREE.TubeGeometry(curve,segments,thickness*(.88+.22*random(id+6)),high?6:5,true);
        const positions=geometry.getAttribute('position'),sides=high?6:5;
        for(let row=0;row<=segments;row++){
          const t=row/segments,center=curve.getPointAt(t),width=.94+.075*Math.sin(TAU*t*3+phase)+.035*Math.sin(TAU*t*7-phase);
          for(let col=0;col<=sides;col++){const index=row*(sides+1)+col;positions.setXYZ(index,center.x+(positions.getX(index)-center.x)*width,center.y+(positions.getY(index)-center.y)*width,center.z+(positions.getZ(index)-center.z)*width);}
        }
        geometry.computeVertexNormals();
        batch.push(geometry);diagnostics.strandCount++;
      }
      const geometry=merge(batch);geometries.push(geometry);diagnostics.triangles+=(geometry.index?.count??0)/3;
      const mesh=new THREE.Mesh(geometry,materials[layer]);mesh.name=`ContinuousVineLayer_${layer}`;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={closedStrands:count,insetFraction:radial,part:source.name};holder.add(mesh);
    }
  }
  let disposed=false;
  function update(time:number):void{if(disposed)return;if(!Number.isFinite(time))throw new RangeError('Time must be finite.');group.updateWorldMatrix(true,false);const inverse=new THREE.Matrix4().copy(group.matrixWorld).invert();for(const {source,holder} of parts){source.updateWorldMatrix(true,false);holder.matrix.copy(inverse).multiply(source.matrixWorld);holder.matrixWorldNeedsUpdate=true;}group.updateWorldMatrix(false,true);}
  function dispose():void{if(disposed)return;disposed=true;group.removeFromParent();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();group.clear();}
  update(0);return {group,update,dispose,diagnostics};
}
