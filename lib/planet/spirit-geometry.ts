import * as THREE from "three";
import { getSurfaceFamily, type GanziThemePreset } from "./theme-library";
import { hashSeed, seededRandom } from "./surface-math";

export type SpiritQuality = "low" | "high";
export interface SpiritGeometry {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  faceDepth: number;
  crown: THREE.Group;
  update: (time: number) => void;
}

/** A living natural object, deliberately without human anatomy or a cartoon head. */
export function createSpiritGeometry(
  preset: GanziThemePreset,
  bodyMaterial: THREE.Material,
  accentMaterial: THREE.Material,
  quality: SpiritQuality = "high",
): SpiritGeometry {
  const family = getSurfaceFamily(preset);
  const low = quality === "low";
  const random = seededRandom(hashSeed(preset.key + ":spirit-form"));
  const group = new THREE.Group();
  group.name = `nature-spirit:${family}`;
  const crown = new THREE.Group();
  crown.name = "natural-crown";
  group.add(crown);
  let geometry: THREE.BufferGeometry;
  let faceDepth = .625;

  if (family === "forest") {
    // Mossy old seed / stump, with a fluted base and actual open branch structure.
    const profile = [[0,-.72],[.31,-.71],[.43,-.6],[.39,-.43],[.35,-.12],[.34,.2],[.32,.5],[.19,.68],[0,.7]];
    const trunkCurve=new THREE.SplineCurve(profile.map(([r,y])=>new THREE.Vector2(r,y)));
    geometry = new THREE.LatheGeometry(trunkCurve.getPoints(low?28:40).map(p=>new THREE.Vector2(Math.max(0,p.x),p.y)), low ? 40 : 56);
    const position = geometry.getAttribute("position");
    for (let i=0; i<position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const angle=Math.atan2(z,x);
      const flute = 1 + (Math.sin(angle*9)*.075+Math.sin(angle*17+y*.9)*.025)*(1+Math.max(0,-y)*.35);
      position.setXYZ(i,x*flute,y,z*flute);
    }
    geometry.computeVertexNormals();
    faceDepth = .355;
  } else if (family === "water") {
    const profile = [[0,-.72],[.29,-.7],[.52,-.53],[.66,-.25],[.67,.05],[.58,.36],[.39,.67],[.18,.95],[.055,1.12],[0,1.15]];
    const curve = new THREE.SplineCurve(profile.map(([r,y])=>new THREE.Vector2(r,y)));
    geometry = new THREE.LatheGeometry(curve.getPoints(low ? 28 : 44).map(p=>new THREE.Vector2(Math.max(0,p.x),p.y)),low?40:64);
    faceDepth = .664;
  } else if (family === "earth") {
    geometry = new THREE.IcosahedronGeometry(.76, preset.stem === "무" ? 2 : 3);
    geometry.scale(1,.91,.86);
    faceDepth = .641;
  } else {
    geometry = new THREE.SphereGeometry(.72,low?32:48,low?24:36);
    const position = geometry.getAttribute("position");
    for (let i=0;i<position.count;i++) {
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i), upper=Math.max(0,y/.72);
      const taper=family === "lava" ? 1-upper*.39 : 1-upper*.15;
      const ridge=family === "metal" && preset.stem === "경" ? 1+.032*Math.cos(Math.atan2(z,x)*6) : 1;
      position.setXYZ(i,x*taper*ridge,y*(family==="lava"?1.14:.99),z*taper*.9*ridge);
    }
    geometry.computeVertexNormals();
    faceDepth = .65;
  }
  geometry.computeBoundingSphere();
  const bodyMesh = new THREE.Mesh(geometry,bodyMaterial);
  bodyMesh.name = "elemental-core";
  group.add(bodyMesh);

  const addMesh = (geo:THREE.BufferGeometry, parent=group, material=accentMaterial) => {
    const mesh=new THREE.Mesh(geo,material); parent.add(mesh); return mesh;
  };
  const animated: {mesh:THREE.Mesh; baseY:number; phase:number}[]=[];

  if (family === "forest") {
    const leafGeometry = new THREE.SphereGeometry(1,8,6);
    leafGeometry.scale(.095,.027,.045);
    const count=low?64:112;
    const leaves=new THREE.InstancedMesh(leafGeometry,accentMaterial,count);
    leaves.name="layered-individual-leaves";
    const transform=new THREE.Object3D();
    // Visible wood between eight sprays gives the canopy real negative space/depth.
    for(let branch=0;branch<8;branch++) {
      const angle=branch*Math.PI*.76;
      const tip=new THREE.Vector3(Math.cos(angle)*(.43+random()*.14),.62+random()*.5,Math.sin(angle)*.42);
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.38,0),tip.clone().multiplyScalar(.62).add(new THREE.Vector3(0,.16,0)),tip]);
      const limb=addMesh(new THREE.TubeGeometry(curve,8,.027,5,false),crown,bodyMaterial);
      limb.name="open-canopy-branch";
      const perBranch=count/8;
      for(let j=0;j<perBranch;j++) {
        const angle2=j*2.4+branch, radius=.06+random()*.2;
        transform.position.copy(tip).add(new THREE.Vector3(Math.cos(angle2)*radius,(random()-.5)*.22,Math.sin(angle2)*radius));
        transform.rotation.set((random()-.5)*.8,angle2,(random()-.5)*.7);
        transform.scale.setScalar(.7+random()*.8);
        transform.updateMatrix();leaves.setMatrixAt(branch*perBranch+j,transform.matrix);
      }
    }
    leaves.instanceMatrix.needsUpdate=true;
    leaves.computeBoundingSphere();
    crown.add(leaves);
    // Roots are organic points, not feet.
    for(let i=0;i<5;i++) {
      const angle=i*Math.PI*2/5;
      const direction=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
      const curve=new THREE.CatmullRomCurve3([
        direction.clone().multiplyScalar(.26).setY(-.49),
        direction.clone().multiplyScalar(.43).setY(-.67),
        direction.clone().multiplyScalar(.62).setY(-.74),
      ]);
      const rootGeometry=new THREE.TubeGeometry(curve,10,.065,6,false);
      const rootPosition=rootGeometry.getAttribute("position");
      for(let v=0;v<rootPosition.count;v++) {
        const u=Math.floor(v/7)/10, center=curve.getPointAt(u);
        const point=new THREE.Vector3().fromBufferAttribute(rootPosition,v).sub(center).multiplyScalar(1-u*.83).add(center);
        rootPosition.setXYZ(v,point.x,point.y,point.z);
      }
      rootGeometry.computeVertexNormals();
      const root=addMesh(rootGeometry,group,bodyMaterial);root.name="tapered-tree-root";
    }
  } else if (family === "lava") {
    for(let i=0;i<5;i++) {
      const h=i===0?.83:.43+random()*.22;
      const geo=new THREE.SphereGeometry(1,low?12:18,low?16:24);
      const pos=geo.getAttribute("position");
      for(let v=0;v<pos.count;v++) {
        const y=pos.getY(v), taper=(1-y)*.5;
        pos.setXYZ(v,pos.getX(v)*.12*taper+Math.pow((y+1)*.5,2)*.11,y*h*.5,pos.getZ(v)*.12*taper);
      }
      geo.computeVertexNormals();
      const flame=addMesh(geo,crown);
      const angle=i*2.4;
      flame.position.set(i===0?0:Math.cos(angle)*.34,.67+h*.32,i===0?-.13:Math.sin(angle)*.24);
      flame.rotation.z=i===0?-.13:Math.cos(angle)*-.32;
      flame.name="molten-flame-crown";
      animated.push({mesh:flame,baseY:flame.position.y,phase:i*1.6});
    }
  } else if (family === "water") {
    // Open wave crests stay behind the eyes and catch the same environment highlights.
    for(let i=0;i<2;i++) {
      const sign=i===0?-1:1;
      const curve=new THREE.CatmullRomCurve3([
        new THREE.Vector3(sign*.44,-.38,-.2), new THREE.Vector3(sign*.75,-.04,-.14),
        new THREE.Vector3(sign*.84,.35,-.2), new THREE.Vector3(sign*.66,.55,-.3),
        new THREE.Vector3(sign*.53,.38,-.35),
      ]);
      const wave=addMesh(new THREE.TubeGeometry(curve,low?20:32,.052,8,false),crown);
      wave.name="curling-water-crest";
      animated.push({mesh:wave,baseY:0,phase:i*Math.PI});
    }
    for(let i=0;i<4;i++) {
      const bead=addMesh(new THREE.SphereGeometry(.05+random()*.035,12,8),crown);
      bead.position.set((i%2?1:-1)*(.69+random()*.14),.47+random()*.35,-.16-random()*.24);
      bead.name="suspended-water-droplet";
      animated.push({mesh:bead,baseY:bead.position.y,phase:i});
    }
  } else if (family === "earth") {
    for(let i=0;i<3;i++) {
      const stone=addMesh(new THREE.IcosahedronGeometry(.19+i*.025,1),crown,bodyMaterial);
      stone.scale.set(1.1,.55,.72);
      stone.position.set((i-1)*.24,.7+(i===1?.12:0),-.08);
      stone.rotation.z=(i-1)*-.15;
      stone.name="layered-earthen-stone";
    }
    // Distinct terraced strata around the bottom, away from the face.
    for(let i=0;i<2;i++) {
      const band=addMesh(new THREE.TorusGeometry(.61-i*.025,.048,6,low?32:48),group,bodyMaterial);
      band.rotation.x=Math.PI/2;band.position.y=-.39-i*.14;band.scale.z=.88;
      band.name="soil-ceramic-stratum";
    }
  } else {
    for(let i=0;i<3;i++) {
      const metalGeo=preset.stem==="경"?new THREE.OctahedronGeometry(.16+i*.025,0):new THREE.SphereGeometry(.12+i*.023,16,12);
      const droplet=addMesh(metalGeo,crown,bodyMaterial);
      droplet.position.set((i-1)*.25,.76+(i===1?.15:0),-.08);
      droplet.scale.y=preset.stem==="경"?1.3:1.1;
      droplet.name=preset.stem==="경"?"titanium-crystal":"mercury-droplet";
      animated.push({mesh:droplet,baseY:droplet.position.y,phase:i});
    }
  }

  return {group,bodyMesh,faceDepth,crown,update(time:number){
    crown.rotation.z=family==="forest"?Math.sin(time*.8)*.018:0;
    for(const {mesh,baseY,phase} of animated) {
      mesh.position.y=baseY+Math.sin(time*(family==="lava"?1.8:.9)+phase)*.022;
    }
  }};
}
