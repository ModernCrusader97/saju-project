// QA-only: real source materials on the same original GLB and linked GPU field
// readback. Both passes use the same loader/face routing to isolate water relief.
import * as THREE from 'three';
import { loadApprovedSpirit } from '@water-loader';
import { createStemMaterial as beforeMaterial } from '@water-before';
import { createStemMaterial as afterMaterial } from '@water-after';
import { createStudioEnvironment } from '@water-environment';
const w=480,h=560,errors=[];
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true});
renderer.setSize(w,h);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.debug.onShaderError=(g,p,v,f)=>errors.push({program:g.getProgramInfoLog(p),vertex:g.getShaderInfoLog(v),fragment:g.getShaderInfoLog(f)});
document.body.style.cssText='margin:0;background:#edf2ea';document.body.append(renderer.domElement);
const scene=new THREE.Scene(),env=createStudioEnvironment(renderer);scene.environment=env.texture;scene.environmentIntensity=1.05;
scene.add(new THREE.HemisphereLight(0xf4f8fc,0x26343b,.85));
for(const [color,intensity,pos] of [[0xfff1d9,2.1,[-3,4,4]],[0xc1e4f0,.8,[4,1,2]],[0xf5fbff,1.8,[0,3,-3]]]){
  const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);
  if(pos[0]===-3){light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-2.5,right:2.5,top:3,bottom:-2,near:.1,far:16});light.shadow.bias=-.0002;}scene.add(light);
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({color:0x1c4836,opacity:.09}));floor.rotation.x=-Math.PI/2;floor.position.y=-.016;floor.receiveShadow=true;scene.add(floor);
const camera=new THREE.PerspectiveCamera(38,w/h,.1,40);camera.position.set(0,1.7,5.7);camera.lookAt(0,1.24,0);
const gl=renderer.getContext(),hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
let spirit,handles=[];
const make=(factory,quality)=>{
  const handle=factory('壬',quality,{coordinateMode:'character-rest',coordinateDensity:2.6});
  const prior=handle.material.onBeforeRender;
  handle.material.onBeforeRender=function(...a){prior.apply(this,a);const final=a[0].getRenderTarget()===null;if(this.premultipliedAlpha!==final){this.premultipliedAlpha=final;this.needsUpdate=true;}};
  return handle;
};
window.waterQA={
  async load(quality){spirit?.dispose();handles.forEach(h=>h.dispose());spirit=await loadApprovedSpirit('임신','병인',quality);scene.add(spirit.group);handles=[make(beforeMaterial,quality),make(afterMaterial,quality)];},
  async frame(version,time,angle=0,close=false){
    camera.position.set(0,close?1.3:1.7,close?3.3:5.7);camera.lookAt(-.15,close?1.3:1.24,0);
    spirit.reset();spirit.update(time,0,camera);spirit.avatarPivot.rotation.y=angle;
    const handle=handles[version];spirit.bodyMesh.material=handle.material;handle.update(time);renderer.render(scene,camera);
    const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const g=spirit.bodyMesh.geometry,attributes={};for(const n of ['position','normal','uv'])attributes[n]=await hash(g.attributes[n].array.buffer);
    const program=renderer.properties.get(handle.material).currentProgram.program,loc=gl.getUniformLocation(program,'uStemTime');
    return {png:renderer.domElement.toDataURL('image/png'),pixels:await hash(pixels),attributes,bodyMatrix:spirit.bodyMesh.matrixWorld.toArray(),morph:[...spirit.bodyMesh.morphTargetInfluences],materialTime:gl.getUniform(program,loc),camera:camera.matrixWorld.toArray(),depth:spirit.avatarPivot.scale.z,errors:[...errors],glError:gl.getError()};
  },
  async field(version,time){
    const handle=make(version?afterMaterial:beforeMaterial,'high'),original=handle.material.onBeforeCompile;
    handle.material.onBeforeCompile=shader=>{original(shader);
      shader.fragmentShader=shader.fragmentShader.replace('StemSurface stSurface(vec3 p,vec3 n) {','float qaBroad=0.;\nStemSurface stSurface(vec3 p,vec3 n) {');
      const match=shader.fragmentShader.match(/s\.height=([.\d]+)\*wave\+/);if(!match)throw new Error('Actual water height assignment missing');
      shader.fragmentShader=shader.fragmentShader.replace(match[0],`qaBroad=${match[1]}*wave;\n${match[0]}`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\ngl_FragColor=vec4(stemSurface.height,qaBroad/pow(max(uStemCoordinateDensity,1.0),.65),stemSurface.height-qaBroad/pow(max(uStemCoordinateDensity,1.0),.65),1.);');
    };
    const key=handle.material.customProgramCacheKey;handle.material.customProgramCacheKey=()=>key()+':qa-field';handle.material.toneMapped=false;handle.material.transmission=0;
    const fieldScene=new THREE.Scene(),body=spirit.bodyMesh.clone();body.material=handle.material;body.matrixAutoUpdate=false;body.matrix.copy(spirit.bodyMesh.matrixWorld);fieldScene.add(body);
    const target=new THREE.WebGLRenderTarget(w,h,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:true});
    handle.update(time);renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(fieldScene,camera);
    const pixels=new Float32Array(w*h*4);renderer.readRenderTargetPixels(target,0,0,w,h,pixels);renderer.setRenderTarget(null);
    const sample=[];for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>.5)sample.push([i/4,pixels[i],pixels[i+1],pixels[i+2]]);
    const result={sample,time,linkedShader:true,floatColorSupported:!!gl.getExtension('EXT_color_buffer_float'),errors:[...errors],glError:gl.getError()};target.dispose();handle.dispose();return result;
  },
  dispose(){handles.forEach(h=>h.dispose());spirit?.dispose();scene.environment=null;env.dispose();floor.geometry.dispose();floor.material.dispose();scene.children.filter(o=>o.isDirectionalLight).forEach(o=>o.shadow.dispose());renderer.dispose();renderer.forceContextLoss();}
};
