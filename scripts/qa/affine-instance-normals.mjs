// Regression for the exact grain transforms under the approved B depth1.35.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const root=process.cwd(),require=createRequire(import.meta.url);
const runtime=require('./load-ts.cjs').createLoader({three:THREE});
const {bindCharacterRestCoordinates}=runtime.load('lib/planet/character-rest-coordinates.ts');
const {createSurfaceFissureSand}=runtime.load('lib/planet/surface-fissure-sand.ts');
const output=path.join(root,'outputs/affine-instance-normals'),observations=[];
await fs.mkdir(output,{recursive:true});
const bytes=await fs.readFile('public/spirits/jade-v002/body.glb');
const loader=new GLTFLoader().register(()=>({name:'CPU_IMAGE_IO_ONLY',loadTexture:async()=>new THREE.Texture()}));
const model=(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
const owner=new THREE.Group();model.position.x=-.42;model.scale.z=1.35;owner.add(model);
let body;model.traverse(object=>{if(object.isMesh&&object.geometry.attributes.position.count===33207)body=object;});
assert(body);body.morphTargetInfluences.fill(0);const binding=bindCharacterRestCoordinates(owner,[body]);
function productionNormalMode(material){
 const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:'',uniforms:{}};
 material.onBeforeCompile(shader,{});
 const cofactor=shader.vertexShader.includes('mat3 cofactors = mat3(cross(im[1], im[2])');
 if(cofactor)assert(!/transformedNormal \/= vec3\( dot\( im\[ 0 \]/.test(shader.vertexShader));
 return cofactor?'affine-cofactor':'stock-scale-shortcut';
}
function shaderNormal(instance,parent,normal,mode){
 const linear=new THREE.Matrix3().setFromMatrix4(instance),e=linear.elements;
 const result=normal.clone();
 if(mode==='affine-cofactor'){
  const x=new THREE.Vector3(e[0],e[1],e[2]),y=new THREE.Vector3(e[3],e[4],e[5]),z=new THREE.Vector3(e[6],e[7],e[8]);
  const a=new THREE.Vector3().crossVectors(y,z),b=new THREE.Vector3().crossVectors(z,x),c=new THREE.Vector3().crossVectors(x,y);
  result.set(a.x*normal.x+b.x*normal.y+c.x*normal.z,a.y*normal.x+b.y*normal.y+c.y*normal.z,a.z*normal.x+b.z*normal.y+c.z*normal.z);
  if(x.dot(a)<0)result.negate();
 }else{
  result.x/=e[0]**2+e[1]**2+e[2]**2;result.y/=e[3]**2+e[4]**2+e[5]**2;result.z/=e[6]**2+e[7]**2+e[8]**2;
  result.applyMatrix3(linear);
 }
 return result.applyMatrix3(new THREE.Matrix3().getNormalMatrix(parent)).normalize();
}
const error=(a,b)=>THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(a.dot(b),-1,1)));
let failure;
try{
 for(const quality of ['low','high']){
  const effect=createSurfaceFissureSand({meshes:[body],quality,allowMorphTargets:true});model.add(effect.group);
  try{
   const grains=effect.group.getObjectByName('ActualSurfaceFissureSand'),mode=productionNormalMode(grains.material);
   const instance=new THREE.Matrix4(),world=new THREE.Matrix4(),normal=new THREE.Vector3();let maximum=0,stockMaximum=0,samples=0;
   const angles=[];
   for(let frame=0;frame<160;frame++){
    effect.update(frame/40);grains.updateWorldMatrix(true,false);
    for(let i=0;i<grains.count;i++){
     grains.getMatrixAt(i,instance);if(Math.abs(instance.determinant())<1e-14)continue;
     world.copy(grains.matrixWorld).multiply(instance);const expectedTransform=new THREE.Matrix3().getNormalMatrix(world);
     for(let vertex=0;vertex<grains.geometry.attributes.normal.count;vertex++){
      normal.fromBufferAttribute(grains.geometry.attributes.normal,vertex);const expected=normal.clone().applyMatrix3(expectedTransform).normalize();
      const actual=shaderNormal(instance,grains.matrixWorld,normal,mode),stock=shaderNormal(instance,grains.matrixWorld,normal,'stock-scale-shortcut');
      const angle=error(actual,expected);maximum=Math.max(maximum,angle);stockMaximum=Math.max(stockMaximum,error(stock,expected));samples++;
      if(quality==='high'&&frame===70&&i===8&&vertex===18)angles.push({time:frame/40,instance:i,vertex,productionErrorDegrees:angle,stockErrorDegrees:error(stock,expected)});
     }
    }
   }
   observations.push({quality,mode,samples,maximumErrorDegrees:maximum,negativeControlStockMaximumDegrees:stockMaximum,exactRegression:angles});
   assert(stockMaximum>15,'The actual shipped depth/shear must reproduce the wrong stock normal as a negative control');
   assert(maximum<.0001,quality+': production normal must equal the inverse transpose of the complete rendered transform');
  }finally{effect.dispose();}
 }
 // The same hook must support arbitrary affine/mirrored instance matrices.
 const effect=createSurfaceFissureSand({meshes:[body],quality:'low'});
 try{
  const mode=productionNormalMode(effect.group.children[0].material),instance=new THREE.Matrix4().set(-.8,.2,.3,0, .1,1.2,.4,0, .15,-.2,1.1,0, 0,0,0,1);
  const parent=new THREE.Matrix4().makeScale(1.1,.9,1.35),world=parent.clone().multiply(instance),transform=new THREE.Matrix3().getNormalMatrix(world);
  for(const values of [[1,0,0],[0,1,0],[0,0,1],[.4,.5,.7]]){
   const normal=new THREE.Vector3(...values).normalize(),expected=normal.clone().applyMatrix3(transform).normalize();
   assert(error(shaderNormal(instance,parent,normal,mode),expected)<.0001);
  }
 }finally{effect.dispose();}
}catch(e){failure=e;process.exitCode=1;}
finally{
 binding.dispose();
 const report={status:failure?'FAIL':'PASS',threeRevision:THREE.REVISION,presentationDepth:1.35,method:'Actual production onBeforeCompile hook and installed Three ShaderChunk normal formula; actual real-B rendered grain instance matrices',observations,error:failure?.message,limits:['CPU emulation of the exact installed shader math; separate actual WebGL shader/render checks required','No geometry, particle matrix or color changes']};
 await fs.writeFile(path.join(output,(process.env.SAJU_QA_PHASE==='before'?'before':'after')+'.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
if(failure)throw failure;
