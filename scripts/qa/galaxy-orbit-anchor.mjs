// Exercise the production orbit and connection blocks without a GPU.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import * as THREE from 'three';

const source=await fs.readFile('components/planet/GalaxyCanvas.tsx','utf8');
const helper=ts.transpileModule(await fs.readFile('lib/planet/galaxy-motion.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const { setGalaxyOrbitPosition }=await import('data:text/javascript;base64,'+Buffer.from(helper).toString('base64'));
function compile(code,args){return new Function(...args,ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText);}
function runtime(text){
 const orbitStart=text.indexOf('if (galaxyGroupRef.current) {',text.indexOf('const simulationTime ='));
 const orbitEnd=text.indexOf('// 2. 추적 대상',orbitStart);
 assert(orbitStart>=0&&orbitEnd>orbitStart);
 const samplingStart=text.indexOf('connectionsRef.current.forEach',text.indexOf('// 7. 인연선'));
 const samplingEnd=text.indexOf('\n      });',samplingStart)+10;
 const construction=text.match(/const curve = new THREE\.QuadraticBezierCurve3\([^;]+;/)?.[0];assert(construction);
 return {
  orbit:compile(text.slice(orbitStart,orbitEnd),['galaxyGroupRef','spiralGalaxy','planetMeshesRef','landingAnimRef','simulationTime','setGalaxyOrbitPosition','motionDt','reducedMotion']),
  sample:compile(text.slice(samplingStart,samplingEnd),['THREE','connectionsRef','ownerGroupRef','motionDt','connectionOrigin','connectionPoint']),
  curve:compile(construction+'\nreturn curve;',['THREE','ownerPos','mid','friendPos']),
 };
}
const production=runtime(source),previous=runtime(execFileSync('git',['show','3d180b141993d86f7198f2f393e6e20acdf1eeab:components/planet/GalaxyCanvas.tsx'],{encoding:'utf8'}));
function scene(engine){
 const ownerNode={isOwner:true,worldPos:new THREE.Vector3(5.8,.1,0)},friendNode={isOwner:false,worldPos:new THREE.Vector3(7,.3,2)};
 const ownerGroup=new THREE.Group(),friendGroup=new THREE.Group();ownerGroup.position.copy(ownerNode.worldPos);friendGroup.position.copy(friendNode.worldPos);
 const start=friendNode.worldPos.clone();
 const mid=ownerNode.worldPos.clone().add(friendNode.worldPos).multiplyScalar(.5);mid.y+=.9;
 const curve=engine.curve(THREE,ownerNode.worldPos,mid,friendNode.worldPos);
 const connection={friendGroup,curve,line:new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)),new THREE.LineBasicMaterial()),pulseMesh:new THREE.Object3D(),pulseT:0};
 return {engine,ownerNode,friendNode,ownerGroup,friendGroup,start,connection,connectionsRef:{current:[connection]},ownerGroupRef:{current:ownerGroup},planets:{current:new Map([['owner',{group:ownerGroup,node:ownerNode}],['friend',{group:friendGroup,node:friendNode}]])},galaxy:{current:new THREE.Group()},spiral:{galaxyGroup:new THREE.Group()},landing:{current:null},origin:new THREE.Vector3(),point:new THREE.Vector3()};
}
function step(s,time,dt){s.engine.orbit(s.galaxy,s.spiral,s.planets,s.landing,time,setGalaxyOrbitPosition,dt,{matches:false});s.engine.sample(THREE,s.connectionsRef,s.ownerGroupRef,dt,s.origin,s.point);}
function expected(start,time){const radius=Math.hypot(start.x,start.z),angle=time*.052/Math.sqrt(Math.max(1,radius/6)),c=Math.cos(angle),s=Math.sin(angle);return new THREE.Vector3(start.x*c+start.z*s,start.y,start.z*c-start.x*s);}
function run(engine,fps,seconds){const s=scene(engine);for(let frame=1;frame<=fps*seconds;frame++)step(s,frame/fps,1/fps);return s;}
const old60=run(previous,60,1),old120=run(previous,120,1),correct=expected(old60.start,1);
console.log(JSON.stringify({baseline:{afterOneSecond60FPS:old60.friendGroup.position.toArray(),afterOneSecond120FPS:old120.friendGroup.position.toArray(),expected:correct.toArray(),error60FPS:old60.friendGroup.position.distanceTo(correct),frameRateDifference:old60.friendGroup.position.distanceTo(old120.friendGroup.position),anchorMutated:!old60.friendNode.worldPos.equals(old60.start)}},null,2));

const checks=[],single=scene(production);step(single,1/60,1/60);
assert.deepEqual(single.friendNode.worldPos.toArray(),single.start.toArray(),'Updating a connection must not mutate its planet\'s fixed orbit anchor');
assert.notEqual(single.connection.curve.v2,single.friendNode.worldPos);assert.notEqual(single.connection.curve.v0,single.ownerNode.worldPos);
checks.push('connection endpoints are independent of owner/friend fixed orbit anchors');
for(const fps of [30,60,144])for(const seconds of [1,10,60,600]){
 const s=run(production,fps,seconds);assert(s.friendGroup.position.distanceTo(expected(s.start,seconds))<1e-10,`${fps} FPS / ${seconds}s must follow the fixed-anchor orbit`);
 assert.deepEqual(s.friendNode.worldPos.toArray(),s.start.toArray());assert(s.connection.curve.v2.equals(s.friendGroup.position));
}
checks.push('30/60/144 FPS through 600 seconds have identical intended orbit positions without acceleration');
const period=2*Math.PI*Math.sqrt(Math.max(1,Math.hypot(single.start.x,single.start.z)/6))/.052;
for(const fps of [30,60,144]){const s=run(production,fps,Math.floor(period));step(s,period,period-Math.floor(period));assert(s.friendGroup.position.distanceTo(s.start)<1e-10,'One intended period must return to the fixed starting point');}
checks.push(`unchanged slow orbit completes one turn in ${period.toFixed(3)} seconds for the radius-7.28 fixture`);
const paused=run(production,60,10),position=paused.friendGroup.position.clone();for(let frame=0;frame<180;frame++)step(paused,10,0);assert(paused.friendGroup.position.equals(position));
assert(paused.connection.curve.v2.equals(position));checks.push('180 paused frames cannot move a surrounding planet or its connection endpoint');
step(paused,10+1/60,1/60);assert(paused.friendGroup.position.distanceTo(expected(paused.start,10+1/60))<1e-10);assert(paused.friendGroup.position.distanceTo(position)<.01);
checks.push('resuming after a pause advances by one normal timestep without a jump');
const first=run(production,60,10),other=run(production,120,20),firstPosition=first.friendGroup.position.clone();step(other,21,1);assert(first.friendGroup.position.equals(firstPosition));assert(first.friendNode.worldPos.equals(first.start));
checks.push('separate scenes and connection updates cannot mutate another scene anchor');
const result={status:'PASS',checks,baseline:{source:'3d180b141993d86f7198f2f393e6e20acdf1eeab',afterOneSecondPositionError:old60.friendGroup.position.distanceTo(correct),differenceBetween60And120FPS:old60.friendGroup.position.distanceTo(old120.friendGroup.position)},limits:['Actual production motion/construction/sampling code with synthetic Three.js scene objects','CPU behavior only; no browser or visual reproduction claim','No changes to orbit speed, shape, shaders, artwork, authentication or stored records']};
await fs.mkdir('outputs/galaxy-orbit-anchor',{recursive:true});await fs.writeFile('outputs/galaxy-orbit-anchor/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
