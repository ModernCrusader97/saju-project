import * as THREE from 'three';

export interface ImWaterStudyOptions { quality?: 'low' | 'medium' | 'high' }
export interface ImWaterStudyHandle {
  material: THREE.MeshPhysicalMaterial;
  update(seconds: number): void;
  dispose(): void;
}

/** Public for exact native diagnostics, not a second shading implementation. */
export const IM_WATER_STUDY_FIELD = /* glsl */ `
uniform float uImTime;
varying vec3 vImRest;
varying vec3 vImRestNormal;
varying vec3 vImViewNormal;
float imHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float imNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(imHash(i),imHash(i+vec3(1,0,0)),f.x),mix(imHash(i+vec3(0,1,0)),imHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(imHash(i+vec3(0,0,1)),imHash(i+vec3(1,0,1)),f.x),mix(imHash(i+vec3(0,1,1)),imHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 imFlow(vec3 p){
 // One common upward flow; coarse folds and fine breakup use this same frame.
 p.y-=uImTime*.23;
 p.x+=.12*sin(p.y*2.7+p.z*2.3);
 p.z+=.09*sin(p.y*3.1-p.x*2.1);
 return p;
}
float imCurrent(vec3 q){
 float warp=imNoise(q*vec3(2.4,.85,2.4)+vec3(1.7,4.1,8.9));
 // Transverse phase with slowly bending longitudinal shear makes open,
 // elongated currents instead of isotropic closed-cell contours.
 float coarse=sin(q.x*10.2+q.z*7.4+q.y*5.4+2.2*sin(q.y*2.0+q.x*.8)+warp*1.4);
 float fine=sin(q.x*26.0+q.z*20.0+q.y*11.0+3.2*sin(q.y*2.2+q.z*.6)+warp*1.4);
 return clamp(.5+.29*coarse+.21*fine,0.,1.);
}
vec3 imViewRest(vec3 viewDirection,vec3 viewNormal){
 vec3 vx=dFdx(-vViewPosition),rx=dFdx(vImRest);
 vec3 vn=normalize(viewNormal),rn=normalize(vImRestNormal);
 vx-=vn*dot(vx,vn);rx-=rn*dot(rx,rn);
 if(dot(vx,vx)<1.e-12||dot(rx,rx)<1.e-12)return rn;
 vx=normalize(vx);rx=normalize(rx);
 vec3 vy=normalize(cross(vn,vx)),ry=normalize(cross(rn,rx));
 return normalize(rx*dot(viewDirection,vx)+ry*dot(viewDirection,vy)+rn*dot(viewDirection,vn));
}
struct ImWaterField {vec3 color;float height;float foam;float roughness;float interior;};
ImWaterField imWater(vec3 p,vec3 restNormal,vec3 viewInRest,float facing){
 // The requested density is retained in common rest units, never restarted per limb.
 vec3 q=imFlow(p*2.6);
 float front=imCurrent(q);
 vec3 ray=normalize(mix(-restNormal,-viewInRest,.63));
 // Bounded three-sample interior-flow approximation. Camera parallax changes
 // sampled depths; no lights or environment highlights are painted into color.
 float middle=imCurrent(imFlow((p+ray*.047)*2.6));
 float deep=imCurrent(imFlow((p+ray*.105)*2.6));
 float inside=front*.19+middle*.34+deep*.47;
 float depth=.055+.225*clamp(facing,0.,1.);
 vec3 absorption=exp(-vec3(5.8,1.4,.55)*depth);
 vec3 blue=mix(vec3(.020,.115,.25),vec3(.060,.49,.64),smoothstep(.17,.83,inside));
 blue*=mix(vec3(.64),absorption,.72);
 float broad=imNoise(q*vec3(1.3,.7,1.3)+vec3(8.1,2.6,1.4));
 float phase=q.x*10.2+q.z*7.4+q.y*5.4+2.2*sin(q.y*2.0+q.x*.8)+broad*1.4;
 float curl=.5+.5*sin(phase);
 float fine=imNoise(q*vec3(3.0,11.0,3.0)+vec3(2.4,7.2,1.6));
 float lip=1.-smoothstep(.020,.105,abs(curl-(.80+fine*.09)));
 float crestGate=smoothstep(.35,.61,broad);
 float breakup=smoothstep(.35,.66,fine);
 float foam=lip*crestGate*breakup*.87;
 // Explicitly visible finer strands stay inside this same advected frame.
 // Twice the previous secondary frequency; no isotropic cell-outline mask.
 float finePhase=q.x*52.+q.z*40.+q.y*22.+6.4*sin(q.y*2.2+q.z*.6)+fine*.65;
 float fineWave=.5+.5*sin(finePhase);
 float fineThread=pow(fineWave,7.);
 float fineCrest=pow(fineWave,13.)*smoothstep(.54,.82,front)*(.25+.75*breakup)*.34;
 foam=clamp(foam+fineCrest,0.,.90);
 // Pale translucent channel edges are colored water, distinct from sparse foam.
 float edge=smoothstep(.70,.94,front)*(.45+.55*broad);
 vec3 aqua=mix(blue,vec3(.20,.66,.76),edge*.46);
 aqua=mix(aqua,vec3(.13,.58,.74),fineThread*(.36+.12*broad));
 ImWaterField f;f.color=mix(aqua,vec3(.84,.94,.96),foam);
 f.height=.0014*sin(phase)+.00048*sin(q.x*26.+q.z*20.+q.y*11.+3.2*sin(q.y*2.2+q.z*.6))+.00038*sin(finePhase)+.00025*(fine-.5)+foam*.00028;
 f.foam=foam;f.roughness=mix(.105,.46,foam);f.interior=inside;
 return f;
}
vec3 imPerturb(vec3 n,float height){
 vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);
 vec3 a=cross(dy,n),b=cross(n,dx);float det=dot(dx,a);
 float restArea=length(cross(dFdx(vImRest),dFdy(vImRest)));
 float viewArea=length(cross(dx,dy));
 float scale=sqrt(max(viewArea,1.e-20)/max(restArea,1.e-20));
 vec3 g=sign(det)*scale*(dFdx(height)*a+dFdy(height)*b);
 return normalize(max(abs(det),1.e-10)*n-g);
}
`;

