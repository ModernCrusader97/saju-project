import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {view,owner,friend,incoming,dom} from './galaxy-scene-host.mjs';

const output=path.resolve('outputs/galaxy-spacing-directions/scene');await fs.mkdir(output,{recursive:true});
const checks=[],measurements=[];
const keys=['갑자','을축','병인','정묘','무진','기사','경오','신미','임신','계유'];
const persons=Array.from({length:24},(_,i)=>({...friend,id:i===0?owner.id:`scene-spacing-${i}`,isMe:i===0,name:'Synthetic scene '+i,affinityScore:[99,95,90,88,84,73][i%6],pillars:{dayKey:keys[i%10],monthKey:keys[(i+3)%10],yearKey:keys[(i+6)%10],hourKey:keys[(i+8)%10]}}));
async function check(name,fn){try{await fn();checks.push({name,status:'PASS'});console.log('PASS',name);}catch(e){checks.push({name,status:'FAIL',error:e.stack});console.error('FAIL',name,e.message);}}
function capture(scene){const nodes=scene.nodes();return scene.groups().map((g,i)=>{const mesh=g.children[0],belt=g.children.find(o=>o.isPoints),pivot=g.children.find(o=>o.isGroup),moon=pivot?.children[0];return{id:nodes[i].person.id,position:g.position.toArray(),directions:{...nodes[i].rotationDirections},spin:mesh.rotation.y,belt:belt.rotation.y,moonOrbit:pivot?.rotation.y,moonSpin:moon?.rotation.y};});}
function gap(scene){let minimum=Infinity;const nodes=scene.nodes(),groups=scene.groups();for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++)minimum=Math.min(minimum,groups[i].position.distanceTo(groups[j].position)-nodes[i].visualRadius-nodes[j].visualRadius);return minimum;}

for(const fps of[30,60,144])await check(`${fps}fps actual React scene keeps envelopes and independent rotations for 600 seconds`,async()=>{
 const scene=await view({initialPeople:persons});try{await scene.frame(0);const begin=process.hrtime.bigint();let minimum=Infinity;
  await scene.advance(fps*600,1000/fps,f=>{if(f%fps===0){minimum=Math.min(minimum,gap(scene));assert(minimum>=.6-1e-8);}});
  for(const row of capture(scene)){assert(Math.abs(row.spin-.16*600*row.directions.body)<1e-8);assert(Math.abs(row.belt-.075*600*row.directions.belt)<1e-8);assert(Math.abs(row.moonOrbit-.32*600*row.directions.moonOrbit)<1e-8);assert(Math.abs(row.moonSpin-.21*600*row.directions.moonSpin)<1e-8);}
  measurements.push({fps,seconds:600,systems:persons.length,minimumEnvelopeGap:minimum,hostMilliseconds:Number(process.hrtime.bigint()-begin)/1e6});
 }finally{await scene.close();}
});
await check('pause, zero speed, prop rebuild, append and reset preserve ID directions and absolute rotation',async()=>{
 const scene=await view({initialPeople:persons});try{await scene.frame(0);await scene.advance(240,1000/60);const before=capture(scene),anchors=scene.nodes().map(n=>n.worldPos.toArray());
  await scene.click('움직임 멈춤');await scene.advance(600,1000/60);assert.deepEqual(capture(scene),before);
  await scene.click('움직임 재생');await scene.setSpeed(0);await scene.advance(120,1000/60);assert.deepEqual(capture(scene),before);
  await scene.setSpeed(1);await scene.arrive();assert.deepEqual(capture(scene).slice(0,before.length),before,'Appending a system must not reset existing spin or teleport the old systems.');assert.deepEqual(scene.nodes().slice(0,before.length).map(n=>n.worldPos.toArray()),anchors);
  let min=Infinity;await scene.advance(180,1000/60,()=>{min=Math.min(min,gap(scene));assert(min>=.6-1e-8);});
  const idDirections=capture(scene).map(r=>({id:r.id,d:r.directions}));await scene.click('초기화');for(const r of capture(scene)){assert.equal(r.spin,0);assert.equal(r.belt,0);assert.equal(r.moonOrbit,0);assert.equal(r.moonSpin,0);}
  assert.deepEqual(capture(scene).map(r=>({id:r.id,d:r.directions})),idDirections);assert(gap(scene)>=.6-1e-8);measurements.push({scenario:'pause-rebuild-entry-reset',entryMinimumEnvelopeGap:min,systems:scene.nodes().length});
 }finally{await scene.close();}
});
dom.window.close();const report={status:checks.every(c=>c.status==='PASS')?'PASS':'FAIL',checks,measurements,limits:['Actual React component and Three objects; GPU, Canvas2D and host clock are explicit CPU boundaries.','Native Worker/WebGL verification is recorded separately.']};await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');if(report.status!=='PASS')process.exitCode=1;
