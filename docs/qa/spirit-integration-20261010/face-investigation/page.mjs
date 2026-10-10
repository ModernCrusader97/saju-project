import * as THREE from 'three';
import { loadApprovedSpirit } from '@face-loader';
import { createStudioEnvironment } from '@face-environment';

const width=640,height=760,errors=[],passes=[],frames=new Map();
const renderer=new THREE.WebGLRenderer({antialias:new URLSearchParams(location.search).get('antialias')!=='false',alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true});
renderer.setSize(width,height);renderer.setPixelRatio(1);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.debug.onShaderError=(g,p,v,f)=>errors.push({program:g.getProgramInfoLog(p),vertex:g.getShaderInfoLog(v),fragment:g.getShaderInfoLog(f)});
document.body.style.cssText='margin:0;background:#edf2ea';document.body.append(renderer.domElement);
const gl=renderer.getContext(),scene=new THREE.Scene(),env=createStudioEnvironment(renderer);
scene.environment=env.texture;scene.environmentIntensity=1.05;
scene.add(new THREE.HemisphereLight(0xf4f8fc,0x26343b,.85));
const key=new THREE.DirectionalLight(0xfff1d9,2.1);key.position.set(-3,4,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
Object.assign(key.shadow.camera,{left:-2.5,right:2.5,top:3,bottom:-2,near:.1,far:16});key.shadow.bias=-.0002;scene.add(key);
for(const[color,intensity,position]of[[0xc1e4f0,.8,[4,1,2]],[0xf5fbff,1.8,[0,3,-3]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({color:0x1c4836,opacity:.09}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.016;ground.receiveShadow=true;scene.add(ground);
const camera=new THREE.PerspectiveCamera(38,width/height,.1,40);
const faceNames=/almond_gaze|small_eye_glint|expressive_brow|quiet_smile/;
let spirit,faces=[],defaults=new Map(),day,quality,clock=0,originalBody={},faceMaterials=new Set();
const hash=async a=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength)))].map(v=>v.toString(16).padStart(2,'0')).join('');
const nativeUniform=(program,name)=>{const p=renderer.properties.get(program).currentProgram?.program;if(!p)return null;const location=gl.getUniformLocation(p,name);if(!location)return null;const value=gl.getUniform(p,location);return ArrayBuffer.isView(value)?[...value]:value;};
function optics(){spirit.group.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.isMeshPhysicalMaterial&&m.transmission>0){const previous=m.onBeforeRender;m.onBeforeRender=function(...args){previous.apply(this,args);const final=args[0].getRenderTarget()===null;if(this.premultipliedAlpha!==final){this.premultipliedAlpha=final;this.needsUpdate=true;}};}});}
function fullCamera(close=false,angle=0){if(close){camera.position.set(-.42,1.84,2.45);camera.lookAt(-.42,1.76,.55);}else{camera.position.set(0,1.7,5.7);camera.lookAt(0,1.24,0);}camera.updateMatrixWorld();spirit.avatarPivot.rotation.set(0,angle,0);}
function restore(){renderer.shadowMap.enabled=true;scene.environment=env.texture;scene.environmentIntensity=1.05;ground.visible=true;
for(const[o,d]of defaults){o.castShadow=d.castShadow;o.receiveShadow=d.receiveShadow;o.visible=d.visible;}
for(const[m,d]of faceMaterials){m.transparent=d.transparent;m.forceSinglePass=d.forceSinglePass;m.colorWrite=d.colorWrite;m.depthWrite=d.depthWrite;m.needsUpdate=true;}
const m=spirit.bodyMesh.material;m.transmission=originalBody.transmission;m.thickness=originalBody.thickness;m.needsUpdate=true;}
function apply(mode){restore();
if(mode==='shadow-off')renderer.shadowMap.enabled=false;
if(mode==='face-caster-off')for(const f of faces)f.castShadow=false;
if(mode==='body-receive-on')spirit.bodyMesh.receiveShadow=true;
if(mode==='transmission-zero')spirit.bodyMesh.material.transmission=0;
if(mode==='thickness-zero')spirit.bodyMesh.material.thickness=0;
if(mode==='face-after-transmission')for(const[m]of faceMaterials){m.transparent=true;m.needsUpdate=true;}
if(mode==='face-after-transmission-single')for(const[m]of faceMaterials){m.transparent=true;m.forceSinglePass=true;m.needsUpdate=true;}
if(mode==='face-after-transmission-water'&&(day.startsWith('임')||day.startsWith('계')))for(const[m]of faceMaterials){m.transparent=true;m.forceSinglePass=true;m.needsUpdate=true;}
if(mode==='face-exclude-offscreen')for(const[m]of faceMaterials){m.transparent=false;m.needsUpdate=true;}
if(mode==='environment-off'){scene.environment=null;scene.environmentIntensity=0;}
if(mode==='face-hidden')for(const f of faces)f.visible=false;
scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.needsUpdate=true;});
}
function projectBounds(mesh){const bounds=new THREE.Box3().setFromObject(mesh),min=[Infinity,Infinity],max=[-Infinity,-Infinity];
for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);const sx=(p.x*.5+.5)*gl.drawingBufferWidth,sy=(-p.y*.5+.5)*gl.drawingBufferHeight;min[0]=Math.min(min[0],sx);min[1]=Math.min(min[1],sy);max[0]=Math.max(max[0],sx);max[1]=Math.max(max[1],sy);}return{min,max};}
async function inspect(mode,time,close,angle){const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);frames.set(mode,{pixels,width:gl.drawingBufferWidth,height:gl.drawingBufferHeight});
const meshes=[],geometryHashes={},seen=new Set();spirit.avatarPivot.traverse(o=>{if(!o.isMesh||!defaults.has(o))return;
meshes.push({name:o.name,castShadow:o.castShadow,receiveShadow:o.receiveShadow,visible:o.visible,position:o.position.toArray(),scale:o.scale.toArray(),matrix:o.matrixWorld.toArray(),bounds:projectBounds(o),material:(Array.isArray(o.material)?o.material:[o.material]).map(m=>({name:m.name,type:m.type,transparent:m.transparent,side:m.side,forceSinglePass:m.forceSinglePass,opacity:m.opacity,colorWrite:m.colorWrite,depthWrite:m.depthWrite,transmission:m.transmission??0,thickness:m.thickness??0}))});});
for(const mesh of[spirit.bodyMesh,...faces]){if(seen.has(mesh.geometry))continue;seen.add(mesh.geometry);const attrs={};for(const[name,a]of Object.entries(mesh.geometry.attributes))attrs[name]=await hash(a.array);if(mesh.geometry.index)attrs.index=await hash(mesh.geometry.index.array);geometryHashes[mesh.name]=attrs;}
return{day,quality,mode,time,close,angle,pixelRatio:renderer.getPixelRatio(),size:[gl.drawingBufferWidth,gl.drawingBufferHeight],pixels:await hash(pixels),png:renderer.domElement.toDataURL('image/png'),meshes,geometryHashes,bodyMorphs:[...spirit.bodyMesh.morphTargetInfluences],bodyNativeTime:nativeUniform(spirit.bodyMesh.material,'uStemTime'),bodyNativeReceiveShadow:nativeUniform(spirit.bodyMesh.material,'receiveShadow'),groundNativeReceiveShadow:nativeUniform(ground.material,'receiveShadow'),groundLinkedShadowMap:(renderer.properties.get(ground.material).currentProgram?.fragmentShader?gl.getShaderSource(renderer.properties.get(ground.material).currentProgram.fragmentShader).includes('#define USE_SHADOWMAP'):null),bodyNativeTransmission:nativeUniform(spirit.bodyMesh.material,'transmission'),bodyNativeThickness:nativeUniform(spirit.bodyMesh.material,'thickness'),bodyNativeTransmissionSampler:nativeUniform(spirit.bodyMesh.material,'transmissionSamplerMap'),bodyNativeTransmissionSize:nativeUniform(spirit.bodyMesh.material,'transmissionSamplerSize'),camera:{position:camera.position.toArray(),world:camera.matrixWorld.toArray(),projection:camera.projectionMatrix.toArray()},shadows:{enabled:renderer.shadowMap.enabled,type:renderer.shadowMap.type,keyCast:key.castShadow,mapSize:key.shadow.mapSize.toArray(),bias:key.shadow.bias,groundReceive:ground.receiveShadow},passes:[...passes],errors:[...errors],glError:gl.getError(),webgl:{version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR)},draws:renderer.info.render.calls};}
let currentMode,transmissionTarget=null;
window.faceQA={
async load(d,q='high'){spirit?.dispose();day=d;quality=q;spirit=await loadApprovedSpirit(d,'병인',q);optics();scene.add(spirit.group);defaults=new Map();faces=[];faceMaterials=new Map();
spirit.avatarPivot.traverse(o=>{if(!o.isMesh)return;defaults.set(o,{castShadow:o.castShadow,receiveShadow:o.receiveShadow,visible:o.visible});if(faceNames.test(o.name)){faces.push(o);for(const m of Array.isArray(o.material)?o.material:[o.material])if(!faceMaterials.has(m)){faceMaterials.set(m,{transparent:m.transparent,forceSinglePass:m.forceSinglePass,colorWrite:m.colorWrite,depthWrite:m.depthWrite});const previous=m.onBeforeRender;m.onBeforeRender=function(...args){previous.apply(this,args);if(currentMode==='face-exclude-offscreen'){const final=args[0].getRenderTarget()===null;this.colorWrite=final;this.depthWrite=final;}};}
const previous=o.onAfterRender;o.onAfterRender=function(...args){previous.apply(this,args);const target=args[0].getRenderTarget();if(target)transmissionTarget=target;const p=renderer.properties.get(args[4]).currentProgram?.program;passes.push({mesh:this.name,target:target?{id:target.uuid,width:target.width,height:target.height,type:target.texture.type,colorSpace:target.texture.colorSpace}:null,material:args[4].name,transparent:args[4].transparent,colorWrite:args[4].colorWrite,depthWrite:args[4].depthWrite,linkedReceiveShadow:p?nativeUniform(args[4],'receiveShadow'):null});};}});
originalBody={transmission:spirit.bodyMesh.material.transmission,thickness:spirit.bodyMesh.material.thickness};key.shadow.mapSize.set(q==='low'?512:1024,q==='low'?512:1024);clock=0;return{day,quality,faceNames:faces.map(o=>o.name),bodyReceiveShadow:spirit.bodyMesh.receiveShadow,bodyMaterial:originalBody};},
async frame(mode='original',time=0,close=false,angle=0,ratio=1){currentMode=mode;apply(mode);renderer.setPixelRatio(ratio);fullCamera(close,angle);spirit.reset();spirit.avatarPivot.rotation.set(0,angle,0);clock=0;
while(clock+.05<time-1e-10){clock+=.05;spirit.update(clock,0,camera);}spirit.update(time,0,camera);clock=time;passes.length=0;renderer.render(scene,camera);return inspect(mode,time,close,angle);},
compare(a,b,rect=null){const first=frames.get(a),second=frames.get(b);if(first.width!==second.width||first.height!==second.height)throw Error('Matched size required');let changedPixels=0,maxChannelDelta=0,totalDelta=0;const area=rect||[0,0,first.width,first.height];for(let y=Math.max(0,Math.floor(area[1]));y<Math.min(first.height,Math.ceil(area[3]));y++)for(let x=Math.max(0,Math.floor(area[0]));x<Math.min(first.width,Math.ceil(area[2]));x++){const i=((first.height-y-1)*first.width+x)*4;let changed=false;for(let c=0;c<4;c++){const d=Math.abs(first.pixels[i+c]-second.pixels[i+c]);changed||=d>0;totalDelta+=d;maxChannelDelta=Math.max(maxChannelDelta,d);}if(changed)changedPixels++;}return{changedPixels,maxChannelDelta,totalDelta,rect:area};},
async transmission(){if(!transmissionTarget)return null;const rt=transmissionTarget,array=rt.texture.type===THREE.HalfFloatType?new Uint16Array(rt.width*rt.height*4):new Uint8Array(rt.width*rt.height*4);renderer.readRenderTargetPixels(rt,0,0,rt.width,rt.height,array);const bytes=new Uint8ClampedArray(array.length);for(let i=0;i<array.length;i++){const linear=rt.texture.type===THREE.HalfFloatType?THREE.DataUtils.fromHalfFloat(array[i]):array[i]/255;const display=(i%4===3?linear:THREE.ColorManagement.workingToColorSpace(new THREE.Color(linear,linear,linear),THREE.SRGBColorSpace).r);bytes[i]=Math.max(0,Math.min(255,Math.round(display*255)));}const flipped=new Uint8ClampedArray(bytes.length);for(let y=0;y<rt.height;y++)flipped.set(bytes.subarray((rt.height-y-1)*rt.width*4,(rt.height-y)*rt.width*4),y*rt.width*4);const canvas=document.createElement('canvas');canvas.width=rt.width;canvas.height=rt.height;canvas.getContext('2d').putImageData(new ImageData(flipped,rt.width,rt.height),0,0);return{width:rt.width,height:rt.height,type:rt.texture.type,colorSpace:rt.texture.colorSpace,pixels:await hash(array),png:canvas.toDataURL('image/png'),glError:gl.getError()};},
dispose(){spirit?.dispose();scene.environment=null;env.dispose();ground.geometry.dispose();ground.material.dispose();key.shadow.dispose();renderer.dispose();renderer.forceContextLoss();return{errors,glError:gl.getError()};}
};
