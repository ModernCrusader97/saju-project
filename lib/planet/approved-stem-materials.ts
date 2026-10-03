import * as THREE from 'three';

/** Approved ten-stem material study. Three r186 / WebGLRenderer. No image downloads. */
export const STEM_PRESETS = [
  { stem: '甲', name: 'Ancient bark', description: 'Rugged warm bark, deep vertical furrows, dry fibrous relief.' },
  { stem: '乙', name: 'Living vines', description: 'Supple glossy jade vines, intertwining tendrils and little leaves.' },
  { stem: '丙', name: 'Solar fire', description: 'Flowing golden flame, white-hot channels and blue-white ignition.' },
  { stem: '丁', name: 'Charcoal embers', description: 'Matte charcoal plates split by narrow, breathing molten cracks.' },
  { stem: '戊', name: 'Layered sandstone', description: 'Warm sedimentary bands, mineral grains and eroded stone relief.' },
  { stem: '己', name: 'Blue-white porcelain', description: 'Ivory glazed ceramic with hand-drawn cobalt flowers, leaves and scrolls.' },
  { stem: '庚', name: 'Brushed titanium', description: 'Clean satin titanium with fine directional brushing and broad metallic highlights.' },
  { stem: '辛', name: 'Liquid silver', description: 'Smooth mirror-polished silver with slow, restrained liquid ripples.' },
  { stem: '壬', name: 'Deep flowing water', description: 'Clear deep-blue water with broad moving waves and true refraction.' },
  { stem: '癸', name: 'Dew water', description: 'Pale clear aqua water, tiny round dew beads and delicate capillary ripples.' },
] as const;
export type Stem = (typeof STEM_PRESETS)[number]['stem'];
export type StemQuality = 'low' | 'medium' | 'high';
export interface StemMaterialHandle {
  material: THREE.MeshPhysicalMaterial;
  /** Absolute seconds, not delta time. Calling update(0) resets exactly. */
  update(timeSeconds: number): void;
  dispose(): void;
}

const VERSION = 'stem-approved-v2-r186-2-feedback';