/** Standalone still-study material. Requires stemRestPosition/stemRestNormal
 * from bindCharacterRestCoordinates. Does not modify any borrowed geometry. */
export function createImWaterStudyMaterial(options: ImWaterStudyOptions = {}): ImWaterStudyHandle {
  const quality=options.quality??'high';
  if(!['low','medium','high'].includes(quality))throw new RangeError('Unknown water-study quality');
  const material=new THREE.MeshPhysicalMaterial({
    name:'壬 · still water readability study', color:0xffffff,vertexColors:false,metalness:0,
    roughness:.105,transmission:.60,thickness:.28,ior:1.333,
    attenuationColor:new THREE.Color('#66c9e5'),attenuationDistance:.82,
    clearcoat:.16,clearcoatRoughness:.11,envMapIntensity:.85,
    transparent:false,depthWrite:true,toneMapped:true,
  });
  const time={value:0};let disposed=false;
  const replace=(source:string,needle:string,value:string):string=>{if(!source.includes(needle))throw new Error(`Water study missing Three chunk ${needle}`);return source.replace(needle,value);};
  material.customProgramCacheKey=()=>`im-water-still-v1:${quality}`;
  material.userData.imWaterStudy={restCoordinates:true,density:2.6,interiorSamples:3,geometryChanges:false};
  material.onBeforeCompile=shader=>{
    shader.uniforms.uImTime=time;
    shader.vertexShader=replace(shader.vertexShader,'#include <common>',`#include <common>\nattribute vec3 stemRestPosition;\nattribute vec3 stemRestNormal;\nvarying vec3 vImRest;\nvarying vec3 vImRestNormal;\nvarying vec3 vImViewNormal;`);
    shader.vertexShader=replace(shader.vertexShader,'#include <begin_vertex>',`#include <begin_vertex>\nvImRest=stemRestPosition;\nvImRestNormal=stemRestNormal;\nvImViewNormal=normalize(normalMatrix*normal);`);
    shader.fragmentShader=replace(shader.fragmentShader,'#include <common>',`#include <common>\n${IM_WATER_STUDY_FIELD}`);
    shader.fragmentShader=replace(shader.fragmentShader,'#include <color_fragment>',`#include <color_fragment>\nvec3 imView=normalize(vViewPosition);\nvec3 imViewNormal=normalize(vImViewNormal);\nvec3 imRestView=imViewRest(imView,imViewNormal);\nImWaterField imField=imWater(vImRest,normalize(vImRestNormal),imRestView,max(dot(imViewNormal,imView),0.));\ndiffuseColor.rgb*=imField.color;`);
    shader.fragmentShader=replace(shader.fragmentShader,'#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=imField.roughness;`);
    shader.fragmentShader=replace(shader.fragmentShader,'#include <normal_fragment_maps>',`#include <normal_fragment_maps>\nnormal=imPerturb(normal,imField.height);`);
    shader.fragmentShader=replace(shader.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>\n#ifdef USE_CLEARCOAT\nclearcoatNormal=normal;\n#endif`);
    // Small neutral-blue energy floor keeps low-light interior legible; it does
    // not encode a rim, specular highlight, lamp direction or scene lighting.
    shader.fragmentShader=replace(shader.fragmentShader,'#include <emissivemap_fragment>',`#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.002,.008,.012)*(1.-imField.foam);`);
    shader.fragmentShader=replace(shader.fragmentShader,'#include <transmission_fragment>',THREE.ShaderChunk.transmission_fragment.replace('material.transmission = transmission;', 'material.transmission = transmission * (1.0-imField.foam*.96);'));
  };
  const release=()=>{if(disposed)return;disposed=true;material.onBeforeCompile=()=>{};material.removeEventListener('dispose',release);};
  material.addEventListener('dispose',release);
  return {material,update(seconds){if(!Number.isFinite(seconds))throw new RangeError('Water study time must be finite');if(!disposed)time.value=seconds;},dispose(){if(!disposed)material.dispose();}};
}
