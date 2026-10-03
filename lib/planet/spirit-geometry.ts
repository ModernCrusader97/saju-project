import * as THREE from "three";
import { getSurfaceFamily, type GanziThemePreset } from "./theme-library";
import { hashSeed, seededRandom } from "./surface-math";

export type SpiritQuality = "low" | "high";
export interface SpiritGeometry {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  head: THREE.Group;
  faceDepth: number;
  crown: THREE.Group;
  eyeLeft: THREE.Mesh;
  eyeRight: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  update: (time: number, reaction?:number) => void;
}

/** Original adult-proportioned elemental avatar. Approximately five head-heights
 * tall, with a planted stance and continuous, fingerless element-shaped limbs. */
export function createSpiritGeometry(
  preset:GanziThemePreset, bodyMaterial:THREE.Material, accentMaterial:THREE.Material,
  quality:SpiritQuality="high",
):SpiritGeometry {
  const family=getSurfaceFamily(preset),low=quality==="low";
  const random=seededRandom(hashSeed(preset.stem+":avatar-form-v2"));
  const group=new THREE.Group();group.name=`elemental-avatar:${family}`;
  group.userData.proportions={headHeight:.72,bodyHeight:3.42,groundY:0};
  const upper=new THREE.Group();upper.name="breathing-upper-body";group.add(upper);
  const head=new THREE.Group();head.name="elemental-head";head.position.y=2.92;upper.add(head);
  const crown=new THREE.Group();crown.name="elemental-crown";head.add(crown);
  const shapeWidth=family==="earth"?1.08:family==="metal"?1.03:family==="lava"?.94:1;
  const sphere=(radius:number,segments=low?18:28)=>new THREE.SphereGeometry(radius,segments,Math.round(segments*.75));
  const mesh=(geometry:THREE.BufferGeometry,name:string,parent:THREE.Object3D=group,material=bodyMaterial)=>{
    const object=new THREE.Mesh(geometry,material);object.name=name;parent.add(object);return object;
  };
  const tube=(points:THREE.Vector3[],radius:number,endRadius:number,name:string,parent:THREE.Object3D=group,material=bodyMaterial,radiusAt?:(u:number)=>number)=>{
    const curve=new THREE.CatmullRomCurve3(points),segments=low?12:20,radial=low?8:12;
    const geometry=new THREE.TubeGeometry(curve,segments,radius,radial,false);
    const positions=geometry.getAttribute("position"),v=new THREE.Vector3();
    for(let i=0;i<positions.count;i++){
      const u=Math.floor(i/(radial+1))/segments,center=curve.getPointAt(u);
      v.fromBufferAttribute(positions,i).sub(center).multiplyScalar(radiusAt?radiusAt(u)/radius:1-u*(1-endRadius/radius)).add(center);
      positions.setXYZ(i,v.x,v.y,v.z);
    }
    geometry.computeVertexNormals();return mesh(geometry,name,parent,material);
  };

  // A shoulder/waist silhouette, rather than a spherical body with attached feet.
  const torsoProfile=[[0,1.28],[.30,1.30],[.33,1.5],[.285,1.76],[.31,2.01],[.415,2.28],[.33,2.40],[.155,2.49],[.13,2.64],[0,2.67]];
  const torsoCurve=new THREE.SplineCurve(torsoProfile.map(([r,y])=>new THREE.Vector2(r,y)));
  const torsoGeometry=new THREE.LatheGeometry(torsoCurve.getPoints(low?30:42).map(p=>new THREE.Vector2(Math.max(0,p.x)*shapeWidth,p.y)),low?32:48);
  torsoGeometry.scale(1,1,.63);
  if(family==="forest"){
    const p=torsoGeometry.getAttribute("position");
    for(let i=0;i<p.count;i++){const a=Math.atan2(p.getZ(i),p.getX(i));const r=1+.025*Math.sin(a*11+p.getY(i));p.setXYZ(i,p.getX(i)*r,p.getY(i),p.getZ(i)*r);}
    torsoGeometry.computeVertexNormals();
  }
  // A darkened surface of the same element reads as a simple high-neck tunic.
  // This is still the day-stem material, never another pillar or a skin palette.
  const garmentColors=new Float32Array(torsoGeometry.getAttribute("position").count*3).fill(.62);
  torsoGeometry.setAttribute("color",new THREE.BufferAttribute(garmentColors,3));
  if(bodyMaterial instanceof THREE.MeshStandardMaterial)bodyMaterial.vertexColors=true;
  const bodyMesh=mesh(torsoGeometry,"adult-elemental-torso",upper);

  // Long, subtly offset legs and low, flattened elemental feet keep the stance adult.
  for(const side of [-1,1]){
    const support=side<0,ankleX=support?-.25:.32;
    const points=support?[
      new THREE.Vector3(-.17,1.43,0),new THREE.Vector3(-.205,.91,-.02),new THREE.Vector3(-.235,.50,.025),new THREE.Vector3(ankleX,.14,.055),
    ]:[new THREE.Vector3(.17,1.41,0),new THREE.Vector3(.245,.88,.095),new THREE.Vector3(.30,.49,.035),new THREE.Vector3(ankleX,.14,-.015)];
    tube(points,.14*shapeWidth,.071,"elemental-leg",group,bodyMaterial,u=>{
      const thigh=.14-(Math.min(u,.48)/.48)*.044;
      const calf=Math.exp(-Math.pow((u-.69)/.15,2))*.026;
      return ((u<.48?thigh:.096-(u-.48)/.52*.025)+calf)*shapeWidth;
    });
    const footGeometry=sphere(.13,low?16:24);footGeometry.scale(.94,.65,1.7);
    const foot=mesh(footGeometry,"planted-elemental-foot");foot.position.set(ankleX,.086,support?.14:.08);foot.rotation.y=support?-.07:.21;
  }

  // Arms have a readable elbow gesture and a single cupped hand shape, no fingers.
  const arm=(side:number)=>{
    const pivot=new THREE.Group();pivot.name=side<0?"left-arm-gesture":"right-arm-gesture";
    pivot.position.set(side*.355*shapeWidth,2.30,0);upper.add(pivot);
    const welcoming=side>0;
    const points=welcoming?[
      new THREE.Vector3(0,0,0),new THREE.Vector3(side*.15,-.40,.02),new THREE.Vector3(side*.39,-.55,.25),
    ]:[new THREE.Vector3(0,0,0),new THREE.Vector3(side*.22,-.40,0),new THREE.Vector3(side*.11,-.75,.16)];
    tube(points,.115*shapeWidth,.071,"continuous-elemental-arm",pivot);
    const shoulder=mesh(sphere(.132*shapeWidth,low?16:24),"rounded-shoulder-transition",pivot);
    shoulder.scale.set(1,.96,.94);
    const end=points[2],handGeometry=sphere(.10,low?14:20);handGeometry.scale(.88,1.2,.59);
    const hand=mesh(handGeometry,"fingerless-element-hand",pivot);
    hand.position.copy(end);hand.rotation.z=welcoming?-side*.95:-side*.22;
    return pivot;
  };
  const leftArm=arm(-1),rightArm=arm(1);

  // An egg-shaped, gently tapered face. No skin color, protruding nose, lips or teeth.
  const headGeometry=sphere(1,low?28:40),headPos=headGeometry.getAttribute("position");
  for(let i=0;i<headPos.count;i++){
    const x=headPos.getX(i),y=headPos.getY(i),z=headPos.getZ(i),jaw=1-Math.max(0,-y)*.085;
    headPos.setXYZ(i,x*.352*jaw,y*.36,z*.265*(1-Math.max(0,-y)*.09));
  }
  headGeometry.computeVertexNormals();mesh(headGeometry,"expressive-element-head",head);

  const face=new THREE.Group();face.name="elemental-expression";head.add(face);
  const eyeWhite=new THREE.MeshBasicMaterial({color:0xd9ebe2});
  const ink=new THREE.MeshBasicMaterial({color:0x12252b});
  const glintMaterial=new THREE.MeshBasicMaterial({color:0xfaf9ed});
  const eyeShape=new THREE.Shape();
  eyeShape.moveTo(-.072,0);eyeShape.quadraticCurveTo(-.045,.052,.006,.042);eyeShape.quadraticCurveTo(.052,.041,.072,0);
  eyeShape.quadraticCurveTo(.046,-.031,0,-.030);eyeShape.quadraticCurveTo(-.05,-.032,-.072,0);
  const eyeGeometry=new THREE.ShapeGeometry(eyeShape,low?8:12);
  const makeEye=(side:number)=>{
    const eye=mesh(eyeGeometry,side<0?"left-expressive-eye":"right-expressive-eye",face,eyeWhite);
    eye.position.set(side*.126,.042,.253);eye.rotation.z=side*-.025;eye.rotation.y=side*.10;eye.scale.set(.91,.84,1);
    const iris=mesh(sphere(.024,low?12:16),"elemental-iris",eye,ink);iris.scale.set(.92,1.16,.27);iris.position.set(0,0,.012);
    const glint=mesh(sphere(.006,8),"eye-catchlight",iris,glintMaterial);glint.position.set(-.008,.010,.009);
    const browCurve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.073,.126,.249),new THREE.Vector3(0,.154,.259),new THREE.Vector3(.069,.124,.25));
    const brow=mesh(new THREE.TubeGeometry(browCurve,12,.009,5,false),"expressive-brow",face,ink);
    brow.position.x=side*.126;brow.rotation.z=side<0?-.025:.075;
    return eye;
  };
  const eyeLeft=makeEye(-1),eyeRight=makeEye(1);
  const smileCurve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.073,-.114,.244),new THREE.Vector3(.001,-.163,.246),new THREE.Vector3(.083,-.10,.242));
  mesh(new THREE.TubeGeometry(smileCurve,16,.008,5,false),"quiet-confident-smile",face,ink);

  if(family==="lava"){
    // Broad, overlapping molten lobes grow out of the head instead of separate horns.
    for(let i=0;i<3;i++){
      const geometry=sphere(1,low?18:28),p=geometry.getAttribute("position"),central=i===1;
      for(let v=0;v<p.count;v++){
        const y=p.getY(v),t=(y+1)*.5;
        p.setXYZ(v,p.getX(v)*(central?.29:.19)*(1-t*.67)+t*t*(central?.13:-.05),.19+t*(central?.65:.43),p.getZ(v)*(central?.22:.17)*(1-t*.45)-.035);
      }
      geometry.computeVertexNormals();
      const flame=mesh(geometry,"continuous-flame-surge",crown,accentMaterial);
      flame.position.x=(i-1)*.17;flame.position.z=i===1?-.035:-.015;
    }
    const crest=mesh(new THREE.ConeGeometry(.065,.21,8),"shoulder-flame-fold",upper,accentMaterial);
    crest.position.set(-.34,2.40,-.10);crest.rotation.z=.55;
  } else if(family==="water"){
    const geometry=sphere(1,low?24:36),p=geometry.getAttribute("position");
    for(let v=0;v<p.count;v++){
      const y=p.getY(v),t=(y+1)*.5;
      p.setXYZ(v,p.getX(v)*.33*(1-t*.38)-t*t*.12,.19+t*.40,p.getZ(v)*.23-t*t*.22);
    }
    geometry.computeVertexNormals();mesh(geometry,"continuous-swept-water-crest",crown,accentMaterial);
    tube([new THREE.Vector3(-.39,2.3,-.08),new THREE.Vector3(-.25,2.46,-.18),new THREE.Vector3(.05,2.40,-.2)],.043,.025,"water-shoulder-current",upper,accentMaterial);
  } else if(family==="forest"){
    const leafGeometry=sphere(1,8);leafGeometry.scale(.075,.019,.038);
    const count=low?40:64,leaves=new THREE.InstancedMesh(leafGeometry,accentMaterial,count);leaves.name="layered-individual-leaves";
    const transform=new THREE.Object3D();
    for(let branch=0;branch<4;branch++){
      const sign=branch%2?-1:1,tip=new THREE.Vector3(sign*(.21+branch*.025),.39+(branch%2)*.08,-.08-(branch>>1)*.12);
      tube([new THREE.Vector3(sign*.08,.26,-.08),tip.clone().multiplyScalar(.8),tip],.023,.012,"open-canopy-branch",crown,bodyMaterial);
      for(let j=0;j<count/4;j++){
        const a=j*2.4,r=.04+random()*.12;
        transform.position.copy(tip).add(new THREE.Vector3(Math.cos(a)*r,(random()-.5)*.10,Math.sin(a)*r));
        transform.rotation.set((random()-.5)*.6,a,(random()-.5)*.6);transform.scale.setScalar(.75+random()*.6);transform.updateMatrix();
        leaves.setMatrixAt(branch*count/4+j,transform.matrix);
      }
    }
    leaves.instanceMatrix.needsUpdate=true;leaves.computeBoundingSphere();crown.add(leaves);
    // Leaf collar, rather than a whole green body.
    for(const side of [-1,1]){
      const collar=mesh(sphere(1,12),"leaf-shoulder-mantle",upper,accentMaterial);collar.scale.set(.21,.055,.12);collar.position.set(side*.27,2.41,-.005);collar.rotation.z=side*-.3;
    }
  } else if(family==="earth"){
    for(let i=0;i<3;i++){
      const stone=mesh(new THREE.IcosahedronGeometry(.11,1),"terracotta-crown-stratum",crown,accentMaterial);
      stone.position.set((i-1)*.17,.35+(i===1?.06:0),-.06);stone.scale.set(1.1,.6,.7);
    }
  } else {
    for(let i=0;i<3;i++){
      const geo=preset.stem==="경"?new THREE.OctahedronGeometry(.10,0):sphere(.082,low?14:20);
      const shard=mesh(geo,preset.stem==="경"?"titanium-crest":"mercury-crest",crown,accentMaterial);
      shard.position.set((i-1)*.15,.36+(i===1?.055:0),-.08);shard.scale.y=1.3;
    }
  }

  const update=(time:number,reaction=0)=>{
    upper.position.y=Math.sin(time*1.25)*.007;
    upper.rotation.y=Math.sin(time*.51)*.018;upper.rotation.z=-.019+Math.sin(time*.69)*.006;upper.position.x=-.012;
    head.rotation.z=.012+Math.sin(time*.67)*.012-reaction*.025;
    head.rotation.x=Math.sin(time*.85)*.01+reaction*.045;
    leftArm.rotation.z=Math.sin(time*.9)*.018;
    rightArm.rotation.z=-Math.sin(time*.86)*.02+reaction*.10;
    rightArm.rotation.x=Math.sin(time*.72)*.016-reaction*.06;
    const blinkPhase=time%5.4,blink=blinkPhase>5.16?1-Math.sin((blinkPhase-5.16)/.24*Math.PI)*.88:1;
    eyeLeft.scale.y=eyeRight.scale.y=.84*blink;
    crown.rotation.z=family==="forest"?Math.sin(time*.7)*.015:0;
  };
  update(0);
  return {group,bodyMesh,head,faceDepth:.253,crown,eyeLeft,eyeRight,leftArm,rightArm,update};
}
