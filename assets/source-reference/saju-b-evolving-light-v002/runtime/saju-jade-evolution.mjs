/** SaJu jade evolving-light v002. Engine-independent reference for fixed RGB fields. */
export const SAJU = Object.freeze({
  loopSeconds: 6, segmentSeconds: 2,
  fixedFieldOffsets: Object.freeze([[0,0,0],[5.21,8.73,2.91],[-7.43,3.17,11.61]].map(Object.freeze)),
  noise: Object.freeze({dimensions:'3D',type:'FBM',scale:4.3,detail:3.2,roughness:.65,lacunarity:2,normalize:true}),
  atlas: Object.freeze({
    gridSize:128, columns:16, rows:8, width:2048, height:1024, byteLength:8388608,
    domainMin:Object.freeze([0,0,0]), domainMax:Object.freeze([1,1,1]),
    pixelFormat:'RGBA8_UNORM', channels:'R=A G=B B=C A=255', colorSpace:'linear/non-color',
    sourceRow0:'canonical minimum Y within first Z tile row',
  }),
  emission: Object.freeze({thresholds:Object.freeze([.50,.72]),linearRGB:Object.freeze([.001,.65,.08]),strength:2}),
  isolationThresholds:Object.freeze([.38,.66]),
  sourceBody:Object.freeze({
    texspaceCenter:Object.freeze([.000006973743438720703,-.000013902783393859863,1.1804927587509155]),
    texspaceHalfSize:Object.freeze([.877256453037262,.4755038022994995,1.1923989057540894]),
    canonicalBlenderFromGLTFLocal:'(x, -z, y)',
  }),
});
const clamp01=v=>Math.max(0,Math.min(1,v));
const mix=(a,b,t)=>a*(1-t)+b*t;
function finite(value,name){if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${name} must be finite`);return value;}
function point3(position){if(!position||position.length!==3)throw new TypeError('position must have three coordinates');return Array.from(position,(v,i)=>finite(v,`position[${i}]`));}
/** CPU wrap before uploading to the GPU. Reject NaN/infinity; avoid epoch-sized float time. */
export function wrapSeconds(seconds){const r=finite(seconds,'seconds')%6;const t=r<0?r+6:r;return t===0||t===6?0:t;}
/** Native bake inputs only. These fixed coordinates NEVER receive time or animation offsets. */
export function fixedFieldInputs(canonicalSourcePosition){const p=point3(canonicalSourcePosition);return SAJU.fixedFieldOffsets.map(c=>p.map((v,i)=>v+c[i]));}
/** A→B→C→A, pairwise smooth unit-L2 weights. Trigonometry changes weights, not positions. */
export function evolutionWeights(seconds){
  const phase=wrapSeconds(seconds)/2,segment=Math.floor(phase),u=phase-segment;
  const theta=Math.PI*.5*u*u*(3-2*u),w=[0,0,0];
  w[segment]=Math.cos(theta);w[(segment+1)%3]=Math.sin(theta);return w;
}
/** Analytic first derivatives in seconds; exactly zero at 0, 2, 4 and 6. */
export function evolutionWeightVelocity(seconds){
  const phase=wrapSeconds(seconds)/2,segment=Math.floor(phase),u=phase-segment;
  const theta=Math.PI*.5*u*u*(3-2*u),speed=Math.PI*.5*3*u*(1-u),v=[0,0,0];
  v[segment]=-Math.sin(theta)*speed;v[(segment+1)%3]=Math.cos(theta)*speed;return v;
}
/** Integer sample centers, source row 0 at canonical Y-min. flipV describes actual upload order. */
export function atlasTexelUV(x,y,z,flipV=false){
  for(const v of [x,y,z])if(!Number.isInteger(v)||v<0||v>127)throw new RangeError('atlas grid index must be an integer in [0, 127]');
  const u=((z%16)*128+x+.5)/2048,v=(Math.floor(z/16)*128+y+.5)/1024;return [u,flipV?1-v:v];
}
/**
 * Eight-texel trilinear RGB sampler. Accepts interleaved RGBA unsigned bytes only.
 * The native noise constant offsets are already baked into the three channels.
 * No PNG decoding, colorspace conversion, time, or extra coordinate offset occurs here.
 * flipV=true is only for bytes whose complete 1024-row image has been reversed.
 */
export function sampleFieldsAtlas(data,canonicalSourcePosition,flipV=false){
  if(!(data instanceof Uint8Array)||data.length!==SAJU.atlas.byteLength)throw new TypeError('atlas must contain 8,388,608 interleaved RGBA8 bytes');
  const grid=point3(canonicalSourcePosition).map(v=>127*clamp01(v));
  const lo=grid.map(Math.floor),hi=lo.map(v=>Math.min(v+1,127)),f=grid.map((v,i)=>v-lo[i]);
  const read=(x,y,z,c)=>{let row=Math.floor(z/16)*128+y;if(flipV)row=1023-row;return data[4*(row*2048+(z%16)*128+x)+c]/255;};
  return [0,1,2].map(c=>{
    const xy=z=>mix(mix(read(lo[0],lo[1],z,c),read(hi[0],lo[1],z,c),f[0]),mix(read(lo[0],hi[1],z,c),read(hi[0],hi[1],z,c),f[0]),f[1]);
    return mix(xy(lo[2]),xy(hi[2]),f[2]);
  });
}
export function blendFields(fields,seconds){const rgb=point3(fields),w=evolutionWeights(seconds);return clamp01(.5+rgb.reduce((sum,v,i)=>sum+w[i]*(v-.5),0));}
export function masksFromField(field){
  finite(field,'field');const emissionMask=clamp01((field-.50)/.22),s=clamp01((field-.38)/.28),isolationMask=s*s*(3-2*s);
  return {emissionMask,isolationMask,reflectiveFraction:1-isolationMask};
}
/** Geometry, jade texture coordinates and all three field sample coordinates remain static. */
export function evaluateJadeEvolution(data,canonicalSourcePosition,seconds,flipV=false){
  const fieldSourcePosition=point3(canonicalSourcePosition),fields=sampleFieldsAtlas(data,fieldSourcePosition,flipV);
  const field=blendFields(fields,seconds),masks=masksFromField(field);
  return {fieldSourcePosition,fields,weights:evolutionWeights(seconds),field,...masks,emissionRadiance:SAJU.emission.linearRGB.map(v=>v*2*masks.emissionMask)};
}
/** Input is the complete original unattenuated jade BRDF radiance in linear space. */
export function composeLinear(originalJadeBRDF,evolution){return point3(originalJadeBRDF).map((v,i)=>v*evolution.reflectiveFraction+evolution.emissionRadiance[i]);}
/** Verified only for the unchanged v001 body export's undeformed glTF-local POSITION. */
export function gltfLocalToGenerated(gltfLocalPosition){const [x,y,z]=point3(gltfLocalPosition);return [x,-z,y].map((v,i)=>.5+(v-SAJU.sourceBody.texspaceCenter[i])/(2*SAJU.sourceBody.texspaceHalfSize[i]));}
