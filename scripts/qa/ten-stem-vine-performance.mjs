// Exact before/after CPU construction on the same actual B GLB in one browser.
// Frozen baseline comes from Git; only QA snapshots receive timing instrumentation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { transform } from 'esbuild';

const root = process.cwd();
const baseline = '861584b5ffe1df41a8c8fcf0f948e3b1c20905e2';
const phase = process.env.SAJU_QA_VINE_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/ten-stem-materials/vine-performance', phase);
await fs.mkdir(output, { recursive: true });
const gitSource = file => execFileSync('git', ['show', baseline + ':' + file], { cwd: root, encoding: 'utf8' });
const meshSource = gitSource('lib/planet/mesh-surface.ts');
const accentSource = gitSource('lib/planet/surface-stem-accents.ts')
  .replace("'./surface-woody-branches'", "'/lib/planet/surface-woody-branches'")
  .replace("'./approved-stem-accents'", "'/lib/planet/approved-stem-accents'")
  .replace("'./mesh-surface'", "'./baseline-mesh.mjs'");
// Compile snapshots to JS so generated QA files do not enter the app's TS glob.
const snapshot = async (name, source) => fs.writeFile(path.join(output, name), (await transform(source, { loader: 'ts', format: 'esm' })).code);
await snapshot('baseline-mesh.mjs', meshSource);
await snapshot('baseline-accents.mjs', accentSource);
// One constructor timer; method timers run only in the separate profile pass.
await snapshot('profile-mesh.mjs', meshSource
  .replace('constructor(readonly meshes: THREE.Mesh[]) {', 'constructor(readonly meshes: THREE.Mesh[]) { const qaStart = performance.now();')
  .replace("if (!this.faces.length) throw new Error('No non-degenerate surface triangles.');", "if (!this.faces.length) throw new Error('No non-degenerate surface triangles.'); globalThis.__vineProfile.constructorMs += performance.now() - qaStart; globalThis.__vineProfile.triangles = this.faces.length;"));
