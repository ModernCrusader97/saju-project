
import * as THREE from 'three';
import {loadApprovedSpirit} from '/lib/planet/approved-jade-spirit';
import {createStudioEnvironment} from '/lib/planet/scene-environment';
import {createSpiritFashion} from '/@fs/workspace/saju-spirit-fashion-dew-water-20261010/lib/planet/spirit-fashion.ts';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(560,640);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.style.cssText='margin:0;background:#edf2ea';document.body.append(renderer.domElement);
const scene=new THREE.Scene(),environment=createStudioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=1.05;scene.background=new THREE.Color('#edf2ea');
scene.add(new THREE.HemisphereLight(0xf4f8fc,0x26343b,.85));
for(const [color,intensity,pos]of [[0xfff1d9,2.1,[-3,4,4]],[0xc1e4f0,.8,[4,1,2]],[0xf5fbff,1.8,[0,3,-3]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);if(pos[0]===-3){light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-2.5,right:2.5,top:3,bottom:-2,near:.1,far:16});light.shadow.bias=-.0002;}scene.add(light);}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({color:0x1c4836,opacity:.09}));floor.rotation.x=-Math.PI/2;floor.position.y=-.016;floor.receiveShadow=true;scene.add(floor);
const camera=new THREE.PerspectiveCamera(38,560/640,.1,40);camera.position.set(0,1.7,5.4);camera.lookAt(-.05,1.24,0);
const errors=[];renderer.debug.onShaderError=(gl,p,v,f)=>errors.push({program:gl.getProgramInfoLog(p),vertex:gl.getShaderInfoLog(v),fragment:gl.getShaderInfoLog(f)});
let spirit,fashion;const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
const v=new THREE.Vector3();
async function metadata(){const body=spirit.bodyMesh,g=body.userData.approvedSpiritGreeting,gl=renderer.getContext(),pixels=new Uint8Array(560*640*4);gl.readPixels(0,0,560,640,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
const hand=new THREE.Vector3();for(const id of g.handVertexIDs)hand.add(body.getVertexPosition(id,v));hand.multiplyScalar(1/g.handVertexIDs.length);
const supports=fashion.group.userData.diagnostics.triangleSupports;return{pixels:await hash(pixels),hand:hand.toArray(),greeting:structuredClone(g),morphs:[...body.morphTargetInfluences],fashionSupports:supports,bodyPositionSHA256:await hash(body.geometry.attributes.position.array),normalSHA256:await hash(body.geometry.attributes.normal.array),uvSHA256:await hash(body.geometry.attributes.uv.array),shadowCaster:body.castShadow,presentationDepth:spirit.avatarPivot.scale.z,errors,glError:gl.getError(),triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls};}
window.raisedWaveQA={async load(day){fashion?.dispose();spirit?.dispose();spirit=await loadApprovedSpirit(day,'병인','high');scene.add(spirit.group);spirit.reset();const model=spirit.bodyMesh.parent;fashion=createSpiritFashion({body:spirit.bodyMesh,model,eyes:[spirit.eyeLeft,spirit.eyeRight],stem:day.charAt(0),quality:'high',presentationDepth:1.35});fashion.set({head:'sprout-pin',face:null,neck:'ribbon-bow',back:'leaf-brooch'});spirit.update(0,0,camera);fashion.update();renderer.render(scene,camera);return metadata();},
async frame(time,angle=0){spirit.avatarPivot.rotation.y=angle;spirit.update(time,0,camera);fashion.update();renderer.render(scene,camera);return metadata();},
trigger(){spirit.triggerReaction();},async reset(){spirit.reset();fashion.update();renderer.render(scene,camera);return metadata();},
dispose(){fashion?.dispose();spirit?.dispose();fashion=spirit=null;renderer.render(scene,camera);return{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};}};