/** Readable botanical ink, generated once per porcelain material with no DOM/canvas. */
function cobaltBotanicalTexture(size: number): THREE.DataTexture {
  const ink = new Float32Array(size * size);
  const etch = new Float32Array(size * size);
  const put = (x: number, y: number, value: number) => {
    const i = ((y % size + size) % size) * size + ((x % size + size) % size);
    if (value < 0) etch[i] = Math.max(etch[i], -value);
    else ink[i] = Math.max(ink[i], Math.min(1, value));
  };
  function disc(x: number, y: number, radius: number, value: number) {
    const cx = x * size, cy = y * size, r = radius * size;
    for (let j = Math.floor(cy - r - 1); j <= cy + r + 1; j++) for (let i = Math.floor(cx - r - 1); i <= cx + r + 1; i++) {
      const coverage = Math.max(0, Math.min(1, r + 0.7 - Math.hypot(i + .5 - cx, j + .5 - cy)));
      if (coverage > 0) put(i, j, coverage * value);
    }
  }
  function line(points: [number, number][], width: number, value = .92) {
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1], [x1, y1] = points[i];
      const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * size * 1.5));
      for (let k = 0; k <= steps; k++) disc(x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps, width * .5, value);
    }
  }
  function curve(a: [number, number], b: [number, number], c: [number, number], d: [number, number], width: number) {
    const points: [number, number][] = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40, s = 1 - t;
      points.push([s*s*s*a[0]+3*s*s*t*b[0]+3*s*t*t*c[0]+t*t*t*d[0], s*s*s*a[1]+3*s*s*t*b[1]+3*s*t*t*c[1]+t*t*t*d[1]]);
    }
    line(points, width);
  }
  function leaf(x: number, y: number, length: number, width: number, angle: number, tone = .88) {
    const c = Math.cos(angle), s = Math.sin(angle);
    for (let iy = Math.floor((y - length) * size); iy <= (y + length) * size; iy++) for (let ix = Math.floor((x - length) * size); ix <= (x + length) * size; ix++) {
      const dx = (ix + .5) / size - x, dy = (iy + .5) / size - y;
      const u = (c*dx+s*dy)/length, v = (-s*dx+c*dy)/width;
      const edge = (1-u*u) - Math.abs(v);
      const coverage = Math.min(1, Math.max(0, edge * width * size));
      const vein = Math.abs(v - .08 * Math.sin(u * 4)) < .06 ? .52 : 1;
      if (coverage > 0) put(ix, iy, tone * coverage * vein * (.88 + .12 * Math.sin(u * 11 + v * 2)));
    }
  }
  // Five winding sprigs with legible ink and generous ivory between the larger flowers.
  for (const [ox, oy, scale, rot] of [[.29,.25,1.05,0], [.75,.77,.90,2.6], [.80,.20,.64,1.2], [.17,.80,.70,-.72], [.61,.46,.65,.42]]) {
    const trans = (x: number, y: number): [number,number] => [ox+scale*(x*Math.cos(rot)-y*Math.sin(rot)), oy+scale*(x*Math.sin(rot)+y*Math.cos(rot))];
    const bez = (a:[number,number], b:[number,number], c:[number,number], d:[number,number], w:number) => curve(trans(...a),trans(...b),trans(...c),trans(...d),w*scale);
    bez([0,.28],[-.11,.10],[.10,-.03],[0,-.12],.009);
    bez([-.025,.15],[.10,.16],[.19,.01],[.15,-.02],.005);
    bez([.018,.07],[-.11,.08],[-.20,-.02],[-.16,-.08],.005);
    bez([-.04,.24],[-.18,.23],[-.18,.13],[-.10,.15],.004);
    for (const [x,y,a,l] of [[.02,.20,-.6,.047],[-.045,.12,2.6,.045],[.07,.12,-.8,.043],[.11,.075,.6,.049],[.14,.025,-.7,.04],[-.065,.06,2.3,.055],[-.12,.025,3.6,.04],[-.16,-.035,2.3,.045],[-.04,-.035,2.6,.044],[.025,-.065,-.5,.042]]) {
      const p=trans(x,y); leaf(p[0],p[1],l*scale,.022*scale,a+rot);
    }
    const [fx,fy]=trans(0,-.14);
    // Layered peony petals: painted shapes with narrow ivory separations and inner cobalt cups.
    for(let ring=0;ring<3;ring++) for(let i=0;i<9-ring*2;i++) {
      const angle=i*Math.PI*2/(9-ring*2)+ring*.42+rot;
      const radius=(.043-ring*.014)*scale;
      leaf(fx+Math.cos(angle)*radius,fy+Math.sin(angle)*radius,(.034-ring*.006)*scale,(.027-ring*.004)*scale,angle,.80+ring*.08);
    }
    // Fine ivory-blue engraved brush separations retain readable peony petals.
    for(let petal=0;petal<8;petal++) {
      const a=petal*Math.PI/4+rot;
      const points: [number,number][]=[];
      for(let j=0;j<=12;j++) { const t=j/12, r=(.016+.045*t)*scale, theta=a+.34*Math.sin(t*Math.PI);
        points.push([fx+Math.cos(theta)*r,fy+Math.sin(theta)*r]);
      }
      line(points,.0018*scale,-.78);
    }
    disc(fx,fy,.009*scale,.98);
    for(let i=0;i<5;i++){const a=i*1.256;disc(fx+Math.cos(a)*.012*scale,fy+Math.sin(a)*.012*scale,.002*scale,.97);}
  }
  const bytes=new Uint8Array(size*size*4);
  for(let i=0;i<ink.length;i++){const a=Math.round(255*ink[i]*(1-etch[i]));bytes[i*4]=a;bytes[i*4+1]=a;bytes[i*4+2]=a;bytes[i*4+3]=255;}
  const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat,THREE.UnsignedByteType);
  texture.name='Cobalt botanical painting'; texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter; texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true; texture.needsUpdate=true;
  return texture;
}

