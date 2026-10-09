// Actual Three/WebGL2 buffer lifecycle on the preserved B GLB. No DB or outbound traffic.
// A strong audit reference deliberately prevents GC from hiding missing explicit deleteBuffer calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const root = process.cwd(), phase = process.env.SAJU_QA_BUFFER_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/ten-stem-materials/buffers', phase);
await fs.mkdir(output, { recursive: true });
const harness = path.join(output, 'harness.mjs');
await fs.writeFile(harness, `
import * as THREE from 'three';
import {loadApprovedSpirit} from '../../../../lib/planet/approved-jade-spirit';
import {CHARACTER_REST_ATTRIBUTES} from '../../../../lib/planet/character-rest-coordinates';
import {createSurfaceStemAccents} from '../../../../lib/planet/surface-stem-accents';
const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false});renderer.setSize(360,420);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
document.body.append(renderer.domElement);
const gl=renderer.getContext(),records=new Map(),tags=new WeakMap();let serial=0,cycle=0;
const native={create:gl.createBuffer,bind:gl.bindBuffer,data:gl.bufferData,remove:gl.deleteBuffer};
gl.createBuffer=function(){const buffer=native.create.call(this);if(buffer)records.set(buffer,{id:++serial,bytes:0,deleteCalls:0,labels:[]});return buffer;};
gl.bufferData=function(target,data,...args){
 const binding=target===gl.ARRAY_BUFFER?gl.ARRAY_BUFFER_BINDING:gl.ELEMENT_ARRAY_BUFFER_BINDING;
 const buffer=gl.getParameter(binding),record=records.get(buffer);
 if(record){record.bytes=typeof data==='number'?data:data.byteLength;record.labels=tags.get(data)??record.labels;}
 return native.data.call(this,target,data,...args);
};
gl.deleteBuffer=function(buffer){const record=records.get(buffer);if(record)record.deleteCalls++;return native.remove.call(this,buffer);};
const scene=new THREE.Scene();scene.background=new THREE.Color('#edf2ea');
scene.add(new THREE.HemisphereLight(0xffffff,0x344333,1));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-3,4,4);scene.add(light);
const camera=new THREE.PerspectiveCamera(38,360/420,.1,40);camera.position.set(0,1.7,5.7);camera.lookAt(0,1.24,0);
const shaderErrors=[];renderer.debug.onShaderError=(context,program,vertex,fragment)=>shaderErrors.push({program:context.getProgramInfoLog(program),vertex:context.getShaderInfoLog(vertex),fragment:context.getShaderInfoLog(fragment)});
renderer.render(scene,camera);
window.bufferQA={async inspect(day,quality){
 const id=++cycle,loadStart=performance.now(),spirit=await loadApprovedSpirit(day,'병인',quality),loadMs=performance.now()-loadStart;scene.add(spirit.group);
 const body=spirit.bodyMesh,restExpected=CHARACTER_REST_ATTRIBUTES.filter(name=>body.geometry.getAttribute(name)).map(name=>({name,bytes:body.geometry.getAttribute(name).array.byteLength}));
 const tag=(attribute,name)=>{const data=attribute?.isInterleavedBufferAttribute?attribute.data:attribute;if(!data?.array)return;const labels=tags.get(data.array)??[];labels.push({cycle:id,name});tags.set(data.array,labels);};
 spirit.group.traverse(object=>{if(!object.geometry)return;for(const [name,attribute] of Object.entries(object.geometry.attributes))tag(attribute,(object===body?'body:':object.name+':')+name);tag(object.geometry.index,(object===body?'body:':object.name+':')+'index');if(object.isInstancedMesh)tag(object.instanceMatrix,object.name+':instanceMatrix');});
 spirit.update(1.5,0,camera);renderer.render(scene,camera);gl.finish();
 const owned=[...records.entries()].filter(([,record])=>record.labels.some(label=>label.cycle===id));
 const rest=owned.filter(([,record])=>record.labels.some(label=>label.cycle===id&&CHARACTER_REST_ATTRIBUTES.some(name=>label.name==='body:'+name)));
 const allocatedRest=rest.map(([,record])=>({id:record.id,bytes:record.bytes,names:record.labels.filter(label=>label.cycle===id).map(label=>label.name)}));
 const uploaded={ownedBuffers:owned.length,restBuffers:rest.length,restBytes:rest.reduce((sum,[,record])=>sum+record.bytes,0)};
 spirit.dispose();spirit.dispose();renderer.render(scene,camera);gl.finish();
 const alive=owned.filter(([buffer])=>gl.isBuffer(buffer));
 const remaining=alive.map(([,record])=>({id:record.id,bytes:record.bytes,deleteCalls:record.deleteCalls,names:record.labels.filter(label=>label.cycle===id).map(label=>label.name)}));
 return{day,quality,loadMs,threeRevision:THREE.REVISION,restExpected,allocatedRest,uploaded,remaining,remainingBytes:alive.reduce((sum,[,record])=>sum+record.bytes,0),deleteCounts:owned.map(([,record])=>record.deleteCalls),memory:{...renderer.info.memory},glError:gl.getError(),shaderErrors};
},async vineTiming(quality){
 const start=performance.now(),spirit=await loadApprovedSpirit('을축','병인',quality),loadMs=performance.now()-start;
 const constructionMs=[];
 try{for(let i=0;i<3;i++){const before=performance.now(),effect=createSurfaceStemAccents('乙',{meshes:[spirit.bodyMesh],quality});constructionMs.push(performance.now()-before);effect.dispose();}}
 finally{spirit.dispose();}
 return{quality,loadMs,constructionMs,vertices:33207,samples:3,scope:'Separate real surface-accent construction on an already loaded neutral B mesh. Constructor includes MeshSurface/path/initial update, excludes network/GLB decode/GPU render. loadMs includes local fetch, embedded image decode, rest binding and accents.'};
},summary(){const owned=[...records.entries()].filter(([,record])=>record.labels.length);return{createdOwnedBuffers:owned.length,aliveOwnedBuffers:owned.filter(([buffer])=>gl.isBuffer(buffer)).length,undeletedOwnedBytes:owned.filter(([buffer])=>gl.isBuffer(buffer)).reduce((sum,[,record])=>sum+record.bytes,0)};}};
`);
const server = await createServer({ root, configFile: false, logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 }, optimizeDeps: { noDiscovery: true },
  plugins: [{ name: 'buffer-lifecycle-qa', configureServer(s) {
    s.middlewares.use((req, res, next) => {
      if (req.url === '/__buffers') {
        res.setHeader('Content-Type', 'text/html');
        res.end('<html><body><script type="module" src="/' + path.relative(root, harness).replaceAll('\\', '/') + '"></script></body></html>');
      } else next();
    });
  } }],
});
const results = [], errors = [], outbound = [], vineTimings = [];
let browser, bufferSummary;
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  const { chromium } = process.env.SAJU_QA_PLAYWRIGHT_PATH
    ? await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH).href) : await import('playwright');
  browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(origin).origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
    outbound.push(url.origin); return route.abort();
  });
  await page.goto(origin + '__buffers'); await page.waitForFunction(() => !!window.bufferQA);
  const keys = process.env.SAJU_QA_BUFFER_SMOKE ? ['갑자'] : ['갑자', '을축', '병인', '정묘', '무진', '기사', '경오', '신미', '임신', '계유'];
  for (const quality of (process.env.SAJU_QA_BUFFER_SMOKE ? ['high'] : ['low', 'high'])) for (const day of keys) {
    const result = await page.evaluate(args => window.bufferQA.inspect(...args), [day, quality]); results.push(result);
    assert.equal(result.threeRevision, '186');
    const expectedRestCount = day[0] === '기' ? 0 : 4;
    assert.equal(result.restExpected.length, expectedRestCount, 'Rest binding must exist before uploading the real body');
    assert.equal(result.uploaded.restBuffers, expectedRestCount, 'Every bound rest attribute must actually reach a WebGL buffer');
    assert.equal(result.uploaded.restBytes, expectedRestCount * 33207 * 3 * 4);
    assert.equal(result.memory.geometries, 0);
    assert.deepEqual(result.remaining, [], 'Disposed spirit must delete every uploaded model/effect/instance buffer');
    assert(result.deleteCounts.every(count => count === 1), 'Repeat disposal must delete each owned buffer exactly once');
    assert.equal(result.glError, 0); assert.deepEqual(result.shaderErrors, []);
  }
  bufferSummary = await page.evaluate(() => window.bufferQA.summary());
  assert.equal(bufferSummary.aliveOwnedBuffers, 0); assert.equal(bufferSummary.undeletedOwnedBytes, 0);
  assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
  if (!process.env.SAJU_QA_BUFFER_SMOKE) for (const quality of ['low', 'high']) vineTimings.push(await page.evaluate(quality => window.bufferQA.vineTiming(quality), quality));
  console.log(JSON.stringify({ status: 'PASS', cases: results.length, bufferSummary }));
} catch (error) { errors.push(error.stack || String(error)); process.exitCode = 1; console.error(error); }
finally {
  const threeVersion = JSON.parse(await fs.readFile(path.join(root, 'node_modules/three/package.json'), 'utf8')).version;
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ status: process.exitCode ? 'FAIL' : 'PASS', phase, threeVersion, cases: results.length, results, bufferSummary, vineTimings, errors, outbound,
    limits: ['Chromium SwiftShader with actual production loader/GLB/PNGs', 'Strong audit references keep WebGLBuffer wrappers alive to measure deterministic explicit deletion, not browser GC behavior', 'Physical mobile GPU and driver GC timing not tested'] }, null, 2) + '\n');
  await browser?.close(); await server.close();
}