await snapshot('profile-accents.mjs', accentSource.replace("'./baseline-mesh.mjs'", "'./profile-mesh.mjs'"));
const harness = path.join(output, 'harness.mjs');
await fs.writeFile(harness, `
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshSurface as BeforeSurface} from './baseline-mesh.mjs';
import {MeshSurface as AfterSurface} from '/lib/planet/mesh-surface';
import {MeshSurface as ProfileSurface} from './profile-mesh.mjs';
import {createSurfaceStemAccents as before} from './baseline-accents.mjs';
import {createSurfaceStemAccents as after} from '/lib/planet/surface-stem-accents';
import {createSurfaceStemAccents as profile} from './profile-accents.mjs';
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',value))].map(x=>x.toString(16).padStart(2,'0')).join('');
const textHash=value=>hash(new TextEncoder().encode(JSON.stringify(value)));
const bytes=await (await fetch('/spirits/jade-v002/body.glb')).arrayBuffer();
const gltf=await new GLTFLoader().parseAsync(bytes,'');
const outer=new THREE.Group(),model=gltf.scene;outer.add(model);model.position.x=-.42;model.scale.z=1.35;
let body;model.traverse(object=>{if(object.isMesh&&object.geometry.getAttribute('position').count===33207)body=object;});
body.morphTargetInfluences.fill(0);outer.updateWorldMatrix(true,true);
const meshId=new Map([[body,0]]),anchorData=a=>({mesh:meshId.get(a.mesh),triangle:a.triangle,barycentric:a.barycentric.toArray()});
const cloneAnchor=a=>({mesh:a.mesh,triangle:a.triangle,barycentric:a.barycentric.clone()});
async function effectsSnapshot(effect){
 const frames=[];model.add(effect.group);
 for(const time of [0,2.25,7.5]){effect.update(time);frames.push(effect.group.children.map(object=>({name:object.name,matrix:Array.from(object.instanceMatrix.array)})));}
 outer.rotation.set(.2,.6,0);outer.scale.set(1.2,.9,1.1);outer.updateWorldMatrix(true,true);effect.update(1.5);
 const transformed=effect.group.children.map(object=>Array.from(object.instanceMatrix.array));
 outer.rotation.set(0,0,0);outer.scale.set(1,1,1);outer.updateWorldMatrix(true,true);
 const geometry=effect.group.children.map(object=>({name:object.name,count:object.count,attributes:Object.fromEntries(Object.entries(object.geometry.attributes).map(([name,a])=>[name,{itemSize:a.itemSize,array:Array.from(a.array)}])),index:Array.from(object.geometry.index.array),material:object.material.toJSON()}));
 // Material UUIDs are identifiers; compare every material property with UUIDs removed.
 for(const object of geometry)delete object.material.uuid;
 return{diagnostics:effect.diagnostics,frameHash:await textHash(frames),transformedHash:await textHash(transformed),geometryMaterialHash:await textHash(geometry),counts:effect.group.children.map(o=>({name:o.name,count:o.count}))};
}
window.vineQA={
 async input(){return{threeRevision:THREE.REVISION,glbHash:await hash(bytes),positionHash:await hash(body.geometry.getAttribute('position').array),uvHash:await hash(body.geometry.getAttribute('uv').array),vertices:body.geometry.getAttribute('position').count,depth:model.scale.z};},
 profile(quality){
  const stats={constructorMs:0,triangles:0,pathMs:0,pathCalls:0,sampleMs:0,sampleCalls:0,resolveMs:0,resolveCalls:0,pathLengths:[]};globalThis.__vineProfile=stats;
  const saved=new Map();
  for(const method of ['path','sample','resolve']){const original=ProfileSurface.prototype[method];saved.set(method,original);ProfileSurface.prototype[method]=function(...args){const start=performance.now(),result=original.apply(this,args);stats[method+'Ms']+=performance.now()-start;stats[method+'Calls']++;if(method==='path')stats.pathLengths.push(result.length);return result;};}
  let effect;const start=performance.now();
  try{effect=profile('乙',{meshes:[body],quality});stats.totalMs=performance.now()-start;stats.otherMs=stats.totalMs-stats.constructorMs-stats.pathMs-stats.sampleMs-stats.resolveMs;return stats;}
  finally{effect?.dispose();for(const [method,original]of saved)ProfileSurface.prototype[method]=original;delete globalThis.__vineProfile;}
 },
 timing(quality,variant){const start=performance.now(),effect=(variant==='before'?before:after)('乙',{meshes:[body],quality});const ms=performance.now()-start;effect.dispose();return ms;},
 operationCounts(quality){
  const results=[];
  for(const create of [before,after]){const stats={normalCalls:0,closestCalls:0},getNormal=THREE.Triangle.prototype.getNormal,closestPoint=THREE.Triangle.prototype.closestPointToPoint;let effect;
   THREE.Triangle.prototype.getNormal=function(...args){stats.normalCalls++;return getNormal.apply(this,args);};
   THREE.Triangle.prototype.closestPointToPoint=function(...args){stats.closestCalls++;return closestPoint.apply(this,args);};
   try{effect=create('乙',{meshes:[body],quality});results.push(stats);}
   finally{effect?.dispose();THREE.Triangle.prototype.getNormal=getNormal;THREE.Triangle.prototype.closestPointToPoint=closestPoint;}}
  return results;
 },
 async equivalent(quality){
  const traces=[];
  for(const [Surface,create]of [[BeforeSurface,before],[AfterSurface,after]]){
   const paths=[],original=Surface.prototype.path;
   Surface.prototype.path=function(...args){const result=original.apply(this,args);paths.push(result.map(anchorData));return result;};
   let effect;try{effect=create('乙',{meshes:[body],quality});traces.push({pathHash:await textHash(paths),paths:paths.map(path=>path.length),...await effectsSnapshot(effect)});}
   finally{effect?.dispose();Surface.prototype.path=original;}
  }
  return traces;
 },
 async pathFixtures(){
  const results=[];
  const check=async(label,meshes,seeds,lengths)=>{
   meshes.forEach((mesh,i)=>meshId.set(mesh,i));const a=new BeforeSurface(meshes),b=new AfterSurface(meshes),rows=[];
   for(const seed of seeds){const initial=a.sample(seed),other=b.sample(seed);if(JSON.stringify(anchorData(initial))!==JSON.stringify(anchorData(other)))throw new Error(label+' sampled anchor changed');
    for(const length of lengths){const expected=a.path(cloneAnchor(initial),length,24).map(anchorData),actual=b.path(cloneAnchor(initial),length,24).map(anchorData);if(JSON.stringify(expected)!==JSON.stringify(actual))throw new Error(label+' exact path changed at seed '+seed+' length '+length);rows.push(expected);}}
   results.push({label,cases:seeds.length*lengths.length,hash:await textHash(rows)});
  };
  await check('real-B',[body],Array.from({length:24},(_,i)=>i*67+121),[0,.15,.5]);
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(2,2,4,4));plane.rotation.set(.2,.5,.1);plane.scale.set(1.3,.8,1.7);
  await check('indexed-boundary-plane',[plane],[1,31,90],[0,.01,.6,5]);
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(1,12,8).toNonIndexed());
  await check('non-indexed-sphere',[sphere],[1,31,90],[0,.01,.6,5]);
  const tieGeometry=new THREE.BufferGeometry();tieGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,0,1,0,-1,-1,0,1,-1,0,0,1,0,0,0,0,0,0,0,0,0,0],3));
  const tie=new THREE.Mesh(tieGeometry),other=new THREE.Mesh(new THREE.PlaneGeometry(2,2,2,2));other.position.z=2;
  await check('equal-distance-degenerate-multiple-mesh',[tie,other],[1,31,90],[0,.01,.6,5]);
  for(const mesh of [plane,sphere,tie,other]){mesh.geometry.dispose();mesh.material.dispose();}
  return results;
 }
};
`);
const server = await createServer({ root, configFile: false, logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 }, optimizeDeps: { noDiscovery: true },
  plugins: [{ name: 'vine-performance-qa', configureServer(s) {
    s.middlewares.use((req, res, next) => {
      if (req.url === '/__vine') {
        res.setHeader('Content-Type', 'text/html');
        res.end('<html><body><script type="module" src="/' + path.relative(root, harness).replaceAll('\\', '/') + '"></script></body></html>');
      } else next();
    });
  } }],
});
const results = [], profiles = [], equivalence = [], errors = [], outbound = [];
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
let browser, input, fixtures, environment;
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  const { chromium } = process.env.SAJU_QA_PLAYWRIGHT_PATH
    ? await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH).href) : await import('playwright');
  browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  environment = { browser: await browser.version(), node: process.version, three: JSON.parse(await fs.readFile(path.join(root, 'node_modules/three/package.json'), 'utf8')).version };
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(origin).origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
    outbound.push(url.origin); return route.abort();
  });
  await page.goto(origin + '__vine'); await page.waitForFunction(() => !!window.vineQA);
  input = await page.evaluate(() => window.vineQA.input());
  assert.equal(input.glbHash, '0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84');
  assert.equal(input.positionHash, 'f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b');
  assert.equal(input.uvHash, 'f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c');
  assert.equal(input.depth, 1.35);
  for (const quality of ['low', 'high']) for (let i = 0; i < 3; i++) profiles.push({ quality, ...await page.evaluate(quality => window.vineQA.profile(quality), quality) });
  for (const quality of ['low', 'high']) {
    const [before, after] = await page.evaluate(quality => window.vineQA.equivalent(quality), quality);
    assert.deepEqual(after, before, quality + ' exact path, matrices, geometry, material and diagnostics must match');
    equivalence.push({ quality, before, after });
    // Warm each variant twice, then alternate AB/BA for seven same-input pairs.
    for (let i = 0; i < 2; i++) for (const variant of ['before', 'after']) await page.evaluate(args => window.vineQA.timing(...args), [quality, variant]);
    const pairs = [];
    for (let i = 0; i < 7; i++) {
      const pair = { order: i % 2 ? ['after', 'before'] : ['before', 'after'] };
      for (const variant of pair.order) pair[variant] = await page.evaluate(args => window.vineQA.timing(...args), [quality, variant]);
      pairs.push(pair);
    }
    const beforeMedianMs = median(pairs.map(p => p.before)), afterMedianMs = median(pairs.map(p => p.after));
    results.push({ quality, pairs, beforeMedianMs, afterMedianMs, reductionPercent: (1 - afterMedianMs / beforeMedianMs) * 100 });
    if (phase === 'after') {
      assert(afterMedianMs < beforeMedianMs * .85, quality + ' must demonstrate at least 15% lower median construction time');
      assert(pairs.every(p => p.after < p.before), quality + ' every paired construction must improve');
    }
  }
  fixtures = await page.evaluate(() => window.vineQA.pathFixtures());
  // Prototype counters can affect JIT caches: never install them before timing.
  for (const result of results) {
    const [before, after] = await page.evaluate(quality => window.vineQA.operationCounts(quality), result.quality);
    result.operations = { before, after };
    assert.equal(after.closestCalls, before.closestCalls, 'Exact search candidates must be unchanged');
    if (phase === 'after') assert(after.normalCalls < before.normalCalls * .01, 'Duplicate triangle normal calculations must decrease by over 99%');
  }
  assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
  console.log(JSON.stringify({ status: 'PASS', phase, profiles, results, fixtures }));
} catch (error) { errors.push(error.stack || String(error)); process.exitCode = 1; console.error(error); }
finally {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ status: process.exitCode ? 'FAIL' : 'PASS', phase, baseline, environment, input, profiles, results, equivalence, fixtures, errors, outbound,
    limits: ['Same Chromium process and real neutral B GLB; synchronous effects creation only, excluding fetch/decode/render/dispose', 'Profiles instrument frozen baseline only; AB/BA timing uses uninstrumented modules', 'Two untimed warm-ups per variant and quality, seven paired samples; no mobile, cold-load, p95 or full-page claim', 'Original per-face arithmetic and strict tie order must be preserved; exact paths and rendered regression hashes are checked separately'] }, null, 2) + '\n');
  await browser?.close(); await server.close();
}
