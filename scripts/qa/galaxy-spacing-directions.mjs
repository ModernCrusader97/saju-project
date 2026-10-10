import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {build} from 'esbuild';
import * as THREE from 'three';

const phase=process.env.SAJU_QA_PHASE||'after',output=path.resolve('outputs/galaxy-spacing-directions',phase);
await fs.mkdir(output,{recursive:true});const entry=path.join(output,'runtime.mjs');
const layout=await fs.access('lib/planet/galaxy-system-layout.ts').then(()=>true,()=>false);
await build({stdin:{contents:`export * from './lib/planet/galaxy-helper';export * from './lib/planet/galaxy-motion';${layout?"export * from './lib/planet/galaxy-system-layout';":''}`,resolveDir:process.cwd()},outfile:entry,bundle:true,platform:'node',format:'esm',packages:'external'});
const api=await import(pathToFileURL(entry).href),checks=[],measurements={};
const sha=b=>createHash('sha256').update(b).digest('hex');
const keys=['갑자','을축','병인','정묘','무진','기사','경오','신미','임신','계유'];
const people=count=>Array.from({length:count},(_,i)=>({id:`spacing-synthetic-${i}`,name:`Synthetic ${i}`,isMe:i===0,relationTitle:'synthetic',affinityScore:[99,95,90,88,84,73][i%6],pillars:{dayKey:keys[i%10],monthKey:keys[(i+3)%10],yearKey:keys[(i+6)%10],...(i%3!==2?{hourKey:keys[(i+8)%10]}:{})}}));
// Independent envelope from the unchanged production construction. Belt jitter,
// thickness and point size are included; moon includes living radial relief.
function envelope(n){const s=n.isOwner?1.3:.88,b=s*.58;return Math.max(s*1.065,Math.hypot(3.46*b,.11*b)+.08*b,n.hourKey?s*(2.2+.28*1.065):0);}
const point=new THREE.Vector3();
function positions(nodes,time){return nodes.map(n=>{if(n.isOwner)return n.worldPos.clone();api.setGalaxyOrbitPosition(point,n.worldPos,time,n.baseRadius);return point.clone();});}
function minimum(nodes,time){const p=positions(nodes,time);let gap=Infinity,pair;for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const d=p[i].distanceTo(p[j])-envelope(nodes[i])-envelope(nodes[j]);if(d<gap){gap=d;pair=[i,j];}}return{gap,pair};}
async function check(name,run){try{await run();checks.push({name,status:'PASS'});console.log('PASS',name);}catch(error){checks.push({name,status:'FAIL',error:error.stack});console.error('FAIL',name,error.message);}}

