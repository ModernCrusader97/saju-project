/** STEM_KIND 4's unchanged .010–.055 F2-F1 field. The GPU source below is
 * independently compared with the production material by browser QA. */
export const SANDSTONE_FISSURE_GLSL = `
float stHash(vec3 p) { p=fract(p*.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
float stNoise(vec3 p) {
 vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
 return mix(mix(mix(stHash(i),stHash(i+vec3(1,0,0)),f.x),mix(stHash(i+vec3(0,1,0)),stHash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(stHash(i+vec3(0,0,1)),stHash(i+vec3(1,0,1)),f.x),mix(stHash(i+vec3(0,1,1)),stHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float stFbm(vec3 p) { float a=.52,s=0.; for(int i=0;i<STEM_OCTAVES;i++){s+=a*stNoise(p);p=p*2.03+vec3(7.1,3.7,8.9);a*=.48;}return s; }
vec2 stCell(vec3 p) {
 vec3 id=floor(p),f=fract(p);float a=10.,b=10.;
 for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec3 o=vec3(float(x),float(y),float(z));
  vec3 h=vec3(stHash(id+o),stHash(id+o+19.1),stHash(id+o+47.2));
  float d=length(o+.2+.6*h-f);if(d<a){b=a;a=d;}else if(d<b)b=d;
 }return vec2(a,b-a);
}
float sandstoneFissure(vec3 p) {
 vec3 warp=vec3(stFbm(p*2.6),stFbm(p*3.0+13.),stFbm(p*2.8-9.));
 return stCell(p*vec3(4.4,3.4,4.4)+warp*.85).y;
}
`;

const f32=Math.fround,fract=(n:number)=>n-Math.floor(n);
const add=(a:number,b:number)=>f32(f32(a)+f32(b));
const mul=(a:number,b:number)=>f32(f32(a)*f32(b));
function fieldHash(x:number,y:number,z:number):number {
 x=f32(fract(mul(x,.1031)));y=f32(fract(mul(y,.1031)));z=f32(fract(mul(z,.1031)));
 const dot=add(add(mul(x,add(y,33.33)),mul(y,add(z,33.33))),mul(z,add(x,33.33)));
 x=add(x,dot);y=add(y,dot);z=add(z,dot);
 return f32(fract(mul(add(x,y),z)));
}
function fieldNoise(x:number,y:number,z:number):number {
 x=f32(x);y=f32(y);z=f32(z);
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
 const smooth=(v:number)=>mul(mul(v,v),add(3,-mul(2,v)));
 const sx=smooth(fract(x)),sy=smooth(fract(y)),sz=smooth(fract(z));
 const mix=(a:number,b:number,t:number)=>add(mul(a,add(1,-t)),mul(b,t));
 return mix(mix(mix(fieldHash(ix,iy,iz),fieldHash(ix+1,iy,iz),sx),mix(fieldHash(ix,iy+1,iz),fieldHash(ix+1,iy+1,iz),sx),sy),
  mix(mix(fieldHash(ix,iy,iz+1),fieldHash(ix+1,iy,iz+1),sx),mix(fieldHash(ix,iy+1,iz+1),fieldHash(ix+1,iy+1,iz+1),sx),sy),sz);
}
function fieldFbm(x:number,y:number,z:number,octaves:number):number {
 x=f32(x);y=f32(y);z=f32(z);let sum=0,amplitude=f32(.52);
 for(let i=0;i<octaves;i++){
  sum=add(sum,mul(amplitude,fieldNoise(x,y,z)));
  x=add(mul(x,2.03),7.1);y=add(mul(y,2.03),3.7);z=add(mul(z,2.03),8.9);amplitude=mul(amplitude,.48);
 }return sum;
}
/** Float32 reference, not a promise of bit-identical arithmetic on every GPU. */
export function sandstoneFissureDistance(point:readonly number[],quality:'low'|'high'='high'):number {
 if(point.length!==3||!point.every(Number.isFinite))throw new RangeError('Fissure coordinates must be three finite rest values.');
 const [px,py,pz]=point.map(f32),octaves=quality==='low'?3:4;
 const warp=(frequency:number,offset=0)=>fieldFbm(add(mul(px,frequency),offset),add(mul(py,frequency),offset),add(mul(pz,frequency),offset),octaves);
 const x=add(mul(px,4.4),mul(warp(2.6),.85)),y=add(mul(py,3.4),mul(warp(3,13),.85)),z=add(mul(pz,4.4),mul(warp(2.8,-9),.85));
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=fract(x),fy=fract(y),fz=fract(z);
 let first=10,second=10;
 for(let c=-1;c<=1;c++)for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){
  const dx=add(add(add(a,.2),mul(.6,fieldHash(ix+a,iy+b,iz+c))),-fx);
  const dy=add(add(add(b,.2),mul(.6,fieldHash(add(ix+a,19.1),add(iy+b,19.1),add(iz+c,19.1)))),-fy);
  const dz=add(add(add(c,.2),mul(.6,fieldHash(add(ix+a,47.2),add(iy+b,47.2),add(iz+c,47.2)))),-fz);
  const d=f32(Math.sqrt(add(add(mul(dx,dx),mul(dy,dy)),mul(dz,dz))));
  if(d<first){second=first;first=d;}else if(d<second)second=d;
 }return add(second,-first);
}
