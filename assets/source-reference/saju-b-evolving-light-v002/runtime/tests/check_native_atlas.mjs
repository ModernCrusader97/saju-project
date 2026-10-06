/** Verify delivered RGBA8 fields against native probes and animation invariants. */
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SAJU,sampleFieldsAtlas,blendFields,masksFromField,evaluateJadeEvolution } from '../saju-jade-evolution.mjs';
const root=new URL('../',import.meta.url);
const meta=JSON.parse(await readFile(new URL('atlas-metadata.json',root),'utf8'));
const atlas=await readFile(new URL(`textures/${meta.atlasRaw}`,root));
assert.equal(atlas.byteLength,8388608);
assert.equal(createHash('sha256').update(atlas).digest('hex'),meta.raw_sha256);
assert.deepEqual(meta.domainMin,[0,0,0]);assert.deepEqual(meta.domainMax,[1,1,1]);
assert.deepEqual(meta.fixed_field_offsets,SAJU.fixedFieldOffsets);
for(const [key,value] of Object.entries({Scale:4.3,Detail:3.2,Roughness:.65,Lacunarity:2}))assert.ok(Math.abs(meta.noise[key]-value)<1e-6);
assert.equal(meta.noise.Distortion,0);
assert.deepEqual([meta.dimension,meta.columns,meta.rows,meta.width,meta.height],[128,16,8,2048,1024]);
const ranges=[[255,0],[255,0],[255,0]];
for(let i=0;i<atlas.length;i+=4){assert.equal(atlas[i+3],255);for(let c=0;c<3;c++){ranges[c][0]=Math.min(ranges[c][0],atlas[i+c]);ranges[c][1]=Math.max(ranges[c][1],atlas[i+c]);}}
for(const [min,max] of ranges)assert.ok(min<max);
const metrics=errors=>({maxAbsolute:Math.max(...errors),meanAbsolute:errors.reduce((a,b)=>a+b,0)/errors.length,rms:Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/errors.length)});
const report={atlasBytes:atlas.byteLength,verifiedRawSHA256:meta.raw_sha256,fieldRanges:ranges.map(r=>r.map(x=>x/255)),samples:0,maximumLoopEndpointError:0,maximumStaticFieldDifference:0,animatedMaskSpan:0,boundaryDerivativesMax:0,spatialOppositeChangeCounts:[],nativeProbeComparison:null};
const points=[];
for(const x of [.05,.2,.35,.5,.65,.8,.95])for(const y of [.05,.2,.35,.5,.65,.8,.95])for(const z of [.05,.2,.35,.5,.65,.8,.95])points.push([x,y,z]);
for(const p of points){
 const start=evaluateJadeEvolution(atlas,p,0),end=evaluateJadeEvolution(atlas,p,6);report.maximumLoopEndpointError=Math.max(report.maximumLoopEndpointError,Math.abs(start.field-end.field));
 let lo=1,hi=0;
 for(let frame=0;frame<72;frame++){
  const r=evaluateJadeEvolution(atlas,p,frame/12);report.samples++;
  assert.ok([r.field,r.emissionMask,r.isolationMask,...r.emissionRadiance].every(Number.isFinite));
  assert.deepEqual(r.fieldSourcePosition,p);
  for(let c=0;c<3;c++)report.maximumStaticFieldDifference=Math.max(report.maximumStaticFieldDifference,Math.abs(r.fields[c]-start.fields[c]));
  lo=Math.min(lo,r.emissionMask);hi=Math.max(hi,r.emissionMask);
 }
 report.animatedMaskSpan=Math.max(report.animatedMaskSpan,hi-lo);
 for(const t of [0,2,4,6]){const h=1e-5,c=blendFields(start.fields,t);for(const sign of [-1,1])report.boundaryDerivativesMax=Math.max(report.boundaryDerivativesMax,Math.abs((blendFields(start.fields,t+sign*h)-c)/h));}
}
for(const t of [0,2,4]){
 let brighter=0,darker=0;
 for(const p of points){const fields=sampleFieldsAtlas(atlas,p),d=blendFields(fields,t+2)-blendFields(fields,t);if(d>.03)brighter++;if(d<-.03)darker++;}
 assert.ok(brighter>10&&darker>10,'each transition must brighten some places and darken others');
 report.spatialOppositeChangeCounts.push({fromSeconds:t,toSeconds:t+2,brighter,darker});
}
assert.equal(report.maximumLoopEndpointError,0);assert.equal(report.maximumStaticFieldDifference,0);assert.ok(report.animatedMaskSpan>.1);assert.ok(report.boundaryDerivativesMax<.00003);
const probes=JSON.parse(await readFile(new URL('native-field-probes.json',root),'utf8'));
assert.equal(probes.points.length,probes.nativeValues.length);assert.ok(probes.points.length>=8);
const perField=[[],[],[]],combined=[],emission=[],isolation=[];
for(let i=0;i<probes.points.length;i++){
 const actual=sampleFieldsAtlas(atlas,probes.points[i]),native=probes.nativeValues[i];assert.equal(native.length,3);
 for(let c=0;c<3;c++)perField[c].push(Math.abs(actual[c]-native[c]));
 for(let t=0;t<6;t+=.5){const a=blendFields(actual,t),b=blendFields(native,t),am=masksFromField(a),bm=masksFromField(b);combined.push(Math.abs(a-b));emission.push(Math.abs(am.emissionMask-bm.emissionMask));isolation.push(Math.abs(am.isolationMask-bm.isolationMask));}
}
report.nativeProbeComparison={points:probes.points.length,blendedChecks:combined.length,fieldABC:perField.map(metrics),blendedField:metrics(combined),emissionMask:metrics(emission),isolationMask:metrics(isolation),acceptanceBudget:{perFieldMax:.02,blendedFieldMax:.025,emissionMax:.12,isolationMax:.14}};
const p=report.nativeProbeComparison;
assert.ok(p.fieldABC.every(x=>x.maxAbsolute<.02));assert.ok(p.blendedField.maxAbsolute<.025);assert.ok(p.emissionMask.maxAbsolute<.12);assert.ok(p.isolationMask.maxAbsolute<.14);
await writeFile(new URL('tests/native-atlas-results.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
