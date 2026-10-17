import * as THREE from 'three';
export interface SurfaceAnchor { mesh: THREE.Mesh; triangle: number; barycentric: THREE.Vector3 }
export interface SurfacePose { position: THREE.Vector3; normal: THREE.Vector3 }
interface Face { mesh: THREE.Mesh; triangle: number; a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; cumulative: number }
const fract = (n:number) => n-Math.floor(n);
export const seeded = (n:number):number => fract(Math.sin(n*127.1+311.7)*43758.5453123);
/** Static geometry, moving rigid transforms. Barycentric positions use actual triangle planes. */
export class MeshSurface {
  private faces: Face[] = [];
  private byMesh = new Map<THREE.Mesh, Face[]>();
  private total = 0;
  readonly bounds = new THREE.Box3();
  // Scratch storage is instance-local; returned poses retain their own vectors.
  private readonly resolveVertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly resolveTransform = new THREE.Matrix4();
  private readonly resolveNormal = new THREE.Matrix3();
  constructor(readonly meshes: THREE.Mesh[]) {
    if (!meshes.length) throw new RangeError('At least one mesh surface is required.');
    for (const mesh of meshes) {
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || mesh.morphTargetInfluences?.length) throw new Error('Rigid non-morph Mesh surfaces only.');
      const p = mesh.geometry.getAttribute('position');
      if (!p) throw new Error('Mesh requires position geometry.');
      mesh.updateWorldMatrix(true,false);
      const index = mesh.geometry.index;
      const count = index?.count ?? p.count;
      const local: Face[] = [];
      for (let offset=0; offset+2<count; offset+=3) {
        const v = (i:number) => new THREE.Vector3().fromBufferAttribute(p,index ? index.getX(offset+i) : offset+i);
        const a=v(0), b=v(1), c=v(2);
        const aw=a.clone().applyMatrix4(mesh.matrixWorld), bw=b.clone().applyMatrix4(mesh.matrixWorld), cw=c.clone().applyMatrix4(mesh.matrixWorld);
        const area = new THREE.Triangle(aw,bw,cw).getArea();
        if (!Number.isFinite(area)) throw new Error('Non-finite surface geometry.');
        if (area<1e-14) continue;
        this.total+=area;
        const face={mesh,triangle:offset/3,a,b,c,cumulative:this.total};
        this.faces.push(face);local.push(face);this.bounds.expandByPoint(aw).expandByPoint(bw).expandByPoint(cw);
      }
      this.byMesh.set(mesh,local);
    }
    if (!this.faces.length) throw new Error('No non-degenerate surface triangles.');
  }
  sample(seed:number):SurfaceAnchor {
    const value=seeded(seed+1)*this.total;
    let lo=0, hi=this.faces.length-1;
    while(lo<hi){const mid=(lo+hi)>>>1;if(this.faces[mid].cumulative<value)lo=mid+1;else hi=mid;}
    const f=this.faces[lo], r=Math.sqrt(seeded(seed+17)), t=seeded(seed+31);
    return {mesh:f.mesh,triangle:f.triangle,barycentric:new THREE.Vector3(1-r,r*(1-t),r*t)};
  }
  resolve(anchor:SurfaceAnchor, root:THREE.Object3D, target?:SurfacePose):SurfacePose {
    const out=target??{position:new THREE.Vector3(),normal:new THREE.Vector3()};
    const mesh=anchor.mesh, p=mesh.geometry.getAttribute('position'), index=mesh.geometry.index;
    const ids=[0,1,2].map(i=>index?index.getX(anchor.triangle*3+i):anchor.triangle*3+i);
    const [a,b,c]=this.resolveVertices;
    a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);
    out.position.copy(a).multiplyScalar(anchor.barycentric.x).addScaledVector(b,anchor.barycentric.y).addScaledVector(c,anchor.barycentric.z);
    // Geometric normals ensure attachment to actual polygon, avoiding interpolated-normal drift.
    out.normal.crossVectors(b.sub(a),c.sub(a)).normalize();
    mesh.updateWorldMatrix(true,false);root.updateWorldMatrix(true,false);
    const relative=this.resolveTransform.copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
    if (Math.abs(relative.determinant())<1e-14) throw new Error('Surface transforms must be invertible.');
    out.position.applyMatrix4(relative);out.normal.applyNormalMatrix(this.resolveNormal.getNormalMatrix(relative));
    return out;
  }
  /** Short local surface crawl. Restricts projection to the SAME mesh and similar facing triangles. */
  path(anchor:SurfaceAnchor,length:number,steps=24):SurfaceAnchor[] {
    const face=(this.byMesh.get(anchor.mesh)??[]).find(f=>f.triangle===anchor.triangle)!;
    let point=face.a.clone().multiplyScalar(anchor.barycentric.x).addScaledVector(face.b,anchor.barycentric.y).addScaledVector(face.c,anchor.barycentric.z);
    const normal=new THREE.Triangle(face.a,face.b,face.c).getNormal(new THREE.Vector3());
    const direction=new THREE.Vector3(0,1,0).addScaledVector(normal,-normal.y);
    if(direction.lengthSq()<.01)direction.set(1,0,0).addScaledVector(normal,-normal.x);
    direction.normalize();
    const result=[anchor], step=length/steps, tri=new THREE.Triangle(), closest=new THREE.Vector3(), n=new THREE.Vector3();
    for(let i=1;i<=steps;i++){
      const wanted=point.clone().addScaledVector(direction,step);
      let best:Face|undefined, distance=Infinity;const pos=new THREE.Vector3();
      for(const f of this.byMesh.get(anchor.mesh)??[]){
        tri.set(f.a,f.b,f.c);tri.getNormal(n);if(n.dot(normal)<.35)continue;
        tri.closestPointToPoint(wanted,closest);const d=closest.distanceToSquared(wanted);
        if(d<distance){distance=d;best=f;pos.copy(closest);}
      }
      if(!best || distance>step*step*2 || pos.distanceToSquared(point)<step*step*.02)break;
      tri.set(best.a,best.b,best.c);tri.getNormal(normal);
      direction.addScaledVector(normal,-direction.dot(normal)).normalize();
      result.push({mesh:anchor.mesh,triangle:best.triangle,barycentric:tri.getBarycoord(pos,new THREE.Vector3())!});point=pos;
    }
    return result;
  }
}