const COMMON = /* glsl */`
varying vec3 vStemPosition;
varying vec3 vStemObjectNormal;
varying vec3 vStemBrushAxis;
uniform float uStemTime;
uniform sampler2D uStemBotanical;
float stHash(vec3 p) { p=fract(p*.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
vec2 stHash2(vec2 p) { return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
float stNoise(vec3 p) {
 vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
 return mix(mix(mix(stHash(i),stHash(i+vec3(1,0,0)),f.x),mix(stHash(i+vec3(0,1,0)),stHash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(stHash(i+vec3(0,0,1)),stHash(i+vec3(1,0,1)),f.x),mix(stHash(i+vec3(0,1,1)),stHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float stDetail(vec3 p) { return mix(stNoise(p),.5,smoothstep(.45,1.6,length(fwidth(p)))); }
float stFbm(vec3 p) { float a=.52,s=0.; for(int i=0;i<STEM_OCTAVES;i++){s+=a*stNoise(p);p=p*2.03+vec3(7.1,3.7,8.9);a*=.48;}return s; }
// F2-F1 cellular borders: no UV seams, quiet broad plate interiors.
vec2 stCell(vec3 p) {
 vec3 id=floor(p),f=fract(p);float a=10.,b=10.;
 for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec3 o=vec3(float(x),float(y),float(z));
  vec3 h=vec3(stHash(id+o),stHash(id+o+19.1),stHash(id+o+47.2));
  float d=length(o+.2+.6*h-f);if(d<a){b=a;a=d;}else if(d<b)b=d;
 }return vec2(a,b-a);
}
float stBotanical(vec3 p,vec3 n) {
 vec3 w=pow(abs(n),vec3(10.));w/=max(dot(w,vec3(1)),.0001);
 return texture2D(uStemBotanical,p.zy*.57+vec2(.19,.07)).r*w.x
      + texture2D(uStemBotanical,p.xz*.57+vec2(.08,.32)).r*w.y
      + texture2D(uStemBotanical,p.xy*.57+vec2(.11,.28)).r*w.z;
}
struct StemSurface { vec3 color; float roughness; float height; vec3 emission; };
StemSurface stSurface(vec3 p,vec3 n) {
 StemSurface s; s.color=vec3(.5);s.roughness=.5;s.height=0.;s.emission=vec3(0);
 #if STEM_KIND == 0
  vec3 warp=vec3(stFbm(p*2.3),stFbm(p*2.3+17.),stFbm(p*2.3-11.));
  vec3 q=p*vec3(8.8,2.1,8.8)+warp*1.35;
  vec2 cell=stCell(q);
  float fissure=1.-smoothstep(.026,.080+.060*stNoise(p*5.),cell.y);
  float fibre=stFbm(p*vec3(31.,3.2,31.)+warp*4.);
  float flakes=stNoise(q*vec3(1.2,2.8,1.2));
  float ridge=clamp(.20+fibre*.68+flakes*.24-fissure*.58,0.,1.);
  s.color=mix(vec3(.038,.012,.004),vec3(.29,.135,.049),ridge);
  s.color*=.84+.22*stNoise(p*vec3(10.,3.,10.));
  s.roughness=.86+.09*fissure;
  s.height=.066*smoothstep(.018,.17,cell.y)+.022*fibre+.010*flakes;
 #elif STEM_KIND == 1
  // The whole surface is packed stem bundles, not green skin below a few decorative lines.
  float drift=.055*sin(p.y*2.2+uStemTime*.48);
  float organic=stFbm(p*vec3(2.2,1.1,2.2));
  float phaseA=(p.x*.82+p.z*.56)*11.4+p.y*3.5+2.3*sin(p.y*2.2+organic)+drift;
  float phaseB=(p.x*.56-p.z*.82)*9.1-p.y*4.3+1.9*sin(p.y*2.8+organic*2.);
  float widthA=.72+.16*stNoise(p*3.+5.);
  float widthB=.68+.19*stNoise(p*3.-8.);
  float a=abs(sin(phaseA))/widthA,b=abs(sin(phaseB))/widthB;
  float stemA=sqrt(max(0.,1.-a*a)),stemB=sqrt(max(0.,1.-b*b));
  float weave=smoothstep(-.18,.18,sin(p.y*4.2+p.x*3.3-p.z*2.7));
  float upper=mix(stemA,stemB,weave),lower=mix(stemB,stemA,weave);
  float body=max(upper,lower*.88);
  float fibre=.5+.5*sin(mix(phaseA,phaseB,weave)*5.5+organic*7.);
  vec3 vineColor=mix(vec3(.042,.14,.012),vec3(.15,.255,.028),organic*.55+body*.45);
  s.color=mix(vec3(.006,.022,.005),vineColor,smoothstep(.0,.56,body));
  s.color*=.90+.10*fibre;
  s.roughness=mix(.58,.30,body);
  s.height=max(.026*lower,.057*upper+.010*lower)+.002*fibre*body;
 #elif STEM_KIND == 2
  vec3 q=p*vec3(3.4,2.,3.4)-vec3(0,uStemTime*.64,0);
  float flow=stFbm(q+vec3(stFbm(q+4.),0,stFbm(q-3.))*3.1);
  float stream=sin(p.x*7.2+p.z*6.1+flow*19.-uStemTime*1.8);
  float tongues=smoothstep(.02,.82,stream);
  float core=pow(max(0.,stream),10.)*smoothstep(.47,.72,flow);
  float blue=pow(max(0.,sin(p.x*5.-p.z*9.+flow*14.+uStemTime)),18.)*.18;
  s.color=mix(vec3(.27,.015,.001),vec3(.58,.14,.007),tongues);
  // Orange negative space keeps the handful of hot cores readable under tone mapping.
  s.emission=mix(vec3(.42,.022,.001),vec3(2.15,.65,.018),tongues);
  s.emission+=vec3(1.5,1.4,.72)*core+vec3(.018,.18,.7)*blue;
  s.roughness=.48;s.height=.008*flow;
 #elif STEM_KIND == 3
  vec3 warp=vec3(stFbm(p*2.4),stFbm(p*2.4+18.),stFbm(p*2.4-12.));
  vec3 q=p*vec3(5.6,7.1,5.9)+warp*2.1;
  vec2 cell=stCell(q);
  float width=.030+.082*pow(stNoise(p*5.3+9.),2.);
  float crack=1.-smoothstep(width*.17,width,cell.y);
  float secondary=(1.-smoothstep(.015,.042,stCell(p*15.+warp*3.).y))*smoothstep(.58,.74,stNoise(p*3.));
  float cinders=stDetail(p*35.);
  float ash=pow(stNoise(p*7.+11.),3.);
  float heat=smoothstep(.20,.70,stNoise(p*2.7+vec3(0,uStemTime*.025,0)));
  float pulse=.71+.24*sin(uStemTime*1.25+stNoise(p*3.)*8.);
  s.color=mix(vec3(.012,.009,.008),vec3(.046,.034,.026),stFbm(p*12.));
  s.color+=vec3(.040,.038,.034)*ash;
  s.roughness=.95-.10*crack;
  s.height=.041*smoothstep(.012,.19,cell.y)+.008*stNoise(p*17.)+.0015*cinders;
  s.emission=vec3(2.9,.25,.007)*(pow(crack,1.3)*(.20+.80*heat)+secondary*.20)*pulse;
 #elif STEM_KIND == 4
  vec3 warp=vec3(stFbm(p*2.6),stFbm(p*3.0+13.),stFbm(p*2.8-9.));
  float beds=stNoise(vec3(p.x*.72,p.y*10.5+warp.y*4.1,p.z*.72));
  float strata=smoothstep(.20,.78,beds);
  float seam=1.-smoothstep(.025,.11,abs(beds-.44));
  vec2 blocks=stCell(p*vec3(4.4,3.4,4.4)+warp*.85);
  float fissure=1.-smoothstep(.010,.055,blocks.y);
  float erosion=stFbm(p*13.);
  float grit=stDetail(p*62.);
  float pore=pow(stNoise(p*31.),6.);
  s.color=mix(vec3(.20,.084,.027),vec3(.52,.32,.16),strata*.72+erosion*.28);
  s.color=mix(s.color,vec3(.14,.056,.016),seam*.35+fissure*.23);
  s.color*=.87+.21*grit-.38*pore;
  s.roughness=.90;
  s.height=.019*strata+.036*erosion-.020*pore-.015*fissure+.0018*grit;
 #elif STEM_KIND == 5
  float ink=stBotanical(p,n);
  float bleed=stNoise(p*38.);
  vec3 cobalt=mix(vec3(.003,.009,.055),vec3(.009,.030,.15),bleed);
  s.color=mix(vec3(.80,.775,.70),cobalt,smoothstep(.055,.45,ink));
  s.roughness=.135+.025*ink;
  s.height=.00016*stDetail(p*60.)-.00025*ink;
 #elif STEM_KIND == 6
  float brushed=stNoise(p*vec3(2.5,340.,2.5));
  float fine=sin(p.y*1050.+stNoise(p*vec3(7.,1.,7.))*3.);
  s.color=vec3(.57,.59,.63)*(.94+.06*brushed);
  s.roughness=.295+.07*brushed;
  s.height=.00075*brushed+.00012*fine;
 #elif STEM_KIND == 7
  float ripple=sin(p.x*3.4+p.y*2.1+uStemTime*.31)*cos(p.z*3.8-p.y*2.3-uStemTime*.22);
  s.color=vec3(.94,.95,.97);s.roughness=.052;
  s.height=.014*ripple;
 #elif STEM_KIND == 8
  float w1=sin(p.x*5.4+p.y*2.4+p.z*1.8-uStemTime*1.35);
  float w2=sin(p.x*-3.2+p.y*6.2+p.z*3.6+uStemTime*.96);
  float w3=sin(p.x*8.2-p.y*3.8+p.z*5.1-uStemTime*1.9);
  float crest=.5+.5*w1*w2;
  s.color=mix(vec3(.016,.18,.32),vec3(.035,.28,.43),crest*.55);
  s.roughness=.042+.026*crest;
  s.height=.092*w1+.057*w2+.026*w3;
 #elif STEM_KIND == 9
  // Raised smooth spherical-cap droplets, independent of the much flatter underlying liquid.
  vec3 cellP=p*13.;vec3 ip=floor(cellP),fp=fract(cellP)-.5;
  vec3 jitter=vec3(stHash(ip),stHash(ip+19.),stHash(ip+47.))-.5;
  float radius=.12+.10*stHash(ip+71.);
  float d=length(fp-jitter*.5);
  float bead=sqrt(max(0.,radius*radius-d*d));
  float ripple=sin(p.x*11.+p.y*6.+uStemTime*.55)*sin(p.z*9.-p.y*4.+uStemTime*.4);
  s.color=vec3(.82,.965,.95);s.roughness=.043;
  s.height=.030*bead+.0018*ripple;
 #endif
 s.color=clamp(s.color,vec3(0.002),vec3(.97));
 s.roughness=clamp(s.roughness,.035,.98);
 return s;
}
// Mikkelsen derivative bump: real light/reflection normal response, without moving the silhouette.
vec3 stPerturb(vec3 normalIn,float height) {
 vec3 dpdx=dFdx(-vViewPosition),dpdy=dFdy(-vViewPosition);
 vec3 r1=cross(dpdy,normalIn),r2=cross(normalIn,dpdx);
 float det=dot(dpdx,r1);
 vec3 grad=sign(det)*(dFdx(height)*r1+dFdy(height)*r2);
 return normalize(max(abs(det),1.e-10)*normalIn-grad);
}
`;