await check('full body/ring/moon envelopes remain separated during slow differential orbits',()=>{
 let min=Infinity,worst;for(const count of[2,8,24,64])for(const scale of[.7,1,1.5]){
  const nodes=api.buildGalaxyNodes(people(count),scale),anchors=nodes.map(n=>n.worldPos.toArray());
  for(const time of[0,1,20,120,600,3600,7200,21600,86400]){const m=minimum(nodes,time);if(m.gap<min){min=m.gap;worst={count,scale,time,...m};}assert(m.gap>=.6-1e-8,JSON.stringify({count,scale,time,...m}));}
  assert.deepEqual(nodes.map(n=>n.worldPos.toArray()),anchors);
 }measurements.spacing={minEnvelopeGap:min,worst};
});
await check('first lane remains valid with unknown owner birth time and every moon/affinity combination',()=>{
 let min=Infinity,cases=0;
 for(const ownerHour of[false,true])for(const friendHour of[false,true])for(const score of[0,73,84,87,90,94,99,100])for(const scale of[.7,1,1.5]){
  const persons=people(2);persons[1].affinityScore=score;
  if(!ownerHour)delete persons[0].pillars.hourKey;
  if(!friendHour)delete persons[1].pillars.hourKey;
  const nodes=api.buildGalaxyNodes(persons,scale),m=minimum(nodes,0);
  assert(nodes.every(n=>n.worldPos.toArray().every(Number.isFinite)));
  assert(m.gap>=.6-1e-8,JSON.stringify({ownerHour,friendHour,score,scale,...m}));
  min=Math.min(min,m.gap);cases++;
 }measurements.firstLane={cases,minimumEnvelopeGap:min};
});
await check('analytical orbit-lane separation bounds all future angles, including a fixed owner',()=>{
 const nodes=api.buildGalaxyNodes(people(128),.7);let bound=Infinity;
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  const a=nodes[i],b=nodes[j],same=!a.isOwner&&!b.isOwner&&a.baseRadius===b.baseRadius;
  const horizontal=same?Math.hypot(a.worldPos.x-b.worldPos.x,a.worldPos.z-b.worldPos.z):Math.abs(a.baseRadius-b.baseRadius);
  const gap=horizontal-envelope(a)-envelope(b);bound=Math.min(bound,gap);assert(gap>=.6-1e-8,JSON.stringify({i,j,gap,same}));
 }measurements.analytic={nodes:nodes.length,minimumHorizontalEnvelopeGap:bound,lanes:new Set(nodes.map(n=>n.baseRadius)).size};
});
await check('affinity data, selected arm meanings and owner anchor survive packing; append preserves existing anchors',()=>{
 const persons=people(24),before=structuredClone(persons),nodes=api.buildGalaxyNodes(persons),again=api.buildGalaxyNodes([...persons,...people(1).map(p=>({...p,id:'arrival-synthetic',isMe:false,affinityScore:99}))]);
 assert.deepEqual(persons,before);assert.deepEqual(nodes.map(n=>n.worldPos.toArray()),again.slice(0,nodes.length).map(n=>n.worldPos.toArray()));
 for(let i=1;i<nodes.length;i++){const score=persons[i].affinityScore,expected=score>=94?0:score>=87?(i-1)%2===0?1:3:2;assert.equal(nodes[i].armIndex,expected);assert.equal(nodes[i].person.affinityScore,score);assert.deepEqual(nodes[i].person.pillars,persons[i].pillars);}
 assert.equal(nodes[0].baseRadius,5.8);assert.equal(nodes[0].worldPos.y,.1);assert.deepEqual(nodes.map(n=>n.worldPos.toArray()),api.buildGalaxyNodes(persons).map(n=>n.worldPos.toArray()));
});
await check('each ID has independent stable bidirectional spin, ring and per-moon directions',()=>{
 assert.equal(typeof api.galaxyRotationDirection,'function');const counts=Array.from({length:4},()=>({plus:0,minus:0})),cross=Array.from({length:4},()=>Array(4).fill(0));
 const parts=['body-spin','year-ring','moon:hour:orbit','moon:hour:spin'];const n=10000;
 for(let i=0;i<n;i++){const signs=parts.map(part=>api.galaxyRotationDirection(`direction-synthetic-${i}`,part));signs.forEach((s,j)=>{assert([-1,1].includes(s));counts[j][s===1?'plus':'minus']++;assert.equal(s,api.galaxyRotationDirection(`direction-synthetic-${i}`,parts[j]));signs.forEach((t,k)=>cross[j][k]+=s*t);});}
 for(let j=0;j<4;j++){assert(Math.abs(counts[j].plus/n-.5)<.025);for(let k=j+1;k<4;k++)assert(Math.abs(cross[j][k]/n)<.035);}
 const persons=people(24),a=api.buildGalaxyNodes(persons),b=api.buildGalaxyNodes([...persons].reverse());
 for(const node of a)assert.deepEqual(node.rotationDirections,b.find(n=>n.person.id===node.person.id).rotationDirections);
 for(let i=0;i<100;i++)assert([-1,1].includes(api.galaxyRotationDirection('one-person',`moon:${i}:orbit`)));
 measurements.directionDistribution={IDs:n,counts,crossCorrelation:cross.map(row=>row.map(v=>v/n))};
});
await check('30/60/144 fps long runs preserve envelopes and agree with the original analytic speed',()=>{
 const nodes=api.buildGalaxyNodes(people(12)),anchors=nodes.map(n=>n.worldPos.toArray());let min=Infinity,maxError=0;
 for(const fps of[30,60,144]){let simulationTime=0;const dt=1/fps;
  for(let frame=1;frame<=fps*3600;frame++){simulationTime+=dt;if(frame%fps)continue;const m=minimum(nodes,simulationTime);min=Math.min(min,m.gap);assert(m.gap>=.6-1e-8);}
  const actual=positions(nodes,simulationTime);for(let i=1;i<nodes.length;i++){const anchor=nodes[i].worldPos,angle=3600*.052/Math.sqrt(Math.max(1,nodes[i].baseRadius/6)),expected=anchor.clone().applyAxisAngle(new THREE.Vector3(0,1,0),angle);maxError=Math.max(maxError,actual[i].distanceTo(expected));}
  assert.deepEqual(nodes.map(n=>n.worldPos.toArray()),anchors);
 }assert(maxError<1e-6);measurements.longRun={seconds:3600,fps:[30,60,144],minimumEnvelopeGap:min,maxEndpointError:maxError,positionsCheckedEverySimulationSecond:true};
});
await check('system envelope helper contains body, belt and complete moon sweep across scales',()=>{
 assert.equal(typeof api.galaxySystemVisualRadius,'function');for(const scale of[.25,.88,1.3,2.5,5])for(const moon of[false,true]){const r=api.galaxySystemVisualRadius(scale,moon);assert(r>=scale*1.065);assert(r>=Math.hypot(3.46*scale*.58,.11*scale*.58)+.08*scale*.58);if(moon)assert(r>=scale*(2.2+.28*1.065));}
});
await check('dense deterministic construction remains bounded without per-frame collision simulation',()=>{
 const persons=people(256),begin=performance.now(),nodes=api.buildGalaxyNodes(persons);const ms=performance.now()-begin;assert.equal(nodes.length,256);assert(nodes.every(n=>n.worldPos.toArray().every(Number.isFinite)));assert(ms<1500);measurements.layoutPerformance={systems:256,milliseconds:ms,budgetMilliseconds:1500};
});
const sourceHashes={};for(const f of ['components/planet/GalaxyCanvas.tsx','lib/planet/galaxy-helper.ts','lib/planet/galaxy-motion.ts',...(layout?['lib/planet/galaxy-system-layout.ts']:[])])sourceHashes[f]=sha(await fs.readFile(f));
const report={status:checks.every(c=>c.status==='PASS')?'PASS':'FAIL',phase,checks,measurements,sourceHashes,limits:['CPU uses actual node placement and orbit code; native WebGL/React integration is checked separately.','Analytical disjoint lanes plus constant equal-radius phase separation provide the all-angle bound; hourly long-run samples alone would not prove it.','Rendered text-label rectangles and star glow are excluded from physical system envelopes.']};
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');if(report.status!=='PASS')process.exitCode=1;
