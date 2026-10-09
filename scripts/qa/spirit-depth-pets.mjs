import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const root=process.cwd(),output=path.join(root,'outputs/spirit-depth-pets/regression');
await fs.mkdir(output,{recursive:true});
const b=await fs.readFile('public/spirits/jade-v002/body.glb');
const jsonSize=b.readUInt32LE(12),gltf=JSON.parse(b.subarray(20,20+jsonSize).toString('utf8'));
const accessor=gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION],view=gltf.bufferViews[accessor.bufferView];
const start=28+jsonSize+(view.byteOffset??0)+(accessor.byteOffset??0);
const rawHash=crypto.createHash('sha256').update(b.subarray(start,start+accessor.count*3*4)).digest('hex');
await fs.writeFile(path.join(output,'harness.mjs'),`
import * as THREE from 'three';
import {loadApprovedSpirit} from '../../../lib/planet/approved-jade-spirit';
import {createElementalSpirit} from '../../../lib/planet/elemental-spirit';
import {createStudioEnvironment} from '../../../lib/planet/scene-environment';
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setSize(560,560);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
document.body.style.cssText='margin:0;background:#edf2ea';document.body.append(renderer.domElement);
const env=createStudioEnvironment(renderer);let current,activeScene,activeCamera;
const vector=v=>v.toArray();
window.spiritQA={async inspect(day='을축',month='병인',quality='high',legacy=false,angle=0){
 current?.dispose();current=legacy?createElementalSpirit(day,month,undefined,{quality}):await loadApprovedSpirit(day,month,quality);
 const pivot=current.avatarPivot??current.bodyMesh.parent;
 current.update(0,0);pivot.rotation.y=angle;
 const scene=new THREE.Scene();scene.environment=env.texture;scene.environmentIntensity=1.05;
 scene.add(current.group,new THREE.HemisphereLight(0xf4f8fc,0x26343b,.85));
 for(const [color,intensity,position] of [[0xfff1d9,2.1,[-3,4,4]],[0xc1e4f0,.8,[4,1,2]],[0xf5fbff,1.8,[0,3,-3]]]){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...position);scene.add(l);}
 const camera=new THREE.PerspectiveCamera(38,1,.1,40);camera.position.set(0,1.70,5.7);camera.lookAt(0,1.24,0);
 activeScene=scene;activeCamera=camera;renderer.render(scene,camera);current.group.updateMatrixWorld(true);
 // Precise bounds use the neutral vertices, rather than the GLB's union of all
 // dormant morph-target envelopes (which overstates its visible dimensions).
 const bodyBox=new THREE.Box3().setFromObject(current.bodyMesh,true),pet=current.zodiacPet??current.monthPet,petBox=new THREE.Box3().setFromObject(pet,true);
 const meshes=[],petEyes=[];pet.traverse(o=>{if(o.isMesh){meshes.push({name:o.name,color:o.material.color?.getHexString(),roughness:o.material.roughness,metalness:o.material.metalness,emission:o.material.emissive?.getHexString()});if(o.name.endsWith('-eye')){const p=o.getWorldPosition(new THREE.Vector3());const ray=new THREE.Raycaster(camera.position,p.clone().sub(camera.position).normalize());petEyes.push({name:o.name,firstHit:ray.intersectObject(pet,true)[0]?.object.name});}}});
 const faces=[];pivot.traverse(o=>{if(o.isMesh&&/gaze/.test(o.name)){const p=o.getWorldPosition(new THREE.Vector3()),box=new THREE.Box3().setFromObject(o);const ray=new THREE.Raycaster(new THREE.Vector3(p.x,p.y,3),new THREE.Vector3(0,0,-1));const hit=angle===0?ray.intersectObject(current.bodyMesh)[0]:null;faces.push({name:o.name,scale:vector(o.getWorldScale(new THREE.Vector3())),surfaceGap:hit?box.max.z-hit.point.z:null});}});
 const positions=current.bodyMesh.geometry.getAttribute('position').array;
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(positions.buffer,positions.byteOffset,positions.byteLength)))].map(v=>v.toString(16).padStart(2,'0')).join('');
 return {day,month,quality,legacy,angle,dimensions:vector(bodyBox.getSize(new THREE.Vector3())),localPositionHash:hash,bodyBox:{min:vector(bodyBox.min),max:vector(bodyBox.max)},petBox:{min:vector(petBox.min),max:vector(petBox.max)},petData:pet.userData,mapping:current.mapping,faces,petEyes,petMeshes:meshes,bodyMorphs:current.bodyMesh.morphTargetInfluences??[],pillarRoles:current.group.userData.pillarRoles,modelScale:vector(pivot.scale),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};
},portrait(){current.avatarPivot.visible=false;activeCamera.position.set(1.10,.60,2.0);activeCamera.lookAt(1.10,.32,.12);renderer.render(activeScene,activeCamera);},image(){return renderer.domElement.toDataURL();}};
`);
const server=await createServer({root,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:4188,strictPort:true},optimizeDeps:{noDiscovery:true},plugins:[{name:'spirit-regression',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/__spirit'){res.setHeader('Content-Type','text/html');res.end('<html><body><script type="module" src="/outputs/spirit-depth-pets/regression/harness.mjs"></script></body></html>');}else next();});}}]});
let browser;const checks=[],errors=[],results=[];
try{
 await server.listen();const origin=server.resolvedUrls.local[0];
 const {chromium}=await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH??path.join(root,'.sites-runtime/browser-qa/node_modules/playwright-core/index.mjs')).href);
 browser=await chromium.launch({executablePath:process.env.SAJU_QA_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:560,height:560}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(origin).origin?r.continue():r.abort());
 await page.goto(origin+'__spirit');await page.waitForFunction(()=>!!window.spiritQA);
 async function inspect(day,month,quality='high',legacy=false,angle=0){const result=await page.evaluate(args=>window.spiritQA.inspect(...args),[day,month,quality,legacy,angle]);results.push(result);return result;}
 const front=await inspect('을축','병인');
 await page.screenshot({path:path.join(output,'front.png')});
 assert(front.dimensions[2]>=1.20&&front.dimensions[2]<=1.40,'Front-to-back body depth must increase from the approved 0.951 to 1.20–1.40 without widening the front');
 assert(Math.abs(front.dimensions[0]-1.754512906)<1e-5);assert(Math.abs(front.dimensions[1]-2.384797894)<1e-5);
 assert.equal(front.localPositionHash,rawHash);assert(front.bodyMorphs.every(v=>v===0));checks.push('real body gains depth with original X/Y, mesh-local positions and neutral morphs preserved');
 assert(front.faces.length===2,'Both original gaze meshes remain present');for(const eye of front.faces)assert(eye.surfaceGap>=-.015&&eye.surfaceGap<=.10,'Eyes must remain attached to the thicker face: '+JSON.stringify(eye));checks.push('eyes remain attached to the body surface');
 for(const [name,angle] of [['oblique',Math.PI/4],['side',Math.PI/2]]){const r=await inspect('을축','병인','high',false,angle);assert(r.petBox.min[0]>r.bodyBox.max[0]+.035,'Pet must stay beside the avatar even when its body rotates: '+name);await page.screenshot({path:path.join(output,name+'.png')});}checks.push('front/oblique/side composition keeps the companion separate');
 const keys=['갑자','을축','갑인','을묘','갑진','을사','갑오','을미','갑신','을유','갑술','을해'];
 const animals=['rat','ox','tiger','rabbit','dragon','snake','horse','sheep','monkey','rooster','dog','pig'];
 const signatures=new Set();
 for(const quality of ['high','low'])for(const [i,key] of keys.entries()){
  const r=await inspect(key,'병인',quality);assert.equal(r.mapping.petBranch,key[1]);assert.equal(r.petData.branch,key[1]);assert.equal(r.petData.animal,animals[i]);assert.equal(r.petData.assetStatus,'procedural-placeholder');
  assert.equal(r.pillarRoles.body,'day-stem');assert.equal(r.pillarRoles.pet,'day-branch');assert.equal(r.pillarRoles.background,'month-pillar');
  assert(Math.abs(r.petBox.min[1])<.002,'Companion feet must meet the floor');assert(r.petBox.max[1]<.76&&r.petBox.max[1]>.30);assert(r.petBox.min[0]>r.bodyBox.max[0]+.035,'No avatar/pet overlap');
  assert(r.petMeshes.every(m=>m.roughness>=.6&&m.metalness===0&&(!m.emission||m.emission==='000000')),'Animal material must remain matte, distinct from elemental/glowing jade');
  assert(r.petEyes.length===2&&r.petEyes.every(e=>e.firstHit===e.name),'Companion eyes must face the viewer without being buried in their muzzle: '+key+' '+JSON.stringify(r.petEyes));
  if(quality==='high'){signatures.add(r.petMeshes.map(m=>m.name).sort().join('|'));await page.evaluate(()=>window.spiritQA.portrait());await page.screenshot({path:path.join(output,animals[i]+'.png')});}
 }
 assert.equal(signatures.size,12);checks.push('all 12 day branches have distinct matte animal placeholders in both qualities');
 const unchanged=await inspect('을축','경자');assert.equal(unchanged.petData.animal,'ox');assert.equal(unchanged.mapping.backgroundStem,'경');checks.push('changing the month affects background identity, not the day animal');
 const legacy=await inspect('을축','병인','low',true);assert.equal(legacy.petData.branch,'축');assert.equal(legacy.petData.animal,'ox');checks.push('legacy factory no longer creates the month elemental pet');
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'report.json'),JSON.stringify({status:'PASS',checks,errors,results,limits:['Chrome SwiftShader, not a physical device','Animals are explicitly temporary procedural geometry; no dedicated animal models were supplied']},null,2));console.log(JSON.stringify({status:'PASS',checks:checks.length,animals:12,qualities:2}));
}catch(error){await fs.writeFile(path.join(output,'report.json'),JSON.stringify({status:'FAIL',error:error.message,checks,errors,results},null,2));throw error;}
finally{await browser?.close();await server.close();}