function replaceRequired(source: string, needle: string, replacement: string): string {
  if (!source.includes(needle)) throw new Error(`Three r186 stem shader: expected chunk missing: ${needle}`);
  return source.replace(needle,replacement);
}

export function createStemMaterial(stem: Stem, quality: StemQuality = 'high'): StemMaterialHandle {
  const index=STEM_PRESETS.findIndex(p=>p.stem===stem);
  if(index<0) throw new RangeError(`Unknown heavenly stem: ${String(stem)}`);
  if(!['low','medium','high'].includes(quality)) throw new RangeError(`Unknown quality: ${String(quality)}`);
  const metallic=index===6||index===7, water=index===8||index===9;
  const material=new THREE.MeshPhysicalMaterial({
    name:`${stem} · ${STEM_PRESETS[index].name}`, color:0xffffff,
    vertexColors:false, metalness:metallic?1:0,
    roughness:metallic?(index===6?.33:.052):water?.06:.5,
    clearcoat:index===5?.85:index===1?.28:0,
    clearcoatRoughness:index===5?.07:.16,
    transmission:water?(index===8?.90:.98):0,
    thickness:index===8?.95:index===9?.30:0,
    ior:water?1.333:index===5?1.50:1.46,
    attenuationColor:water?(index===8?new THREE.Color('#0c709f'):new THREE.Color('#d1f7ee')):new THREE.Color(0xffffff),
    attenuationDistance:index===8?.95:index===9?6:Infinity,
    anisotropy:index===6?.72:0,
    anisotropyRotation:0,
    envMapIntensity:1,
    // Three transmission is opaque-list physical refraction; alpha transparency is unnecessary.
    transparent:false, depthWrite:true, toneMapped:true,
  });
  const time={value:0};
  const botanical=index===5?cobaltBotanicalTexture(quality==='low'?256:quality==='medium'?384:512):null;
  material.defines={...material.defines,STEM_KIND:index,STEM_OCTAVES:quality==='low'?3:4};
  material.customProgramCacheKey=()=>`${VERSION}:${index}:${quality}`;
  material.onBeforeCompile=(shader)=>{
    shader.uniforms.uStemTime=time;
    shader.uniforms.uStemBotanical={value:botanical};
    shader.vertexShader=replaceRequired(shader.vertexShader,'#include <common>',`#include <common>\nvarying vec3 vStemPosition;\nvarying vec3 vStemObjectNormal;\nvarying vec3 vStemBrushAxis;`);
    shader.vertexShader=replaceRequired(shader.vertexShader,'#include <begin_vertex>',`#include <begin_vertex>\nvStemPosition=position;\nvStemObjectNormal=normal;\nvStemBrushAxis=normalize(normalMatrix*vec3(0.,1.,0.));`);
    shader.fragmentShader=replaceRequired(shader.fragmentShader,'#include <common>',`#include <common>\n${COMMON}`);
    shader.fragmentShader=replaceRequired(shader.fragmentShader,'#include <color_fragment>',`#include <color_fragment>\nStemSurface stemSurface=stSurface(vStemPosition,normalize(vStemObjectNormal));\ndiffuseColor.rgb*=stemSurface.color;`);
    shader.fragmentShader=replaceRequired(shader.fragmentShader,'#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=stemSurface.roughness;`);
    shader.fragmentShader=replaceRequired(shader.fragmentShader,'#include <normal_fragment_maps>',`#include <normal_fragment_maps>\nnormal=stPerturb(normal,stemSurface.height);\n#ifdef USE_ANISOTROPY\n vec3 brush=vStemBrushAxis-normal*dot(vStemBrushAxis,normal);\n if(dot(brush,brush)<.00001)brush=cross(normal,vec3(1.,.01,.01));\n tbn=mat3(normalize(brush),normalize(cross(normal,brush)),normal);\n#endif`);
    shader.fragmentShader=replaceRequired(shader.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>\n#ifdef USE_CLEARCOAT\nclearcoatNormal=normal;\n#endif`);
    shader.fragmentShader=replaceRequired(shader.fragmentShader,'#include <emissivemap_fragment>',`#include <emissivemap_fragment>\ntotalEmissiveRadiance+=stemSurface.emission;`);
  };
  let disposed=false;
  const release=()=>{if(disposed)return;disposed=true;botanical?.dispose();material.onBeforeCompile=()=>{};material.removeEventListener('dispose',release);};
  material.addEventListener('dispose',release);
  return {material,update(seconds){if(!Number.isFinite(seconds))throw new RangeError('Time must be finite');if(!disposed)time.value=seconds;},dispose(){if(disposed)return;material.dispose();}};
}
