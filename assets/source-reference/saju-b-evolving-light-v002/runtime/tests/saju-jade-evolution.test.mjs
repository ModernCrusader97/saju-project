import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const api = await import('../saju-jade-evolution.mjs').catch(e => { if(e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e; });
const { SAJU, wrapSeconds, evolutionWeights, evolutionWeightVelocity, fixedFieldInputs, atlasTexelUV, sampleFieldsAtlas, blendFields, masksFromField, evaluateJadeEvolution, composeLinear, gltfLocalToGenerated } = api;
const near = (a,b,e=1e-12) => assert.ok(Math.abs(a-b)<=e, `${a} != ${b}`);
const near3 = (a,b,e=1e-12) => a.forEach((v,i)=>near(v,b[i],e));
const offset = (x,y,z) => 4*((Math.floor(z/16)*128+y)*2048+(z%16)*128+x);
const fixture = () => {
  const data=new Uint8Array(2048*1024*4);
  for(let z=0;z<128;z++) for(let y=0;y<128;y++) for(let x=0;x<128;x++) data.set([x,y,z,255],offset(x,y,z));
  return data;
};
let data;
test('exposes fixed-field RGB8 v002 contract',()=>{
  assert.ok(SAJU, 'v002 implementation is absent');
  assert.deepEqual(SAJU.atlas.domainMin,[0,0,0]); assert.deepEqual(SAJU.atlas.domainMax,[1,1,1]);
  assert.equal(SAJU.atlas.byteLength,8388608);
  assert.deepEqual(SAJU.fixedFieldOffsets,[[0,0,0],[5.21,8.73,2.91],[-7.43,3.17,11.61]]);
  assert.deepEqual(SAJU.noise,{dimensions:'3D',type:'FBM',scale:4.3,detail:3.2,roughness:.65,lacunarity:2,normalize:true});
});
test('fixed native noise inputs and atlas sampling coordinates never depend on time',()=>{
  data=fixture(); const p=[.13,.42,.91], copy=[...p]; const fixed=fixedFieldInputs(p);
  assert.deepEqual(fixed,[p,[p[0]+5.21,p[1]+8.73,p[2]+2.91],[p[0]-7.43,p[1]+3.17,p[2]+11.61]]);
  const initial=evaluateJadeEvolution(data,p,0);
  for(let t=-6;t<12;t+=.137){const r=evaluateJadeEvolution(data,p,t); assert.deepEqual(r.fieldSourcePosition,p); assert.deepEqual(r.fields,initial.fields); assert.deepEqual(fixedFieldInputs(p,t),fixed);}
  assert.deepEqual(p,copy);
  assert.ok(!('loopOffset' in api)); assert.ok(!('loopVelocity' in api));
});
test('time wraps safely; segment endpoints select A, B, C and loop exactly',()=>{
  assert.equal(wrapSeconds(-.25),5.75); assert.equal(wrapSeconds(-6),0);
  for(const [t,w] of [[0,[1,0,0]],[2,[0,1,0]],[4,[0,0,1]],[6,[1,0,0]],[-2,[0,0,1]]])near3(evolutionWeights(t),w);
  for(const t of [NaN,Infinity,-Infinity,'1'])assert.throws(()=>evolutionWeights(t),TypeError);
  for(const t of [1e30,-1e30,Number.MAX_VALUE,Number.MIN_VALUE])assert.ok(evolutionWeights(t).every(Number.isFinite));
});
test('unit L2 pair weights and zero first derivative at every segment boundary',()=>{
  for(let t=-12;t<18;t+=.0071){const w=evolutionWeights(t);near(w.reduce((s,x)=>s+x*x,0),1,4e-15);assert.ok(w.every(v=>v>=-1e-15 && v<=1));assert.ok(w.filter(v=>v!==0).length<=2);}
  for(const t of [-6,-4,-2,0,2,4,6,8]){
    near3(evolutionWeightVelocity(t),[0,0,0]);const h=1e-5, c=evolutionWeights(t),l=evolutionWeights(t-h),r=evolutionWeights(t+h);
    for(let i=0;i<3;i++){near((r[i]-c[i])/h,0,2e-5);near((c[i]-l[i])/h,0,2e-5);}
  }
  near3(evolutionWeights(1),[Math.SQRT1_2,Math.SQRT1_2,0]);
});
test('RGB8 trilinear sampling interpolates vector linear fixture and normalizes by 255',()=>{
  data??=fixture();
  for(const p of [[0,0,0],[1,1,1],[.4,.6,.8],[.3,.7,15.5/127],[.99,.01,111.5/127],[-1,.5,2]])near3(sampleFieldsAtlas(data,p),p.map(v=>Math.min(1,Math.max(0,v))*127/255),1e-14);
  const normalized=new Uint8Array(8388608);normalized.set([0,128,255,255],0);near3(sampleFieldsAtlas(normalized,[0,0,0]),[0,128/255,1]);
  assert.throws(()=>sampleFieldsAtlas(new Uint16Array(2097152),[0,0,0]),TypeError);
  assert.throws(()=>sampleFieldsAtlas(new Float32Array(8388608),[0,0,0]),TypeError);
  assert.throws(()=>sampleFieldsAtlas(data,[NaN,0,0]),TypeError);
});
test('all atlas texel centers address the correct tile; V flip and boundary clamp agree',()=>{
  data??=fixture();
  for(const z of [0,15,16,31,32,111,112,127])for(const x of [0,127])for(const y of [0,127]){
    const uv=atlasTexelUV(x,y,z),fl=atlasTexelUV(x,y,z,true),idx=offset(x,y,z)/4;
    assert.equal(Math.floor(uv[1]*1024)*2048+Math.floor(uv[0]*2048),idx);near(fl[1]+uv[1],1);near(fl[0],uv[0]);
  }
  const flipped=new Uint8Array(data.length); for(let row=0;row<1024;row++)flipped.set(data.subarray(row*8192,(row+1)*8192),(1023-row)*8192);
  for(const p of [[.1,.9,.25],[.9,.1,.93],[1,1,1],[-1,2,0]])near3(sampleFieldsAtlas(flipped,p,true),sampleFieldsAtlas(data,p));
  for(const idx of [-1,128,.5])assert.throws(()=>atlasTexelUV(idx,0,0),RangeError);
});
test('centered blending is spatial evolution rather than one uniform intensity pulse',()=>{
  near(blendFields([.7,.5,.3],0),.7);near(blendFields([.7,.5,.3],2),.5);near(blendFields([.7,.5,.3],4),.3);
  near(blendFields([.5,.5,.5],1),.5);near(blendFields([1,1,0],1),1);near(blendFields([0,0,1],1),0);
  const brightAtA=[.75,.35,.45],brightAtB=[.35,.75,.55];
  assert.ok(blendFields(brightAtA,2)<blendFields(brightAtA,0));assert.ok(blendFields(brightAtB,2)>blendFields(brightAtB,0));
  const mid=blendFields([.7,.7,.5],1);near(mid,.5+.2*Math.SQRT2);
});
test('approved masks, green strength and BRDF isolation remain unchanged',()=>{
  for(const f of [0,.38,.49,.5,.6,.66,.72,1]){const r=masksFromField(f),s=Math.max(0,Math.min(1,(f-.38)/.28));near(r.emissionMask,Math.max(0,Math.min(1,(f-.5)/.22)));near(r.isolationMask,s*s*(3-2*s));near(r.reflectiveFraction,1-r.isolationMask);}
  const r=evaluateJadeEvolution(data,[1,.5,.3],0);near3(r.emissionRadiance,[.001,.65,.08].map(v=>v*2*r.emissionMask));
  near3(composeLinear([.2,.4,.6],r),[.2,.4,.6].map((v,i)=>v*r.reflectiveFraction+r.emissionRadiance[i]));
});
test('verified glTF to Generated adapter is preserved',()=>{
  const c=SAJU.sourceBody.texspaceCenter,h=SAJU.sourceBody.texspaceHalfSize;
  near3(gltfLocalToGenerated([c[0],c[2],-c[1]]),[.5,.5,.5]);
  near3(gltfLocalToGenerated([c[0]+h[0],c[2]+h[2],-c[1]-h[1]]),[1,1,1]);
});
test('GLSL evaluator samples source position directly; contains no translating or rotating coordinate function',async()=>{
  const src=await readFile(new URL('../saju-jade-evolution.glsl',import.meta.url),'utf8');
  assert.match(src,/sajuSampleFieldsAtlas\(atlas, canonicalSourcePosition, flipV\)/);
  assert.doesNotMatch(src,/sajuLoopOffset|loopOffset|mat[234]\s*\(|canonicalSourcePosition\s*\+/);
  assert.match(src,/\.rgb/);assert.match(src,/precision highp sampler2D/);
});
