import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import * as THREE from 'three';

// Execute the actual connection-update block, not a duplicated optimized algorithm.
function compile(source) {
 const marker=source.indexOf('// 7. 인연선'); assert(marker>=0);
 const start=source.indexOf('connectionsRef.current.forEach',marker),end=source.indexOf('\n      });',start)+10;
 assert(start>=0&&end>start);
 const code=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function('THREE','connectionsRef','ownerGroupRef','motionDt','connectionOrigin','connectionPoint',code);
}
const file='components/planet/GalaxyCanvas.tsx';
const current=compile(await fs.readFile(file,'utf8'));
const baseline=compile(execFileSync('git',['show','9cfbe47e373a79e88006405c8bc3c4298c62b6d8:'+file],{encoding:'utf8'}));
function fixtures() {
 const counters={vectors:0,arrays:0};
 const connections=Array.from({length:10},(_,i)=>{
  const curve=new THREE.QuadraticBezierCurve3();
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)),new THREE.LineBasicMaterial());
  const getPoint=curve.getPoint,getPoints=curve.getPoints;
  curve.getPoint=function(t,target){if(target===undefined)counters.vectors++;return getPoint.call(this,t,target);};
  curve.getPoints=function(divisions){counters.arrays++;return getPoints.call(this,divisions);};
  return {curve,line,friendGroup:new THREE.Group(),pulseMesh:new THREE.Object3D(),pulseT:i/10};
 });
 return {connectionsRef:{current:connections},ownerGroupRef:{current:new THREE.Group()},counters,origin:new THREE.Vector3(),point:new THREE.Vector3()};
}
const old=fixtures(),next=fixtures(),checks=[];
function step(state,update,frame,dt,owner=true) {
 if(owner)state.ownerGroupRef.current.position.set(Math.sin(frame/7)*3,Math.cos(frame/11),Math.sin(frame/13));
 state.connectionsRef.current.forEach((conn,i)=>conn.friendGroup.position.set(Math.cos(frame/23+i)*15,i*.2,Math.sin(frame/19+i)*15));
 update(THREE,state.connectionsRef,owner?state.ownerGroupRef:{current:null},dt,state.origin,state.point);
}
function equivalent(a,b) {
 for(let i=0;i<a.connectionsRef.current.length;i++) {
  const x=a.connectionsRef.current[i],y=b.connectionsRef.current[i];
  assert.deepEqual(x.line.geometry.getAttribute('position').array,y.line.geometry.getAttribute('position').array);
  assert.deepEqual(x.pulseMesh.position.toArray(),y.pulseMesh.position.toArray()); assert.equal(x.pulseT,y.pulseT);
  assert.deepEqual(x.line.geometry.boundingSphere.center.toArray(),y.line.geometry.boundingSphere.center.toArray());
  assert.equal(x.line.geometry.boundingSphere.radius,y.line.geometry.boundingSphere.radius);
 }
}
for(let frame=0;frame<120;frame++){const dt=frame%9===0?0:1/60;step(old,baseline,frame,dt);step(next,current,frame,dt);equivalent(old,next);}
assert.deepEqual(old.counters,{vectors:31200,arrays:1200});
assert.deepEqual(next.counters,{vectors:0,arrays:0},'Connection sampling must reuse scene vectors without getPoints arrays or default getPoint allocations');
checks.push('10 connections × 120 frames: baseline 31,200 sample vectors / 1,200 arrays; restored 0 / 0');
checks.push('all Float32 point coordinates, pulse phases/positions and recomputed bounding spheres equal v27 exactly');
const geometry=next.connectionsRef.current.map(c=>[c.line.geometry,c.line.geometry.getAttribute('position'),c.line.geometry.getAttribute('position').array]);
for(let frame=0;frame<20;frame++){step(old,baseline,frame,frame/3,false);step(next,current,frame,frame/3,false);equivalent(old,next);}
next.connectionsRef.current.forEach((c,i)=>{assert.equal(c.line.geometry,geometry[i][0]);assert.equal(c.line.geometry.getAttribute('position'),geometry[i][1]);assert.equal(c.line.geometry.getAttribute('position').array,geometry[i][2]);});
checks.push('missing owner fallback, zero motion and pulse wrap remain equivalent; geometry and typed buffers retain identity');
const other=fixtures();step(other,current,4321,.75);const first=next.connectionsRef.current.map(c=>[...c.pulseMesh.position.toArray()]);
step(other,current,5000,.5);assert.deepEqual(next.connectionsRef.current.map(c=>c.pulseMesh.position.toArray()),first);
checks.push('separate scene sampling vectors do not affect another mounted scene');
const result={status:'PASS',checks,limits:['Counts cover connection curve sampling only, not total scene allocations or frame rate','CPU equality with pinned Three.js; no WebGL or real-browser rendering claim']};
await fs.mkdir('outputs/galaxy-sampling',{recursive:true});await fs.writeFile('outputs/galaxy-sampling/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
